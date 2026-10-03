import { describe, expect, it } from "vitest";
import { checkLevel, checkZone } from "@/checker/check";
import { createDemoProject, DEMO_LEVEL_ID } from "@/content/demo";
import { snowPack } from "@/content/snow/pack";
import type { Project, Thing } from "@/model/schema";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, thing, type ZoneArt } from "../runtime/helpers";

// A level whose boss room holds the given things.
function withBossRoom(zones: ZoneArt[], bossThings: Thing[]): Project {
  const project = projectFromArt(zones);
  const level = project.levels[0];
  const last = level.zones.length - 1;
  const zonesOut = level.zones.map((z, i) => (i === last ? { ...z, things: bossThings } : z));
  return { ...project, levels: [{ ...level, zones: zonesOut }] };
}

const oneBoss = [thing("boss", 12, 12)];

describe("checkZone", () => {
  it("passes a crossable zone and rates it", () => {
    const result = checkZone(projectFromArt([{ art: flatArt() }]), "L1", "z1", testPack);
    expect(result).toEqual({
      zoneId: "z1",
      name: "Zone 1",
      passable: true,
      difficulty: 1,
      reason: null,
      furthest: null,
      warnings: [],
    });
  });

  it("explains an impassable zone and says where the player gets stuck, in tiles", () => {
    const row = "######....######";
    const result = checkZone(projectFromArt([{ art: flatArt({ 13: row, 14: row }) }]), "L1", "z1", testPack);
    expect(result.passable).toBe(false);
    expect(result.reason).toMatch(/gap 4 tiles wide at column 6/);
    expect(result.furthest).toEqual({ x: 5, y: 12 });
  });

  it("explains a zone the player cannot even start in", () => {
    const art = Array.from({ length: 30 }, () => ".".repeat(16));
    const project = projectFromArt([{ art, entry: { edge: "bottom", from: 7, to: 8 }, exit: { edge: "top", from: 7, to: 8 } }]);
    const result = checkZone(project, "L1", "z1", testPack);
    expect(result.passable).toBe(false);
    expect(result.reason).toBe("The player has nothing to stand on or climb where they arrive.");
  });

  it("warns about an enemy right where the player arrives", () => {
    const project = projectFromArt([{ art: flatArt(), things: [thing("walker", 2, 12)] }]);
    expect(checkZone(project, "L1", "z1", testPack).warnings).toEqual([
      "The Walker at (2, 12) is right where the player arrives.",
    ]);
  });

  it("warns about an enemy right next to a checkpoint", () => {
    const project = projectFromArt(
      [{ art: flatArt(), things: [thing("walker", 9, 12)] }],
      [{ zoneId: "z1", x: 8, y: 12 }],
    );
    expect(checkZone(project, "L1", "z1", testPack).warnings).toEqual([
      "The Walker at (9, 12) is right next to a checkpoint.",
    ]);
  });

  it("throws for a zone that does not exist", () => {
    expect(() => checkZone(projectFromArt([{ art: flatArt() }]), "L1", "zz", testPack)).toThrow(
      /no zone with id "zz"/,
    );
  });
});

describe("checkLevel", () => {
  it("checks every zone", () => {
    const result = checkLevel(withBossRoom([{ art: flatArt() }], oneBoss), "L1", testPack);
    expect(result.zones.map((z) => z.zoneId)).toEqual(["z1", "corridor", "boss"]);
    expect(result.zones.every((z) => z.passable)).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it("reports a boss room with no boss", () => {
    expect(checkLevel(projectFromArt([{ art: flatArt() }]), "L1", testPack).problems).toContain(
      'The boss room "Boss Room" has no boss, so the level can never be won.',
    );
  });

  it("reports a boss room with two bosses", () => {
    const result = checkLevel(withBossRoom([{ art: flatArt() }], [thing("boss", 4, 12), thing("boss", 12, 12)]), "L1", testPack);
    expect(result.problems).toContain('The boss room "Boss Room" has 2 bosses. It should have exactly one.');
  });

  it("reports a boss outside the boss room", () => {
    const result = checkLevel(withBossRoom([{ art: flatArt(), things: [thing("boss", 8, 12)] }], oneBoss), "L1", testPack);
    expect(result.problems).toContain('"Zone 1" has a boss in it. Bosses belong in the boss room.');
  });

  it("reports a boss with nothing under it", () => {
    const project = withBossRoom([{ art: flatArt() }], oneBoss);
    const level = project.levels[0];
    const room = level.zones[2];
    const holed = { ...room, tiles: room.tiles.map((t, i) => (i % 16 >= 10 && i % 16 <= 14 ? 0 : t)) };
    const broken = { ...project, levels: [{ ...level, zones: [level.zones[0], level.zones[1], holed] }] };
    expect(checkLevel(broken, "L1", testPack).problems).toContain(
      'The boss in "Boss Room" has nothing to stand on.',
    );
  });

  it("includes connection problems between zones", () => {
    const result = checkLevel(withBossRoom([{ art: flatArt(), exit: { edge: "top", from: 4, to: 5 } }], oneBoss), "L1", testPack);
    expect(result.problems.join(" ")).toMatch(/must be entered from its bottom edge/);
  });

  it("passes every zone of the demo level with no problems", () => {
    const result = checkLevel(createDemoProject(), DEMO_LEVEL_ID, snowPack);
    expect(result.zones.filter((z) => !z.passable)).toEqual([]);
    expect(result.problems).toEqual([]);
  });
});
