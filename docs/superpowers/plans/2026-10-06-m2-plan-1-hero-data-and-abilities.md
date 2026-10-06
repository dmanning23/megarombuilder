# Hero Data and Abilities Implementation Plan (Milestone 2, Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every game a hero (abilities chosen from named steps, and a look drawn in an 8-bit palette) stored in the game file, upgrade old games to it, and make the game, the checker and the assistant's catalogue play and draw that hero.

**Architecture:** The model gains `src/model/palette.ts` (the 8-bit colours) and `src/model/hero.ts` (pictures, abilities, the ability table `heroPhysics`, look validation). A project's `hero` replaces `player`; format version 2 upgrades version 1 files on load. The content pack supplies the default hero look (the snow hero, moved out of the snow art). Everything that read `project.player` now reads `heroPhysics(project.hero.abilities)`, and the renderer draws the hero from `project.hero.look`. Four commands change the hero.

**Tech Stack:** as milestone 1 (Next.js 16, React 19, TypeScript, Zod 4, Vitest, Playwright). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-milestone-2-your-own-hero-design.md` (sections 3, 4, 9 and 10; build order item 1)

**Plan series for milestone 2:**

1. Hero data and abilities (this plan)
2. Slide and charge shot
3. The hero screen
4. Picture import
5. The assistant

## Global Constraints

- Model, commands, the simulation and the checker stay plain TypeScript: no React, no DOM, no randomness (enforced by `tests/boundaries.test.ts`).
- The model does not import from `src/content/`; content packs are passed in.
- Every change to a project is a command; commands validate their arguments and return readable errors.
- The hero's body stays 14×22 pixels. Gravity, fall speed and ladder speed stay at milestone 1's values.
- Games saved before this plan open and play exactly as before.
- Interface text is short, plain and in sentence case.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **The ability table**, measured with the checker before writing this plan:

  | Ability | Steps | Value |
  |---|---|---|
  | Speed (run speed, px/step) | normal, fast, veryFast | 1.375, 1.625, 1.875 |
  | Jump (jump velocity) | low, normal, high, veryHigh | 4.375, 4.875, 5.375, 6.125 |
  | Health | fragile, normal, tough | 20, 28, 40 |
  | Shots | 1, 2, 3, 5 | as named |

  Low and normal clear a 2-tile wall but not 3; high clears 3 but not 4; very high clears 4 but not 5. Every level piece passes at every speed with a jump velocity as low as 4.125; "low" is 4.375 to keep a margin rather than sit on the boundary.
- **Normal everywhere equals milestone 1** (`heroPhysics(DEFAULT_ABILITIES)` is exactly `DEFAULT_PLAYER`), so upgraded games play identically.
- **`PlayerSettings` stays** as the name of the computed physics; it is no longer stored. `DEFAULT_PLAYER` stays as milestone 1's numbers.
- **The 8-bit palette** is the 55 distinct colours of the classic NES palette (its repeated blacks removed), in the console's order. Pixels name a hero colour slot `1`–`8`; slots hold palette indices.
- **Shot pictures:** `shot` 6×4 (the runtime's shot box), `chargedShot` 12×10 (the box plan 2 will give it).
- **The snow hero is re-expressed in the 8-bit palette**, each of its seven colours snapped to the nearest palette colour, so it looks almost exactly as before. It gains a slide pose and a charged shot.
- **Upgrading a version 1 file** keeps its level data, drops `player`, and gives it the pack's hero with each old number mapped to the nearest step (every real saved game has the defaults, so it gets normal everywhere). If the file's pack is missing, the existing "needs the content pack" message is shown.
- **Changing abilities rechecks every zone** (the check cache keys on the abilities object); changing the look does not.
- **The renderer draws the hero from the game's own look.** The snow art set loses its `player` and `playerShot`.

## Review Focus

1. **A version 1 game in IndexedDB or a version 1 export file**: opens, upgrades, and plays as before. Tested in Task 4.
2. **A file whose hero is broken** (a picture the wrong size, a pixel naming a colour slot that does not exist, a colour index outside the palette): refused with a plain explanation, nothing saved. Tested in Tasks 2 and 4.
3. **Removing a hero colour that pixels still use**: refused with "Colour N is still used in …", the hero unchanged. Tested in Task 6.
4. **Lowering the jump so zones fail, then undoing**: the zones fail, then pass again. Tested in Task 4.
5. **The tough hero's longer health bar**: still fits on screen. Tested in Task 4.

## File Structure

```
src/model/palette.ts            PALETTE_8BIT, nearestColour
src/model/hero.ts               pictures and sizes, abilities, heroPhysics, abilitiesFromSettings, look schema, lookProblems
src/model/schema.ts             format version 2; hero replaces player
src/model/contentPack.ts        a pack supplies its default hero look
src/model/factory.ts            new games get the pack's hero
src/model/parse.ts              the version 1 upgrade
src/model/validate.ts           hero look problems are structure problems
src/content/snow/palette.ts     the snow colours (moved out of art.ts)
src/content/snow/hero.ts        the snow hero as a HeroLook (moved out of art.ts, plus slide and charged shot)
src/content/snow/art.ts         no hero art
src/content/snow/pack.ts        hero: snowHero
src/runtime/render/heroArt.ts   heroArt: a look as sprites and a palette
src/runtime/render/art.ts       ArtSet without player art; playerPose returns a HeroPose
src/runtime/render/draw.ts      draws the hero from Skin.hero
src/runtime/render/PlayCanvas.tsx  builds the hero skin from the project
src/runtime/sim/state.ts        physics from heroPhysics
src/checker/check.ts, src/checker/cache.ts, src/ai/describe.ts   read the hero
src/commands/hero.ts            setHeroAbilities, setHeroColours, setHeroPose, resetHeroLook
src/commands/registry.ts        registers them
tests/...                       new and updated tests, named in each task
```

---

### Task 1: The 8-bit palette

**Files:**
- Create: `src/model/palette.ts`
- Test: `tests/model/palette.test.ts`

**Interfaces:**
- Produces:
  - `PALETTE_8BIT: readonly string[]` (55 lower-case `#rrggbb` colours)
  - `nearestColour(hex: string): number` (index into `PALETTE_8BIT`; throws on a malformed colour)

- [ ] **Step 1: Write the failing test**

`tests/model/palette.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nearestColour, PALETTE_8BIT } from "@/model/palette";

describe("PALETTE_8BIT", () => {
  it("has 55 different colours", () => {
    expect(PALETTE_8BIT).toHaveLength(55);
    expect(new Set(PALETTE_8BIT).size).toBe(55);
    for (const colour of PALETTE_8BIT) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("nearestColour", () => {
  it("finds a palette colour exactly", () => {
    PALETTE_8BIT.forEach((colour, i) => expect(nearestColour(colour)).toBe(i));
  });

  it("snaps other colours to the closest one", () => {
    expect(PALETTE_8BIT[nearestColour("#1a1c2c")]).toBe("#000000");
    expect(PALETTE_8BIT[nearestColour("#f4f4f4")]).toBe("#f8f8f8");
    expect(PALETTE_8BIT[nearestColour("#FF0000")]).toMatch(/^#[ef][0-9a-f]/); // a strong red
  });

  it("refuses something that is not a colour", () => {
    expect(() => nearestColour("red")).toThrow(/not a colour/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/model/palette.test.ts`
Expected: FAIL (cannot resolve `@/model/palette`).

- [ ] **Step 3: Write the implementation**

`src/model/palette.ts`:

```ts
// The 8-bit palette: the colours a hero can be drawn in, in the order the colour picker shows
// them. These are the classic NES console's colours, without its repeated blacks.
export const PALETTE_8BIT: readonly string[] = [
  "#7c7c7c", "#0000fc", "#0000bc", "#4428bc", "#940084", "#a80020", "#a81000",
  "#881400", "#503000", "#007800", "#006800", "#005800", "#004058", "#000000",
  "#bcbcbc", "#0078f8", "#0058f8", "#6844fc", "#d800cc", "#e40058", "#f83800",
  "#e45c10", "#ac7c00", "#00b800", "#00a800", "#00a844", "#008888",
  "#f8f8f8", "#3cbcfc", "#6888fc", "#9878f8", "#f878f8", "#f85898", "#f87858",
  "#fca044", "#f8b800", "#b8f818", "#58d854", "#58f898", "#00e8d8", "#787878",
  "#fcfcfc", "#a4e4fc", "#b8b8f8", "#d8b8f8", "#f8b8f8", "#f8a4c0", "#f0d0b0",
  "#fce0a8", "#f8d878", "#d8f878", "#b8f8b8", "#b8f8d8", "#00fcfc", "#d8d8d8",
];

function channels(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`"${hex}" is not a colour.`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const RGB = PALETTE_8BIT.map(channels);

// The palette colour that looks closest, by the "redmean" approximation of how eyes see colour.
export function nearestColour(hex: string): number {
  const [r, g, b] = channels(hex);
  let best = 0;
  let bestDistance = Infinity;
  RGB.forEach(([pr, pg, pb], i) => {
    const mean = (r + pr) / 2;
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const distance = (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/model/palette.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/palette.ts tests/model/palette.test.ts
git commit -m "feat: add the 8-bit palette heroes are drawn in"
```

---

### Task 2: The hero in the model

**Files:**
- Create: `src/model/hero.ts`
- Test: `tests/model/hero.test.ts`

**Interfaces:**
- Consumes: `PALETTE_8BIT` (Task 1); `PlayerSettings`, `DEFAULT_PLAYER` from `src/model/schema.ts` (type and constant, unchanged)
- Produces:
  - `HERO_POSES` (`stand`, `standShoot`, `run1`, `run2`, `jump`, `jumpShoot`, `climb`, `hurt`, `slide`) and `type HeroPose`
  - `HERO_PICTURES` (the poses, then `shot`, `chargedShot`) and `type HeroPicture`
  - `PICTURE_SIZES: Record<HeroPicture, { w: number; h: number }>`, `PICTURE_NAMES: Record<HeroPicture, string>`, `MAX_COLOURS = 8`
  - `SPEEDS`, `JUMPS`, `HEALTHS`, `SHOT_COUNTS`; `abilitiesSchema`; `type Abilities`; `DEFAULT_ABILITIES`
  - `heroPhysics(abilities: Abilities): PlayerSettings`
  - `abilitiesFromSettings(old: unknown): Abilities` (for upgrading old files)
  - `heroLookSchema`, `heroSchema`; `type HeroLook = { colours: number[]; poses: Record<HeroPose, string[]>; shot: string[]; chargedShot: string[] }`; `type Hero = { abilities: Abilities; look: HeroLook }`
  - `pictureRows(look: HeroLook, picture: HeroPicture): string[]`, `withPicture(look: HeroLook, picture: HeroPicture, rows: string[]): HeroLook`
  - `lookProblems(look: HeroLook): string[]`

- [ ] **Step 1: Write the failing test**

`tests/model/hero.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  abilitiesFromSettings,
  abilitiesSchema,
  DEFAULT_ABILITIES,
  HERO_PICTURES,
  heroLookSchema,
  heroPhysics,
  lookProblems,
  PICTURE_SIZES,
  pictureRows,
  withPicture,
  type HeroLook,
} from "@/model/hero";
import { DEFAULT_PLAYER } from "@/model/schema";

const solid = (w: number, h: number, ch = "1") => Array.from({ length: h }, () => ch.repeat(w));

function look(): HeroLook {
  const rows = (p: (typeof HERO_PICTURES)[number]) => solid(PICTURE_SIZES[p].w, PICTURE_SIZES[p].h);
  return {
    colours: [13, 27],
    poses: {
      stand: rows("stand"), standShoot: rows("standShoot"), run1: rows("run1"), run2: rows("run2"),
      jump: rows("jump"), jumpShoot: rows("jumpShoot"), climb: rows("climb"), hurt: rows("hurt"),
      slide: rows("slide"),
    },
    shot: rows("shot"),
    chargedShot: rows("chargedShot"),
  };
}

describe("heroPhysics", () => {
  it("gives milestone 1's numbers for normal abilities", () => {
    expect(heroPhysics(DEFAULT_ABILITIES)).toEqual(DEFAULT_PLAYER);
  });

  it("turns each step into its value", () => {
    const at = (changes: Partial<typeof DEFAULT_ABILITIES>) => heroPhysics({ ...DEFAULT_ABILITIES, ...changes });
    expect([at({ speed: "fast" }).runSpeed, at({ speed: "veryFast" }).runSpeed]).toEqual([1.625, 1.875]);
    expect([at({ jump: "low" }), at({ jump: "high" }), at({ jump: "veryHigh" })].map((p) => p.jumpVelocity)).toEqual([
      4.375, 5.375, 6.125,
    ]);
    expect([at({ health: "fragile" }).maxHealth, at({ health: "tough" }).maxHealth]).toEqual([20, 40]);
    expect([1, 2, 5].map((shots) => at({ shots: shots as 1 | 2 | 5 }).maxShots)).toEqual([1, 2, 5]);
  });

  it("keeps gravity, falling and climbing as they were", () => {
    const fast = heroPhysics({ ...DEFAULT_ABILITIES, speed: "veryFast", jump: "veryHigh" });
    expect([fast.gravity, fast.maxFallSpeed, fast.ladderSpeed]).toEqual([0.25, 7, 1.25]);
  });
});

describe("abilitiesSchema", () => {
  it("accepts only the named steps", () => {
    expect(abilitiesSchema.safeParse(DEFAULT_ABILITIES).success).toBe(true);
    expect(abilitiesSchema.safeParse({ ...DEFAULT_ABILITIES, jump: "huge" }).success).toBe(false);
    expect(abilitiesSchema.safeParse({ ...DEFAULT_ABILITIES, shots: 4 }).success).toBe(false);
  });
});

describe("abilitiesFromSettings", () => {
  it("maps milestone 1's numbers to normal", () => {
    expect(abilitiesFromSettings(DEFAULT_PLAYER)).toEqual(DEFAULT_ABILITIES);
  });

  it("maps other numbers to the nearest step, and anything unreadable to normal", () => {
    expect(abilitiesFromSettings({ ...DEFAULT_PLAYER, runSpeed: 2, jumpVelocity: 6, maxHealth: 35, maxShots: 5 })).toEqual({
      ...DEFAULT_ABILITIES,
      speed: "veryFast",
      jump: "veryHigh",
      health: "tough",
      shots: 5,
    });
    expect(abilitiesFromSettings(undefined)).toEqual(DEFAULT_ABILITIES);
    expect(abilitiesFromSettings({ runSpeed: "fast" })).toEqual(DEFAULT_ABILITIES);
  });
});

describe("hero looks", () => {
  it("accepts a complete look", () => {
    expect(heroLookSchema.safeParse(look()).success).toBe(true);
    expect(lookProblems(look())).toEqual([]);
  });

  it("refuses colours outside the palette, and too many colours", () => {
    expect(heroLookSchema.safeParse({ ...look(), colours: [55] }).success).toBe(false);
    expect(heroLookSchema.safeParse({ ...look(), colours: [0, 1, 2, 3, 4, 5, 6, 7, 8] }).success).toBe(false);
    expect(heroLookSchema.safeParse({ ...look(), colours: [] }).success).toBe(false);
  });

  it("names pictures of the wrong size", () => {
    const bad = withPicture(look(), "run1", solid(16, 23));
    expect(lookProblems(bad)).toEqual(["Run 1 is 16 by 23 pixels, not 16 by 24."]);
    const ragged = withPicture(look(), "shot", ["111111", "11111", "111111", "111111"]);
    expect(lookProblems(ragged)).toEqual(["Shot row 2 is 5 pixels wide, not 6."]);
  });

  it("names pixels that use a colour the hero does not have", () => {
    const bad = withPicture(look(), "slide", solid(24, 16, "3"));
    expect(lookProblems(bad)).toEqual(['Slide uses colour 3, but the hero only has 2 colours.']);
    const odd = withPicture(look(), "stand", solid(16, 24, "x"));
    expect(lookProblems(odd)).toEqual(['Stand has a pixel "x" that is not a colour.']);
  });

  it("reads and replaces any picture", () => {
    const changed = withPicture(look(), "chargedShot", solid(12, 10, "2"));
    expect(pictureRows(changed, "chargedShot")[0]).toBe("222222222222");
    expect(pictureRows(changed, "stand")).toEqual(look().poses.stand);
    expect(pictureRows(withPicture(look(), "climb", solid(16, 24, ".")), "climb")[0]).toBe("................");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/model/hero.test.ts`
Expected: FAIL (cannot resolve `@/model/hero`).

- [ ] **Step 3: Write the implementation**

`src/model/hero.ts`:

```ts
import { z } from "zod";
import { PALETTE_8BIT } from "./palette";
import type { PlayerSettings } from "./schema";

// The hero: what the kid chose for it (abilities, from named steps) and what it looks like.

export const HERO_POSES = ["stand", "standShoot", "run1", "run2", "jump", "jumpShoot", "climb", "hurt", "slide"] as const;
export type HeroPose = (typeof HERO_POSES)[number];

export const HERO_PICTURES = [...HERO_POSES, "shot", "chargedShot"] as const;
export type HeroPicture = (typeof HERO_PICTURES)[number];

const BODY = { w: 16, h: 24 };
export const PICTURE_SIZES: Record<HeroPicture, { w: number; h: number }> = {
  stand: BODY,
  standShoot: BODY,
  run1: BODY,
  run2: BODY,
  jump: BODY,
  jumpShoot: BODY,
  climb: BODY,
  hurt: BODY,
  slide: { w: 24, h: 16 },
  shot: { w: 6, h: 4 },
  chargedShot: { w: 12, h: 10 },
};

export const PICTURE_NAMES: Record<HeroPicture, string> = {
  stand: "Stand",
  standShoot: "Stand and shoot",
  run1: "Run 1",
  run2: "Run 2",
  jump: "Jump",
  jumpShoot: "Jump and shoot",
  climb: "Climb",
  hurt: "Hurt",
  slide: "Slide",
  shot: "Shot",
  chargedShot: "Charged shot",
};

export const MAX_COLOURS = 8;

// ---- Abilities ----

export const SPEEDS = ["normal", "fast", "veryFast"] as const;
export const JUMPS = ["low", "normal", "high", "veryHigh"] as const;
export const HEALTHS = ["fragile", "normal", "tough"] as const;
export const SHOT_COUNTS = [1, 2, 3, 5] as const;

export const abilitiesSchema = z.object({
  speed: z.enum(SPEEDS),
  jump: z.enum(JUMPS),
  health: z.enum(HEALTHS),
  shots: z.literal(SHOT_COUNTS),
  slide: z.boolean(),
  chargeShot: z.boolean(),
});
export type Abilities = z.infer<typeof abilitiesSchema>;

export const DEFAULT_ABILITIES: Abilities = {
  speed: "normal",
  jump: "normal",
  health: "normal",
  shots: 3,
  slide: false,
  chargeShot: false,
};

// The only place ability steps become numbers. Normal everywhere is milestone 1's hero.
// Measured with the checker: low and normal jumps clear a 2-tile wall, high 3 and very high 4.
const RUN_SPEED: Record<Abilities["speed"], number> = { normal: 1.375, fast: 1.625, veryFast: 1.875 };
const JUMP_VELOCITY: Record<Abilities["jump"], number> = { low: 4.375, normal: 4.875, high: 5.375, veryHigh: 6.125 };
const MAX_HEALTH: Record<Abilities["health"], number> = { fragile: 20, normal: 28, tough: 40 };

export function heroPhysics(abilities: Abilities): PlayerSettings {
  return {
    runSpeed: RUN_SPEED[abilities.speed],
    jumpVelocity: JUMP_VELOCITY[abilities.jump],
    gravity: 0.25,
    maxFallSpeed: 7,
    ladderSpeed: 1.25,
    maxHealth: MAX_HEALTH[abilities.health],
    maxShots: abilities.shots,
  };
}

// The step whose value is closest (the first, on a tie); the default when the value is unreadable.
function nearest<K extends string | number>(steps: [K, number][], value: unknown, fallback: K): K {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  let best = steps[0];
  for (const step of steps) if (Math.abs(step[1] - value) < Math.abs(best[1] - value)) best = step;
  return best[0];
}

// For games saved before heroes: the steps nearest to the physics numbers they stored.
export function abilitiesFromSettings(old: unknown): Abilities {
  const s = (typeof old === "object" && old !== null ? old : {}) as Record<string, unknown>;
  const entries = <K extends string>(table: Record<K, number>) => Object.entries(table) as [K, number][];
  return {
    speed: nearest(entries(RUN_SPEED), s.runSpeed, "normal"),
    jump: nearest(entries(JUMP_VELOCITY), s.jumpVelocity, "normal"),
    health: nearest(entries(MAX_HEALTH), s.maxHealth, "normal"),
    shots: nearest(SHOT_COUNTS.map((n): [Abilities["shots"], number] => [n, n]), s.maxShots, 3),
    slide: false,
    chargeShot: false,
  };
}

// ---- Look ----

const rows = z.array(z.string()).min(1).max(64);

export const heroLookSchema = z.object({
  colours: z
    .array(z.number().int().min(0).max(PALETTE_8BIT.length - 1))
    .min(1)
    .max(MAX_COLOURS),
  poses: z.record(z.enum(HERO_POSES), rows),
  shot: rows,
  chargedShot: rows,
});
export type HeroLook = z.infer<typeof heroLookSchema>;

export const heroSchema = z.object({ abilities: abilitiesSchema, look: heroLookSchema });
export type Hero = z.infer<typeof heroSchema>;

export function pictureRows(look: HeroLook, picture: HeroPicture): string[] {
  if (picture === "shot") return look.shot;
  if (picture === "chargedShot") return look.chargedShot;
  return look.poses[picture];
}

export function withPicture(look: HeroLook, picture: HeroPicture, rows: string[]): HeroLook {
  if (picture === "shot") return { ...look, shot: rows };
  if (picture === "chargedShot") return { ...look, chargedShot: rows };
  return { ...look, poses: { ...look.poses, [picture]: rows } };
}

// Everything wrong with a look that the schema cannot see: sizes, and pixels naming missing colours.
// A pixel is "." (transparent) or a digit naming a colour slot, "1" for the first.
export function lookProblems(look: HeroLook): string[] {
  const problems: string[] = [];
  for (const picture of HERO_PICTURES) {
    const name = PICTURE_NAMES[picture];
    const { w, h } = PICTURE_SIZES[picture];
    const pixels = pictureRows(look, picture);
    if (pixels.length !== h || pixels[0].length !== w) {
      problems.push(`${name} is ${pixels[0].length} by ${pixels.length} pixels, not ${w} by ${h}.`);
      continue;
    }
    const ragged = pixels.findIndex((row) => row.length !== w);
    if (ragged >= 0) {
      problems.push(`${name} row ${ragged} is ${pixels[ragged].length} pixels wide, not ${w}.`);
      continue;
    }
    const odd = [...pixels.join("")].find((ch) => ch !== "." && !/[1-8]/.test(ch));
    if (odd) {
      problems.push(`${name} has a pixel "${odd}" that is not a colour.`);
      continue;
    }
    const highest = Math.max(0, ...[...pixels.join("")].filter((ch) => ch !== ".").map(Number));
    if (highest > look.colours.length) {
      const count = look.colours.length;
      problems.push(`${name} uses colour ${highest}, but the hero only has ${count} colour${count === 1 ? "" : "s"}.`);
    }
  }
  return problems;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/model/hero.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/model/hero.ts tests/model/hero.test.ts
git commit -m "feat: model the hero: pictures, abilities from named steps, and the ability table"
```

---
### Task 3: The snow hero as a hero look

**Files:**
- Create: `src/content/snow/palette.ts`, `src/content/snow/hero.ts`
- Modify: `src/model/contentPack.ts`, `src/content/snow/art.ts`, `src/content/snow/pack.ts`, `tests/fixtures/testPack.ts`
- Test: `tests/content/snowHero.test.ts`

**Interfaces:**
- Consumes: `HeroLook`, `HERO_POSES`, `HERO_PICTURES`, `HeroPicture`, `lookProblems` (Task 2); `nearestColour`, `PALETTE_8BIT` (Task 1)
- Produces:
  - `ContentPack.hero: HeroLook` (a pack's default hero)
  - `SNOW_PALETTE: Record<string, string>` (`src/content/snow/palette.ts`; the letters-to-colours table that was `PALETTE` in `art.ts`)
  - `SNOW_HERO_PICTURES: Record<HeroPicture, string[]>` (the snow hero in snow-palette letters) and `snowHero: HeroLook` (`src/content/snow/hero.ts`)
  - `snowPack.hero === snowHero`; `testHero: HeroLook` and `testPack.hero === testHero` (`tests/fixtures/testPack.ts`)

- [ ] **Step 1: Write the failing test**

`tests/content/snowHero.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SNOW_HERO_PICTURES, snowHero } from "@/content/snow/hero";
import { snowPack } from "@/content/snow/pack";
import { HERO_PICTURES, HERO_POSES, lookProblems, pictureRows } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import { testHero, testPack } from "../fixtures/testPack";

const LETTERS = ["k", "t", "T", "w", "o", "G", "y"];
const toLetters = (rows: string[]) =>
  rows.map((row) => [...row].map((ch) => (ch === "." ? "." : LETTERS[Number(ch) - 1])).join(""));

describe("the snow hero", () => {
  it("is a complete, valid hero look", () => {
    expect(lookProblems(snowHero)).toEqual([]);
  });

  it("is the snow pack's hero", () => {
    expect(snowPack.hero).toBe(snowHero);
  });

  it("keeps the snow hero's drawing, with its seven colours snapped to the 8-bit palette", () => {
    expect(snowHero.colours).toHaveLength(7);
    expect(PALETTE_8BIT[snowHero.colours[0]]).toBe("#000000"); // the outline
    expect(PALETTE_8BIT[snowHero.colours[3]]).toBe("#f8f8f8"); // the eyes
    for (const picture of HERO_PICTURES) {
      expect(toLetters(pictureRows(snowHero, picture)), picture).toEqual(SNOW_HERO_PICTURES[picture]);
    }
  });

  it("gives every pose something to see", () => {
    for (const pose of HERO_POSES) {
      expect(snowHero.poses[pose].join("").replace(/\./g, "").length, pose).toBeGreaterThan(50);
    }
  });
});

describe("the test pack's hero", () => {
  it("is a valid hero look", () => {
    expect(lookProblems(testHero)).toEqual([]);
    expect(testPack.hero).toBe(testHero);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/content/snowHero.test.ts`
Expected: FAIL (cannot resolve `@/content/snow/hero`).

- [ ] **Step 3: Move the snow colours into their own file**

Create `src/content/snow/palette.ts` with the colour table cut from the top of `src/content/snow/art.ts` (the `const PALETTE: Record<string, string> = { k: "#1a1c2c", … E: "#2d8f4e" };` block, unchanged except its name and export):

```ts
// The snow pack's colours, by the letter its pixel art uses for each.
export const SNOW_PALETTE: Record<string, string> = {
  k: "#1a1c2c", // outline
  w: "#f4f4f4",
  t: "#2ec4b6",
  T: "#1b8a80",
  o: "#ff9f1c",
  g: "#8d99ae",
  G: "#4a5568",
  b: "#3a86ff",
  B: "#1d4ed8",
  i: "#bdf4ff",
  I: "#5bc0eb",
  n: "#f8fafc",
  N: "#cbd5e1",
  d: "#8b5e34",
  D: "#5c3d22",
  c: "#64748b",
  C: "#334155",
  h: "#c08a4a",
  H: "#7a4f24",
  r: "#ef476f",
  R: "#a4133c",
  y: "#ffd166",
  p: "#9b5de5",
  P: "#5a2d91",
  e: "#80ed99",
  E: "#2d8f4e",
};
```

In `src/content/snow/art.ts`, delete the `const PALETTE … };` block, add `import { SNOW_PALETTE } from "./palette";`, and change `palette: PALETTE,` to `palette: SNOW_PALETTE,`. Also change `import { GROUND, ICE, LADDER, LEDGE, SPIKE } from "./pack";` to import from `"./tiles"`, so that `art.ts` no longer depends on `pack.ts` (the pack is about to depend on the hero, and the art on the hero).

- [ ] **Step 4: Move the hero into `hero.ts`**

Create `src/content/snow/hero.ts`. Move into it, unchanged, everything in `src/content/snow/art.ts` from the line `// ---- The hero, 16 by 24, built from parts ----` down to (but not including) the line `const hero = (head: string[], arms: string[], legs: string[]) =>`: that is `HEAD`, `HURT_HEAD`, `BACK_HEAD`, `TORSO`, `ARMS_DOWN`, `ARMS_SHOOT`, `ARMS_UP`, `WAIST`, `LEGS_STAND`, `LEGS_RUN1`, `LEGS_RUN2`, `LEGS_JUMP`, `LEGS_CLIMB`. Delete the `const hero = …` helper from `art.ts` too. Then complete `hero.ts`:

```ts
import { HERO_POSES, type HeroLook, type HeroPicture } from "@/model/hero";
import { nearestColour } from "@/model/palette";
import { SNOW_PALETTE } from "./palette";

// ---- The hero, 16 by 24, built from parts ----

// (HEAD … LEGS_CLIMB, moved here from art.ts unchanged)

const body = (head: string[], arms: string[], legs: string[]) => [...head, ...TORSO, ...arms, ...WAIST, ...legs];

// Sliding: 24 by 16, low and long, head forward.
const SLIDE = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "..............kkkk......",
  ".............kttttk.....",
  "............kttttttk....",
  "............ktwwwwtk....",
  "............ktwkwktk....",
  "..kkkkkkkkkkktwwwwtk....",
  ".kGGkttTTTTTkkttttk.....",
  "kGGGkttTTTTTTTkkkkttk...",
  "kGGGkkttTTTTTTTTTTtttk..",
  "kkkkkkkkttTTTTTTTTkkkk..",
  ".......kkkkkkkkkkkk.....",
];

const SHOT = [".kkkk.", "kyyywk", "kyyywk", ".kkkk."];

const CHARGED_SHOT = [
  "....kkkk....",
  "..kkyyyykk..",
  ".kyyywwyyyk.",
  ".kyywwwwyyk.",
  "kyywwwwwwyyk",
  "kyywwwwwwyyk",
  ".kyywwwwyyk.",
  ".kyyywwyyyk.",
  "..kkyyyykk..",
  "....kkkk....",
];

// The snow hero in the snow palette's letters.
export const SNOW_HERO_PICTURES: Record<HeroPicture, string[]> = {
  stand: body(HEAD, ARMS_DOWN, LEGS_STAND),
  standShoot: body(HEAD, ARMS_SHOOT, LEGS_STAND),
  run1: body(HEAD, ARMS_DOWN, LEGS_RUN1),
  run2: body(HEAD, ARMS_DOWN, LEGS_RUN2),
  jump: body(HEAD, ARMS_UP, LEGS_JUMP),
  jumpShoot: body(HEAD, ARMS_SHOOT, LEGS_JUMP),
  climb: body(BACK_HEAD, ARMS_UP, LEGS_CLIMB),
  hurt: body(HURT_HEAD, ARMS_UP, LEGS_JUMP),
  slide: SLIDE,
  shot: SHOT,
  chargedShot: CHARGED_SHOT,
};

// Each letter the hero uses becomes a colour slot, "1" for the first.
const LETTERS = ["k", "t", "T", "w", "o", "G", "y"];

function toSlots(rows: string[]): string[] {
  return rows.map((row) =>
    [...row]
      .map((ch) => {
        if (ch === ".") return ".";
        const slot = LETTERS.indexOf(ch);
        if (slot < 0) throw new Error(`The snow hero uses the letter "${ch}", which has no colour slot.`);
        return String(slot + 1);
      })
      .join(""),
  );
}

export const snowHero: HeroLook = {
  colours: LETTERS.map((ch) => nearestColour(SNOW_PALETTE[ch])),
  poses: Object.fromEntries(HERO_POSES.map((pose) => [pose, toSlots(SNOW_HERO_PICTURES[pose])])) as HeroLook["poses"],
  shot: toSlots(SHOT),
  chargedShot: toSlots(CHARGED_SHOT),
};
```

In `src/content/snow/art.ts`, until heroes are drawn from the game's look (Task 5), build the old `player` and `playerShot` from these pictures. Add `PLAYER_POSES` to the import from `@/runtime/render/art`, add `import { SNOW_HERO_PICTURES } from "./hero";`, and replace the `player: { stand: hero(…), … hurt: hero(…) },` entry and the `playerShot: sprite([…]),` entry with:

```ts
  player: Object.fromEntries(PLAYER_POSES.map((pose) => [pose, sprite(SNOW_HERO_PICTURES[pose])])) as ArtSet["player"],
```

```ts
  playerShot: sprite(SNOW_HERO_PICTURES.shot),
```

- [ ] **Step 5: Give packs a hero**

In `src/model/contentPack.ts` add `import type { HeroLook } from "./hero";` and, in `ContentPack`, after `pieces: PieceDef[];`:

```ts
  hero: HeroLook; // the hero a new game starts with
```

In `src/content/snow/pack.ts` add `import { snowHero } from "./hero";` and `hero: snowHero,` to `snowPack`.

In `tests/fixtures/testPack.ts` add, above `testPack`:

```ts
import { HERO_PICTURES, PICTURE_SIZES, type HeroLook, type HeroPicture } from "@/model/hero";

const solid = (picture: HeroPicture) =>
  Array.from({ length: PICTURE_SIZES[picture].h }, () => "1".repeat(PICTURE_SIZES[picture].w));

// A plain black hero: every picture filled with its one colour.
export const testHero: HeroLook = {
  colours: [13],
  poses: Object.fromEntries(HERO_PICTURES.filter((p) => p !== "shot" && p !== "chargedShot").map((p) => [p, solid(p)])) as HeroLook["poses"],
  shot: solid("shot"),
  chargedShot: solid("chargedShot"),
};
```

(merge the import into the file's existing imports) and `hero: testHero,` to `testPack`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/content tests/runtime && npm run typecheck`
Expected: PASS, including `tests/runtime/snowArt.test.ts` (the snow art still covers every pose); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/content/snow src/model/contentPack.ts tests/fixtures/testPack.ts tests/content/snowHero.test.ts
git commit -m "feat: make the snow hero a hero look in the 8-bit palette, with a slide pose and a charged shot"
```

---

### Task 4: Games store their hero

**Files:**
- Modify: `src/model/schema.ts`, `src/model/factory.ts`, `src/model/parse.ts`, `src/model/validate.ts`, `src/runtime/sim/state.ts`, `src/checker/check.ts`, `src/checker/cache.ts`, `src/ai/describe.ts`
- Modify tests: `tests/model/factory.test.ts`, `tests/model/parse.test.ts`, `tests/checker/cache.test.ts`, `tests/checker/pieces.test.ts`, `tests/checker/passage.test.ts`, `tests/checker/routes.test.ts`, `tests/checker/reasons.test.ts`, `tests/checker/fairness.test.ts`, `tests/runtime/movement.test.ts`, `tests/editor/checks.test.tsx`
- Test (new): `tests/runtime/abilities.test.ts`, `tests/checker/abilities.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3
- Produces:
  - `FORMAT_VERSION = 2`; `Project.hero: Hero` (no `player`)
  - `createProject` gives `hero: { abilities: { ...DEFAULT_ABILITIES }, look: pack.hero }`
  - `parseProject` upgrades version 1 documents
  - `structureProblems` includes the hero look's problems, each prefixed "The hero: "
  - the simulation, the checker and the assistant's catalogue use `heroPhysics(project.hero.abilities)`
  - `CheckCache` rechecks when `project.hero.abilities` changes (by identity)

- [ ] **Step 1: Write the failing tests**

Add to `tests/model/parse.test.ts` (and add `import { DEFAULT_ABILITIES } from "@/model/hero";`, `import { DEFAULT_PLAYER } from "@/model/schema";` alongside `type Project`, and `import { testHero } from "../fixtures/testPack";` alongside `testPack`):

```ts
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
```

and change the existing newer-version test to use format version 3:

```ts
    expect(errorOf({ ...project(), formatVersion: 3 })).toMatch(/newer version/);
```

In `tests/model/factory.test.ts`, change the "rejects a document with the wrong format version" test's `formatVersion: 2` to `formatVersion: 3`, and add (with `import { DEFAULT_ABILITIES } from "@/model/hero";` and `testHero` imported from `"../fixtures/testPack"`):

```ts
  it("gives a new game the pack's hero with normal abilities", () => {
    const project = createProject({ id: "p1", name: "My Game" }, testPack);
    expect(project.formatVersion).toBe(2);
    expect(project.hero).toEqual({ abilities: DEFAULT_ABILITIES, look: testHero });
    expect(project).not.toHaveProperty("player");
  });
```

`tests/runtime/abilities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDemoProject, DEMO_LEVEL_ID } from "@/content/demo";
import { snowPack } from "@/content/snow/pack";
import type { Abilities } from "@/model/hero";
import { draw } from "@/runtime/render/draw";
import { createSim, step } from "@/runtime/sim";
import { NO_INPUT } from "@/runtime/sim/state";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt } from "./helpers";
import { run } from "./simHelpers";

function sim(changes: Partial<Abilities>) {
  const project = projectFromArt([{ art: flatArt() }]);
  const hero = { ...project.hero, abilities: { ...project.hero.abilities, ...changes } };
  return createSim({ ...project, hero }, "L1", testPack);
}

describe("the hero's abilities in play", () => {
  it("runs at the hero's speed", () => {
    for (const [speed, perStep] of [["normal", 1.375], ["fast", 1.625], ["veryFast", 1.875]] as const) {
      const s = sim({ speed });
      const start = s.player.x;
      run(s, { right: true }, 10);
      expect(s.player.x - start, speed).toBeCloseTo(10 * perStep);
    }
  });

  it("starts with the hero's health", () => {
    expect(sim({ health: "fragile" }).player.health).toBe(20);
    expect(sim({ health: "normal" }).player.health).toBe(28);
    expect(sim({ health: "tough" }).player.health).toBe(40);
  });

  it("allows the hero's number of shots on screen", () => {
    for (const shots of [1, 2, 3, 5] as const) {
      const s = sim({ shots });
      let most = 0;
      for (let i = 0; i < 20; i++) {
        run(s, { shoot: true }, 1);
        run(s, {}, 1);
        most = Math.max(most, s.shots.length);
      }
      expect(most, `${shots} shots`).toBe(shots);
    }
  });

  it("fits the tough hero's longer health bar on screen", () => {
    const project = createDemoProject();
    const hero = { ...project.hero, abilities: { ...project.hero.abilities, health: "tough" as const } };
    const s = createSim({ ...project, hero }, DEMO_LEVEL_ID, snowPack);
    step(s, NO_INPUT);
    const rects: { y: number; h: number }[] = [];
    const ctx = {
      fillStyle: "",
      font: "",
      textAlign: "start" as CanvasTextAlign,
      fillRect: (_x: number, y: number, _w: number, h: number) => rects.push({ y, h }),
      fillText: () => {},
      drawImage: () => {},
    };
    draw(ctx, s);
    expect(rects.every((r) => r.y >= 0 && r.y + r.h <= 240)).toBe(true);
    expect(rects.some((r) => r.h === 40 * 2 + 1)).toBe(true); // the bar's frame, one tick per point
  });
});
```

`tests/checker/abilities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkZone } from "@/checker/check";
import type { Abilities } from "@/model/hero";
import { game, pack, run } from "../ai/helpers";

// Zone 1 with a wall two tiles thick and `height` tiles tall standing on the floor.
function wall(height: number, jump: Abilities["jump"]) {
  const p = run(game(), "fillRect", { levelId: "L1", zoneId: "z1", x: 8, y: 13 - height, w: 2, h: height, tile: 1 });
  return { ...p, hero: { ...p.hero, abilities: { ...p.hero.abilities, jump } } };
}

describe("jump steps, played by the checker", () => {
  for (const [jump, clears] of [["low", 2], ["normal", 2], ["high", 3], ["veryHigh", 4]] as const) {
    it(`a ${jump} jump clears a ${clears}-tile wall but not ${clears + 1}`, () => {
      expect(checkZone(wall(clears, jump), "L1", "z1", pack).passable).toBe(true);
      expect(checkZone(wall(clears + 1, jump), "L1", "z1", pack).passable).toBe(false);
    });
  }
});
```

In `tests/checker/cache.test.ts`, replace the test "checks again when the player's settings change" with:

```ts
  it("checks again when the hero's abilities change, but not its look", () => {
    const cache = createCheckCache();
    const project = game();
    const first = cache.zone(project, "L1", "z1", pack);
    const recoloured = { ...project, hero: { ...project.hero, look: { ...project.hero.look, colours: [0, 1, 2, 3, 4, 5, 6] } } };
    expect(cache.zone(recoloured, "L1", "z1", pack)).toBe(first);
    const lowJump = { ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, jump: "low" as const } } };
    expect(cache.zone(lowJump, "L1", "z1", pack)).not.toBe(first);
  });

  it("finds a zone that fails with a lower jump, and passes it again when the jump is put back", () => {
    const cache = createCheckCache();
    const walled = run(game(), { name: "fillRect", args: { levelId: "L1", zoneId: "z1", x: 8, y: 10, w: 2, h: 3, tile: 1 } });
    const withJump = (jump: "low" | "high") => ({
      ...walled,
      hero: { ...walled.hero, abilities: { ...walled.hero.abilities, jump } },
    });
    const high = withJump("high");
    expect(cache.zone(high, "L1", "z1", pack).passable).toBe(true);
    expect(cache.zone(withJump("low"), "L1", "z1", pack).passable).toBe(false);
    expect(cache.zone(high, "L1", "z1", pack).passable).toBe(true); // undo brings back the same abilities
  });
```

In `tests/checker/pieces.test.ts`, add (with `import { JUMPS, SPEEDS } from "@/model/hero";`):

```ts
  for (const jump of JUMPS) {
    it(`can all be crossed by a hero with a ${jump} jump, at every speed`, () => {
      for (const speed of SPEEDS) {
        for (const piece of snowPieces) {
          for (const settings of settingCombos(piece)) {
            const project = zoneWithPiece(piece, settings);
            const hero = { ...project.hero, abilities: { ...project.hero.abilities, jump, speed } };
            const result = checkZone({ ...project, hero }, "L", "z", snowPack);
            expect(result.passable, `${piece.id} ${JSON.stringify(settings)} ${speed}: ${result.reason}`).toBe(true);
          }
        }
      }
    }, 120_000);
  }
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/model tests/runtime/abilities.test.ts tests/checker/abilities.test.ts tests/checker/cache.test.ts`
Expected: FAIL: projects have no `hero`, format version is 1, and the upgrade tests fail.

- [ ] **Step 3: Store the hero in the project**

In `src/model/schema.ts`:
- set `export const FORMAT_VERSION = 2;`
- add `import { heroSchema } from "./hero";`
- delete `playerSettingsSchema`, and replace `player: playerSettingsSchema,` in `projectSchema` with `hero: heroSchema,`
- replace `export type PlayerSettings = z.infer<typeof playerSettingsSchema>;` with a plain type (the physics the game computes from a hero's abilities; no longer stored):

```ts
// The hero's physics, computed from its abilities by heroPhysics. Units are pixels and simulation
// steps (60 per second).
export type PlayerSettings = {
  runSpeed: number;
  jumpVelocity: number;
  gravity: number;
  maxFallSpeed: number;
  ladderSpeed: number;
  maxHealth: number;
  maxShots: number;
};
```

`DEFAULT_PLAYER` stays as it is.

In `src/model/factory.ts`, in `createProject`, replace `player: { ...DEFAULT_PLAYER },` with:

```ts
    hero: { abilities: { ...DEFAULT_ABILITIES }, look: pack.hero },
```

importing `DEFAULT_ABILITIES` from `"./hero"` and removing the now-unused `DEFAULT_PLAYER` import.

In `src/model/validate.ts`, import `lookProblems` from `"./hero"` and, in `structureProblems` before `return problems;`:

```ts
  problems.push(...lookProblems(project.hero.look).map((p) => `The hero: ${p}`));
```

- [ ] **Step 4: Upgrade version 1 games**

In `src/model/parse.ts`, import `abilitiesFromSettings` from `"./hero"` and replace the `UPGRADES` declaration and the upgrade loop:

```ts
// One entry per old format version: upgrades a document to the next version.
const UPGRADES: Record<number, (doc: Record<string, unknown>, pack: ContentPack) => Record<string, unknown>> = {
  // Version 2 gave games a hero. A version 1 game gets the pack's hero, with the abilities
  // nearest to the physics numbers it stored (milestone 1's defaults become normal everywhere).
  1: (doc, pack) => {
    const { player, ...rest } = doc;
    return { ...rest, formatVersion: 2, hero: { abilities: abilitiesFromSettings(player), look: pack.hero } };
  },
};
```

```ts
  if (version < FORMAT_VERSION) {
    const pack = getPack(String(doc.contentPackId));
    if (!pack) {
      return {
        ok: false,
        error: `This project needs the content pack "${String(doc.contentPackId)}", which is not available.`,
      };
    }
    for (let v = version; v < FORMAT_VERSION; v++) doc = UPGRADES[v](doc, pack);
  }
```

- [ ] **Step 5: Play and check the hero's abilities**

In `src/runtime/sim/state.ts`, import `heroPhysics` from `"@/model/hero"`, compute `const settings = heroPhysics(project.hero.abilities);` before the player is made, and use it: `health: settings.maxHealth,` and `settings,` in the sim (replacing `project.player.maxHealth` and `settings: project.player`).

In `src/checker/check.ts`, import `heroPhysics` and change `const settings = project.player;` to `const settings = heroPhysics(project.hero.abilities);`.

In `src/checker/cache.ts`, key on the abilities:

```ts
import type { Abilities } from "@/model/hero";
import type { Checkpoint, Project, Zone } from "@/model/schema";
```

```ts
type Cached = { abilities: Abilities; checkpoints: Checkpoint[]; pack: ContentPack; check: ZoneCheck };
```

and in `zone`, compare and store `abilities: project.hero.abilities` where it compared and stored `player: project.player`. Update the comment above `createCheckCache` to say "the hero's abilities" instead of "the player's settings".

In `src/ai/describe.ts`, import `heroPhysics` from `"@/model/hero"` and in `describeCatalogue` use `const physics = heroPhysics(project.hero.abilities);` with `jumpReach(physics)` and `clearableGap(physics)`.

- [ ] **Step 6: Update the tests that set physics numbers directly**

- `tests/checker/passage.test.ts`, `routes.test.ts`, `reasons.test.ts`, `fairness.test.ts`: replace `const settings = projectFromArt([{ art: flatArt() }]).player;` with `const settings = DEFAULT_PLAYER;`, importing `DEFAULT_PLAYER` from `"@/model/schema"` (and dropping `projectFromArt`/`flatArt` imports if they become unused).
- `tests/runtime/movement.test.ts`, test "uses the project's player settings": rename it "uses the hero's speed" and replace its body with:

```ts
    const project = projectFromArt([{ art: flatArt() }]);
    const fast = { ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, speed: "veryFast" as const } } };
    const sim = createSim(fast, "L1", testPack);
    const start = sim.player.x;
    run(sim, { right: true }, 10);
    expect(sim.player.x - start).toBeCloseTo(18.75);
```

- `tests/editor/checks.test.tsx`, test "rechecks every zone when the player's settings change": rename it "rechecks every zone when the hero's abilities change" and change its `rerender` line to:

```ts
    rerender({ p: { ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, jump: "low" } } } });
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. If any other test still reads `project.player`, change it the same way as above (abilities on `project.hero`, or `DEFAULT_PLAYER` for raw physics).

- [ ] **Step 8: Commit**

```bash
git add -A src tests
git commit -m "feat: store the hero in the game file, upgrade old games, and play and check the hero's abilities"
```

---
### Task 5: Drawing the hero from the game's look

**Files:**
- Create: `src/runtime/render/heroArt.ts`
- Modify: `src/runtime/render/art.ts`, `src/runtime/render/draw.ts`, `src/runtime/render/PlayCanvas.tsx`, `src/content/snow/art.ts`
- Modify tests: `tests/runtime/render.test.ts`, `tests/runtime/art.test.ts`, `tests/runtime/snowArt.test.ts`
- Test (new): `tests/runtime/heroArt.test.ts`

**Interfaces:**
- Consumes: `HeroLook`, `HeroPose`, `HERO_POSES`, `PICTURE_SIZES` (Task 2); `PALETTE_8BIT` (Task 1); `Project.hero` (Task 4)
- Produces:
  - `type HeroArt = { palette: Record<string, string>; poses: Record<HeroPose, Sprite>; shot: Sprite; chargedShot: Sprite }`
  - `heroArt(look: HeroLook): HeroArt`
  - `type HeroSkin = { art: HeroArt; image: (s: Sprite, flip: boolean) => CanvasImageSource }`; `Skin` gains `hero?: HeroSkin`
  - `ArtSet` loses `player` and `playerShot`; `PLAYER_POSES` and `PlayerPose` are removed; `playerPose` returns `{ pose: HeroPose; flip: boolean }`

- [ ] **Step 1: Write the failing tests**

`tests/runtime/heroArt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { HERO_POSES, PICTURE_SIZES } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import { heroArt } from "@/runtime/render/heroArt";

describe("heroArt", () => {
  const art = heroArt(snowHero);

  it("names each colour slot by its digit", () => {
    expect(art.palette).toEqual(
      Object.fromEntries(snowHero.colours.map((colour, i) => [String(i + 1), PALETTE_8BIT[colour]])),
    );
  });

  it("makes a sprite of every pose and both shots, at their sizes", () => {
    for (const pose of HERO_POSES) {
      expect(art.poses[pose].rows, pose).toEqual(snowHero.poses[pose]);
      expect([art.poses[pose].w, art.poses[pose].h]).toEqual([PICTURE_SIZES[pose].w, PICTURE_SIZES[pose].h]);
    }
    expect(art.shot.rows).toEqual(snowHero.shot);
    expect([art.chargedShot.w, art.chargedShot.h]).toEqual([12, 10]);
  });
});
```

In `tests/runtime/render.test.ts`, add the imports `import { heroArt } from "@/runtime/render/heroArt";` and replace the `skin` helper with:

```ts
const fakeImage = (sprite: Sprite, flip: boolean) => ({ sprite, flip }) as unknown as CanvasImageSource;
const hero = heroArt(createDemoProject().hero.look);
const skin = (set = snowArt): Skin => ({ set, image: fakeImage, hero: { art: hero, image: fakeImage } });
```

and change the expectations that name the old art: `snowArt.player.stand` becomes `hero.poses.stand` (two places), and `snowArt.playerShot` becomes `hero.shot`. Add:

```ts
  it("draws the game's own hero, recoloured", () => {
    const project = createDemoProject();
    const look = { ...project.hero.look, colours: [...project.hero.look.colours].reverse() };
    const sim = createSim({ ...project, hero: { ...project.hero, look } }, DEMO_LEVEL_ID, snowPack);
    step(sim, NO_INPUT);
    const own = heroArt(look);
    const ctx = fakeContext();
    draw(ctx, sim, { set: snowArt, image: fakeImage, hero: { art: own, image: fakeImage } });
    expect(ctx.images).toContainEqual({ sprite: own.poses.stand, flip: false, x: 1, y: 184 });
    expect(own.palette["1"]).not.toBe(hero.palette["1"]);
  });
```

In `tests/runtime/art.test.ts`: remove `PLAYER_POSES` from the import; in `fullArt()` delete the `player: …` and `playerShot: square(4),` entries; in the test "reports a missing background, player pose or thing", rename it "reports a missing background or thing" and delete the `art.player = …` line and the `"Player hurt is 16 by 16, not 16 by 24."` expectation. If the `playerPose` tests use a `PlayerPose` type, use `HeroPose` from `"@/model/hero"` instead.

In `tests/runtime/snowArt.test.ts`, delete the test "gives every player pose something to see" (Task 3's `snowHero.test.ts` covers it).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime`
Expected: FAIL: `@/runtime/render/heroArt` cannot be resolved, and `art.test.ts` fails to compile against the old `ArtSet`.

- [ ] **Step 3: Write the implementation**

`src/runtime/render/heroArt.ts`:

```ts
import { HERO_POSES, type HeroLook, type HeroPose } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import { sprite, type Sprite } from "./art";

// A hero's look as sprites. Its pixels are colour slot digits, so the palette maps "1" to the
// first slot's colour, and so on.
export type HeroArt = {
  palette: Record<string, string>;
  poses: Record<HeroPose, Sprite>;
  shot: Sprite;
  chargedShot: Sprite;
};

export function heroArt(look: HeroLook): HeroArt {
  return {
    palette: Object.fromEntries(look.colours.map((colour, i) => [String(i + 1), PALETTE_8BIT[colour]])),
    poses: Object.fromEntries(HERO_POSES.map((pose) => [pose, sprite(look.poses[pose])])) as Record<HeroPose, Sprite>,
    shot: sprite(look.shot),
    chargedShot: sprite(look.chargedShot),
  };
}
```

In `src/runtime/render/art.ts`:
- delete `PLAYER_POSES` and `PlayerPose`;
- delete `player: Record<PlayerPose, Sprite>;` and `playerShot: Sprite;` from `ArtSet`;
- in `artProblems`, delete the `for (const pose of PLAYER_POSES) …` line and the `check("Player shot", art.playerShot);` line;
- import `type HeroPose` from `"@/model/hero"` and change `playerPose`'s return type to `{ pose: HeroPose; flip: boolean }`.

In `src/content/snow/art.ts`, delete the `player: …` and `playerShot: …` entries, and the imports of `PLAYER_POSES` and `SNOW_HERO_PICTURES` that Task 3 added.

In `src/runtime/render/draw.ts`:

```ts
import type { HeroArt } from "./heroArt";
```

```ts
// Sprite art, and a way to turn a sprite into something drawImage can draw. The hero's art comes
// from the game's own look, with its own palette, so it has its own image maker.
export type HeroSkin = { art: HeroArt; image: (s: Sprite, flip: boolean) => CanvasImageSource };
export type Skin = { set: ArtSet; image: (s: Sprite, flip: boolean) => CanvasImageSource; hero?: HeroSkin };
```

Change `onBox` to take the image maker rather than the whole skin:

```ts
function onBox(
  ctx: Ctx2D,
  image: Skin["image"],
  s: Sprite,
  flip: boolean,
  box: Box,
  ox: number,
  oy: number,
) {
  const x = Math.round(box.x + box.w / 2 - s.w / 2) + ox;
  const y = Math.round(box.y + box.h - s.h) + oy;
  ctx.drawImage(image(s, flip), x, y);
}
```

pass `skin.image` at the existing call for things (`onBox(ctx, skin.image, frame, e.facing < 0, e, ox, oy);`), and draw the hero and its shots from `skin.hero`:

```ts
  if (sim.phase !== "dead" && !blinkedOut) {
    if (skin?.hero) {
      const { pose, flip } = playerPose(p, sim.steps);
      onBox(ctx, skin.hero.image, skin.hero.art.poses[pose], flip, p, originX, originY);
    } else {
      const px = Math.round(p.x) + originX;
      const py = Math.round(p.y) + originY;
      rect(ctx, PLAYER_COLOUR, px, py, p.w, p.h);
      rect(ctx, "#ffffff", p.facing > 0 ? px + p.w - 4 : px + 1, py + 4, 3, 3);
    }
  }

  for (const shot of sim.shots) {
    const x = Math.round(shot.x) + originX;
    const y = Math.round(shot.y) + originY;
    if (skin?.hero) ctx.drawImage(skin.hero.image(skin.hero.art.shot, shot.vx < 0), x, y);
    else rect(ctx, SHOT_COLOUR, x, y, SHOT_W, SHOT_H);
  }
```

In `src/runtime/render/PlayCanvas.tsx`, import `heroArt` from `"./heroArt"` and build the hero's skin from the project:

```ts
    const hero = heroArt(project.hero.look);
    const skin: Skin | undefined = art
      ? {
          set: art,
          image: createSpriteCache(art.palette, browserCanvas),
          hero: { art: hero, image: createSpriteCache(hero.palette, browserCanvas) },
        }
      : undefined;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Look at it**

Run `npm run e2e` (it builds and serves on port 3100, and saves `test-results/` screenshots). Expected: 8 passed. Open the play screenshot from the editor test: the hero looks as before, its colours snapped to the 8-bit palette.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: draw the hero from the game's own look"
```

---

### Task 6: Commands that change the hero

**Files:**
- Create: `src/commands/hero.ts`
- Modify: `src/commands/registry.ts`, `tests/boundaries.test.ts`
- Test: `tests/commands/hero.test.ts`

**Interfaces:**
- Consumes: `abilitiesSchema`, `HERO_PICTURES`, `PICTURE_NAMES`, `MAX_COLOURS`, `pictureRows`, `withPicture`, `lookProblems`, `type HeroLook` (Task 2); `PALETTE_8BIT` (Task 1); `ContentPack.hero` (Task 3); `defineCommand`, `ok`, `fail` (milestone 1)
- Produces commands (each registered in `commandDefs`):
  - `setHeroAbilities { speed?, jump?, health?, shots?, slide?, chargeShot? }`: at least one
  - `setHeroColours { colours: number[] }`: 1–8 palette indices
  - `setHeroPose { picture: HeroPicture, rows: string[] }`
  - `resetHeroLook {}`

- [ ] **Step 1: Write the failing test**

`tests/commands/hero.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createHistory, runCommand, undo } from "@/commands/history";
import { DEFAULT_ABILITIES, PICTURE_SIZES } from "@/model/hero";
import { testHero } from "../fixtures/testPack";
import { baseProject, ctx, run, runError } from "./helpers";

const solid = (w: number, h: number, ch: string) => Array.from({ length: h }, () => ch.repeat(w));

describe("setHeroAbilities", () => {
  it("changes only the abilities it is given", () => {
    const project = run(baseProject(), "setHeroAbilities", { jump: "high", slide: true });
    expect(project.hero.abilities).toEqual({ ...DEFAULT_ABILITIES, jump: "high", slide: true });
    expect(project.hero.look).toBe(baseProject().hero.look);
  });

  it("refuses steps that do not exist, and an empty change", () => {
    expect(runError(baseProject(), "setHeroAbilities", { jump: "huge" })).toMatch(/jump/);
    expect(runError(baseProject(), "setHeroAbilities", { shots: 4 })).toMatch(/shots/);
    expect(runError(baseProject(), "setHeroAbilities", {})).toBe("Give at least one ability to change.");
  });

  it("undoes exactly", () => {
    const history = createHistory(baseProject());
    const { history: changed } = runCommand(history, { name: "setHeroAbilities", args: { speed: "fast" } }, ctx);
    expect(undo(changed).project).toBe(history.project);
  });
});

describe("setHeroColours", () => {
  it("recolours the hero", () => {
    const project = run(baseProject(), "setHeroColours", { colours: [21] });
    expect(project.hero.look.colours).toEqual([21]);
  });

  it("adds colour slots", () => {
    expect(run(baseProject(), "setHeroColours", { colours: [13, 27, 0] }).hero.look.colours).toEqual([13, 27, 0]);
  });

  it("refuses to remove a colour that pixels still use", () => {
    let project = run(baseProject(), "setHeroColours", { colours: [13, 27, 0] });
    project = run(project, "setHeroPose", { picture: "stand", rows: solid(16, 24, "3") });
    project = run(project, "setHeroPose", { picture: "run1", rows: solid(16, 24, "3") });
    expect(runError(project, "setHeroColours", { colours: [13, 27] })).toBe("Colour 3 is still used in Stand and Run 1.");
    expect(run(project, "setHeroColours", { colours: [13, 27, 5] }).hero.look.colours).toEqual([13, 27, 5]);
  });

  it("refuses colours outside the palette, and more than eight", () => {
    expect(runError(baseProject(), "setHeroColours", { colours: [55] })).toMatch(/colours/);
    expect(runError(baseProject(), "setHeroColours", { colours: [0, 1, 2, 3, 4, 5, 6, 7, 8] })).toMatch(/colours/);
    expect(runError(baseProject(), "setHeroColours", { colours: [] })).toMatch(/colours/);
  });
});

describe("setHeroPose", () => {
  it("replaces one picture", () => {
    const rows = solid(PICTURE_SIZES.slide.w, PICTURE_SIZES.slide.h, ".");
    const project = run(baseProject(), "setHeroPose", { picture: "slide", rows });
    expect(project.hero.look.poses.slide).toEqual(rows);
    expect(project.hero.look.poses.stand).toEqual(testHero.poses.stand);
  });

  it("replaces the shots too", () => {
    const project = run(baseProject(), "setHeroPose", { picture: "chargedShot", rows: solid(12, 10, ".") });
    expect(project.hero.look.chargedShot[0]).toBe("............");
  });

  it("refuses a picture of the wrong size, or with a colour the hero lacks", () => {
    expect(runError(baseProject(), "setHeroPose", { picture: "stand", rows: solid(16, 23, "1") })).toBe(
      "Stand is 16 by 23 pixels, not 16 by 24.",
    );
    expect(runError(baseProject(), "setHeroPose", { picture: "shot", rows: solid(6, 4, "2") })).toBe(
      "Shot uses colour 2, but the hero only has 1 colour.",
    );
    expect(runError(baseProject(), "setHeroPose", { picture: "cape", rows: ["1"] })).toMatch(/picture/);
  });
});

describe("resetHeroLook", () => {
  it("puts back the pack's hero and keeps the abilities", () => {
    let project = run(baseProject(), "setHeroAbilities", { speed: "fast" });
    project = run(project, "setHeroColours", { colours: [21, 22] });
    project = run(project, "resetHeroLook", {});
    expect(project.hero.look).toBe(testHero);
    expect(project.hero.abilities.speed).toBe("fast");
  });
});
```

In `tests/boundaries.test.ts`, add the four commands to the list in "has every command in the spec":

```ts
        "addCheckpoint", "removeCheckpoint",
        "setHeroAbilities", "setHeroColours", "setHeroPose", "resetHeroLook",
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/commands/hero.test.ts tests/boundaries.test.ts`
Expected: FAIL (`Unknown command "setHeroAbilities"`; the registry is missing four commands).

- [ ] **Step 3: Write the implementation**

`src/commands/hero.ts`:

```ts
import { z } from "zod";
import {
  abilitiesSchema,
  HERO_PICTURES,
  lookProblems,
  MAX_COLOURS,
  PICTURE_NAMES,
  pictureRows,
  withPicture,
  type HeroLook,
} from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import type { Project } from "@/model/schema";
import { defineCommand, fail, ok, type CommandResult } from "./types";

const withLook = (project: Project, look: HeroLook): Project => ({ ...project, hero: { ...project.hero, look } });

// "Stand", "Stand and Run 1", "Stand, Run 1 and Jump".
function listNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const setHeroAbilitiesCommand = defineCommand({
  name: "setHeroAbilities",
  description:
    "Change the hero's abilities: speed (normal, fast, veryFast), jump (low, normal, high, veryHigh), health (fragile, normal, tough), shots on screen (1, 2, 3 or 5), slide and chargeShot (true or false). Only the given ones change.",
  args: abilitiesSchema.partial().strict(),
  apply(project, args): CommandResult {
    if (Object.keys(args).length === 0) return fail("Give at least one ability to change.");
    return ok({ ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, ...args } } });
  },
});

const setHeroColoursCommand = defineCommand({
  name: "setHeroColours",
  description: `Set the hero's colour slots: 1 to ${MAX_COLOURS} colours from the 8-bit palette (0 to ${PALETTE_8BIT.length - 1}). Pixels name slots, so changing a slot recolours it everywhere.`,
  args: z.strictObject({
    colours: z
      .array(z.number().int().min(0).max(PALETTE_8BIT.length - 1))
      .min(1)
      .max(MAX_COLOURS),
  }),
  apply(project, args) {
    const look = project.hero.look;
    for (let slot = args.colours.length + 1; slot <= look.colours.length; slot++) {
      const users = HERO_PICTURES.filter((p) => pictureRows(look, p).some((row) => row.includes(String(slot))));
      if (users.length > 0) {
        return fail(`Colour ${slot} is still used in ${listNames(users.map((p) => PICTURE_NAMES[p]))}.`);
      }
    }
    return ok(withLook(project, { ...look, colours: args.colours }));
  },
});

const setHeroPoseCommand = defineCommand({
  name: "setHeroPose",
  description:
    'Replace one of the hero\'s pictures (a pose, "shot" or "chargedShot") with rows of pixels: "." is empty and a digit names a colour slot.',
  args: z.strictObject({ picture: z.enum(HERO_PICTURES), rows: z.array(z.string()).min(1).max(64) }),
  apply(project, args) {
    const look = withPicture(project.hero.look, args.picture, args.rows);
    const problem = lookProblems(look).find((p) => p.startsWith(PICTURE_NAMES[args.picture] + " "));
    if (problem) return fail(problem);
    return ok(withLook(project, look));
  },
});

const resetHeroLookCommand = defineCommand({
  name: "resetHeroLook",
  description: "Put back the content pack's hero look. The hero's abilities stay as they are.",
  args: z.strictObject({}),
  apply(project, _args, ctx) {
    return ok(withLook(project, ctx.pack.hero));
  },
});

export const heroCommands = [setHeroAbilitiesCommand, setHeroColoursCommand, setHeroPoseCommand, resetHeroLookCommand];
```

In `src/commands/registry.ts`, add `import { heroCommands } from "./hero";` and `...heroCommands,` at the end of `commandDefs`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. The assistant's tool list is unchanged: its tools are listed by name in `src/ai/tools.ts`, and plan 5 adds `set_hero_abilities`.

- [ ] **Step 5: Commit**

```bash
git add src/commands/hero.ts src/commands/registry.ts tests/commands/hero.test.ts tests/boundaries.test.ts
git commit -m "feat: add commands to change the hero's abilities, colours and pictures"
```

---

## Self-review

- **Spec coverage:** section 3 (hero in the file, abilities table, look, new and old games) → Tasks 1–5; section 4 (commands) → Task 6; section 9 rows for old games and broken heroes → Task 4, removing a used colour → Task 6; section 10 abilities (jump heights, pieces at every jump and speed), model (upgrade, validation, palette) and commands → Tasks 1, 2, 4, 6. Slide, charge shot, the hero screen, import and the assistant are plans 2–5.
- **Types:** `Abilities`, `HeroLook`, `HeroPicture`, `heroPhysics`, `lookProblems`, `pictureRows`, `withPicture` are defined in Task 2 and used with the same names in Tasks 3–6. `PlayerSettings` keeps its name as computed physics.
- **Known limits, accepted:** slide and charge shot are stored but do nothing until plan 2; the slide pose and charged shot are drawn but not shown until then.
