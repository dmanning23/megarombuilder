# The Shared Look Implementation Plan (Milestone 4, Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The hero, the kid's enemies, the kid's boss and the content pack's starting drawings all store one shared `Look` (canvas sizes, up to 16 colours, named animations of 1 to 8 frames with a speed, a body box, an optional shot point) in game file format 4, with an upgrade from format 3 and one set of look commands, and nothing a kid sees or plays changes.

**Architecture:** A new `src/model/look.ts` holds the `Look` schema, the per-kind rules (which animations and canvases each kind of character has, and the size limits) and `lookProblems`. A new `src/model/lookUpgrade.ts` turns the old picture shapes into looks; it serves the format upgrade and the content packs. The game and the editor keep reading pictures the old way through small accessors (`pictureRows` for the hero, `designFrames` for enemies and the boss), so drawing and play are unchanged until plans 2 and 3. Ten look commands, aimed with a `target`, replace the six picture commands, and the screens call them.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Zod 4, Vitest 4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-07-milestone-4-characters-that-fit-design.md` (sections 3 (the look, old games), 4 (commands), 8 (broken files), 9 (model and commands, old games play the same); build order item 1)

**Plan series for milestone 4:**

1. The shared look, format 4, the upgrade, the look commands (this plan)
2. Animations in the game
3. Sizes, bodies and shot points in the game
4. The editor: animations, frames, play, onion skin, 16 colours
5. The editor: size, hitbox, shot marker

## Global Constraints

- No visible change: every screen, preview and game looks and plays as before. The editor still offers 8 colours (16 arrive in plan 4).
- Pixels are `.`, `1` to `9`, then `a` to `g`, naming colour slots 1 to 16.
- Model, commands, the simulation and the checker have no React, no DOM and no randomness (the boundary test stands).
- Every change is a command; commands validate and return readable errors; all are undoable.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **Kinds of character:** `LookKind = "hero" | EnemyBehaviour | "boss"`. Each kind has a fixed set of animations, each on a canvas group:

  | Kind | Animations (canvas) | Canvas sizes, w × h |
  |---|---|---|
  | hero | stand, standShoot, run, runShoot, jump, jumpShoot, climb, hurt (main); slide (slide); shot (shot); chargedShot (chargedShot) | main 12–32 × 16–32; slide 16–32 × 8–16; shot 6 × 4; chargedShot 12 × 10 |
  | walker / flyer / turret | walk / fly / idle (main) | 8–32 × 8–32 |
  | jumper | ground, air (main) | 8–32 × 8–32 |
  | shielded | closed, open (main) | 8–32 × 8–32 |
  | dropper | hang, fall (main) | 8–32 × 8–32 |
  | boss | stand, jump, attack (main) | 16–48 × 16–48 |

  Sizes are even (steps of 2), except fixed ones.
- **Body limits:** at least 4 × 4, inside its canvas; the hero's `body` at most 30 tall; the hero's `slideBody` (required for the hero, absent otherwise) at most 14 tall.
- **Shot point:** `shotY` is required for the hero, turrets, shield guards and the boss, and absent otherwise; it runs from 0 to the body's height minus the shot's height (4 for the hero's shot, 6 for an enemy shot).
- **Upgraded and starting looks** (today's sizes and numbers, so play is unchanged):

  | Kind | Canvas | Body (x, y, w, h) | shotY |
  |---|---|---|---|
  | hero | main 16 × 24, slide 24 × 16 | body 1, 2, 14, 22; slideBody 5, 2, 14, 14 | 8 |
  | walker, turret, jumper | 16 × 16 | 1, 2, 14, 14 | turret 4 |
  | flyer, dropper | 16 × 16 | 1, 4, 14, 12 | |
  | shielded | 16 × 16 | 1, 0, 14, 16 | 5 |
  | boss | 24 × 28 | 0, 0, 24, 28 | 11 |

  (The enemy shot heights put the shot where `fireAt` puts it today: centred, `h / 2 − 3`.) Speeds are all normal.
- **Old pictures to animations:** the hero's run1 and run2 become run's two frames, and runShoot starts as the same two frames; every other hero picture becomes a one-frame animation of its own name. An enemy's two frames: walker walk, flyer fly and turret idle take both; jumper ground/air, shielded closed/open, dropper hang/fall take one each. A boss's three frames become stand, jump and attack.
- **Reading pictures the old way** until plans 2 and 3: `pictureRows(look, picture)` (run1 is run's frame 1, run2 its frame 2, or frame 1 if it has one) and `designFrames(kind, look)` (an enemy's or boss's frames in the old order). The renderer, previews and screens use these, so they need no other change.
- **The look commands' `target`:** `"hero"`, `"boss"` or `{ enemy: "<id>" }`. Animation names are the ones above.
- **Colour still in use:** the refusal names animation frames: "Colour 3 is still used in Run frame 2 and Stand frame 1." (the old commands named pictures; the screens' tests change to the new words).
- **The content pack's own characters** (the snow things the renderer draws from its art set) stay on that art set until plan 2. Only the pack's starting drawings (`hero`, `enemyLooks`, `bossLook`) become looks here.

## Review Focus

1. **A format 1 or 2 game:** it upgrades through 3 to 4 and opens; the hero it gets from the pack (already a look) isn't converted twice. Tested in Task 3.
2. **The hero's run with only one frame left** (after `removeFrame` in a later plan): `pictureRows(look, "run2")` gives frame 1, never undefined. Tested in Task 2.
3. **A hand-edited file with a 17th colour, an empty animation, an extra animation, a body outside its canvas, or a shot point on a walker:** refused with a plain message. Tested in Task 1.
4. **Resizing a canvas smaller than the drawing, then undo:** pixels trimmed evenly at the sides and top, the feet row kept, the body refitted; one undo restores everything. Tested in Task 4.
5. **Copying a frame onto an animation that already has 8:** refused, nothing changes. Tested in Task 4.

## File Structure

```
src/model/look.ts                       Look, LookKind, KINDS, ANIMATION_NAMES, pixels, lookProblems, fitBody
src/model/lookUpgrade.ts                heroLookFrom, designLookFrom (old shapes to looks)
src/model/hero.ts                       HeroLook = Look; pictureRows/withPicture over looks; old picture validation removed
src/model/designs.ts                    enemy and boss looks are Looks; DESIGN_BODIES; designFrames, designLook
src/model/schema.ts                     FORMAT_VERSION 4
src/model/parse.ts                      upgrade 3 → 4
src/model/validate.ts                   lookProblems for the hero, enemies and boss
src/model/contentPack.ts                hero, enemyLooks, bossLook as Looks
src/content/snow/hero.ts, src/content/snow/enemies.ts   the snow drawings as looks
src/runtime/render/heroArt.ts, src/runtime/render/lookArt.ts   read through the accessors
src/commands/look.ts                    the ten look commands
src/commands/hero.ts, src/commands/enemies.ts, src/commands/boss.ts   picture commands removed
src/editor/components/HeroScreen.tsx, EnemiesScreen.tsx, BossScreen.tsx, Colours.tsx, src/editor/hero/importPicture.ts   the new commands; 8 colours kept in the editor
tests/fixtures/testPack.ts and the tests named in each task
```

---

### Task 1: The look model

**Files:**
- Create: `src/model/look.ts`
- Test: `tests/model/look.test.ts`

**Interfaces:**
- Consumes: `ENEMY_BEHAVIOURS`, `type EnemyBehaviour` from `@/model/designs` (type-only import, so no import cycle at run time); `PALETTE_8BIT`
- Produces:
  - `MAX_LOOK_COLOURS = 16`, `MAX_FRAMES = 8`, `ANIMATION_SPEEDS = ["slow", "normal", "fast"] as const`, `PIXEL_SLOTS = "123456789abcdefg"`, `slotChar(slot: number): string`, `slotOf(ch: string): number` (0 for "." or unknown)
  - `type LookBox = { x: number; y: number; w: number; h: number }`, `lookSchema`, `type Look`, `type Animation`
  - `type LookKind = "hero" | EnemyBehaviour | "boss"`; `KINDS: Record<LookKind, KindRule>` with `KindRule = { animations: Record<string, string>; canvases: Record<string, { min: Size; max: Size }>; shotHeight: number | null }`
  - `ANIMATION_NAMES: Record<string, string>`; `lookProblems(kind: LookKind, look: Look, name: string): string[]`
  - `fitBody(rows: string[], canvas: Size, maxH: number | null): LookBox`; `firstStanding(kind: LookKind): string` (the animation a body is fitted to)

- [ ] **Step 1: Write the failing tests**

`tests/model/look.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fitBody, KINDS, lookProblems, lookSchema, slotChar, slotOf, type Look } from "@/model/look";

const fill = (w: number, h: number, ch = "1") => Array.from({ length: h }, () => ch.repeat(w));
const walker = (): Look => ({
  colours: [13],
  canvases: { main: { w: 16, h: 16 } },
  animations: { walk: { frames: [fill(16, 16), fill(16, 16)], speed: "normal" } },
  body: { x: 1, y: 2, w: 14, h: 14 },
});

describe("pixels", () => {
  it("name 16 colour slots with one character each", () => {
    expect([1, 9, 10, 16].map(slotChar)).toEqual(["1", "9", "a", "g"]);
    expect(["1", "9", "a", "g", ".", "h"].map(slotOf)).toEqual([1, 9, 10, 16, 0, 0]);
  });
});

describe("lookProblems", () => {
  it("accepts a good look", () => {
    expect(lookSchema.safeParse(walker()).success).toBe(true);
    expect(lookProblems("walker", walker(), "Frost Fang")).toEqual([]);
  });

  it("refuses a 17th colour", () => {
    expect(lookSchema.safeParse({ ...walker(), colours: Array.from({ length: 17 }, () => 1) }).success).toBe(false);
  });

  it("refuses a missing, extra or empty animation", () => {
    expect(lookProblems("walker", { ...walker(), animations: {} }, "Frost Fang")).toContain("Frost Fang has no Walk animation.");
    const extra = { ...walker(), animations: { ...walker().animations, fly: walker().animations.walk } };
    expect(lookProblems("walker", extra, "Frost Fang")).toContain('Frost Fang has an animation "fly" it can\'t use.');
    expect(lookSchema.safeParse({ ...walker(), animations: { walk: { frames: [], speed: "normal" } } }).success).toBe(false);
  });

  it("refuses frames of the wrong size and pixels naming missing colours", () => {
    const look = walker();
    look.animations.walk.frames[1] = fill(15, 16);
    expect(lookProblems("walker", look, "Frost Fang")).toContain("Frost Fang's Walk frame 2 is not 16 by 16 pixels.");
    const colourful = walker();
    colourful.animations.walk.frames[0] = fill(16, 16, "a");
    expect(lookProblems("walker", colourful, "Frost Fang")).toContain(
      "Frost Fang's Walk frame 1 uses colour 10, but Frost Fang only has 1 colour.",
    );
  });

  it("refuses canvases outside the limits, or odd sizes", () => {
    const look = walker();
    look.canvases.main = { w: 34, h: 16 };
    look.animations.walk.frames = [fill(34, 16)];
    expect(lookProblems("walker", look, "Frost Fang")).toContain("Frost Fang's canvas is 34 by 16; it can be 8 to 32 wide and 8 to 32 tall.");
    look.canvases.main = { w: 15, h: 16 };
    look.animations.walk.frames = [fill(15, 16)];
    expect(lookProblems("walker", look, "Frost Fang")).toContain("Frost Fang's canvas is 15 by 16; its sides must be even.");
  });

  it("refuses a body outside its canvas, a shot point on a walker, and a hero too tall for the level pieces", () => {
    expect(lookProblems("walker", { ...walker(), body: { x: 4, y: 4, w: 14, h: 14 } }, "Frost Fang")).toContain(
      "Frost Fang's hitbox doesn't fit inside its canvas.",
    );
    expect(lookProblems("walker", { ...walker(), shotY: 3 }, "Frost Fang")).toContain("Frost Fang doesn't shoot, so it can't have a shot point.");
    expect(KINDS.hero.canvases.main.max.h).toBe(32);
  });
});

describe("fitBody", () => {
  it("fits the smallest box around the drawn pixels", () => {
    const rows = ["........", "..11....", "..111...", "........"];
    expect(fitBody(rows, { w: 8, h: 4 }, null)).toEqual({ x: 2, y: 1, w: 3, h: 2 });
  });

  it("grows to 4 by 4 inside the canvas, and keeps the feet when too tall", () => {
    expect(fitBody(["......", "...1..", "......", "......"], { w: 6, h: 4 }, null)).toEqual({ x: 2, y: 0, w: 4, h: 4 });
    expect(fitBody(fill(4, 20), { w: 4, h: 20 }, 14)).toEqual({ x: 0, y: 6, w: 4, h: 14 });
  });

  it("takes the whole canvas when nothing is drawn", () => {
    expect(fitBody(fill(8, 8, "."), { w: 8, h: 8 }, 6)).toEqual({ x: 0, y: 2, w: 8, h: 6 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/model/look.test.ts`
Expected: FAIL (no `@/model/look`).

- [ ] **Step 3: Write the model**

`src/model/look.ts`:

```ts
import { z } from "zod";
import type { EnemyBehaviour } from "./designs";
import { PALETTE_8BIT } from "./palette";

// One look for every character: the hero, enemies and the boss, the kid's and the content pack's.

export const MAX_LOOK_COLOURS = 16;
export const MAX_FRAMES = 8;
export const ANIMATION_SPEEDS = ["slow", "normal", "fast"] as const;
export type AnimationSpeed = (typeof ANIMATION_SPEEDS)[number];

// A pixel is "." (clear) or one character naming a colour slot: "1" to "9", then "a" to "g".
export const PIXEL_SLOTS = "123456789abcdefg";
export const slotChar = (slot: number): string => PIXEL_SLOTS[slot - 1];
export const slotOf = (ch: string): number => (ch === "." ? 0 : PIXEL_SLOTS.indexOf(ch) + 1);

type Size = { w: number; h: number };
export type LookBox = { x: number; y: number; w: number; h: number };

const boxSchema = z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int().min(1), h: z.number().int().min(1) });
const rows = z.array(z.string()).min(1).max(64);
export const animationSchema = z.object({
  frames: z.array(rows).min(1).max(MAX_FRAMES),
  speed: z.enum(ANIMATION_SPEEDS),
});
export type Animation = z.infer<typeof animationSchema>;

export const lookSchema = z.object({
  colours: z
    .array(z.number().int().min(0).max(PALETTE_8BIT.length - 1))
    .min(1)
    .max(MAX_LOOK_COLOURS),
  canvases: z.record(z.string(), z.object({ w: z.number().int().min(1).max(64), h: z.number().int().min(1).max(64) })),
  animations: z.record(z.string(), animationSchema),
  body: boxSchema,
  slideBody: boxSchema.optional(),
  shotY: z.number().int().optional(),
});
export type Look = z.infer<typeof lookSchema>;

export type LookKind = "hero" | EnemyBehaviour | "boss";

export type KindRule = {
  animations: Record<string, string>; // animation → its canvas group
  canvases: Record<string, { min: Size; max: Size }>; // min = max for a fixed size
  shotHeight: number | null; // the height of its shots, or null when it doesn't shoot
};

const enemyCanvas = { main: { min: { w: 8, h: 8 }, max: { w: 32, h: 32 } } };
const enemy = (animations: string[], shotHeight: number | null = null): KindRule => ({
  animations: Object.fromEntries(animations.map((a) => [a, "main"])),
  canvases: enemyCanvas,
  shotHeight,
});

export const HERO_SHOT_H = 4;
export const ENEMY_SHOT_H = 6;
export const HERO_BODY_MAX_H = 30; // fits through the level pieces' 2-tile openings
export const SLIDE_BODY_MAX_H = 14; // fits under the crawl space's 1-tile gap
export const BODY_MIN = 4;

export const KINDS: Record<LookKind, KindRule> = {
  hero: {
    animations: {
      stand: "main",
      standShoot: "main",
      run: "main",
      runShoot: "main",
      jump: "main",
      jumpShoot: "main",
      climb: "main",
      hurt: "main",
      slide: "slide",
      shot: "shot",
      chargedShot: "chargedShot",
    },
    canvases: {
      main: { min: { w: 12, h: 16 }, max: { w: 32, h: 32 } },
      slide: { min: { w: 16, h: 8 }, max: { w: 32, h: 16 } },
      shot: { min: { w: 6, h: 4 }, max: { w: 6, h: 4 } },
      chargedShot: { min: { w: 12, h: 10 }, max: { w: 12, h: 10 } },
    },
    shotHeight: HERO_SHOT_H,
  },
  walker: enemy(["walk"]),
  flyer: enemy(["fly"]),
  turret: enemy(["idle"], ENEMY_SHOT_H),
  jumper: enemy(["ground", "air"]),
  shielded: enemy(["closed", "open"], ENEMY_SHOT_H),
  dropper: enemy(["hang", "fall"]),
  boss: {
    animations: { stand: "main", jump: "main", attack: "main" },
    canvases: { main: { min: { w: 16, h: 16 }, max: { w: 48, h: 48 } } },
    shotHeight: ENEMY_SHOT_H,
  },
};

export const ANIMATION_NAMES: Record<string, string> = {
  stand: "Stand",
  standShoot: "Stand and shoot",
  run: "Run",
  runShoot: "Run and shoot",
  jump: "Jump",
  jumpShoot: "Jump and shoot",
  climb: "Climb",
  hurt: "Hurt",
  slide: "Slide",
  shot: "Shot",
  chargedShot: "Charged shot",
  walk: "Walk",
  fly: "Fly",
  idle: "Idle",
  ground: "On the ground",
  air: "In the air",
  closed: "Shield closed",
  open: "Shield open",
  hang: "Hang",
  fall: "Fall",
  attack: "Attack",
};

// The animation a body is fitted to: the kind's first.
export const firstStanding = (kind: LookKind): string => Object.keys(KINDS[kind].animations)[0];

const inside = (box: LookBox, canvas: Size) =>
  box.x >= 0 && box.y >= 0 && box.x + box.w <= canvas.w && box.y + box.h <= canvas.h;

// Everything wrong with a look that the schema can't see. `name` is how messages name the character.
export function lookProblems(kind: LookKind, look: Look, name: string): string[] {
  const rule = KINDS[kind];
  const problems: string[] = [];
  const possessive = `${name}'s`;

  for (const [group, limits] of Object.entries(rule.canvases)) {
    const canvas = look.canvases[group];
    const label = group === "main" ? `${possessive} canvas` : `${possessive} ${ANIMATION_NAMES[group]?.toLowerCase() ?? group} canvas`;
    if (!canvas) {
      problems.push(`${label} is missing.`);
      continue;
    }
    const fixed = limits.min.w === limits.max.w && limits.min.h === limits.max.h;
    if (canvas.w < limits.min.w || canvas.w > limits.max.w || canvas.h < limits.min.h || canvas.h > limits.max.h) {
      problems.push(
        fixed
          ? `${label} must be ${limits.min.w} by ${limits.min.h}.`
          : `${label} is ${canvas.w} by ${canvas.h}; it can be ${limits.min.w} to ${limits.max.w} wide and ${limits.min.h} to ${limits.max.h} tall.`,
      );
    } else if (!fixed && (canvas.w % 2 !== 0 || canvas.h % 2 !== 0)) {
      problems.push(`${label} is ${canvas.w} by ${canvas.h}; its sides must be even.`);
    }
  }
  for (const group of Object.keys(look.canvases)) {
    if (!rule.canvases[group]) problems.push(`${name} has a canvas "${group}" it can't use.`);
  }

  for (const [animation, group] of Object.entries(rule.animations)) {
    const anim = look.animations[animation];
    const label = ANIMATION_NAMES[animation];
    if (!anim) {
      problems.push(`${name} has no ${label} animation.`);
      continue;
    }
    const canvas = look.canvases[group];
    if (!canvas) continue;
    anim.frames.forEach((frame, i) => {
      const where = `${possessive} ${label} frame ${i + 1}`;
      if (frame.length !== canvas.h || frame.some((row) => row.length !== canvas.w)) {
        problems.push(`${where} is not ${canvas.w} by ${canvas.h} pixels.`);
        return;
      }
      const pixels = [...frame.join("")];
      const odd = pixels.find((ch) => ch !== "." && slotOf(ch) === 0);
      if (odd) {
        problems.push(`${where} has a pixel "${odd}" that is not a colour.`);
        return;
      }
      const highest = Math.max(0, ...pixels.map(slotOf));
      const count = look.colours.length;
      if (highest > count) {
        problems.push(`${where} uses colour ${highest}, but ${name} only has ${count} colour${count === 1 ? "" : "s"}.`);
      }
    });
  }
  for (const animation of Object.keys(look.animations)) {
    if (!rule.animations[animation]) problems.push(`${name} has an animation "${animation}" it can't use.`);
  }

  const main = look.canvases.main;
  if (main) {
    if (look.body.w < BODY_MIN || look.body.h < BODY_MIN) problems.push(`${possessive} hitbox must be at least ${BODY_MIN} by ${BODY_MIN}.`);
    if (!inside(look.body, main)) problems.push(`${possessive} hitbox doesn't fit inside its canvas.`);
    if (kind === "hero" && look.body.h > HERO_BODY_MAX_H) {
      problems.push(`${possessive} hitbox is ${look.body.h} tall; at most ${HERO_BODY_MAX_H}, so it fits through 2-tile gaps.`);
    }
  }
  if (kind === "hero") {
    const slide = look.canvases.slide;
    if (!look.slideBody) problems.push(`${name} has no sliding hitbox.`);
    else if (slide) {
      if (look.slideBody.w < BODY_MIN || look.slideBody.h < BODY_MIN) problems.push(`${possessive} sliding hitbox must be at least ${BODY_MIN} by ${BODY_MIN}.`);
      if (!inside(look.slideBody, slide)) problems.push(`${possessive} sliding hitbox doesn't fit inside its slide canvas.`);
      if (look.slideBody.h > SLIDE_BODY_MAX_H) {
        problems.push(`${possessive} sliding hitbox is ${look.slideBody.h} tall; at most ${SLIDE_BODY_MAX_H}, so it fits under 1-tile gaps.`);
      }
    }
  } else if (look.slideBody) {
    problems.push(`${name} can't slide, so it can't have a sliding hitbox.`);
  }

  if (rule.shotHeight === null) {
    if (look.shotY !== undefined) problems.push(`${name} doesn't shoot, so it can't have a shot point.`);
  } else if (look.shotY === undefined) {
    problems.push(`${name} has no shot point.`);
  } else if (look.shotY < 0 || look.shotY > look.body.h - rule.shotHeight) {
    problems.push(`${possessive} shot point is outside its hitbox.`);
  }
  return problems;
}

// The smallest box around a picture's drawn pixels, at least BODY_MIN square and inside the canvas.
// Taller than maxH keeps its bottom (the feet). Nothing drawn: the whole canvas.
export function fitBody(rows: string[], canvas: Size, maxH: number | null): LookBox {
  let left = canvas.w;
  let top = canvas.h;
  let right = -1;
  let bottom = -1;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }),
  );
  let box: LookBox = right < 0 ? { x: 0, y: 0, w: canvas.w, h: canvas.h } : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
  const grow = (start: number, length: number, limit: number): [number, number] => {
    if (length >= BODY_MIN) return [start, length];
    const extra = BODY_MIN - length;
    const from = Math.max(0, Math.min(limit - BODY_MIN, start - Math.floor(extra / 2)));
    return [from, BODY_MIN];
  };
  [box.x, box.w] = grow(box.x, box.w, canvas.w);
  [box.y, box.h] = grow(box.y, box.h, canvas.h);
  if (maxH !== null && box.h > maxH) box = { ...box, y: box.y + box.h - maxH, h: maxH };
  return box;
}
```

Check the "grows to 4 by 4" test against `grow`: a pixel at (3, 1) in a 6 × 4 canvas gives x from `max(0, min(2, 3 − 1)) = 2`, y from `max(0, min(0, 1 − 1)) = 0`, so (2, 0, 4, 4).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/model/look.test.ts && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/model/look.ts tests/model/look.test.ts
git commit -m "feat: add the shared look: canvases, 16 colours, animations, a hitbox and a shot point"
```

---

### Task 2: Old pictures as looks

**Files:**
- Create: `src/model/lookUpgrade.ts`
- Modify: `src/model/designs.ts` (add `DESIGN_BODIES`, `ENEMY_SHOT_Y`, `designFrames`, `designFrameSlot`, `designLook`), `src/model/hero.ts` (add `HERO_PICTURE_SLOTS`)
- Test: `tests/model/lookUpgrade.test.ts`

**Interfaces:**
- Consumes: Task 1's `Look`, `LookKind`, `KINDS`, `lookProblems`
- Produces:
  - `type OldHeroLook = { colours: number[]; poses: Record<HeroPose, string[]>; shot: string[]; chargedShot: string[] }`; `heroLookFrom(old: OldHeroLook): Look`
  - `type OldDesignLook = { colours: number[]; frames: string[][] }`; `designLookFrom(kind: EnemyBehaviour | "boss", old: OldDesignLook): Look`
  - `HERO_PICTURE_SLOTS: Record<HeroPicture, { animation: string; frame: number }>`
  - `designFrameSlot(kind: EnemyBehaviour | "boss", index: number): { animation: string; frame: number }`; `designFrames(kind, look: Look): string[][]` (old order); `designLook(kind, look): { colours: number[]; frames: string[][] }`
  - `DESIGN_BODIES: Record<EnemyBehaviour | "boss", LookBox>`

- [ ] **Step 1: Write the failing tests**

`tests/model/lookUpgrade.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { SNOW_PALETTE } from "@/content/snow/palette";
import { DESIGN_BODIES, designFrames, ENEMY_BEHAVIOURS, lettersToLook } from "@/model/designs";
import { HERO_PICTURE_SLOTS, HERO_POSES } from "@/model/hero";
import { lookProblems } from "@/model/look";
import { designLookFrom, heroLookFrom, type OldHeroLook } from "@/model/lookUpgrade";
import { bodySize } from "@/runtime/sim/entities/spawn";

const fill = (w: number, h: number, ch: string) => Array.from({ length: h }, () => ch.repeat(w));

function oldHero(): OldHeroLook {
  const poses = Object.fromEntries(HERO_POSES.map((pose, i) => [pose, pose === "slide" ? fill(24, 16, "1") : fill(16, 24, String((i % 8) + 1))]));
  return { colours: [0, 1, 2, 3, 4, 5, 6, 7], poses: poses as OldHeroLook["poses"], shot: fill(6, 4, "1"), chargedShot: fill(12, 10, "2") };
}

describe("heroLookFrom", () => {
  it("makes a valid hero look with today's sizes, bodies and shot point", () => {
    const look = heroLookFrom(oldHero());
    expect(lookProblems("hero", look, "The hero")).toEqual([]);
    expect(look.canvases).toEqual({ main: { w: 16, h: 24 }, slide: { w: 24, h: 16 }, shot: { w: 6, h: 4 }, chargedShot: { w: 12, h: 10 } });
    expect(look.body).toEqual({ x: 1, y: 2, w: 14, h: 22 });
    expect(look.slideBody).toEqual({ x: 5, y: 2, w: 14, h: 14 });
    expect(look.shotY).toBe(8);
  });

  it("puts each old picture where the hero's pictures are read from", () => {
    const old = oldHero();
    const look = heroLookFrom(old);
    expect(look.animations.run.frames).toEqual([old.poses.run1, old.poses.run2]);
    expect(look.animations.runShoot.frames).toEqual([old.poses.run1, old.poses.run2]);
    for (const [picture, slot] of Object.entries(HERO_PICTURE_SLOTS)) {
      const expected = picture === "shot" ? old.shot : picture === "chargedShot" ? old.chargedShot : old.poses[picture as keyof OldHeroLook["poses"]];
      expect(look.animations[slot.animation].frames[slot.frame], picture).toEqual(expected);
      expect(look.animations[slot.animation].speed).toBe("normal");
    }
  });
});

describe("designLookFrom", () => {
  it("gives every behaviour a valid look whose frames read back in the old order", () => {
    for (const behaviour of ENEMY_BEHAVIOURS) {
      const old = { colours: [13], frames: [fill(16, 16, "1"), fill(16, 16, ".")] };
      const look = designLookFrom(behaviour, old);
      expect(lookProblems(behaviour, look, behaviour), behaviour).toEqual([]);
      expect(designFrames(behaviour, look), behaviour).toEqual(old.frames);
    }
  });

  it("gives bodies the game's sizes for each behaviour, centred with their feet on the bottom", () => {
    for (const behaviour of ENEMY_BEHAVIOURS) {
      const { w, h } = bodySize(behaviour);
      expect(DESIGN_BODIES[behaviour], behaviour).toEqual({ x: (16 - w) / 2, y: 16 - h, w, h });
    }
    expect(DESIGN_BODIES.boss).toEqual({ x: 0, y: 0, w: 24, h: 28 });
  });

  it("turns the Blizzard Bot into a boss look with stand, jump and attack", () => {
    const old = lettersToLook(snowArt.things.boss.map((s) => s.rows), SNOW_PALETTE);
    const look = designLookFrom("boss", old);
    expect(lookProblems("boss", look, "Blizzard Bot")).toEqual([]);
    expect(designFrames("boss", look)).toEqual(old.frames);
    expect(look.shotY).toBe(11);
  });
});
```

Add to the same file:

```ts
describe("pictureRows on a hero whose run has one frame", () => {
  it("reads run2 as the run's only frame", async () => {
    const { pictureRows } = await import("@/model/hero");
    const look = heroLookFrom(oldHero());
    const oneFrame = { ...look, animations: { ...look.animations, run: { frames: [look.animations.run.frames[0]], speed: "normal" as const } } };
    expect(pictureRows(oneFrame, "run2")).toEqual(look.animations.run.frames[0]);
  });
});
```

(This last test needs Task 3's `pictureRows` over looks; it fails until then. Mark it `it.todo` here and turn it into the test above in Task 3, Step 1.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/model/lookUpgrade.test.ts`
Expected: FAIL (no `@/model/lookUpgrade`).

- [ ] **Step 3: Write the conversion**

In `src/model/hero.ts`, after `PICTURE_NAMES`:

```ts
// Where each of the hero's old pictures lives in its look: run1 and run2 are run's two frames.
export const HERO_PICTURE_SLOTS: Record<HeroPicture, { animation: string; frame: number }> = {
  stand: { animation: "stand", frame: 0 },
  standShoot: { animation: "standShoot", frame: 0 },
  run1: { animation: "run", frame: 0 },
  run2: { animation: "run", frame: 1 },
  jump: { animation: "jump", frame: 0 },
  jumpShoot: { animation: "jumpShoot", frame: 0 },
  climb: { animation: "climb", frame: 0 },
  hurt: { animation: "hurt", frame: 0 },
  slide: { animation: "slide", frame: 0 },
  shot: { animation: "shot", frame: 0 },
  chargedShot: { animation: "chargedShot", frame: 0 },
};
```

In `src/model/designs.ts` (importing `type Look`, `type LookBox`, `KINDS` from `./look`), after the looks section:

```ts
// Each behaviour's body today, in a 16 by 16 picture: centred, feet on the bottom. The boss fills its 24 by 28.
const body = (w: number, h: number): LookBox => ({ x: (16 - w) / 2, y: 16 - h, w, h });
export const DESIGN_BODIES: Record<EnemyBehaviour | "boss", LookBox> = {
  walker: body(14, 14),
  flyer: body(14, 12),
  turret: body(14, 14),
  jumper: body(14, 14),
  shielded: body(14, 16),
  dropper: body(14, 12),
  boss: { x: 0, y: 0, w: 24, h: 28 },
};
// Where enemy shots come out today: the middle of the body (an enemy shot is 6 high).
export const DESIGN_SHOT_Y: Partial<Record<EnemyBehaviour | "boss", number>> = { turret: 4, shielded: 5, boss: 11 };

// Where an enemy's or boss's old frame lives in its look. Walk, fly and idle took both old frames.
export function designFrameSlot(kind: EnemyBehaviour | "boss", index: number): { animation: string; frame: number } {
  const animations = Object.keys(KINDS[kind].animations);
  return animations.length === 1 ? { animation: animations[0], frame: index } : { animation: animations[index], frame: 0 };
}

const OLD_FRAME_COUNT = (kind: EnemyBehaviour | "boss") => (kind === "boss" ? 3 : 2);

// An enemy's or boss's frames in the old order (two for an enemy, three for the boss). Used until
// the game and the screens play animations (milestone 4, plans 2 to 4).
export function designFrames(kind: EnemyBehaviour | "boss", look: Look): string[][] {
  return Array.from({ length: OLD_FRAME_COUNT(kind) }, (_, i) => {
    const { animation, frame } = designFrameSlot(kind, i);
    const frames = look.animations[animation].frames;
    return frames[Math.min(frame, frames.length - 1)];
  });
}

export const designLook = (kind: EnemyBehaviour | "boss", look: Look): DesignLook => ({
  colours: look.colours,
  frames: designFrames(kind, look),
});
```

`src/model/lookUpgrade.ts`:

```ts
import { DESIGN_BODIES, DESIGN_SHOT_Y, designFrameSlot, type EnemyBehaviour } from "./designs";
import { HERO_PICTURE_SLOTS, HERO_POSES, type HeroPicture, type HeroPose } from "./hero";
import { KINDS, type Animation, type Look } from "./look";

// Turning the pictures of format 3 and before into looks, with today's sizes, bodies and shot
// points, so upgraded games look and play as before.

export type OldHeroLook = { colours: number[]; poses: Record<HeroPose, string[]>; shot: string[]; chargedShot: string[] };
export type OldDesignLook = { colours: number[]; frames: string[][] };

const still = (frames: string[][]): Animation => ({ frames, speed: "normal" });

export function heroLookFrom(old: OldHeroLook): Look {
  const picture = (p: HeroPicture) => (p === "shot" ? old.shot : p === "chargedShot" ? old.chargedShot : old.poses[p]);
  const animations: Record<string, Animation> = {};
  for (const p of [...HERO_POSES, "shot", "chargedShot"] as HeroPicture[]) {
    const { animation, frame } = HERO_PICTURE_SLOTS[p];
    const frames = animations[animation]?.frames ?? [];
    frames[frame] = picture(p);
    animations[animation] = still(frames);
  }
  animations.runShoot = still([...animations.run.frames]); // today's running shot shows the run
  return {
    colours: old.colours,
    canvases: { main: { w: 16, h: 24 }, slide: { w: 24, h: 16 }, shot: { w: 6, h: 4 }, chargedShot: { w: 12, h: 10 } },
    animations,
    body: { x: 1, y: 2, w: 14, h: 22 },
    slideBody: { x: 5, y: 2, w: 14, h: 14 },
    shotY: 8,
  };
}

export function designLookFrom(kind: EnemyBehaviour | "boss", old: OldDesignLook): Look {
  const animations: Record<string, Animation> = Object.fromEntries(Object.keys(KINDS[kind].animations).map((a) => [a, still([])]));
  old.frames.forEach((rows, i) => {
    const { animation, frame } = designFrameSlot(kind, i);
    animations[animation].frames[frame] = rows;
  });
  const shotY = DESIGN_SHOT_Y[kind];
  return {
    colours: old.colours,
    canvases: { main: kind === "boss" ? { w: 24, h: 28 } : { w: 16, h: 16 } },
    animations,
    body: DESIGN_BODIES[kind],
    ...(shotY === undefined ? {} : { shotY }),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/model/lookUpgrade.test.ts && npm run typecheck && npm run lint`
Expected: all pass (one todo).

- [ ] **Step 5: Commit**

```bash
git add src/model tests/model/lookUpgrade.test.ts
git commit -m "feat: turn today's hero, enemy and boss pictures into looks, keeping their sizes and bodies"
```

---

### Task 3: Format 4: every character stores a look

**Files:**
- Modify: `src/model/hero.ts`, `src/model/designs.ts`, `src/model/schema.ts`, `src/model/parse.ts`, `src/model/validate.ts`, `src/model/contentPack.ts`, `src/content/snow/hero.ts`, `src/content/snow/enemies.ts`, `src/runtime/render/heroArt.ts`, `src/runtime/render/lookArt.ts`, `src/commands/hero.ts`, `src/commands/enemies.ts`, `src/commands/boss.ts`, `src/editor/components/EnemiesScreen.tsx`, `src/editor/components/BossScreen.tsx`, `src/editor/components/Colours.tsx`, `src/editor/hero/importPicture.ts`, `tests/fixtures/testPack.ts`
- Test: `tests/model/parse.test.ts`, `tests/runtime/heroArt.test.ts`, `tests/model/lookUpgrade.test.ts`, and existing tests that build or read the old shapes

**Interfaces:**
- Consumes: Tasks 1 and 2
- Produces: `HeroLook` is now `Look`; `heroSchema.look`, `enemyDesignSchema.look`, `bossDesignSchema.look` are `lookSchema`; `ContentPack.hero: Look`, `enemyLooks: Record<EnemyBehaviour, Look>`, `bossLook: Look`; `FORMAT_VERSION = 4`; `pictureRows(look: Look, picture)` and `withPicture(look: Look, picture, rows)`; `EDITOR_MAX_COLOURS = 8` in `src/editor/hero/importPicture.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/model/lookUpgrade.test.ts`, turn the `it.todo` into the "reads run2 as the run's only frame" test written in Task 2.

Add to `tests/model/parse.test.ts` (importing `heroLookFrom` from `@/model/lookUpgrade`, `designFrames` from `@/model/designs`, `pictureRows`, `HERO_PICTURES` from `@/model/hero`, and `testOldHero` from the fixtures):

```ts
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
```

Add to `tests/runtime/heroArt.test.ts` (importing `heroLookFrom` and `testOldHero`):

```ts
  it("draws an upgraded hero exactly as the old pictures", () => {
    const art = heroArt(heroLookFrom(testOldHero));
    for (const pose of HERO_POSES) expect(art.poses[pose], pose).toEqual(sprite(testOldHero.poses[pose]));
    expect(art.shot).toEqual(sprite(testOldHero.shot));
    expect(art.chargedShot).toEqual(sprite(testOldHero.chargedShot));
  });
```

(importing `sprite` from `@/runtime/render/art` and `HERO_POSES` from `@/model/hero` if the file lacks them.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/model/parse.test.ts tests/runtime/heroArt.test.ts tests/model/lookUpgrade.test.ts`
Expected: FAIL (format is 3; `testOldHero` doesn't exist; `pictureRows` reads `poses`).

- [ ] **Step 3: The model**

`src/model/hero.ts`:
- Delete `heroLookSchema`, `pictureProblems`, `lookProblems` and the `rows` constant; import `lookSchema`, `type Look` from `./look`; keep `MAX_COLOURS` deleted too (its users move to `MAX_LOOK_COLOURS` or `EDITOR_MAX_COLOURS`, below).
- `export type HeroLook = Look;` and `export const heroSchema = z.object({ abilities: abilitiesSchema, look: lookSchema });`
- Replace `pictureRows` and `withPicture`:

```ts
// The hero's old pictures, read from and written to its look. A run with one frame shows it for run2.
export function pictureRows(look: Look, picture: HeroPicture): string[] {
  const { animation, frame } = HERO_PICTURE_SLOTS[picture];
  const frames = look.animations[animation].frames;
  return frames[Math.min(frame, frames.length - 1)];
}

export function withPicture(look: Look, picture: HeroPicture, rows: string[]): Look {
  const { animation, frame } = HERO_PICTURE_SLOTS[picture];
  const anim = look.animations[animation];
  const frames = anim.frames.map((f, i) => (i === Math.min(frame, anim.frames.length - 1) ? rows : f));
  return { ...look, animations: { ...look.animations, [animation]: { ...anim, frames } } };
}
```

`src/model/designs.ts`:
- `enemyLookSchema` and `bossLookSchema` are deleted; `enemyDesignSchema.look` and `bossDesignSchema.look` are `lookSchema`.
- `DesignLook` stays (`{ colours, frames }`) as the old-order view `lookArt` draws.
- `framesProblems` and `lettersToLook` stay (the latter still builds the snow drawings; its colour limit becomes `MAX_LOOK_COLOURS`). `ENEMY_FRAME` and `BOSS_FRAME` stay for the screens.

`src/model/schema.ts`: `export const FORMAT_VERSION = 4;`

`src/model/parse.ts` (importing `heroLookFrom`, `designLookFrom`):

```ts
  // Version 4 gave every character a look: named animations, canvas sizes, a hitbox and a shot point.
  // The hero's look came from the pack in a version 1 game, and the pack's is already a look.
  3: (doc) => {
    const hero = doc.hero as { abilities: unknown; look: Record<string, unknown> } | undefined;
    const enemies = (doc.enemies as { behaviour: EnemyBehaviour; look: OldDesignLook }[] | undefined) ?? [];
    const boss = doc.boss as { look: OldDesignLook } | null | undefined;
    const old = (look: Record<string, unknown>) => "poses" in look;
    return {
      ...doc,
      formatVersion: 4,
      hero: hero && old(hero.look) ? { ...hero, look: heroLookFrom(hero.look as unknown as OldHeroLook) } : hero,
      enemies: enemies.map((e) => (Array.isArray((e.look as { frames?: unknown }).frames) ? { ...e, look: designLookFrom(e.behaviour, e.look) } : e)),
      boss: boss && Array.isArray((boss.look as { frames?: unknown }).frames) ? { ...boss, look: designLookFrom("boss", boss.look) } : boss ?? null,
    };
  },
```

(A malformed old document is left for the schema to refuse with its usual "damaged" message; guard each cast so a missing field can't throw.)

`src/model/validate.ts`: replace the hero, enemy and boss look checks with `lookProblems` from `./look`:

```ts
  problems.push(...lookProblems("hero", project.hero.look, "The hero"));
  // ...for each enemy:
  problems.push(...lookProblems(enemy.behaviour, enemy.look, tidyName(enemy.name)));
  // ...for the boss:
  if (project.boss) problems.push(...lookProblems("boss", project.boss.look, tidyName(project.boss.name)));
```

(Remove the old "The hero: " prefix; `lookProblems` names the character itself.)

`src/model/contentPack.ts`: `hero: Look`, `enemyLooks: Record<EnemyBehaviour, Look>`, `bossLook: Look`.

- [ ] **Step 4: The content packs**

`src/content/snow/hero.ts`: build the old shape as before under a new local name (`snowHeroPictures: OldHeroLook`), then `export const snowHero: Look = heroLookFrom(snowHeroPictures);`.

`src/content/snow/enemies.ts`: `snowEnemyLooks` maps each behaviour to `designLookFrom(behaviour, look(behaviour))`; `snowBossLook = designLookFrom("boss", lettersToLook(...))`.

`tests/fixtures/testPack.ts`: keep today's solid pictures as `export const testOldHero: OldHeroLook` (today's `testHero` body), then `export const testHero = heroLookFrom(testOldHero)`; `testEnemyLooks` maps through `designLookFrom(b, ...)`; `testBossLook = designLookFrom("boss", ...)`.

- [ ] **Step 5: Readers**

- `src/runtime/render/heroArt.ts`: `poses` from `pictureRows(look, pose)`; `shot` from `pictureRows(look, "shot")`, `chargedShot` likewise.
- `src/runtime/render/lookArt.ts`: `ownSkins` builds each enemy's art from `designLook(enemy.behaviour, enemy.look)` and the boss's from `designLook("boss", boss.look)`; `lookArt` keeps taking a `DesignLook`.
- `src/editor/Editor.tsx`'s `ownArt` and `EnemiesScreen`'s thumbnails and canvas: `lookArt(designLook(e.behaviour, e.look))`; the canvas rows are `designFrames(enemy.behaviour, enemy.look)[frame]`, partners likewise.
- `src/editor/components/BossScreen.tsx`: `lookArt(designLook("boss", look))`; rows `designFrames("boss", boss.look)[frame]`.
- `src/editor/hero/importPicture.ts`: `export const EDITOR_MAX_COLOURS = 8; // the screens offer 8 until milestone 4, plan 4`, used where `MAX_COLOURS` was; `src/editor/components/Colours.tsx` imports it from there.
- The AI's `describe.ts` doesn't read pictures: no change.

- [ ] **Step 6: The picture commands, over looks**

They keep their names, arguments and messages until Task 4 replaces them:

- `setHeroColours`: the colour check reads `pictureRows(look, p)`; the limit is `MAX_LOOK_COLOURS` (16). Commands may not import the editor, so only the editor holds 8.
- `setHeroPose`: `withPicture(look, picture, rows)`, then the size check is `PICTURE_SIZES[picture]` against `rows` (the old message: `${PICTURE_NAMES[picture]} is ${w} by ${h} pixels, not ${W} by ${H}.`), then `lookProblems("hero", next, "The hero")[0]` for pixels and colours.
- `setEnemyColours`, `setEnemyFrame`, `setBossColours`, `setBossFrame`: read and write through `designFrameSlot`; keep `framesProblems(name, designLook(kind, next), size)` for their size and colour messages.
- `addEnemy` and `createBoss` copy `ctx.pack.enemyLooks[behaviour]` and `ctx.pack.bossLook` as before (now looks). `setEnemyBehaviour` must keep the drawing: build the new look with `designLookFrom(newBehaviour, designLook(oldBehaviour, enemy.look))` (the frames carry over by position, as the spec says).

- [ ] **Step 7: Bring the old-shape tests along**

Run `grep -rln "\.poses\|look\.frames\|look\.shot\|chargedShot:\|heroLookSchema\|enemyLookSchema\|MAX_COLOURS" tests e2e src` and update each hit:
- reading a hero picture: `pictureRows(look, picture)`;
- reading an enemy's or boss's frame: `designFrames(kind, look)[i]`;
- building a look by hand: build the old shape and pass it through `heroLookFrom` / `designLookFrom`;
- expected messages from validation now come from `lookProblems` (for example "The hero's Stand frame 1 is not 16 by 24 pixels.").

Don't change what a test checks, only how it reaches the pictures.

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass. The browser tests are unchanged and must pass as they are: nothing visible changed.

- [ ] **Step 9: Commit**

```bash
git add -A src tests
git commit -m "feat: store every character as a look in game file format 4, upgrading older games"
```

---

### Task 4: The look commands

**Files:**
- Create: `src/commands/look.ts`
- Modify: `src/commands/registry.ts`, `src/commands/hero.ts`, `src/commands/enemies.ts`, `src/commands/boss.ts`, `src/editor/components/HeroScreen.tsx`, `src/editor/components/EnemiesScreen.tsx`, `src/editor/components/BossScreen.tsx`, `tests/boundaries.test.ts`
- Test: `tests/commands/look.test.ts`; the screens' existing tests

**Interfaces:**
- Consumes: Tasks 1 to 3
- Produces: commands `setLookColours { target, colours }`, `setFrame { target, animation, frame, rows }`, `addFrame { target, animation, after, copy? }`, `removeFrame { target, animation, frame }`, `moveFrame { target, animation, from, to }`, `setAnimationSpeed { target, animation, speed }`, `resizeCanvas { target, canvas, w, h }`, `setBody { target, which?: "main" | "slide", body }`, `fitBody { target, which?: "main" | "slide" }`, `setShotY { target, y }`; `type LookTarget = "hero" | "boss" | { enemy: string }`. The commands `setHeroColours`, `setHeroPose`, `setEnemyColours`, `setEnemyFrame`, `setBossColours`, `setBossFrame` are removed.

- [ ] **Step 1: Write the failing tests**

`tests/commands/look.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createHistory, runCommand, undo } from "@/commands/history";
import { lookProblems } from "@/model/look";
import { baseProject, ctx, run, runError } from "./helpers";

const fill = (w: number, h: number, ch: string) => Array.from({ length: h }, () => ch.repeat(w));
const hero = { target: "hero" };
const run2 = (p: ReturnType<typeof baseProject>) => p.hero.look.animations.run;

describe("frames", () => {
  it("adds a blank frame or a copy after the chosen one, and refuses a ninth", () => {
    let project = run(baseProject(), "addFrame", { ...hero, animation: "run", after: 0, copy: true });
    expect(run2(project).frames).toEqual([run2(baseProject()).frames[0], run2(baseProject()).frames[0], run2(baseProject()).frames[1]]);
    project = run(project, "addFrame", { ...hero, animation: "run", after: 2 });
    expect(run2(project).frames[3]).toEqual(fill(16, 24, "."));
    for (let i = 0; i < 4; i++) project = run(project, "addFrame", { ...hero, animation: "run", after: 0 });
    expect(run2(project).frames).toHaveLength(8);
    expect(runError(project, "addFrame", { ...hero, animation: "run", after: 0, copy: true })).toBe("Run already has 8 frames, the most.");
  });

  it("removes and moves frames, keeping at least one", () => {
    const start = run2(baseProject()).frames;
    let project = run(baseProject(), "moveFrame", { ...hero, animation: "run", from: 1, to: 0 });
    expect(run2(project).frames).toEqual([start[1], start[0]]);
    project = run(project, "removeFrame", { ...hero, animation: "run", frame: 0 });
    expect(run2(project).frames).toEqual([start[0]]);
    expect(runError(project, "removeFrame", { ...hero, animation: "run", frame: 0 })).toBe("Run needs at least one frame.");
    expect(runError(project, "removeFrame", { ...hero, animation: "run", frame: 4 })).toBe("Run has no frame 5.");
  });

  it("draws a frame, checking its size and colours", () => {
    const project = run(baseProject(), "setFrame", { ...hero, animation: "stand", frame: 0, rows: fill(16, 24, ".") });
    expect(project.hero.look.animations.stand.frames[0]).toEqual(fill(16, 24, "."));
    expect(runError(project, "setFrame", { ...hero, animation: "stand", frame: 0, rows: fill(15, 24, ".") })).toBe(
      "The hero's Stand frame 1 is not 16 by 24 pixels.",
    );
    expect(runError(project, "setFrame", { ...hero, animation: "walk", frame: 0, rows: fill(16, 24, ".") })).toBe(
      'The hero has no animation called "walk".',
    );
  });

  it("sets an animation's speed", () => {
    expect(run2(run(baseProject(), "setAnimationSpeed", { ...hero, animation: "run", speed: "fast" })).speed).toBe("fast");
  });
});

describe("colours", () => {
  it("allows 16, and refuses removing one still in use, naming the frames", () => {
    const sixteen = Array.from({ length: 16 }, (_, i) => i);
    let project = run(baseProject(), "setLookColours", { ...hero, colours: sixteen });
    project = run(project, "setFrame", { ...hero, animation: "run", frame: 1, rows: fill(16, 24, "g") });
    expect(runError(project, "setLookColours", { ...hero, colours: sixteen.slice(0, 15) })).toBe("Colour 16 is still used in Run frame 2.");
  });
});

describe("the canvas, body and shot point", () => {
  it("grows evenly at the sides and top, keeping the feet row, and refits the body", () => {
    const project = run(baseProject(), "resizeCanvas", { ...hero, canvas: "main", w: 20, h: 28 });
    const look = project.hero.look;
    expect(look.canvases.main).toEqual({ w: 20, h: 28 });
    const before = baseProject().hero.look.animations.stand.frames[0];
    expect(look.animations.stand.frames[0]).toEqual([...fill(20, 4, "."), ...before.map((row) => `..${row}..`)]);
    expect(look.body).toEqual({ x: 2, y: 4, w: 16, h: 24 }); // the test hero's solid picture
    expect(lookProblems("hero", look, "The hero")).toEqual([]);
  });

  it("trims evenly when shrinking, and one undo puts it all back", () => {
    const start = baseProject();
    const history = createHistory(start);
    const { history: shrunk } = runCommand(history, { name: "resizeCanvas", args: { ...hero, canvas: "main", w: 12, h: 20 } }, ctx);
    const look = shrunk.present.hero.look;
    expect(look.animations.stand.frames[0]).toEqual(start.hero.look.animations.stand.frames[0].slice(4).map((row) => row.slice(2, 14)));
    expect(look.body.h).toBeLessThanOrEqual(20);
    expect(undo(shrunk).project).toBe(start);
  });

  it("refuses sizes outside the limits", () => {
    expect(runError(baseProject(), "resizeCanvas", { ...hero, canvas: "main", w: 34, h: 24 })).toBe(
      "The hero's canvas is 34 by 24; it can be 12 to 32 wide and 16 to 32 tall.",
    );
    expect(runError(baseProject(), "resizeCanvas", { ...hero, canvas: "shot", w: 8, h: 4 })).toBe("The hero's shot canvas must be 6 by 4.");
  });

  it("sets and fits the hitbox, and moves the shot point within it", () => {
    let project = run(baseProject(), "setBody", { ...hero, body: { x: 2, y: 4, w: 12, h: 20 } });
    expect(project.hero.look.body).toEqual({ x: 2, y: 4, w: 12, h: 20 });
    expect(runError(project, "setBody", { ...hero, body: { x: 2, y: 0, w: 12, h: 31 } })).toMatch(/hitbox/);
    project = run(project, "fitBody", { ...hero });
    expect(project.hero.look.body).toEqual({ x: 0, y: 0, w: 16, h: 24 }); // the test hero's pictures are solid
    project = run(project, "setShotY", { ...hero, y: 12 });
    expect(project.hero.look.shotY).toBe(12);
    expect(runError(project, "setShotY", { ...hero, y: 21 })).toBe("The hero's shot point is outside its hitbox.");
  });

  it("aims at an enemy or the boss", () => {
    let project = run(baseProject(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    project = run(project, "addFrame", { target: { enemy: "e1" }, animation: "walk", after: 1, copy: true });
    expect(project.enemies[0].look.animations.walk.frames).toHaveLength(3);
    expect(runError(project, "setShotY", { target: { enemy: "e1" }, y: 2 })).toBe("Frost Fang doesn't shoot, so it can't have a shot point.");
    expect(runError(project, "setFrame", { target: { enemy: "e9" }, animation: "walk", frame: 0, rows: ["1"] })).toBe(
      'There is no enemy with the id "e9".',
    );
    expect(runError(project, "setAnimationSpeed", { target: "boss", animation: "stand", speed: "slow" })).toBe(
      "Your game has no boss of its own yet.",
    );
  });
});
```

In `tests/boundaries.test.ts`, replace `"setHeroColours", "setHeroPose"` and the enemy and boss picture commands with:

```ts
        "setLookColours", "setFrame", "addFrame", "removeFrame", "moveFrame", "setAnimationSpeed", "resizeCanvas", "setBody", "fitBody", "setShotY",
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/commands/look.test.ts tests/boundaries.test.ts`
Expected: FAIL (no look commands).

- [ ] **Step 3: Write the commands**

`src/commands/look.ts`:

```ts
import { z } from "zod";
import { tidyName, type Project } from "@/model/schema";
import {
  ANIMATION_NAMES,
  ANIMATION_SPEEDS,
  firstStanding,
  fitBody,
  HERO_BODY_MAX_H,
  KINDS,
  lookProblems,
  MAX_FRAMES,
  MAX_LOOK_COLOURS,
  SLIDE_BODY_MAX_H,
  slotChar,
  type Look,
  type LookKind,
} from "@/model/look";
import { PALETTE_8BIT } from "@/model/palette";
import { listNames } from "./helpers";
import { defineCommand, fail, idArg, ok, type CommandResult } from "./types";

const targetArg = z.union([z.literal("hero"), z.literal("boss"), z.strictObject({ enemy: idArg })]);
export type LookTarget = z.infer<typeof targetArg>;
const frameIndex = z.number().int().min(0).max(MAX_FRAMES - 1);
const animationArg = z.string().min(1).max(32);

type Found = { kind: LookKind; look: Look; name: string };

function find(project: Project, target: LookTarget): Found | string {
  if (target === "hero") return { kind: "hero", look: project.hero.look, name: "The hero" };
  if (target === "boss") {
    if (!project.boss) return "Your game has no boss of its own yet.";
    return { kind: "boss", look: project.boss.look, name: tidyName(project.boss.name) };
  }
  const enemy = project.enemies.find((e) => e.id === target.enemy);
  if (!enemy) return `There is no enemy with the id "${target.enemy}".`;
  return { kind: enemy.behaviour, look: enemy.look, name: tidyName(enemy.name) };
}

function put(project: Project, target: LookTarget, look: Look): Project {
  if (target === "hero") return { ...project, hero: { ...project.hero, look } };
  if (target === "boss") return { ...project, boss: { ...project.boss!, look } };
  return { ...project, enemies: project.enemies.map((e) => (e.id === target.enemy ? { ...e, look } : e)) };
}

// Finds the target, applies a change to its look, and keeps the result only if the look is valid.
function editLook(project: Project, target: LookTarget, change: (found: Found) => Look | string): CommandResult {
  const found = find(project, target);
  if (typeof found === "string") return fail(found);
  const next = change(found);
  if (typeof next === "string") return fail(next);
  const problem = lookProblems(found.kind, next, found.name)[0];
  if (problem) return fail(problem);
  return ok(put(project, target, next));
}

function animationOf(found: Found, animation: string) {
  if (!KINDS[found.kind].animations[animation]) {
    const who = found.kind === "hero" ? "The hero" : found.name;
    return `${who} has no animation called "${animation}".`;
  }
  return found.look.animations[animation];
}

const withFrames = (look: Look, animation: string, frames: string[][]): Look => ({
  ...look,
  animations: { ...look.animations, [animation]: { ...look.animations[animation], frames } },
});

const setLookColours = defineCommand({
  name: "setLookColours",
  description: `Set a character's colour slots: 1 to ${MAX_LOOK_COLOURS} colours from the 8-bit palette. Pixels name slots ("1" to "9", then "a" to "g").`,
  args: z.strictObject({
    target: targetArg,
    colours: z.array(z.number().int().min(0).max(PALETTE_8BIT.length - 1)).min(1).max(MAX_LOOK_COLOURS),
  }),
  apply(project, args) {
    return editLook(project, args.target, ({ look }) => {
      for (let slot = args.colours.length + 1; slot <= look.colours.length; slot++) {
        const ch = slotChar(slot);
        const users = Object.entries(look.animations).flatMap(([name, anim]) =>
          anim.frames.flatMap((rows, i) => (rows.some((row) => row.includes(ch)) ? [`${ANIMATION_NAMES[name]} frame ${i + 1}`] : [])),
        );
        if (users.length > 0) return `Colour ${slot} is still used in ${listNames(users)}.`;
      }
      return { ...look, colours: args.colours };
    });
  },
});

const setFrame = defineCommand({
  name: "setFrame",
  description: "Replace one frame of a character's animation with rows of pixels.",
  args: z.strictObject({ target: targetArg, animation: animationArg, frame: frameIndex, rows: z.array(z.string()).min(1).max(64) }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      if (args.frame >= anim.frames.length) return `${ANIMATION_NAMES[args.animation]} has no frame ${args.frame + 1}.`;
      return withFrames(found.look, args.animation, anim.frames.map((f, i) => (i === args.frame ? args.rows : f)));
    });
  },
});

const addFrame = defineCommand({
  name: "addFrame",
  description: "Add a frame to a character's animation after frame `after`: blank, or a copy of frame `after`.",
  args: z.strictObject({ target: targetArg, animation: animationArg, after: frameIndex, copy: z.boolean().optional() }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      const label = ANIMATION_NAMES[args.animation];
      if (anim.frames.length >= MAX_FRAMES) return `${label} already has ${MAX_FRAMES} frames, the most.`;
      if (args.after >= anim.frames.length) return `${label} has no frame ${args.after + 1}.`;
      const canvas = found.look.canvases[KINDS[found.kind].animations[args.animation]];
      const added = args.copy ? anim.frames[args.after] : Array.from({ length: canvas.h }, () => ".".repeat(canvas.w));
      const frames = [...anim.frames.slice(0, args.after + 1), added, ...anim.frames.slice(args.after + 1)];
      return withFrames(found.look, args.animation, frames);
    });
  },
});

const removeFrame = defineCommand({
  name: "removeFrame",
  description: "Remove a frame from a character's animation. Every animation keeps at least one.",
  args: z.strictObject({ target: targetArg, animation: animationArg, frame: frameIndex }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      const label = ANIMATION_NAMES[args.animation];
      if (args.frame >= anim.frames.length) return `${label} has no frame ${args.frame + 1}.`;
      if (anim.frames.length === 1) return `${label} needs at least one frame.`;
      return withFrames(found.look, args.animation, anim.frames.filter((_, i) => i !== args.frame));
    });
  },
});

const moveFrame = defineCommand({
  name: "moveFrame",
  description: "Move a frame of a character's animation to a new place in the animation.",
  args: z.strictObject({ target: targetArg, animation: animationArg, from: frameIndex, to: frameIndex }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      const label = ANIMATION_NAMES[args.animation];
      const missing = [args.from, args.to].find((i) => i >= anim.frames.length);
      if (missing !== undefined) return `${label} has no frame ${missing + 1}.`;
      const frames = anim.frames.filter((_, i) => i !== args.from);
      frames.splice(args.to, 0, anim.frames[args.from]);
      return withFrames(found.look, args.animation, frames);
    });
  },
});

const setAnimationSpeed = defineCommand({
  name: "setAnimationSpeed",
  description: "Set how fast one of a character's animations plays: slow, normal or fast.",
  args: z.strictObject({ target: targetArg, animation: animationArg, speed: z.enum(ANIMATION_SPEEDS) }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      return { ...found.look, animations: { ...found.look.animations, [args.animation]: { ...anim, speed: args.speed } } };
    });
  },
});

// Pads or trims a frame: evenly at the left and right (the odd pixel on the right), and at the
// top only, so the bottom row (the feet) stays the bottom row.
function reframe(rows: string[], w: number, h: number): string[] {
  const oldW = rows[0].length;
  const left = Math.floor((w - oldW) / 2);
  const widened = rows.map((row) => {
    if (left >= 0) return ".".repeat(left) + row + ".".repeat(w - oldW - left);
    return row.slice(-left, -left + w);
  });
  const dy = h - widened.length;
  return dy >= 0 ? [...Array.from({ length: dy }, () => ".".repeat(w)), ...widened] : widened.slice(-dy);
}

const bodyFor = (found: Found, look: Look, which: "main" | "slide") => {
  const animation = which === "slide" ? "slide" : firstStanding(found.kind);
  const maxH = found.kind !== "hero" ? null : which === "slide" ? SLIDE_BODY_MAX_H : HERO_BODY_MAX_H;
  return fitBody(look.animations[animation].frames[0], look.canvases[which], maxH);
};

// Keeps a shot point inside a new body.
function withShotInside(found: Found, look: Look): Look {
  const shotHeight = KINDS[found.kind].shotHeight;
  if (shotHeight === null || look.shotY === undefined) return look;
  return { ...look, shotY: Math.max(0, Math.min(look.shotY, look.body.h - shotHeight)) };
}

const resizeCanvas = defineCommand({
  name: "resizeCanvas",
  description:
    "Resize one of a character's canvases, padding or trimming every frame on it evenly at the sides and at the top (the feet stay on the bottom), and fitting its hitbox to the drawing.",
  args: z.strictObject({ target: targetArg, canvas: z.string().min(1).max(32), w: z.number().int().min(1).max(64), h: z.number().int().min(1).max(64) }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      if (!KINDS[found.kind].canvases[args.canvas]) return `${found.name} has no canvas called "${args.canvas}".`;
      const animations = Object.fromEntries(
        Object.entries(found.look.animations).map(([name, anim]) => [
          name,
          KINDS[found.kind].animations[name] === args.canvas ? { ...anim, frames: anim.frames.map((f) => reframe(f, args.w, args.h)) } : anim,
        ]),
      );
      let look: Look = { ...found.look, canvases: { ...found.look.canvases, [args.canvas]: { w: args.w, h: args.h } }, animations };
      // Check the size before fitting, so a size outside the limits gets its own message.
      const sizeProblem = lookProblems(found.kind, look, found.name).find((p) => /canvas (is|must)/.test(p));
      if (sizeProblem) return sizeProblem;
      if (args.canvas === "main") look = withShotInside(found, { ...look, body: bodyFor(found, look, "main") });
      if (args.canvas === "slide") look = { ...look, slideBody: bodyFor(found, look, "slide") };
      return look;
    });
  },
});

const whichArg = z.enum(["main", "slide"]).optional();
const boxArg = z.strictObject({ x: z.number().int(), y: z.number().int(), w: z.number().int().min(1), h: z.number().int().min(1) });

const setBody = defineCommand({
  name: "setBody",
  description: "Set a character's hitbox (or the hero's sliding hitbox, with which: \"slide\") in its canvas's pixels.",
  args: z.strictObject({ target: targetArg, which: whichArg, body: boxArg }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      if (args.which === "slide") return found.kind === "hero" ? { ...found.look, slideBody: args.body } : `${found.name} can't slide.`;
      return withShotInside(found, { ...found.look, body: args.body });
    });
  },
});

const fitBodyCommand = defineCommand({
  name: "fitBody",
  description: "Fit a character's hitbox (or the hero's sliding hitbox) to its drawing.",
  args: z.strictObject({ target: targetArg, which: whichArg }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      if (args.which === "slide") return found.kind === "hero" ? { ...found.look, slideBody: bodyFor(found, found.look, "slide") } : `${found.name} can't slide.`;
      return withShotInside(found, { ...found.look, body: bodyFor(found, found.look, "main") });
    });
  },
});

const setShotY = defineCommand({
  name: "setShotY",
  description: "Set where a character's shots come out: pixels below the top of its hitbox.",
  args: z.strictObject({ target: targetArg, y: z.number().int().min(-64).max(64) }),
  apply(project, args) {
    return editLook(project, args.target, (found) => ({ ...found.look, shotY: args.y }));
  },
});

export const lookCommands = [
  setLookColours,
  setFrame,
  addFrame,
  removeFrame,
  moveFrame,
  setAnimationSpeed,
  resizeCanvas,
  setBody,
  fitBodyCommand,
  setShotY,
];
```

Register `...lookCommands` in `src/commands/registry.ts`. Delete `setHeroColours` and `setHeroPose` from `hero.ts`, `setEnemyColours` and `setEnemyFrame` from `enemies.ts`, and `setBossColours` and `setBossFrame` from `boss.ts`, with their tests (their behaviour is now covered in `look.test.ts`; move any refusal a deleted test pinned that `look.test.ts` doesn't, such as the colour-in-use refusal for an enemy, into `look.test.ts`).

(The `setFrame` message for a wrong size comes from `lookProblems`: "The hero's Stand frame 1 is not 16 by 24 pixels.". A "shot point outside" check covers both `setShotY` and a hand-edited file.)

- [ ] **Step 4: The screens call the new commands**

- `HeroScreen.tsx`: drawing a picture sends `setFrame { target: "hero", ...HERO_PICTURE_SLOTS[picture], rows }`; colours send `setLookColours { target: "hero", colours }`; an import sends the colours (if changed) then the frame, as now.
- `EnemiesScreen.tsx`: `setFrame { target: { enemy: enemy.id }, ...designFrameSlot(enemy.behaviour, frame), rows }`; colours `setLookColours { target: { enemy: enemy.id }, colours }`.
- `BossScreen.tsx`: `setFrame { target: "boss", ...designFrameSlot("boss", frame), rows }`; colours `setLookColours { target: "boss", colours }`.

(`HERO_PICTURE_SLOTS` gives `{ animation, frame }`, exactly the two arguments `setFrame` needs.)

Update the screens' tests whose expected colour refusal text changes: "Colour 3 is still used in …" now names animation frames ("Stand frame 1").

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass. The browser tests are unchanged.

- [ ] **Step 6: Update the status and commit**

In `docs/superpowers/STATUS.md`: add this plan and the milestone 4 spec to the documents table (the plan as implemented, reviewed and merged); say game files are format 4, every character stores a look, and nothing visible changed; update the test counts; add this plan's deferred review findings.

```bash
git add -A src tests docs/superpowers/STATUS.md
git commit -m "feat: add the look commands for frames, speeds, canvas sizes, hitboxes and shot points"
```

---

## Self-review

- **Spec coverage:** section 3's look (colours 1–16, canvases per group with the spec's sizes and even steps, the animations per kind, body and slide body limits, shotY for the hero, turrets, shield guards and the boss) → Task 1; old games (pictures to animations, today's bodies and shot heights, speeds normal) → Tasks 2 and 3; the content pack's starting drawings as looks → Task 3 (the snow things' rendering waits for plan 2, stated in Decisions); section 4's ten commands, the six old ones replaced, all undoable and validated → Task 4; section 8's broken-file rows (wrong frame size, 17th colour, empty or missing animation, body outside or past limits, shot point outside) → Tasks 1 and 3; section 9's upgrade tests and "old games play the same" (drawn identically, since the sprites are equal) → Task 3. Animations in the game, bodies and shot points in the game, and the editor's new controls are plans 2 to 5.
- **Placeholder scan:** Task 3's Step 7 is a rule for mechanical updates, with the grep that finds them; every behaviour change has its test written out.
- **Types:** `Look`, `LookKind`, `KINDS`, `lookProblems`, `fitBody`, `firstStanding`, `heroLookFrom`, `designLookFrom`, `HERO_PICTURE_SLOTS`, `designFrameSlot`, `designFrames`, `designLook`, `DESIGN_BODIES`, `DESIGN_SHOT_Y`, `LookTarget` are defined once and used with the same names.
