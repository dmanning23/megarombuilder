import { describe, expect, it } from "vitest";
import { createLevel, createProject, createZone } from "@/model/factory";
import { tileIndex } from "@/model/geometry";
import { DEFAULT_ABILITIES } from "@/model/hero";
import { DEFAULT_PLAYER, projectSchema } from "@/model/schema";
import { testHero, testPack } from "../fixtures/testPack";

describe("createZone", () => {
  it("gives a horizontal zone a two-row floor and side openings", () => {
    const zone = createZone({ id: "z", name: "Snowy Path", screens: 2 }, testPack);
    const size = { width: 32, height: 15 };
    expect(zone.tiles).toHaveLength(480);
    expect(zone.tiles[tileIndex(size, 0, 12)]).toBe(0);
    expect(zone.tiles[tileIndex(size, 0, 13)]).toBe(1);
    expect(zone.tiles[tileIndex(size, 31, 14)]).toBe(1);
    expect(zone.entry).toEqual({ edge: "left", from: 9, to: 12 });
    expect(zone.exit).toEqual({ edge: "right", from: 9, to: 12 });
    expect(zone.kind).toBe("normal");
    expect(zone.variant).toBe("outdoor");
    expect(zone.intent).toBe("");
  });

  it("gives a vertical zone no floor and openings bottom and top", () => {
    const zone = createZone({ id: "z", name: "Climb", scroll: "vertical", screens: 2 }, testPack);
    expect(zone.tiles).toHaveLength(480);
    expect(zone.tiles.every((t) => t === 0)).toBe(true);
    expect(zone.entry).toEqual({ edge: "bottom", from: 7, to: 8 });
    expect(zone.exit).toEqual({ edge: "top", from: 7, to: 8 });
  });

  it("gives the boss room no exit", () => {
    const zone = createZone({ id: "b", name: "Boss Room", kind: "bossRoom" }, testPack);
    expect(zone.exit).toBeNull();
  });
});

describe("createLevel", () => {
  it("makes a start zone, a boss corridor and a boss room", () => {
    const level = createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack);
    expect(level.zones.map((z) => z.id)).toEqual(["a", "b", "c"]);
    expect(level.zones.map((z) => z.kind)).toEqual(["normal", "bossCorridor", "bossRoom"]);
    expect(level.zones.map((z) => z.name)).toEqual(["Zone 1", "Boss Corridor", "Boss Room"]);
    expect(level.brief).toBe("");
    expect(level.checkpoints).toEqual([]);
  });
});

describe("createProject", () => {
  it("produces a document the schema accepts", () => {
    const project = createProject({ id: "p1", name: "My Game" }, testPack);
    const withLevel = {
      ...project,
      levels: [createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack)],
    };
    expect(projectSchema.safeParse(withLevel).success).toBe(true);
    expect(project.contentPackId).toBe("test");
    expect(project.chat).toEqual([]);
  });

  it("uses the spec's default player numbers", () => {
    expect(DEFAULT_PLAYER).toEqual({
      runSpeed: 1.375,
      jumpVelocity: 4.875,
      gravity: 0.25,
      maxFallSpeed: 7,
      ladderSpeed: 1.25,
      maxHealth: 28,
      maxShots: 3,
      slide: false,
      chargeShot: false,
    });
  });
  it("gives a new game the pack's hero with normal abilities", () => {
    const project = createProject({ id: "p1", name: "My Game" }, testPack);
    expect(project.formatVersion).toBe(4);
    expect(project.hero).toEqual({ abilities: DEFAULT_ABILITIES, look: testHero });
    expect(project).not.toHaveProperty("player");
  });
});

describe("projectSchema", () => {
  it("rejects a document with the wrong format version", () => {
    const project = { ...createProject({ id: "p1", name: "My Game" }, testPack), formatVersion: 5 };
    expect(projectSchema.safeParse(project).success).toBe(false);
  });

  it("rejects a zone with a missing field", () => {
    const project = createProject({ id: "p1", name: "My Game" }, testPack);
    const level = createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack);
    const broken: Record<string, unknown> = { ...level.zones[0] };
    delete broken.intent;
    const bad = { ...project, levels: [{ ...level, zones: [broken, level.zones[1], level.zones[2]] }] };
    expect(projectSchema.safeParse(bad).success).toBe(false);
  });
});
