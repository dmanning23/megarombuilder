import { describe, expect, it } from "vitest";
import { createLevel, createProject } from "@/model/factory";
import { parseProject } from "@/model/parse";
import { DEFAULT_ABILITIES } from "@/model/hero";
import { DEFAULT_PLAYER, type Project } from "@/model/schema";
import { testHero, testPack } from "../fixtures/testPack";

const getPack = (id: string) => (id === "test" ? testPack : undefined);

function project(): Project {
  return {
    ...createProject({ id: "p1", name: "Game" }, testPack),
    levels: [createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack)],
  };
}

function errorOf(raw: unknown): string {
  const result = parseProject(raw, getPack);
  if (result.ok) throw new Error("expected a failure");
  return result.error;
}

describe("parseProject", () => {
  it("round-trips a project through JSON", () => {
    const original = project();
    const result = parseProject(JSON.parse(JSON.stringify(original)), getPack);
    expect(result).toEqual({ ok: true, project: original });
  });

  it("refuses things that are not a project file", () => {
    for (const raw of ["hello", null, undefined, 42, [1, 2, 3]]) {
      expect(errorOf(raw)).toMatch(/not a MegaRomBuilder project/);
    }
  });

  it("refuses an object with no format version", () => {
    expect(errorOf({ name: "x" })).toMatch(/not a MegaRomBuilder project/);
  });

  it("refuses a project from a newer version", () => {
    expect(errorOf({ ...project(), formatVersion: 4 })).toMatch(/newer version/);
  });

  it("explains which field is wrong when the shape is bad", () => {
    const bad = { ...project(), name: 5 };
    expect(errorOf(bad)).toMatch(/name/);
  });

  it("refuses names longer than the editor allows, and empty names", () => {
    const p = project();
    const long = p.levels[0].zones.map((z, i) => (i === 0 ? { ...z, name: "x".repeat(41) } : z));
    expect(errorOf({ ...p, levels: [{ ...p.levels[0], zones: long }] })).toMatch(/zones\.0\.name/);
    expect(errorOf({ ...p, levels: [{ ...p.levels[0], name: "" }] })).toMatch(/levels\.0\.name/);
  });

  it("refuses a project whose content pack is missing", () => {
    expect(errorOf({ ...project(), contentPackId: "lava" })).toMatch(/content pack "lava"/);
  });

  it("refuses a project that breaks a hard rule", () => {
    const p = project();
    const zones = p.levels[0].zones.map((z, i) => (i === 0 ? { ...z, tiles: [0] } : z));
    const bad = { ...p, levels: [{ ...p.levels[0], zones }] };
    expect(errorOf(bad)).toMatch(/has 1 tiles but its size needs 240/);
  });
});

// The same game as saved before heroes: format 1, with physics numbers instead of a hero.
function versionOne(player: unknown = DEFAULT_PLAYER): Record<string, unknown> {
  const doc = JSON.parse(JSON.stringify(project()));
  delete doc.hero;
  return { ...doc, formatVersion: 1, player };
}

describe("upgrading games saved before heroes", () => {
  it("gives a version 1 game the pack's hero with normal abilities", () => {
    const result = parseProject(versionOne(), getPack);
    expect(result).toEqual({ ok: true, project: project() });
    if (result.ok) {
      expect(result.project.hero.abilities).toEqual(DEFAULT_ABILITIES);
      expect(result.project.hero.look).toEqual(testHero);
      expect(result.project).not.toHaveProperty("player");
    }
  });

  it("keeps faster or stronger settings as the nearest steps", () => {
    const result = parseProject(versionOne({ ...DEFAULT_PLAYER, runSpeed: 2, maxHealth: 40 }), getPack);
    expect(result.ok && result.project.hero.abilities).toMatchObject({ speed: "veryFast", health: "tough" });
  });

  it("says when a version 1 game's content pack is missing", () => {
    expect(errorOf({ ...versionOne(), contentPackId: "lava" })).toMatch(/content pack "lava"/);
  });
});

describe("a game's hero", () => {
  it("is refused when a picture is broken", () => {
    const p = project();
    const bad = { ...p, hero: { ...p.hero, look: { ...p.hero.look, shot: ["1"] } } };
    expect(errorOf(bad)).toMatch(/The hero: Shot is 1 by 1 pixels, not 6 by 4\./);
  });

  it("is refused when a pixel names a colour the hero does not have", () => {
    const p = project();
    const stand = p.hero.look.poses.stand.map((row) => row.replace(/1/g, "2"));
    const bad = { ...p, hero: { ...p.hero, look: { ...p.hero.look, poses: { ...p.hero.look.poses, stand } } } };
    expect(errorOf(bad)).toMatch(/The hero: Stand uses colour 2/);
  });

  it("is refused when an ability is not a step", () => {
    const p = project();
    expect(errorOf({ ...p, hero: { ...p.hero, abilities: { ...p.hero.abilities, jump: 9 } } })).toMatch(/hero\.abilities\.jump/);
  });
});
