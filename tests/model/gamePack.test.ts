import { describe, expect, it } from "vitest";
import { defaultTuning, type EnemyDesign } from "@/model/designs";
import { createLevel, createProject } from "@/model/factory";
import { gamePack, ownType } from "@/model/gamePack";
import { parseProject } from "@/model/parse";
import type { Project } from "@/model/schema";
import { structureProblems } from "@/model/validate";
import { testPack } from "../fixtures/testPack";

const solid = (ch = "1") => Array.from({ length: 16 }, () => ch.repeat(16));
const fang: EnemyDesign = {
  id: "e1",
  name: "Frost Fang",
  behaviour: "walker",
  tuning: { ...defaultTuning("walker"), speed: "fast" },
  look: { colours: [13], frames: [solid(), solid()] },
};

function game(enemies: EnemyDesign[] = [fang]): Project {
  return {
    ...createProject({ id: "p1", name: "Game" }, testPack),
    levels: [createLevel({ id: "L1", name: "Stage", zoneIds: ["z1", "corridor", "boss"] }, testPack)],
    enemies,
  };
}

const withPlaced = (project: Project, type: string): Project => {
  const level = project.levels[0];
  const zones = level.zones.map((z, i) => (i === 0 ? { ...z, things: [{ id: "t1", type, x: 3, y: 12, settings: {} }] } : z));
  return { ...project, levels: [{ ...level, zones }] };
};

describe("gamePack", () => {
  it("adds each enemy design as a thing type of its own, first", () => {
    const pack = gamePack(game(), testPack);
    expect(pack.things[0]).toEqual({
      type: "own-e1",
      name: "Frost Fang",
      category: "enemy",
      behaviour: "walker",
      description: "Yours",
      defaults: { health: 1, damage: 2, speed: 0.75 },
      own: true,
    });
    expect(pack.things.slice(1)).toEqual(testPack.things);
    expect(ownType("e1")).toBe("own-e1");
  });

  it("is the content pack itself when the game has no designs", () => {
    expect(gamePack(game([]), testPack)).toBe(testPack);
  });

  it("never adds a design twice, even when given a game pack", () => {
    const once = gamePack(game(), testPack);
    expect(gamePack(game(), once).things).toEqual(once.things);
  });
});

describe("designs in the game file", () => {
  const getPack = (id: string) => (id === "test" ? testPack : undefined);

  it("start empty in a new game", () => {
    const project = createProject({ id: "p1", name: "Game" }, testPack);
    expect(project.formatVersion).toBe(3);
    expect(project.enemies).toEqual([]);
    expect(project.boss).toBeNull();
  });

  it("let a placed own enemy pass validation, and refuse one with no design", () => {
    expect(structureProblems(withPlaced(game(), "own-e1"), testPack)).toEqual([]);
    expect(structureProblems(withPlaced(game([]), "own-e1"), testPack)).toContainEqual(
      expect.stringMatching(/unknown thing type "own-e1"/),
    );
  });

  it("refuse broken frames, and two enemies with one id or name", () => {
    const broken: EnemyDesign = { ...fang, look: { colours: [13], frames: [solid(), ["1"]] } };
    expect(structureProblems(game([broken]), testPack)).toContain("Frost Fang frame 2 is not 16 by 16 pixels.");
    expect(structureProblems(game([fang, { ...fang, name: "Other" }]), testPack)).toContain(
      'Two enemies share the id "e1".',
    );
    expect(structureProblems(game([fang, { ...fang, id: "e2", name: " frost  FANG " }]), testPack)).toContain(
      'Two enemies are called "Frost Fang".',
    );
  });

  it("are refused when a file's design is broken", () => {
    const raw = JSON.parse(JSON.stringify(game([{ ...fang, look: { colours: [13], frames: [solid("2"), solid()] } }])));
    const result = parseProject(raw, getPack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Frost Fang frame 1 uses colour 2/);
  });

  it("are added, empty, to a version 2 game", () => {
    const doc = JSON.parse(JSON.stringify(game([])));
    delete doc.enemies;
    delete doc.boss;
    const result = parseProject({ ...doc, formatVersion: 2 }, getPack);
    expect(result).toEqual({ ok: true, project: game([]) });
  });
});
