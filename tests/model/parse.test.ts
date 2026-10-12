import { describe, expect, it } from "vitest";
import { createLevel, createProject } from "@/model/factory";
import { parseProject } from "@/model/parse";
import { DEFAULT_ABILITIES, HERO_PICTURES, pictureRows, withPicture } from "@/model/hero";
import { designFrames } from "@/model/designs";
import { KINDS, type Look, type LookKind } from "@/model/look";
import { centreRows } from "@/model/lookUpgrade";
import { DEFAULT_PLAYER, FORMAT_VERSION, type Project } from "@/model/schema";
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
    expect(errorOf({ ...project(), formatVersion: 7 })).toMatch(/newer version/);
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

  it("upgrade to the current format with every picture where it was read from", () => {
    const result = parseProject(format3(), getPack);
    if (!result.ok) throw new Error(result.error);
    const { project: upgraded } = result;
    expect(upgraded.formatVersion).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(6);
    for (const picture of HERO_PICTURES) {
      const old = picture === "shot" ? testOldHero.shot : picture === "chargedShot" ? testOldHero.chargedShot : testOldHero.poses[picture];
      expect(pictureRows(upgraded.hero.look, picture), picture).toEqual(old);
    }
    const old = format3() as { enemies: { look: { frames: string[][] } }[]; boss: { look: { frames: string[][] } } };
    expect(designFrames("jumper", upgraded.enemies[0].look)).toEqual(old.enemies[0].look.frames);
    expect(designFrames("boss", upgraded.boss!.look)).toEqual(old.boss.look.frames);
  });

  it("refuse a damaged format 3 hero without throwing", () => {
    for (const chargedShot of [[], ["1".repeat(20)], "nope"]) {
      const doc = { ...format3(), hero: { abilities: DEFAULT_ABILITIES, look: { ...testOldHero, chargedShot } } };
      expect(parseProject(doc, getPack).ok, JSON.stringify(chargedShot)).toBe(false);
    }
  });

  it("upgrade a format 1 game without converting the pack's hero twice", () => {
    const result = parseProject({ ...format3(), formatVersion: 1, hero: undefined, enemies: undefined, boss: undefined, player: {} }, getPack);
    if (!result.ok) throw new Error(result.error);
    expect(result.project.hero.look).toEqual(testPack.hero);
  });

  it("refuse a broken look with a plain message", () => {
    const look = project().hero.look;
    const doc = { ...project(), hero: { ...project().hero, look: { ...look, animations: { ...look.animations, standShoot: { ...look.animations.standShoot, shotY: 40 } } } } };
    expect(errorOf(doc)).toContain("The hero's Stand and shoot shot point is outside its hitbox.");
  });

  // The format 4 shape of a current look, as format 4 games stored it: one canvas per group, one
  // boxed hitbox, one shot point, and no Level 2 shot (format 6 added it).
  function format4(kind: LookKind, current: Look) {
    const look = { ...current, animations: without(current.animations, "chargedShot2") };
    const group = (a: string) => (kind === "hero" && ["slide", "shot", "chargedShot"].includes(a) ? a : "main");
    const first = Object.keys(KINDS[kind].animations)[0];
    const canvases = Object.fromEntries(Object.keys(look.animations).map((a) => [group(a), look.animations[a].size]));
    return {
      colours: look.colours,
      canvases,
      animations: Object.fromEntries(Object.entries(look.animations).map(([a, { frames, speed }]) => [a, { frames, speed }])),
      body: { ...look.animations[first].at!, ...look.body },
      ...(look.slideBody ? { slideBody: { ...look.animations.slide.at!, ...look.slideBody } } : {}),
      ...(look.animations[first].shotY === undefined ? {} : { shotY: look.animations[first].shotY }),
    };
  }
  const without = <T extends object>(o: T, key: string) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)) as T;
  const withoutLevel2 = (abilities: Project["hero"]["abilities"]) => without(abilities, "chargeLevel2");
  // A game with a hero, an enemy and a boss, in the current format.
  function current(): Project {
    const result = parseProject(format3(), getPack);
    if (!result.ok) throw new Error(result.error);
    return result.project;
  }

  it("open from format 4 with every pose sized, placed and shooting as before", () => {
    const game = current();
    const doc = {
      ...game,
      formatVersion: 4,
      hero: { abilities: withoutLevel2(game.hero.abilities), look: format4("hero", game.hero.look) },
      enemies: game.enemies.map((e) => ({ ...e, look: format4(e.behaviour, e.look) })),
      boss: { ...game.boss!, look: format4("boss", game.boss!.look) },
    };
    const result = parseProject(JSON.parse(JSON.stringify(doc)), getPack);
    expect(result.ok && result.project).toEqual(game);
  });

  it("open from format 5 with level 2 off and a Level 2 shot copied from the Charged shot", () => {
    const game = current();
    const animations = without(game.hero.look.animations, "chargedShot2");
    const abilities = withoutLevel2(game.hero.abilities);
    const doc = { ...game, formatVersion: 5, hero: { abilities, look: { ...game.hero.look, animations } } };
    const result = parseProject(JSON.parse(JSON.stringify(doc)), getPack);
    if (!result.ok) throw new Error(result.error);
    expect(result.project.hero.abilities.chargeLevel2).toBe(false);
    expect(result.project.hero.look.animations.chargedShot2.frames).toEqual(
      game.hero.look.animations.chargedShot.frames.map((rows) => centreRows(rows, 16, 12)),
    );
  });

  it("refuse a hero with level 2 on but charge shot off", () => {
    const game = current();
    const doc = { ...game, hero: { ...game.hero, abilities: { ...game.hero.abilities, chargeShot: false, chargeLevel2: true } } };
    expect(errorOf(doc)).toContain("The hero's level 2 charge shot needs its charge shot on.");
  });

  it("refuse a damaged format 4 look without throwing", () => {
    const game = current();
    const broken = { ...format4("hero", game.hero.look), canvases: {} };
    expect(parseProject({ ...game, formatVersion: 4, hero: { ...game.hero, look: broken } }, getPack).ok).toBe(false);
    const ghost = { ...game.enemies[0], behaviour: "ghost", look: format4(game.enemies[0].behaviour, game.enemies[0].look) };
    expect(parseProject({ ...game, formatVersion: 4, enemies: [ghost] }, getPack).ok).toBe(false);
  });
});
