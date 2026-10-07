# Enemy Data and the Game Pack Implementation Plan (Milestone 3, Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Games can hold the kid's own enemies (a name, one of the six behaviours, tuning steps, two frames of pixel art) and an optional boss design; a "game pack" makes them ordinary thing types everywhere; the game plays them, the checker checks them, and the renderer draws them from their own looks.

**Architecture:** `src/model/designs.ts` holds the design types, the tuning table and look validation. `src/model/gamePack.ts`'s `gamePack(project, pack)` adds each design to the content pack as a thing type `own-<id>` marked `own: true`. Command handling, the simulation, the checker and validation build the game pack themselves from the project and the content pack they are given, so nothing else needs to know about designs. Placed own enemies store only their own settings, so changing a design's tuning changes every placed copy. The renderer draws own types from their looks, as it draws the hero.

**Tech Stack:** as milestone 2. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-milestone-3-your-own-enemies-and-boss-design.md` (sections 2, 3, 4 (enemy commands), 8 and 9; build order item 1)

**Plan series for milestone 3:**

1. Enemy data, the game pack, and drawing own enemies (this plan)
2. The Characters screen and the Enemies tab
3. Boss data and the new boss attacks
4. The Boss tab
5. The assistant

## Global Constraints

- Model, commands, the simulation and the checker stay plain TypeScript: no React, no DOM, no randomness.
- The model does not import from `src/content/`; packs are passed in.
- Every change is a command; commands validate and return readable errors.
- Each behaviour keeps its body size.
- Games saved before this plan open and play exactly as before.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **The tuning table** (the runtime's own numbers are "normal"):

  | Step | Settings |
  |---|---|
  | health 1/2/3/5 | `health` |
  | damage low/normal/high | `damage` (and `shotDamage` for shooters) 1/2/4 |
  | speed slow/normal/fast | ×2/3, ×1, ×1.5 of `speed` (walker 0.5, flyer 0.75, shielded 0.4) or `hop` (jumper 1) |
  | shoots rarely/sometimes/often | ×2, ×1, ×½ of `interval` (turret 90, shielded 120) |

  A new enemy starts with its snow counterpart's health (walker, flyer, dropper 1; jumper, shielded 2; turret 3), normal damage and speed, and shoots "sometimes".
- **Own thing types are `own-<id>`**, listed before the pack's things, with the description "Yours" and `own: true` on their `ThingDef`. `gamePack` drops any `own` things already in the pack it is given, so building it twice is harmless.
- **Placing an own enemy stores only the settings given** (normally none); its tuning comes from the design at play time. Pack things keep copying their defaults as now.
- **Starting drawings:** content packs gain `enemyLooks` (one look per behaviour). The snow pack's come from its enemy art, with each letter's colour snapped to the 8-bit palette and letters that snap to the same colour sharing a slot. The turret's single picture fills both frames.
- **Design limits:** up to 12 enemies; ids up to 64 characters; names 1–40 characters, unique among the game's enemies ignoring case and extra spaces.
- **The boss design's schema and look checks arrive now** (so the file format changes once); boss commands, the game pack's boss and the attacks are plan 3.
- **The check cache** also keys on `project.enemies`, so changing a design rechecks every zone.
- **The editor gives the zone canvas and its tools the game pack** now; the palette and the Characters screen are plan 2.

## Review Focus

1. **A game file with a placed `own-…` thing whose design is missing, or a design with a broken frame or colour**: refused with a plain explanation. Tested in Task 2.
2. **Removing an enemy that is placed in a level, or in another level**: refused, naming the zones. Tested in Task 3.
3. **Changing an enemy's tuning after placing it**: every placed copy plays with the new tuning, and the checker rechecks. Tested in Task 4.
4. **Building the game pack from a pack that already has own types** (e.g. a function given the game pack): no duplicate types. Tested in Task 2.
5. **An own enemy with "normal" tuning**: moves exactly like the snow enemy with the same behaviour. Tested in Task 4.

## File Structure

```
src/model/designs.ts              behaviours, tuning, looks, design schemas, framesProblems, lettersToLook
src/model/gamePack.ts             ownType, gamePack
src/model/contentPack.ts          ThingDef.own; ContentPack.enemyLooks
src/model/schema.ts               format version 3; enemies and boss
src/model/factory.ts, parse.ts, validate.ts   new games, the version 2 upgrade, design checks
src/content/snow/enemies.ts       the snow enemies as starting looks
src/content/snow/pack.ts          enemyLooks
src/commands/enemies.ts           addEnemy … removeEnemy
src/commands/helpers.ts           listNames (moved from hero.ts)
src/commands/registry.ts          enemy commands; commands see the game pack
src/commands/things.ts            own enemies store only their own settings
src/runtime/sim/state.ts          the game uses the game pack
src/checker/check.ts, cache.ts    the checker uses the game pack; the cache keys on enemies
src/checker/probe.ts              its project has no designs
src/runtime/render/lookArt.ts     lookArt, ownSkins
src/runtime/render/draw.ts        Skin.own; own enemies drawn from their looks
src/runtime/render/PlayCanvas.tsx own skins
src/editor/zoneView.ts            own enemies drawn on the zone canvas
src/editor/Editor.tsx             the game pack for the canvas and tools; own skins
tests/fixtures/testPack.ts        enemyLooks
tests/...                         named in each task
```

---

### Task 1: Designs in the model

**Files:**
- Create: `src/model/designs.ts`
- Test: `tests/model/designs.test.ts`

**Interfaces:**
- Consumes: `PALETTE_8BIT`, `nearestColour` (milestone 2); `MAX_COLOURS` (milestone 2 `hero.ts`); `MAX_ID_LENGTH`, `MAX_NAME_LENGTH`, `ThingSettings` (types/values from `schema.ts`, used in tests only to compare)
- Produces:
  - `ENEMY_BEHAVIOURS`, `type EnemyBehaviour`, `MAX_ENEMIES = 12`, `ENEMY_FRAME = { w: 16, h: 16 }`, `BOSS_FRAME = { w: 24, h: 28 }`
  - `HEALTH_STEPS`, `DAMAGE_STEPS`, `SPEED_STEPS`, `SHOOT_STEPS`; `enemyTuningSchema`; `type EnemyTuning`; `TUNING_USED: Record<EnemyBehaviour, (keyof EnemyTuning)[]>`; `DEFAULT_HEALTH`; `defaultTuning(behaviour): EnemyTuning`
  - `tuningSettings(behaviour: EnemyBehaviour, tuning: EnemyTuning): Record<string, number>`
  - `type DesignLook = { colours: number[]; frames: string[][] }`; `enemyLookSchema`, `bossLookSchema`
  - `enemyDesignSchema`, `type EnemyDesign`; `BOSS_ATTACKS`, `type BossAttack`, `BOSS_FIGHTS`, `bossDesignSchema`, `type BossDesign`
  - `framesProblems(name: string, look: DesignLook, size: { w: number; h: number }): string[]`
  - `lettersToLook(frames: string[][], palette: Record<string, string>): DesignLook`

- [ ] **Step 1: Write the failing test**

`tests/model/designs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  bossDesignSchema,
  defaultTuning,
  ENEMY_BEHAVIOURS,
  enemyDesignSchema,
  framesProblems,
  lettersToLook,
  tuningSettings,
  TUNING_USED,
  type EnemyDesign,
} from "@/model/designs";
import { nearestColour } from "@/model/palette";

const solid = (ch = "1") => Array.from({ length: 16 }, () => ch.repeat(16));

function design(changes: Partial<EnemyDesign> = {}): EnemyDesign {
  return {
    id: "e1",
    name: "Frost Fang",
    behaviour: "walker",
    tuning: defaultTuning("walker"),
    look: { colours: [13], frames: [solid(), solid()] },
    ...changes,
  };
}

describe("enemy tuning", () => {
  it("gives a normal enemy the snow enemy's own numbers", () => {
    expect(tuningSettings("walker", defaultTuning("walker"))).toEqual({ health: 1, damage: 2, speed: 0.5 });
    expect(tuningSettings("flyer", defaultTuning("flyer"))).toEqual({ health: 1, damage: 2, speed: 0.75 });
    expect(tuningSettings("turret", defaultTuning("turret"))).toEqual({ health: 3, damage: 2, interval: 90, shotDamage: 2 });
    expect(tuningSettings("jumper", defaultTuning("jumper"))).toEqual({ health: 2, damage: 2, hop: 1 });
    expect(tuningSettings("shielded", defaultTuning("shielded"))).toEqual({
      health: 2,
      damage: 2,
      speed: 0.4,
      interval: 120,
      shotDamage: 2,
    });
    expect(tuningSettings("dropper", defaultTuning("dropper"))).toEqual({ health: 1, damage: 2 });
  });

  it("turns each step into its number", () => {
    const walker = (changes: object) => tuningSettings("walker", { ...defaultTuning("walker"), ...changes });
    expect(walker({ speed: "slow" }).speed).toBeCloseTo(0.5 * (2 / 3));
    expect(walker({ speed: "fast" }).speed).toBe(0.75);
    expect([walker({ damage: "low" }).damage, walker({ damage: "high" }).damage]).toEqual([1, 4]);
    expect(walker({ health: 5 }).health).toBe(5);
    const turret = (shoots: "rarely" | "often") => tuningSettings("turret", { ...defaultTuning("turret"), shoots });
    expect([turret("rarely").interval, turret("often").interval]).toEqual([180, 45]);
    expect(tuningSettings("turret", { ...defaultTuning("turret"), damage: "high" }).shotDamage).toBe(4);
  });

  it("names the steps each behaviour uses", () => {
    expect(TUNING_USED.walker).toEqual(["health", "damage", "speed"]);
    expect(TUNING_USED.turret).toEqual(["health", "damage", "shoots"]);
    expect(TUNING_USED.shielded).toEqual(["health", "damage", "speed", "shoots"]);
    expect(TUNING_USED.dropper).toEqual(["health", "damage"]);
    expect(Object.keys(TUNING_USED).sort()).toEqual([...ENEMY_BEHAVIOURS].sort());
  });
});

describe("design schemas", () => {
  it("accept a complete enemy and refuse unknown behaviours, steps and too many colours", () => {
    expect(enemyDesignSchema.safeParse(design()).success).toBe(true);
    expect(enemyDesignSchema.safeParse({ ...design(), behaviour: "dragon" }).success).toBe(false);
    expect(enemyDesignSchema.safeParse({ ...design(), tuning: { ...design().tuning, health: 4 } }).success).toBe(false);
    expect(enemyDesignSchema.safeParse({ ...design(), look: { colours: [0, 1, 2, 3, 4, 5, 6, 7, 8], frames: [solid(), solid()] } }).success).toBe(false);
    expect(enemyDesignSchema.safeParse({ ...design(), look: { colours: [13], frames: [solid()] } }).success).toBe(false);
    expect(enemyDesignSchema.safeParse({ ...design(), name: "" }).success).toBe(false);
  });

  it("accept a boss with two or three attacks, and no other number", () => {
    const frame = Array.from({ length: 28 }, () => "1".repeat(24));
    const boss = { name: "Volt Viper", fight: "normal", attacks: ["jump", "rain"], look: { colours: [13], frames: [frame, frame, frame] } };
    expect(bossDesignSchema.safeParse(boss).success).toBe(true);
    expect(bossDesignSchema.safeParse({ ...boss, attacks: ["jump", "dash", "spread", "big"] }).success).toBe(false);
    expect(bossDesignSchema.safeParse({ ...boss, attacks: ["jump"] }).success).toBe(false);
    expect(bossDesignSchema.safeParse({ ...boss, attacks: ["jump", "fireworks"] }).success).toBe(false);
  });
});

describe("framesProblems", () => {
  it("finds nothing wrong with a good look", () => {
    expect(framesProblems("Frost Fang", design().look, { w: 16, h: 16 })).toEqual([]);
  });

  it("names a frame of the wrong size, an odd pixel, or a missing colour", () => {
    expect(framesProblems("Frost Fang", { colours: [13], frames: [solid(), ["1"]] }, { w: 16, h: 16 })).toEqual([
      "Frost Fang frame 2 is not 16 by 16 pixels.",
    ]);
    expect(framesProblems("Frost Fang", { colours: [13], frames: [solid("x"), solid()] }, { w: 16, h: 16 })).toEqual([
      'Frost Fang frame 1 has a pixel "x" that is not a colour.',
    ]);
    expect(framesProblems("Frost Fang", { colours: [13], frames: [solid(), solid("2")] }, { w: 16, h: 16 })).toEqual([
      "Frost Fang frame 2 uses colour 2, but Frost Fang only has 1 colour.",
    ]);
  });
});

describe("lettersToLook", () => {
  it("snaps each letter's colour to the palette and shares slots for letters that snap together", () => {
    const look = lettersToLook([["kw", "nk"], ["wk", "kn"]], { k: "#1a1c2c", w: "#f4f4f4", n: "#f8fafc" });
    expect(look.colours).toEqual([nearestColour("#1a1c2c"), nearestColour("#f4f4f4")]);
    expect(look.frames).toEqual([["12", "21"], ["21", "12"]]);
  });

  it("keeps see-through pixels and refuses more than eight colours", () => {
    expect(lettersToLook([[".k"]], { k: "#000000" }).frames).toEqual([[".1"]]);
    const many = Object.fromEntries("abcdefghi".split("").map((ch, i) => [ch, ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff", "#888888"][i]]));
    expect(() => lettersToLook([["abcdefghi"]], many)).toThrow(/more than 8 colours/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/model/designs.test.ts`
Expected: FAIL (cannot resolve `@/model/designs`).

- [ ] **Step 3: Write the implementation**

`src/model/designs.ts`:

```ts
import { z } from "zod";
import { MAX_COLOURS } from "./hero";
import { nearestColour, PALETTE_8BIT } from "./palette";

// The kid's own enemies and boss: what they chose (named steps), and what they drew.

export const ENEMY_BEHAVIOURS = ["walker", "flyer", "turret", "jumper", "shielded", "dropper"] as const;
export type EnemyBehaviour = (typeof ENEMY_BEHAVIOURS)[number];

export const MAX_ENEMIES = 12;
export const ENEMY_FRAME = { w: 16, h: 16 };
export const BOSS_FRAME = { w: 24, h: 28 };

// ---- Tuning ----

export const HEALTH_STEPS = [1, 2, 3, 5] as const;
export const DAMAGE_STEPS = ["low", "normal", "high"] as const;
export const SPEED_STEPS = ["slow", "normal", "fast"] as const;
export const SHOOT_STEPS = ["rarely", "sometimes", "often"] as const;

export const enemyTuningSchema = z.object({
  health: z.literal(HEALTH_STEPS),
  damage: z.enum(DAMAGE_STEPS),
  speed: z.enum(SPEED_STEPS),
  shoots: z.enum(SHOOT_STEPS),
});
export type EnemyTuning = z.infer<typeof enemyTuningSchema>;

// The steps each behaviour uses. The others are kept (so changing behaviour loses nothing) but do nothing.
export const TUNING_USED: Record<EnemyBehaviour, (keyof EnemyTuning)[]> = {
  walker: ["health", "damage", "speed"],
  flyer: ["health", "damage", "speed"],
  turret: ["health", "damage", "shoots"],
  jumper: ["health", "damage", "speed"],
  shielded: ["health", "damage", "speed", "shoots"],
  dropper: ["health", "damage"],
};

// A new enemy starts as tough as its snow counterpart (the runtime's own health for that behaviour).
export const DEFAULT_HEALTH: Record<EnemyBehaviour, EnemyTuning["health"]> = {
  walker: 1,
  flyer: 1,
  turret: 3,
  jumper: 2,
  shielded: 2,
  dropper: 1,
};

export const defaultTuning = (behaviour: EnemyBehaviour): EnemyTuning => ({
  health: DEFAULT_HEALTH[behaviour],
  damage: "normal",
  speed: "normal",
  shoots: "sometimes",
});

const DAMAGE: Record<EnemyTuning["damage"], number> = { low: 1, normal: 2, high: 4 };
const SPEED: Record<EnemyTuning["speed"], number> = { slow: 2 / 3, normal: 1, fast: 1.5 };
const SHOOT: Record<EnemyTuning["shoots"], number> = { rarely: 2, sometimes: 1, often: 0.5 }; // times the interval

// The runtime's own numbers for a normal enemy of each behaviour.
const BASE_SPEED: Partial<Record<EnemyBehaviour, { key: string; value: number }>> = {
  walker: { key: "speed", value: 0.5 },
  flyer: { key: "speed", value: 0.75 },
  jumper: { key: "hop", value: 1 },
  shielded: { key: "speed", value: 0.4 },
};
const BASE_INTERVAL: Partial<Record<EnemyBehaviour, number>> = { turret: 90, shielded: 120 };

// The only place tuning steps become numbers: the thing settings the runtime reads.
export function tuningSettings(behaviour: EnemyBehaviour, tuning: EnemyTuning): Record<string, number> {
  const settings: Record<string, number> = { health: tuning.health, damage: DAMAGE[tuning.damage] };
  const speed = BASE_SPEED[behaviour];
  if (speed) settings[speed.key] = speed.value * SPEED[tuning.speed];
  const interval = BASE_INTERVAL[behaviour];
  if (interval !== undefined) {
    settings.interval = interval * SHOOT[tuning.shoots];
    settings.shotDamage = DAMAGE[tuning.damage];
  }
  return settings;
}

// ---- Looks ----

const rows = z.array(z.string()).min(1).max(64);
const colours = z
  .array(z.number().int().min(0).max(PALETTE_8BIT.length - 1))
  .min(1)
  .max(MAX_COLOURS);

export const enemyLookSchema = z.object({ colours, frames: z.tuple([rows, rows]) });
export const bossLookSchema = z.object({ colours, frames: z.tuple([rows, rows, rows]) });
export type DesignLook = { colours: number[]; frames: string[][] };

const id = z.string().min(1).max(64); // as MAX_ID_LENGTH
const name = z.string().min(1).max(40); // as MAX_NAME_LENGTH

export const enemyDesignSchema = z.object({
  id,
  name,
  behaviour: z.enum(ENEMY_BEHAVIOURS),
  tuning: enemyTuningSchema,
  look: enemyLookSchema,
});
export type EnemyDesign = z.infer<typeof enemyDesignSchema>;

export const BOSS_ATTACKS = ["jump", "dash", "spread", "aimed", "rain", "big"] as const;
export type BossAttack = (typeof BOSS_ATTACKS)[number];
export const BOSS_FIGHTS = ["short", "normal", "long"] as const;

export const bossDesignSchema = z.object({
  name,
  fight: z.enum(BOSS_FIGHTS),
  attacks: z.array(z.enum(BOSS_ATTACKS)).min(2).max(3),
  look: bossLookSchema,
});
export type BossDesign = z.infer<typeof bossDesignSchema>;

// Everything wrong with a design's frames that the schema can't see.
export function framesProblems(name: string, look: DesignLook, size: { w: number; h: number }): string[] {
  const problems: string[] = [];
  look.frames.forEach((frame, i) => {
    const label = `${name} frame ${i + 1}`;
    if (frame.length !== size.h || frame.some((row) => row.length !== size.w)) {
      problems.push(`${label} is not ${size.w} by ${size.h} pixels.`);
      return;
    }
    const pixels = frame.join("");
    const odd = [...pixels].find((ch) => ch !== "." && !/[1-8]/.test(ch));
    if (odd) {
      problems.push(`${label} has a pixel "${odd}" that is not a colour.`);
      return;
    }
    const highest = Math.max(0, ...[...pixels].filter((ch) => ch !== ".").map(Number));
    const count = look.colours.length;
    if (highest > count) {
      problems.push(`${label} uses colour ${highest}, but ${name} only has ${count} colour${count === 1 ? "" : "s"}.`);
    }
  });
  return problems;
}

// Pixel art written in palette letters (as the snow pack's) as a look: each letter's colour snapped
// to the 8-bit palette, and letters that snap to the same colour sharing a slot.
export function lettersToLook(frames: string[][], palette: Record<string, string>): DesignLook {
  const colours: number[] = [];
  const slotOf = (ch: string): string => {
    const index = nearestColour(palette[ch]);
    let slot = colours.indexOf(index);
    if (slot < 0) {
      colours.push(index);
      slot = colours.length - 1;
    }
    return String(slot + 1);
  };
  const converted = frames.map((frame) => frame.map((row) => [...row].map((ch) => (ch === "." ? "." : slotOf(ch))).join("")));
  if (colours.length > MAX_COLOURS) throw new Error(`This art uses more than ${MAX_COLOURS} colours.`);
  return { colours, frames: converted };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/model/designs.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/designs.ts tests/model/designs.test.ts
git commit -m "feat: model the kid's enemy and boss designs, and the enemy tuning table"
```

---

### Task 2: Designs in the game file, and the game pack

**Files:**
- Create: `src/model/gamePack.ts`, `src/content/snow/enemies.ts`
- Modify: `src/model/contentPack.ts`, `src/model/schema.ts`, `src/model/factory.ts`, `src/model/parse.ts`, `src/model/validate.ts`, `src/content/snow/pack.ts`, `src/checker/probe.ts`, `tests/fixtures/testPack.ts`
- Modify tests: `tests/model/parse.test.ts`, `tests/model/factory.test.ts`
- Test: `tests/model/gamePack.test.ts`, `tests/content/snowEnemies.test.ts`

**Interfaces:**
- Consumes: Task 1
- Produces:
  - `FORMAT_VERSION = 3`; `Project.enemies: EnemyDesign[]`; `Project.boss: BossDesign | null`
  - `ThingDef.own?: boolean`; `ContentPack.enemyLooks: Record<EnemyBehaviour, DesignLook>`
  - `ownType(id: string): string` (`own-<id>`); `gamePack(project: Project, pack: ContentPack): ContentPack`
  - `structureProblems` checks designs and checks placed things against the game pack
  - `snowEnemyLooks`; `testPack.enemyLooks`

- [ ] **Step 1: Write the failing tests**

`tests/model/gamePack.test.ts`:

```ts
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
    const broken = { ...fang, look: { colours: [13], frames: [solid(), ["1"]] } };
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
```

`tests/content/snowEnemies.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { snowEnemyLooks } from "@/content/snow/enemies";
import { snowPack } from "@/content/snow/pack";
import { ENEMY_BEHAVIOURS, ENEMY_FRAME, framesProblems } from "@/model/designs";

describe("the snow enemies as starting looks", () => {
  it("give every behaviour two good 16 by 16 frames", () => {
    for (const behaviour of ENEMY_BEHAVIOURS) {
      expect(framesProblems(behaviour, snowEnemyLooks[behaviour], ENEMY_FRAME), behaviour).toEqual([]);
      expect(snowEnemyLooks[behaviour].frames).toHaveLength(2);
    }
  });

  it("keep the snow drawings' shapes", () => {
    const shape = (rows: string[]) => rows.map((row) => row.replace(/[^.]/g, "#"));
    expect(snowEnemyLooks.walker.frames.map(shape)).toEqual(snowArt.things.walker.map((s) => shape(s.rows)));
    expect(snowEnemyLooks.turret.frames[1]).toEqual(snowEnemyLooks.turret.frames[0]); // one picture, both frames
  });

  it("are the snow pack's starting looks", () => {
    expect(snowPack.enemyLooks).toBe(snowEnemyLooks);
  });
});
```

In `tests/model/parse.test.ts` and `tests/model/factory.test.ts`, change the "newer version" tests from `formatVersion: 3` to `formatVersion: 4`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/model tests/content`
Expected: FAIL (cannot resolve `@/model/gamePack` and `@/content/snow/enemies`).

- [ ] **Step 3: Packs and the file format**

In `src/model/contentPack.ts`:
- `import type { DesignLook, EnemyBehaviour } from "./designs";`
- add `own?: boolean; // one of the kid's own designs (added by gamePack)` to `ThingDef`;
- add to `ContentPack`: `enemyLooks: Record<EnemyBehaviour, DesignLook>; // the drawings a new enemy starts from`.

In `src/model/schema.ts`: `FORMAT_VERSION = 3`; import `bossDesignSchema, enemyDesignSchema, MAX_ENEMIES` from `"./designs"`; add to `projectSchema`:

```ts
  enemies: z.array(enemyDesignSchema).max(MAX_ENEMIES),
  boss: bossDesignSchema.nullable(),
```

In `src/model/factory.ts`, `createProject` adds `enemies: [],` and `boss: null,`.

In `src/model/parse.ts`, add the upgrade:

```ts
  // Version 3 gave games their own enemies and boss. A version 2 game has none of its own.
  2: (doc) => ({ ...doc, formatVersion: 3, enemies: [], boss: null }),
```

In `src/checker/probe.ts`, the probe's project adds `enemies: [],` and `boss: null,` (the probe is given the game pack, so its own project needs no designs).

`src/model/gamePack.ts`:

```ts
import type { ContentPack, ThingDef } from "./contentPack";
import { tuningSettings } from "./designs";
import type { Project } from "./schema";

export const ownType = (id: string): string => `own-${id}`;

// The content pack plus the kid's own designs as thing types, so the game, the checker, commands
// and validation treat them like any other thing. Own types already in `pack` are replaced, so
// building it from a game pack is harmless.
export function gamePack(project: Project, pack: ContentPack): ContentPack {
  const base = pack.things.filter((d) => !d.own);
  if (project.enemies.length === 0 && base.length === pack.things.length) return pack;
  const own: ThingDef[] = project.enemies.map((enemy) => ({
    type: ownType(enemy.id),
    name: enemy.name,
    category: "enemy",
    behaviour: enemy.behaviour,
    description: "Yours",
    defaults: tuningSettings(enemy.behaviour, enemy.tuning),
    own: true,
  }));
  return { ...pack, things: [...own, ...base] };
}
```

In `src/model/validate.ts`:
- import `gamePack` from `"./gamePack"`, `BOSS_FRAME, ENEMY_FRAME, framesProblems` from `"./designs"`;
- at the start of `structureProblems`, use the game pack for everything after: `const full = gamePack(project, pack);` and pass `full` where it passed `pack` (to `levelProblems`);
- before `return problems;`, check the designs:

```ts
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const enemy of project.enemies) {
    if (ids.has(enemy.id)) problems.push(`Two enemies share the id "${enemy.id}".`);
    ids.add(enemy.id);
    const key = tidyName(enemy.name).toLowerCase();
    if (names.has(key)) problems.push(`Two enemies are called "${tidyName(enemy.name)}".`);
    names.add(key);
    problems.push(...framesProblems(tidyName(enemy.name), enemy.look, ENEMY_FRAME));
  }
  if (project.boss) problems.push(...framesProblems(tidyName(project.boss.name), project.boss.look, BOSS_FRAME));
```

(importing `tidyName` from `"./schema"` if not already).

- [ ] **Step 4: The snow pack's starting looks**

`src/content/snow/enemies.ts`:

```ts
import { ENEMY_BEHAVIOURS, lettersToLook, type DesignLook, type EnemyBehaviour } from "@/model/designs";
import { snowArt } from "./art";
import { SNOW_PALETTE } from "./palette";

// The snow enemies as the drawings a kid's new enemy starts from, one per behaviour. The behaviours
// share their names with the snow enemy types; a single picture fills both frames.
function look(behaviour: EnemyBehaviour): DesignLook {
  const frames = snowArt.things[behaviour].map((sprite) => sprite.rows);
  return lettersToLook(frames.length === 1 ? [frames[0], frames[0]] : frames.slice(0, 2), SNOW_PALETTE);
}

export const snowEnemyLooks = Object.fromEntries(ENEMY_BEHAVIOURS.map((b) => [b, look(b)])) as Record<
  EnemyBehaviour,
  DesignLook
>;
```

In `src/content/snow/pack.ts`, import `snowEnemyLooks` and add `enemyLooks: snowEnemyLooks,`.

In `tests/fixtures/testPack.ts`, add (importing `ENEMY_BEHAVIOURS`, `type DesignLook`, `type EnemyBehaviour` from `@/model/designs`):

```ts
const enemyFrame = Array.from({ length: 16 }, () => "1".repeat(16));
export const testEnemyLooks = Object.fromEntries(
  ENEMY_BEHAVIOURS.map((b) => [b, { colours: [13], frames: [enemyFrame, enemyFrame] }]),
) as Record<EnemyBehaviour, DesignLook>;
```

and `enemyLooks: testEnemyLooks,` to `testPack`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. (Any other test that builds a `Project` literal needs `enemies: []` and `boss: null`; typecheck names them.)

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: store the kid's enemies and boss in the game file, and build a game pack from them"
```

---

### Task 3: Enemy commands

**Files:**
- Create: `src/commands/enemies.ts`
- Modify: `src/commands/helpers.ts`, `src/commands/hero.ts`, `src/commands/registry.ts`, `src/commands/things.ts`, `tests/boundaries.test.ts`
- Test: `tests/commands/enemies.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2
- Produces commands: `addEnemy { enemyId, name, behaviour }`, `renameEnemy { enemyId, name }`, `setEnemyBehaviour { enemyId, behaviour }`, `setEnemyTuning { enemyId, health?, damage?, speed?, shoots? }`, `setEnemyColours { enemyId, colours }`, `setEnemyFrame { enemyId, frame: 0 | 1, rows }`, `removeEnemy { enemyId }`; `listNames(names: string[]): string` in `helpers.ts`; `applyCommand` gives commands the game pack

- [ ] **Step 1: Write the failing test**

`tests/commands/enemies.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createHistory, runCommand, undo } from "@/commands/history";
import { defaultTuning } from "@/model/designs";
import { testEnemyLooks } from "../fixtures/testPack";
import { baseProject, ctx, run, runError } from "./helpers";

const add = (project = baseProject(), enemyId = "e1", name = "Frost Fang", behaviour = "walker") =>
  run(project, "addEnemy", { enemyId, name, behaviour });
const place = (project: ReturnType<typeof baseProject>, zoneId = "z1", thingId = "t1") =>
  run(project, "placeThing", { levelId: "L1", zoneId, thingId, type: "own-e1", x: 3, y: 12 });
const solid = (ch: string) => Array.from({ length: 16 }, () => ch.repeat(16));

describe("addEnemy", () => {
  it("adds an enemy starting from the pack's drawing for its behaviour", () => {
    const project = add(baseProject(), "e1", "  Frost   Fang ", "turret");
    expect(project.enemies).toEqual([
      { id: "e1", name: "Frost Fang", behaviour: "turret", tuning: defaultTuning("turret"), look: testEnemyLooks.turret },
    ]);
  });

  it("refuses a used id or name, and a thirteenth enemy", () => {
    const one = add();
    expect(runError(one, "addEnemy", { enemyId: "e1", name: "Other", behaviour: "walker" })).toBe(
      'There is already an enemy with the id "e1".',
    );
    expect(runError(one, "addEnemy", { enemyId: "e2", name: "frost fang", behaviour: "walker" })).toBe(
      'There is already an enemy called "Frost Fang".',
    );
    let many = baseProject();
    for (let i = 0; i < 12; i++) many = add(many, `e${i}`, `Enemy ${i}`);
    expect(runError(many, "addEnemy", { enemyId: "e99", name: "One more", behaviour: "walker" })).toBe(
      "A game can have up to 12 enemies of its own.",
    );
  });
});

describe("changing an enemy", () => {
  it("renames, changes behaviour and tunes, keeping everything else", () => {
    let project = add();
    project = run(project, "renameEnemy", { enemyId: "e1", name: "Ice Fang" });
    project = run(project, "setEnemyBehaviour", { enemyId: "e1", behaviour: "jumper" });
    project = run(project, "setEnemyTuning", { enemyId: "e1", speed: "fast", health: 5, shoots: undefined });
    expect(project.enemies[0]).toMatchObject({
      name: "Ice Fang",
      behaviour: "jumper",
      tuning: { ...defaultTuning("walker"), speed: "fast", health: 5 },
      look: testEnemyLooks.walker,
    });
    expect(runError(project, "setEnemyTuning", { enemyId: "e1" })).toBe("Give at least one step to change.");
    expect(runError(project, "renameEnemy", { enemyId: "nope", name: "X" })).toBe('There is no enemy with the id "nope".');
  });

  it("draws frames and recolours, refusing to drop a colour that is used", () => {
    let project = add();
    project = run(project, "setEnemyColours", { enemyId: "e1", colours: [13, 20] });
    project = run(project, "setEnemyFrame", { enemyId: "e1", frame: 1, rows: solid("2") });
    expect(project.enemies[0].look.frames[1]).toEqual(solid("2"));
    expect(runError(project, "setEnemyColours", { enemyId: "e1", colours: [13] })).toBe(
      "Colour 2 is still used in Frost Fang's frame 2.",
    );
    expect(runError(project, "setEnemyFrame", { enemyId: "e1", frame: 0, rows: ["1"] })).toBe(
      "Frost Fang frame 1 is not 16 by 16 pixels.",
    );
    expect(runError(project, "setEnemyFrame", { enemyId: "e1", frame: 2, rows: solid("1") })).toMatch(/frame/);
  });
});

describe("placing and removing an enemy", () => {
  it("places an own enemy with only its own settings, so its tuning stays live", () => {
    const project = place(add());
    expect(project.levels[0].zones[0].things[0]).toEqual({ id: "t1", type: "own-e1", x: 3, y: 12, settings: {} });
  });

  it("refuses to remove an enemy that is placed, naming the zones", () => {
    let project = place(add());
    project = place(project, "corridor", "t2");
    expect(runError(project, "removeEnemy", { enemyId: "e1" })).toBe(
      "Frost Fang is used in Zone 1 and Boss Corridor.",
    );
  });

  it("removes an enemy that isn't placed", () => {
    expect(run(add(), "removeEnemy", { enemyId: "e1" }).enemies).toEqual([]);
  });

  it("undoes exactly", () => {
    const history = createHistory(baseProject());
    const { history: added } = runCommand(history, { name: "addEnemy", args: { enemyId: "e1", name: "Fang", behaviour: "flyer" } }, ctx);
    expect(undo(added).project).toBe(history.project);
  });
});
```

In `tests/boundaries.test.ts`, add the seven commands to the expected list:

```ts
        "addEnemy", "renameEnemy", "setEnemyBehaviour", "setEnemyTuning", "setEnemyColours", "setEnemyFrame", "removeEnemy",
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/commands/enemies.test.ts tests/boundaries.test.ts`
Expected: FAIL (`Unknown command "addEnemy"`).

- [ ] **Step 3: Write the implementation**

Move `listNames` from `src/commands/hero.ts` into `src/commands/helpers.ts` (exported, unchanged) and import it in `hero.ts`.

`src/commands/enemies.ts`:

```ts
import { z } from "zod";
import {
  defaultTuning,
  DAMAGE_STEPS,
  ENEMY_BEHAVIOURS,
  ENEMY_FRAME,
  framesProblems,
  HEALTH_STEPS,
  MAX_ENEMIES,
  SHOOT_STEPS,
  SPEED_STEPS,
  type EnemyDesign,
} from "@/model/designs";
import { ownType } from "@/model/gamePack";
import { MAX_COLOURS } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import { tidyName, type Project } from "@/model/schema";
import { listNames } from "./helpers";
import { defineCommand, fail, idArg, nameArg, ok, type CommandResult } from "./types";

const behaviourArg = z.enum(ENEMY_BEHAVIOURS);

function findEnemy(project: Project, enemyId: string): EnemyDesign | string {
  return project.enemies.find((e) => e.id === enemyId) ?? `There is no enemy with the id "${enemyId}".`;
}

function editEnemy(project: Project, enemyId: string, change: (enemy: EnemyDesign) => EnemyDesign | string): CommandResult {
  const enemy = findEnemy(project, enemyId);
  if (typeof enemy === "string") return fail(enemy);
  const next = change(enemy);
  if (typeof next === "string") return fail(next);
  return ok({ ...project, enemies: project.enemies.map((e) => (e.id === enemyId ? next : e)) });
}

function nameClash(project: Project, name: string, exceptId?: string): string | null {
  const wanted = tidyName(name).toLowerCase();
  const other = project.enemies.find((e) => e.id !== exceptId && tidyName(e.name).toLowerCase() === wanted);
  return other ? `There is already an enemy called "${tidyName(other.name)}".` : null;
}

const addEnemyCommand = defineCommand({
  name: "addEnemy",
  description: "Add one of the kid's own enemies, starting from the content pack's drawing for its behaviour.",
  args: z.strictObject({ enemyId: idArg, name: nameArg, behaviour: behaviourArg }),
  apply(project, args, ctx) {
    if (project.enemies.length >= MAX_ENEMIES) return fail(`A game can have up to ${MAX_ENEMIES} enemies of its own.`);
    if (project.enemies.some((e) => e.id === args.enemyId)) {
      return fail(`There is already an enemy with the id "${args.enemyId}".`);
    }
    const clash = nameClash(project, args.name);
    if (clash) return fail(clash);
    const enemy: EnemyDesign = {
      id: args.enemyId,
      name: args.name,
      behaviour: args.behaviour,
      tuning: defaultTuning(args.behaviour),
      look: ctx.pack.enemyLooks[args.behaviour],
    };
    return ok({ ...project, enemies: [...project.enemies, enemy] });
  },
});

const renameEnemyCommand = defineCommand({
  name: "renameEnemy",
  description: "Rename one of the kid's own enemies.",
  args: z.strictObject({ enemyId: idArg, name: nameArg }),
  apply(project, args) {
    const clash = nameClash(project, args.name, args.enemyId);
    if (clash) return fail(clash);
    return editEnemy(project, args.enemyId, (enemy) => ({ ...enemy, name: args.name }));
  },
});

const setEnemyBehaviourCommand = defineCommand({
  name: "setEnemyBehaviour",
  description: "Change how one of the kid's own enemies behaves. Its drawing and tuning stay.",
  args: z.strictObject({ enemyId: idArg, behaviour: behaviourArg }),
  apply(project, args) {
    return editEnemy(project, args.enemyId, (enemy) => ({ ...enemy, behaviour: args.behaviour }));
  },
});

const setEnemyTuningCommand = defineCommand({
  name: "setEnemyTuning",
  description: "Change any of an enemy's tuning steps: health (1, 2, 3, 5), damage, speed, shoots.",
  args: z.strictObject({
    enemyId: idArg,
    health: z.literal(HEALTH_STEPS).optional(),
    damage: z.enum(DAMAGE_STEPS).optional(),
    speed: z.enum(SPEED_STEPS).optional(),
    shoots: z.enum(SHOOT_STEPS).optional(),
  }),
  apply(project, args) {
    const { enemyId, ...steps } = args;
    const given = Object.fromEntries(Object.entries(steps).filter(([, value]) => value !== undefined));
    if (Object.keys(given).length === 0) return fail("Give at least one step to change.");
    return editEnemy(project, enemyId, (enemy) => ({ ...enemy, tuning: { ...enemy.tuning, ...given } }));
  },
});

const setEnemyColoursCommand = defineCommand({
  name: "setEnemyColours",
  description: `Set an enemy's colour slots: 1 to ${MAX_COLOURS} colours from the 8-bit palette.`,
  args: z.strictObject({
    enemyId: idArg,
    colours: z.array(z.number().int().min(0).max(PALETTE_8BIT.length - 1)).min(1).max(MAX_COLOURS),
  }),
  apply(project, args) {
    return editEnemy(project, args.enemyId, (enemy) => {
      for (let slot = args.colours.length + 1; slot <= enemy.look.colours.length; slot++) {
        const frames = enemy.look.frames.flatMap((rows, i) => (rows.some((row) => row.includes(String(slot))) ? [`frame ${i + 1}`] : []));
        if (frames.length > 0) return `Colour ${slot} is still used in ${tidyName(enemy.name)}'s ${listNames(frames)}.`;
      }
      return { ...enemy, look: { ...enemy.look, colours: args.colours } };
    });
  },
});

const setEnemyFrameCommand = defineCommand({
  name: "setEnemyFrame",
  description: 'Replace one of an enemy\'s two frames (0 or 1) with rows of pixels: "." is empty, a digit is a colour.',
  args: z.strictObject({ enemyId: idArg, frame: z.union([z.literal(0), z.literal(1)]), rows: z.array(z.string()).min(1).max(64) }),
  apply(project, args) {
    return editEnemy(project, args.enemyId, (enemy) => {
      const frames = enemy.look.frames.map((rows, i) => (i === args.frame ? args.rows : rows));
      const look = { ...enemy.look, frames: frames as [string[], string[]] };
      const problem = framesProblems(tidyName(enemy.name), { colours: look.colours, frames: [args.rows] }, ENEMY_FRAME)[0];
      if (problem) return problem.replace(" frame 1 ", ` frame ${args.frame + 1} `);
      return { ...enemy, look };
    });
  },
});

const removeEnemyCommand = defineCommand({
  name: "removeEnemy",
  description: "Remove one of the kid's own enemies. Refused while it is placed in any zone.",
  args: z.strictObject({ enemyId: idArg }),
  apply(project, args) {
    const enemy = findEnemy(project, args.enemyId);
    if (typeof enemy === "string") return fail(enemy);
    const type = ownType(enemy.id);
    const zones = project.levels.flatMap((level) => level.zones.filter((z) => z.things.some((t) => t.type === type)).map((z) => z.name));
    if (zones.length > 0) return fail(`${tidyName(enemy.name)} is used in ${listNames(zones)}.`);
    return ok({ ...project, enemies: project.enemies.filter((e) => e.id !== enemy.id) });
  },
});

export const enemyCommands = [
  addEnemyCommand,
  renameEnemyCommand,
  setEnemyBehaviourCommand,
  setEnemyTuningCommand,
  setEnemyColoursCommand,
  setEnemyFrameCommand,
  removeEnemyCommand,
];
```

In `src/commands/registry.ts`: import `enemyCommands` and add `...enemyCommands,`; import `gamePack` from `"@/model/gamePack"` and give every command the game pack:

```ts
  return def.apply(project, parsed.data as never, { ...ctx, pack: gamePack(project, ctx.pack) });
```

In `src/commands/things.ts`, `placeThing` stores only the given settings for an own enemy:

```ts
        settings: def.own ? args.settings : { ...def.defaults, ...args.settings },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: add commands to make, tune, draw and remove the kid's own enemies"
```

---

### Task 4: The game and the checker play own enemies

**Files:**
- Modify: `src/runtime/sim/state.ts`, `src/checker/check.ts`, `src/checker/cache.ts`
- Test: `tests/runtime/ownEnemies.test.ts`, additions to `tests/checker/cache.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3
- Produces: `createSim`, `checkZone`, `levelProblems` (and so `checkLevel` and the cache) build the game pack themselves; `CheckCache` keys on `project.enemies`

- [ ] **Step 1: Write the failing tests**

`tests/runtime/ownEnemies.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkZone } from "@/checker/check";
import { defaultTuning, type EnemyTuning } from "@/model/designs";
import type { Project } from "@/model/schema";
import { createSim } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { NO_INPUT } from "@/runtime/sim/state";
import { game, pack, run } from "../ai/helpers";

// The snow game with the kid's walker "Frost Fang" (e1), and one thing placed in Zone 1.
function withFang(type: string, tuning: Partial<EnemyTuning> = {}, x = 8): Project {
  let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
  if (Object.keys(tuning).length > 0) project = run(project, "setEnemyTuning", { enemyId: "e1", ...tuning });
  return run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type, x, y: 12 });
}

function track(project: Project, steps: number): number[] {
  const sim = createSim(project, "L1", pack);
  const xs: number[] = [];
  for (let i = 0; i < steps; i++) {
    step(sim, NO_INPUT);
    xs.push(sim.slots[0].entity?.x ?? Number.NaN);
  }
  return xs;
}

describe("the kid's own enemies in the game", () => {
  it("play exactly like the snow enemy with the same behaviour, when tuned normal", () => {
    expect(track(withFang("own-e1"), 120)).toEqual(track(withFang("walker"), 120));
  });

  it("follow their tuning, even after they are placed", () => {
    const fast = createSim(withFang("own-e1", { speed: "fast", health: 5, damage: "high" }), "L1", pack);
    step(fast, NO_INPUT);
    const fang = fast.slots[0].entity!;
    expect(fang.health).toBe(5);
    expect(fang.settings).toMatchObject({ speed: 0.75, damage: 4 });
  });

  it("are checked like any enemy, by name", () => {
    const check = checkZone(withFang("own-e1", {}, 1), "L1", "z1", pack);
    expect(check.warnings).toContain("The Frost Fang at (1, 12) is right where the player arrives.");
  });
});
```

Add to `tests/checker/cache.test.ts`:

```ts
  it("checks again when the kid's enemies change", () => {
    const cache = createCheckCache();
    const project = run(game(), { name: "addEnemy", args: { enemyId: "e1", name: "Fang", behaviour: "walker" } });
    const first = cache.zone(project, "L1", "z1", pack);
    const tuned = run(project, { name: "setEnemyTuning", args: { enemyId: "e1", speed: "fast" } });
    expect(cache.zone(tuned, "L1", "z1", pack)).not.toBe(first);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime/ownEnemies.test.ts tests/checker/cache.test.ts`
Expected: FAIL (the game doesn't know `own-e1`; the cache returns the old check).

- [ ] **Step 3: Write the implementation**

In `src/runtime/sim/state.ts`, import `gamePack` from `"@/model/gamePack"` and, at the start of `createSim`, use the game pack for everything:

```ts
  pack = gamePack(project, pack); // the kid's own enemies are thing types like any other
```

In `src/checker/check.ts`, import `gamePack` and start `checkZone` and `levelProblems` the same way (`pack = gamePack(project, pack);`).

In `src/checker/cache.ts`, add `enemies: EnemyDesign[]` to `Cached`, compare `hit.enemies === project.enemies` with the other keys, store `enemies: project.enemies`, and update the comment to name the kid's enemies. Import `type EnemyDesign` from `"@/model/designs"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass, including every piece test.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: play and check the kid's own enemies like any other"
```

---

### Task 5: Drawing own enemies

**Files:**
- Create: `src/runtime/render/lookArt.ts`
- Modify: `src/runtime/render/draw.ts`, `src/runtime/render/PlayCanvas.tsx`, `src/editor/zoneView.ts`, `src/editor/Editor.tsx`, `docs/superpowers/status.md`
- Test: `tests/runtime/lookArt.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `sprite`, `Sprite` (render); `PALETTE_8BIT`
- Produces:
  - `type LookArt = { palette: Record<string, string>; frames: Sprite[] }`; `lookArt(look: DesignLook): LookArt`
  - `type OwnSkin = { art: LookArt; image: (s: Sprite, flip: boolean) => CanvasImageSource }`; `ownSkins(project: Project, imageFor: (palette: Record<string, string>) => (s: Sprite, flip: boolean) => CanvasImageSource): Record<string, OwnSkin>`
  - `Skin` gains `own?: Record<string, OwnSkin>`

- [ ] **Step 1: Write the failing test**

`tests/runtime/lookArt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { drawZoneView } from "@/editor/zoneView";
import { PALETTE_8BIT } from "@/model/palette";
import type { Sprite } from "@/runtime/render/art";
import { draw } from "@/runtime/render/draw";
import { lookArt, ownSkins } from "@/runtime/render/lookArt";
import { createSim, NO_INPUT } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { game, pack, run } from "../ai/helpers";

const fake = (sprite: Sprite, flip: boolean) => ({ sprite, flip }) as unknown as CanvasImageSource;

function fangGame() {
  let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
  project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 6, y: 12 });
  return project;
}

function recorder() {
  const images: { sprite: Sprite; flip: boolean }[] = [];
  return {
    images,
    fillStyle: "",
    font: "",
    textAlign: "start" as CanvasTextAlign,
    fillRect: () => {},
    fillText: () => {},
    drawImage: (image: CanvasImageSource) => images.push(image as unknown as { sprite: Sprite; flip: boolean }),
  };
}

describe("lookArt", () => {
  it("makes sprites of a look's frames, with its colours by slot digit", () => {
    const art = lookArt({ colours: [13, 20], frames: [["12"], ["21"]] });
    expect(art.palette).toEqual({ "1": PALETTE_8BIT[13], "2": PALETTE_8BIT[20] });
    expect(art.frames.map((f) => f.rows)).toEqual([["12"], ["21"]]);
  });

  it("makes a skin for each of the kid's enemies, keyed by thing type", () => {
    const skins = ownSkins(fangGame(), () => fake);
    expect(Object.keys(skins)).toEqual(["own-e1"]);
    expect(skins["own-e1"].art.frames).toHaveLength(2);
  });
});

describe("drawing the kid's enemies", () => {
  it("draws them in the game from their own frames", () => {
    const project = fangGame();
    const sim = createSim(project, "L1", pack);
    step(sim, NO_INPUT);
    const own = ownSkins(project, () => fake);
    const ctx = recorder();
    draw(ctx, sim, { set: snowArt, image: fake, own });
    expect(ctx.images.some((i) => own["own-e1"].art.frames.includes(i.sprite))).toBe(true);
  });

  it("draws them on the zone canvas from their first frame", () => {
    const project = fangGame();
    const own = ownSkins(project, () => fake);
    const ctx = recorder();
    const zone = project.levels[0].zones[0];
    drawZoneView(ctx, zone, { ...pack, things: [{ ...pack.things[0], type: "own-e1", own: true }, ...pack.things] }, { set: snowArt, image: fake, own }, []);
    expect(ctx.images.some((i) => i.sprite === own["own-e1"].art.frames[0])).toBe(true);
  });
});
```

(`drawZoneView` takes the pack it is given; the editor passes the game pack. The test builds a minimal one so it doesn't depend on `gamePack`'s output order.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/runtime/lookArt.test.ts`
Expected: FAIL (cannot resolve `@/runtime/render/lookArt`).

- [ ] **Step 3: Write the implementation**

`src/runtime/render/lookArt.ts`:

```ts
import type { DesignLook } from "@/model/designs";
import { ownType } from "@/model/gamePack";
import { PALETTE_8BIT } from "@/model/palette";
import type { Project } from "@/model/schema";
import { sprite, type Sprite } from "./art";

// A design's look as sprites. Pixels are colour slot digits, so the palette maps "1" to the first.
export type LookArt = { palette: Record<string, string>; frames: Sprite[] };

export function lookArt(look: DesignLook): LookArt {
  return {
    palette: Object.fromEntries(look.colours.map((colour, i) => [String(i + 1), PALETTE_8BIT[colour]])),
    frames: look.frames.map((rows) => sprite(rows)),
  };
}

export type OwnSkin = { art: LookArt; image: (s: Sprite, flip: boolean) => CanvasImageSource };

// Art for each of the kid's own enemies, keyed by thing type, each with its own image maker.
export function ownSkins(
  project: Project,
  imageFor: (palette: Record<string, string>) => (s: Sprite, flip: boolean) => CanvasImageSource,
): Record<string, OwnSkin> {
  return Object.fromEntries(
    project.enemies.map((enemy) => {
      const art = lookArt(enemy.look);
      return [ownType(enemy.id), { art, image: imageFor(art.palette) }];
    }),
  );
}
```

In `src/runtime/render/draw.ts`, import `type OwnSkin` from `"./lookArt"`, add `own?: Record<string, OwnSkin>;` to `Skin`, and in `drawEntity` prefer an own skin:

```ts
  const own = skin?.own?.[e.type];
  const frames = own ? own.art.frames : skin?.set.things[e.type];
  if (skin && frames && frames.length > 0) {
    if (flashing) return; // blink
    const frame = frames[thingFrame(e, sim.steps, frames.length)];
    onBox(ctx, own ? own.image : skin.image, frame, e.facing < 0, e, ox, oy);
    return;
  }
```

In `src/editor/zoneView.ts`, draw a thing's first frame from its own skin when it has one:

```ts
    const own = skin?.own?.[thing.type];
    const frame = own ? own.art.frames[0] : skin?.set.things[thing.type]?.[0];
    if (skin && frame) {
      ctx.drawImage(
        (own ? own.image : skin.image)(frame, false),
```

(the rest of that call is unchanged).

In `src/runtime/render/PlayCanvas.tsx`, import `ownSkins` and add to the skin:

```ts
          own: ownSkins(project, (palette) => createSpriteCache(palette, browserCanvas)),
```

In `src/editor/Editor.tsx`:
- import `gamePack` from `"@/model/gamePack"` and `ownSkins` from `"@/runtime/render/lookArt"`;
- the zone canvas and its tools work with the game pack: add `const fullPack = useMemo(() => gamePack(project, pack), [project, pack]);` after `project` is known, and pass `fullPack` instead of `pack` to `ZoneCanvas`, `thingAt`, `paintCommand` and `placeCommand` (the palette, the checker hook, the hero screen and the chat keep `pack`, since they build the game pack themselves or show the pack's things);
- the zone canvas's skin includes own skins: change the `skin` `useMemo` to

```ts
  const skin = useMemo<Skin | undefined>(() => {
    if (!art || typeof document === "undefined") return undefined;
    return {
      set: art,
      image: createSpriteCache(art.palette, browserCanvas),
      own: ownSkins(project, (palette) => createSpriteCache(palette, browserCanvas)),
    };
    // Rebuilt when the kid's enemies change, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art, project.enemies]);
```

(The `skin` `useMemo` must move below `const project = state.history.project;` if it is above it.)

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass.

- [ ] **Step 5: Update the status and commit**

In `docs/superpowers/status.md`: add this plan to the table as implemented, reviewed and merged; mark the milestone 3 spec approved; update the test counts; add this plan's deferred review findings.

```bash
git add -A src tests docs/superpowers/status.md
git commit -m "feat: draw the kid's own enemies from their own drawings, in the game and on the zone canvas"
```

---

## Self-review

- **Spec coverage:** section 3 (designs in the file, tuning table, pictures, game pack, old games) → Tasks 1, 2, 4, 5; section 4's enemy commands → Task 3; section 8's rows for old games, broken designs and deleting placed enemies → Tasks 2 and 3; section 9's model, command, game-pack and checker tests → Tasks 1–4. The palette, the Characters screen, boss commands and attacks, and the assistant are plans 2–5.
- **Types:** `EnemyDesign`, `EnemyTuning`, `DesignLook`, `gamePack`, `ownType`, `tuningSettings`, `framesProblems`, `lookArt`, `ownSkins`, `OwnSkin` are defined once and used with the same names.
- **Known limits, accepted:** the zone canvas rebuilds own skins only when `project.enemies` changes (the right trigger); the palette doesn't yet list own enemies (plan 2).
