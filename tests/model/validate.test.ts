import { describe, expect, it } from "vitest";
import { createLevel, createProject } from "@/model/factory";
import type { Level, Project, Zone } from "@/model/schema";
import { chainProblems, structureProblems } from "@/model/validate";
import { testPack } from "../fixtures/testPack";

function project(): Project {
  return {
    ...createProject({ id: "p1", name: "Game" }, testPack),
    levels: [createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack)],
  };
}

function withZone(p: Project, index: number, patch: Partial<Zone>): Project {
  const level = p.levels[0];
  const zones = level.zones.map((z, i) => (i === index ? { ...z, ...patch } : z));
  return { ...p, levels: [{ ...level, zones }] };
}

function withLevel(p: Project, patch: Partial<Level>): Project {
  return { ...p, levels: [{ ...p.levels[0], ...patch }] };
}

describe("structureProblems", () => {
  it("finds nothing wrong with a fresh project", () => {
    expect(structureProblems(project(), testPack)).toEqual([]);
  });

  it("reports a tile grid of the wrong length", () => {
    const problems = structureProblems(withZone(project(), 0, { tiles: [0, 0, 0] }), testPack);
    expect(problems.join(" ")).toMatch(/has 3 tiles but its size needs 240/);
  });

  it("reports a tile the pack does not have", () => {
    const tiles = project().levels[0].zones[0].tiles.slice();
    tiles[0] = 99;
    const problems = structureProblems(withZone(project(), 0, { tiles }), testPack);
    expect(problems.join(" ")).toMatch(/tile that is not in the content pack/);
  });

  it("reports a level that does not end in corridor then boss room", () => {
    const p = project();
    const [a, b, c] = p.levels[0].zones;
    const problems = structureProblems(withLevel(p, { zones: [a, c, b] }), testPack);
    expect(problems.join(" ")).toMatch(/must end with a boss corridor and then a boss room/);
  });

  it("reports fewer than three zones", () => {
    const p = project();
    const problems = structureProblems(withLevel(p, { zones: p.levels[0].zones.slice(1) }), testPack);
    expect(problems.join(" ")).toMatch(/at least three zones/);
  });

  it("reports zone names that differ only by case and spaces", () => {
    const problems = structureProblems(withZone(project(), 0, { name: " boss ROOM " }), testPack);
    expect(problems.join(" ")).toMatch(/more than one zone called/);
  });

  it("reports a boss zone that is not one horizontal screen", () => {
    const problems = structureProblems(withZone(project(), 2, { screens: 2 }), testPack);
    expect(problems.join(" ")).toMatch(/must be one horizontal screen/);
  });

  it("reports a thing outside the zone", () => {
    const things = [{ id: "t1", type: "walker", x: 16, y: 0, settings: {} }];
    const problems = structureProblems(withZone(project(), 0, { things }), testPack);
    expect(problems.join(" ")).toMatch(/outside the zone/);
  });

  it("reports a thing type the pack does not have", () => {
    const things = [{ id: "t1", type: "dragon", x: 1, y: 1, settings: {} }];
    const problems = structureProblems(withZone(project(), 0, { things }), testPack);
    expect(problems.join(" ")).toMatch(/unknown thing type "dragon"/);
  });

  it("reports an entry on the right edge and an exit on the left edge", () => {
    const p = withZone(project(), 0, {
      entry: { edge: "right", from: 9, to: 12 },
      exit: { edge: "left", from: 9, to: 12 },
    });
    const text = structureProblems(p, testPack).join(" ");
    expect(text).toMatch(/entry cannot be on the right edge/);
    expect(text).toMatch(/exit cannot be on the left edge/);
  });

  it("reports an opening that runs off its edge", () => {
    const p = withZone(project(), 0, { exit: { edge: "right", from: 12, to: 15 } });
    expect(structureProblems(p, testPack).join(" ")).toMatch(/only has positions 0 to 14/);
  });

  it("reports a normal zone with no exit and a boss room with one", () => {
    const noExit = structureProblems(withZone(project(), 0, { exit: null }), testPack);
    expect(noExit.join(" ")).toMatch(/needs an exit/);
    const bossExit = structureProblems(
      withZone(project(), 2, { exit: { edge: "right", from: 9, to: 12 } }),
      testPack,
    );
    expect(bossExit.join(" ")).toMatch(/boss room cannot have an exit/);
  });

  it("reports a checkpoint in a zone that does not exist", () => {
    const p = withLevel(project(), { checkpoints: [{ zoneId: "gone", x: 1, y: 1 }] });
    expect(structureProblems(p, testPack).join(" ")).toMatch(/checkpoint is in a zone that does not exist/);
  });

  it("reports a zone name with extra spaces", () => {
    for (const name of ["  Snowy Path", "Snowy  Path"]) {
      const problems = structureProblems(withZone(project(), 0, { name }), testPack);
      expect(problems.join(" ")).toMatch(/name with extra spaces/);
    }
  });

  it("reports zone names that differ only by spaces inside them", () => {
    const problems = structureProblems(withZone(project(), 0, { name: "Boss  Room" }), testPack);
    expect(problems.join(" ")).toMatch(/more than one zone called/);
  });

  it("reports two checkpoints in the same place", () => {
    const spot = { zoneId: "a", x: 1, y: 1 };
    const p = withLevel(project(), { checkpoints: [spot, { ...spot }] });
    expect(structureProblems(p, testPack).join(" ")).toMatch(/two checkpoints at \(1, 1\)/);
  });

  it("reports an entry and exit that overlap", () => {
    const p = withZone(project(), 0, {
      entry: { edge: "top", from: 3, to: 5 },
      exit: { edge: "top", from: 5, to: 6 },
    });
    expect(structureProblems(p, testPack).join(" ")).toMatch(/entry and exit overlap on the top edge/);
  });

  it("reports a project built for a different content pack", () => {
    const p = { ...project(), contentPackId: "lava" };
    expect(structureProblems(p, testPack).join(" ")).toMatch(/content pack "lava"/);
  });
});

describe("chainProblems", () => {
  it("finds nothing wrong with the default chain", () => {
    expect(chainProblems(project().levels[0])).toEqual([]);
  });

  it("reports an exit that does not pair with the next entry", () => {
    const p = withZone(project(), 0, { exit: { edge: "top", from: 7, to: 8 } });
    expect(chainProblems(p.levels[0]).join(" ")).toMatch(
      /"Zone 1" exits on its top edge, so "Boss Corridor" must be entered from its bottom edge/,
    );
  });

  it("reports paired openings of different lengths", () => {
    const p = withZone(project(), 0, { exit: { edge: "right", from: 9, to: 10 } });
    expect(chainProblems(p.levels[0]).join(" ")).toMatch(/2 tiles long.*4 tiles long/);
  });
});
