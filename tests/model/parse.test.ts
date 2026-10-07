import { describe, expect, it } from "vitest";
import { createLevel, createProject } from "@/model/factory";
import { parseProject } from "@/model/parse";
import { DEFAULT_ABILITIES, HERO_PICTURES, pictureRows, withPicture } from "@/model/hero";
import { designFrames } from "@/model/designs";
import { DEFAULT_PLAYER, type Project } from "@/model/schema";
import { testHero, testOldHero, testPack } from "../fixtures/testPack";

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
    expect(errorOf({ ...project(), formatVersion: 5 })).toMatch(/newer version/);
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
    const bad = { ...p, hero: { ...p.hero, look: withPicture(p.hero.look, "shot", ["1"]) } };
    expect(errorOf(bad)).toMatch(/The hero's Shot frame 1 is not 6 by 4 pixels\./);
  });

  it("is refused when a pixel names a colour the hero does not have", () => {
    const p = project();
    const stand = pictureRows(p.hero.look, "stand").map((row) => row.replace(/1/g, "2"));
    const bad = { ...p, hero: { ...p.hero, look: withPicture(p.hero.look, "stand", stand) } };
    expect(errorOf(bad)).toMatch(/The hero's Stand frame 1 uses colour 2/);
  });

  it("is refused when an ability is not a step", () => {
    const p = project();
    expect(errorOf({ ...p, hero: { ...p.hero, abilities: { ...p.hero.abilities, jump: 9 } } })).toMatch(/hero\.abilities\.jump/);
  });
});

describe("format 3 games", () => {
  // A format 3 game: the hero, one enemy and a boss in the old picture shapes.
  function format3(): Record<string, unknown> {
    const frame = (w: number, h: number, ch: string) => Array.from({ length: h }, () => ch.repeat(w));
    return {
      ...project(),
      formatVersion: 3,
      hero: { abilities: DEFAULT_ABILITIES, look: testOldHero },
      enemies: [
        {
          id: "e1",
          name: "Frost Fang",
          behaviour: "jumper",
          tuning: { health: 1, damage: "normal", speed: "normal", shoots: "sometimes" },
          look: { colours: [13], frames: [frame(16, 16, "1"), frame(16, 16, ".")] },
        },
      ],
      boss: { name: "Volt Viper", fight: "normal", attacks: ["jump", "dash"], look: { colours: [13], frames: [frame(24, 28, "1"), frame(24, 28, "."), frame(24, 28, "1")] } },
    };
  }

  it("upgrade to format 4 with every picture where it was read from", () => {
    const result = parseProject(format3(), getPack);
    if (!result.ok) throw new Error(result.error);
    const { project: upgraded } = result;
    expect(upgraded.formatVersion).toBe(4);
    for (const picture of HERO_PICTURES) {
      const old = picture === "shot" ? testOldHero.shot : picture === "chargedShot" ? testOldHero.chargedShot : testOldHero.poses[picture];
      expect(pictureRows(upgraded.hero.look, picture), picture).toEqual(old);
    }
    const old = format3() as { enemies: { look: { frames: string[][] } }[]; boss: { look: { frames: string[][] } } };
    expect(designFrames("jumper", upgraded.enemies[0].look)).toEqual(old.enemies[0].look.frames);
    expect(designFrames("boss", upgraded.boss!.look)).toEqual(old.boss.look.frames);
  });

  it("upgrade a format 1 game without converting the pack's hero twice", () => {
    const result = parseProject({ ...format3(), formatVersion: 1, hero: undefined, enemies: undefined, boss: undefined, player: {} }, getPack);
    if (!result.ok) throw new Error(result.error);
    expect(result.project.hero.look).toEqual(testPack.hero);
  });

  it("refuse a broken look with a plain message", () => {
    const doc = { ...project(), hero: { ...project().hero, look: { ...project().hero.look, shotY: 40 } } };
    expect(errorOf(doc)).toContain("The hero's shot point is outside its hitbox.");
  });
});
