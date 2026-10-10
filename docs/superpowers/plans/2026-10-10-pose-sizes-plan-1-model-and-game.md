# Pose sizes, plan 1 of 2: the model, the file and the game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every pose (animation) of every character has its own picture size,
hitbox position and shot point; game files move to format 5; the game draws each
pose on the body and fires from the shown pose's shot point; the editor's
existing controls work on the chosen pose.

**Architecture:** The look loses its `canvases` and its boxed `body`/`shotY`.
Each animation gains `size`, `at` (the hitbox's top-left in its picture) and
`shotY`; the look keeps the hitbox *sizes* (`body`, `slideBody`) once. Kind rules
become per pose (`PoseRule`: which hitbox, min and max size). Pure helpers in
`src/model/poses.ts` resize a pose and set a pose's hitbox; commands wrap them.
The game reads the pose being shown, through a small sim-side `pose.ts` that
both the renderer and the shooting code use.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Zod 4, Vitest 4 (jsdom), Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-pose-sizes-design.md`

**Build order (ruling):** the spec's three steps become two plans. Changing the
look's shape breaks the game and the editor at once, so this plan rewires both
to the new shape (the game fully, the editor's existing controls per pose).
Plan 2 is the editor's new behaviour: the dimmed Size step and its note, the
hitbox drag limited by the smallest pose, the zoom from the largest pose, Copy
from across sizes, scaled thumbnails, and the browser test with a larger Jump and
shoot.

## Global Constraints

- Picture-size limits per pose:
  - the hero's standing poses 12×16 to 32×32 (even sides);
  - Slide 16×8 to 32×16;
  - Shot fixed 6×4;
  - Charged shot fixed 12×10;
  - enemies 8×8 to 32×32;
  - the boss 16×16 to 48×48.
- Hitbox limits (unchanged):
  - at least 4×4;
  - the hero's at most 16 wide and 30 tall;
  - the sliding hitbox at most 14 tall.
- A pose with a hitbox has `at`. The hero's Shot and Charged shot have none.
- A shot point exists on every pose with the main hitbox, on characters that shoot (hero, turret, shielded, boss). Slide has none.
- Messages name the pose. They are written exactly as in the tests below, for example:
  - "The hero's Jump and shoot is 12 by 16; its hitbox needs 14 by 22."
  - "The hero's Jump and shoot shot point is outside its hitbox."
- Format 5. Every format 4 (and older) game opens and looks and plays the same.
- Each command is one undo step, as now.
- Never commit `test-art/`: stage with `git add -A src tests e2e docs`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tasks 1–4 run only their named test files. The whole suite and `npm run typecheck` are green again at the end of Task 5; everything else in between is expected to be red.

## Review Focus

1. **A damaged format-4 file** (a look missing a canvas, or an enemy with an unknown behaviour) is refused as damaged. It never throws while upgrading. Test: Task 2.
2. **Changing the hitbox size so it no longer fits a smaller pose** is refused with that pose's message, and nothing changes. Test: Task 3.
3. **Changing an enemy's behaviour so two poses of different sizes become one** reframes the frames to the first pose's size, so the look stays valid. Test: Task 1.
4. **Firing on a ladder, or in the air,** uses Climb's or Jump and shoot's shot point, not Stand and shoot's. Test: Task 4.
5. **Changing only one pose's shot point** gets the level checked again: the checker's cache notices it. Test: Task 4.

## Mapping old fields to new (for every task)

| Format 4 | Format 5 |
|---|---|
| `look.canvases[group]` | `look.animations[a].size` (each pose of the old group) |
| `look.body` (a box) | `look.body` is `{ w, h }`; the box is `poseBox(look, kind, a)` = `{ ...animations[a].at, ...body }` |
| `look.slideBody` (a box) | `look.slideBody` is `{ w, h }`; the box is `poseBox(look, "hero", "slide")` |
| `look.shotY` | `look.animations[a].shotY`, for each pose with a shot point |
| `KINDS[k].animations[a]` (a group name) | `KINDS[k].animations[a]` is a `PoseRule { body, min, max }` |
| `KINDS[k].canvases[g]` | `KINDS[k].animations[a].min` / `.max` |
| `resizeCanvas { canvas, w, h }` | `resizePose { animation, w, h }` |
| `setBody { which?, body }` | `setBody { animation, body }` |
| `fitBody { which? }` | `fitBody { animation }` |
| `setShotY { y }` | `setShotY { animation, y }` |

A test that builds a format-4 look literal can wrap it as `lookFromFormat4(kind, literal)` (Task 2) instead of rewriting it.

---

### Task 1: The pose model

**Files:**
- Modify: `src/model/look.ts`
- Create: `src/model/poses.ts`
- Test: `tests/model/poses.test.ts` (new), `tests/model/look.test.ts` (update)

**Interfaces:**
- Produces, in `src/model/look.ts`:
  - `type Size = { w: number; h: number }` (exported);
  - `type Point = { x: number; y: number }`;
  - `Animation` = `{ frames, speed, size: Size, at?: Point, shotY?: number }`;
  - `Look` = `{ colours, animations: Record<string, Animation>, body: Size, slideBody?: Size }`;
  - `type BodyName = "main" | "slide"`;
  - `type PoseRule = { body: BodyName | null; min: Size; max: Size }`;
  - `KindRule = { animations: Record<string, PoseRule>; shotHeight: number | null }`;
  - `isFixed(rule: PoseRule): boolean`;
  - `hasShotPoint(kind: LookKind, animation: string): boolean`;
  - `poseBox(look: Look, kind: LookKind, animation: string): LookBox | null`;
  - `shotPoints(look: Look): Record<string, number>`;
  - `cutsDrawing(look: Look, animation: string, w: number, h: number): boolean`;
  - `lookForKind(look, from, to)` (same signature);
  - `fitBody`, `reframeRows` and `lookProblems` keep their signatures. `firstStanding` stays.
- Produces, in `src/model/poses.ts`:
  - `nudgeInside(at: Point, box: Size, picture: Size): Point`;
  - `resizePose(look: Look, kind: LookKind, animation: string, w: number, h: number): Look`;
  - `setPoseBody(look: Look, kind: LookKind, animation: string, box: LookBox): Look`;
  - `fittedPoseBody(look: Look, kind: LookKind, animation: string): LookBox`.

- [ ] **Step 1: Write the failing tests**

Create `tests/model/poses.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cutsDrawing, KINDS, lookForKind, lookProblems, poseBox, shotPoints, type Animation, type Look, type Point } from "@/model/look";
import { fittedPoseBody, resizePose, setPoseBody } from "@/model/poses";

const fill = (w: number, h: number, ch = "1") => Array.from({ length: h }, () => ch.repeat(w));
const pose = (w: number, h: number, at?: Point, shotY?: number): Animation => ({
  frames: [fill(w, h)],
  speed: "normal",
  size: { w, h },
  ...(at ? { at } : {}),
  ...(shotY === undefined ? {} : { shotY }),
});

// Today's hero, in format 5: every standing pose 16 by 24 with the hitbox at (1, 2), shooting from 8.
function heroLook(): Look {
  const main = () => pose(16, 24, { x: 1, y: 2 }, 8);
  return {
    colours: [13],
    animations: {
      stand: main(), standShoot: main(), run: main(), runShoot: main(), jump: main(), jumpShoot: main(), climb: main(), hurt: main(),
      slide: pose(24, 16, { x: 5, y: 2 }),
      shot: pose(6, 4),
      chargedShot: pose(12, 10),
    },
    body: { w: 14, h: 22 },
    slideBody: { w: 14, h: 14 },
  };
}
const walker = (): Look => ({ colours: [13], animations: { walk: pose(16, 16, { x: 1, y: 2 }) }, body: { w: 14, h: 14 } });
const problems = (look: Look) => lookProblems("hero", look, "The hero");

describe("a look with poses", () => {
  it("accepts today's hero and a walker", () => {
    expect(problems(heroLook())).toEqual([]);
    expect(lookProblems("walker", walker(), "Frost Fang")).toEqual([]);
  });

  it("knows each pose's hitbox box and shot points", () => {
    const look = heroLook();
    expect(poseBox(look, "hero", "jumpShoot")).toEqual({ x: 1, y: 2, w: 14, h: 22 });
    expect(poseBox(look, "hero", "slide")).toEqual({ x: 5, y: 2, w: 14, h: 14 });
    expect(poseBox(look, "hero", "shot")).toBeNull();
    expect(Object.keys(shotPoints(look)).sort()).toEqual(["climb", "hurt", "jump", "jumpShoot", "run", "runShoot", "stand", "standShoot"]);
    expect(KINDS.hero.animations.stand).toEqual({ body: "main", min: { w: 12, h: 16 }, max: { w: 32, h: 32 } });
  });

  it("names the pose in every size, hitbox and shot point message", () => {
    const look = heroLook();
    look.animations.jumpShoot = { ...pose(34, 24, { x: 1, y: 2 }, 8) };
    expect(problems(look)).toContain("The hero's Jump and shoot is 34 by 24; it can be 12 to 32 wide and 16 to 32 tall.");
    look.animations.jumpShoot = pose(15, 24, { x: 1, y: 2 }, 8);
    expect(problems(look)).toContain("The hero's Jump and shoot is 15 by 24; its sides must be even.");
    look.animations.jumpShoot = pose(12, 16, { x: 0, y: 0 }, 8);
    expect(problems(look)).toContain("The hero's Jump and shoot is 12 by 16; its hitbox needs 14 by 22.");
    look.animations.jumpShoot = pose(16, 24, { x: 3, y: 2 }, 8);
    expect(problems(look)).toContain("The hero's Jump and shoot hitbox doesn't fit inside its picture.");
    look.animations.jumpShoot = pose(16, 24, { x: 1, y: 2 }, 19);
    expect(problems(look)).toContain("The hero's Jump and shoot shot point is outside its hitbox.");
    look.animations.shot = pose(8, 4);
    expect(problems(look)).toContain("The hero's Shot must be 6 by 4.");
    look.animations.shot = pose(6, 4, { x: 0, y: 0 });
    expect(problems(look)).toContain("The hero's Shot can't have a hitbox.");
    look.animations.slide = pose(24, 16, { x: 5, y: 2 }, 4);
    expect(problems(look)).toContain("The hero's Slide can't have a shot point.");
    look.animations.run = pose(16, 24);
    expect(problems(look)).toEqual(expect.arrayContaining(["The hero's Run has no hitbox position.", "The hero's Run has no shot point."]));
  });

  it("says once that a walker doesn't shoot", () => {
    const look = walker();
    look.animations.walk.shotY = 3;
    expect(lookProblems("walker", look, "Frost Fang").filter((p) => p.includes("doesn't shoot"))).toEqual([
      "Frost Fang doesn't shoot, so it can't have a shot point.",
    ]);
  });
});

describe("resizing one pose", () => {
  it("changes only that pose, moving its hitbox with the pixels", () => {
    const look = resizePose(heroLook(), "hero", "jumpShoot", 24, 24);
    expect(look.animations.stand).toEqual(heroLook().animations.stand);
    expect(look.animations.jumpShoot.size).toEqual({ w: 24, h: 24 });
    expect(look.animations.jumpShoot.frames[0][0]).toBe(`....${"1".repeat(16)}....`);
    expect(look.animations.jumpShoot.at).toEqual({ x: 5, y: 2 });
    expect(look.animations.jumpShoot.shotY).toBe(8);
    expect(problems(look)).toEqual([]);
  });

  it("nudges a hitbox a trim left poking out back inside", () => {
    const start = heroLook();
    start.animations.stand.at = { x: 2, y: 2 };
    const look = resizePose(start, "hero", "stand", 14, 24);
    expect(look.animations.stand.at).toEqual({ x: 0, y: 2 });
    expect(problems(look)).toEqual([]);
  });

  it("can't be smaller than the hitbox", () => {
    expect(problems(resizePose(heroLook(), "hero", "stand", 12, 24))).toContain("The hero's Stand is 12 by 24; its hitbox needs 14 by 22.");
  });

  it("knows when it would cut off drawing", () => {
    expect(cutsDrawing(heroLook(), "stand", 14, 24)).toBe(true);
    expect(cutsDrawing(heroLook(), "stand", 18, 24)).toBe(false);
    expect(cutsDrawing(resizePose(heroLook(), "hero", "jump", 20, 24), "stand", 14, 24)).toBe(true); // reads the named pose only
  });
});

describe("setting a pose's hitbox", () => {
  it("moves it in that pose and resizes it everywhere, keeping each pose's feet, centre and shot row", () => {
    const wide = resizePose(heroLook(), "hero", "jumpShoot", 24, 24); // its hitbox at (5, 2)
    const look = setPoseBody(wide, "hero", "stand", { x: 2, y: 4, w: 12, h: 20 });
    expect(look.body).toEqual({ w: 12, h: 20 });
    expect(look.animations.stand.at).toEqual({ x: 2, y: 4 });
    expect(look.animations.jumpShoot.at).toEqual({ x: 6, y: 4 }); // bottom 24 and centre 12 kept
    expect(look.animations.run.at).toEqual({ x: 2, y: 4 });
    expect(look.animations.stand.shotY).toBe(6); // the same picture row: 2 + 8 = 4 + 6
    expect(look.animations.slide).toEqual(wide.animations.slide);
    expect(problems(look)).toEqual([]);
  });

  it("sets the sliding hitbox from Slide, leaving the standing poses alone", () => {
    const look = setPoseBody(heroLook(), "hero", "slide", { x: 4, y: 4, w: 16, h: 12 });
    expect(look.slideBody).toEqual({ w: 16, h: 12 });
    expect(look.animations.slide.at).toEqual({ x: 4, y: 4 });
    expect(look.body).toEqual(heroLook().body);
    expect(look.animations.stand).toEqual(heroLook().animations.stand);
  });

  it("is refused by the smallest pose when it grows too big for it", () => {
    const narrow = resizePose(heroLook(), "hero", "stand", 14, 24);
    const look = setPoseBody(narrow, "hero", "jump", { x: 0, y: 2, w: 16, h: 22 });
    expect(problems(look)[0]).toBe("The hero's Stand is 14 by 24; its hitbox needs 16 by 22.");
  });

  it("fits a pose's hitbox to that pose's drawing", () => {
    const look = heroLook();
    look.animations.jumpShoot = { ...look.animations.jumpShoot, frames: [fill(16, 24, ".").map((row, y) => (y >= 8 ? "..1111111111...." : row))] };
    expect(fittedPoseBody(look, "hero", "jumpShoot")).toEqual({ x: 2, y: 8, w: 10, h: 16 });
  });
});

describe("changing an enemy's behaviour", () => {
  it("gives a new shooter a shot point in each pose, and merges poses of different sizes", () => {
    const turret = lookForKind(walker(), "walker", "turret");
    expect(turret.animations.idle.shotY).toBe(4); // the middle of a 14-tall hitbox, for a 6-tall shot
    expect(lookProblems("turret", turret, "Ice Eye")).toEqual([]);
    const jumper: Look = {
      colours: [13],
      animations: { ground: pose(16, 16, { x: 1, y: 2 }), air: pose(20, 16, { x: 3, y: 2 }) },
      body: { w: 14, h: 14 },
    };
    const merged = lookForKind(jumper, "jumper", "walker");
    expect(merged.animations.walk.frames).toHaveLength(2);
    expect(merged.animations.walk.frames.every((rows) => rows.length === 16 && rows[0].length === 16)).toBe(true);
    expect(lookProblems("walker", merged, "Frost Fang")).toEqual([]);
  });
});
```

In `tests/model/look.test.ts`:

1. Replace `walker()` with:

   ```ts
   const walker = (): Look => ({
     colours: [13],
     animations: { walk: { frames: [fill(16, 16), fill(16, 16)], speed: "normal", size: { w: 16, h: 16 }, at: { x: 1, y: 2 } } },
     body: { w: 14, h: 14 },
   });
   ```

2. In "refuses canvases outside the limits, or odd sizes", set `look.animations.walk.size` instead of `look.canvases.main`. Expect "Frost Fang's Walk is 34 by 16; it can be 8 to 32 wide and 8 to 32 tall." and "Frost Fang's Walk is 15 by 16; its sides must be even.".
3. In the body test:
   - use `{ ...walker(), animations: { walk: { ...walker().animations.walk, at: { x: 4, y: 4 } } } }`, expecting "Frost Fang's Walk hitbox doesn't fit inside its picture.";
   - set the shot point with `walk.shotY = 3`;
   - check `KINDS.hero.animations.stand.max.h`.
4. In "the hero's width", build the hero with `heroLookFrom(testOldHero)`. This passes once Task 2 makes it return format 5, so this test is the one in this file allowed to stay red until Task 2:
   - The 16-wide hitbox case uses `body: { w: 16, h: 22 }` with every standing pose at `{ x: 0, y: 2 }`.
   - The 18-wide case widens every standing pose to `size { w: 18, h: 24 }` with frames `row + ".."`, `at { x: 0, y: 2 }` and `body { w: 18, h: 22 }`.
   - The wide slide case uses `slideBody: { w: 22, h: 14 }` with `slide.at = { x: 1, y: 2 }`.
5. In "knows when shrinking would cut off drawn pixels", give the look the format 5 shape (`size: { w: 16, h: 16 }`, `at: { x: 4, y: 2 }`, `body: { w: 8, h: 14 }`), and call `cutsDrawing(look, "walk", w, h)`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/model/poses.test.ts tests/model/look.test.ts`
Expected: FAIL. `poseBox`, `shotPoints`, `resizePose` and the rest aren't exported, and the old shape's messages don't match.

- [ ] **Step 3: Change the model**

In `src/model/look.ts`:

1. Replace the schemas:

```ts
export type Size = { w: number; h: number };
export type Point = { x: number; y: number };
export type LookBox = { x: number; y: number; w: number; h: number };

const sizeSchema = z.object({ w: z.number().int().min(1).max(64), h: z.number().int().min(1).max(64) });
const rows = z.array(z.string()).min(1).max(64);
// A pose: its frames and speed, its own picture size, where the hitbox sits in that picture, and
// (for a pose with the standing hitbox, on a character that shoots) where shots come out.
export const animationSchema = z.object({
  frames: z.array(rows).min(1).max(MAX_FRAMES),
  speed: z.enum(ANIMATION_SPEEDS),
  size: sizeSchema,
  at: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
  shotY: z.number().int().optional(), // below the hitbox's top
});
export type Animation = z.infer<typeof animationSchema>;

// The hitbox sizes are the character's, the same in every pose: its body never changes size.
const bodySchema = z.object({ w: z.number().int().min(1), h: z.number().int().min(1) });
export const lookSchema = z.object({
  colours: z.array(z.number().int().min(0).max(PALETTE_8BIT.length - 1)).min(1).max(MAX_LOOK_COLOURS),
  animations: z.record(z.string(), animationSchema),
  body: bodySchema,
  slideBody: bodySchema.optional(),
});
```

2. Replace the kind rules:

```ts
export type BodyName = "main" | "slide";
// One pose's rule: which hitbox it carries (none for the hero's shots), and its picture's limits.
export type PoseRule = { body: BodyName | null; min: Size; max: Size };
export type KindRule = {
  animations: Record<string, PoseRule>;
  shotHeight: number | null; // the height of its shots, or null when it doesn't shoot
};

const poseRule = (body: BodyName | null, min: Size, max: Size): PoseRule => ({ body, min, max });
const ENEMY_POSE = poseRule("main", { w: 8, h: 8 }, { w: 32, h: 32 });
const enemy = (animations: string[], shotHeight: number | null = null): KindRule => ({
  animations: Object.fromEntries(animations.map((a) => [a, ENEMY_POSE])),
  shotHeight,
});
const HERO_POSE = poseRule("main", { w: 12, h: 16 }, { w: 32, h: 32 });
const BOSS_POSE = poseRule("main", { w: 16, h: 16 }, { w: 48, h: 48 });
```

   In `KINDS`:
   - **Hero:** `animations` maps stand, standShoot, run, runShoot, jump, jumpShoot, climb and hurt to `HERO_POSE`, plus:
     - `slide: poseRule("slide", { w: 16, h: 8 }, { w: 32, h: 16 })`;
     - `shot: poseRule(null, { w: 6, h: 4 }, { w: 6, h: 4 })`;
     - `chargedShot: poseRule(null, { w: 12, h: 10 }, { w: 12, h: 10 })`.
   - **Boss:** `{ animations: { stand: BOSS_POSE, jump: BOSS_POSE, attack: BOSS_POSE }, shotHeight: ENEMY_SHOT_H }`.
   - **Enemies:** the `enemy(...)` lines stay as they are.

3. Add the helpers, after `firstStanding`:

```ts
export const isFixed = (rule: PoseRule): boolean => rule.min.w === rule.max.w && rule.min.h === rule.max.h;

export const hasShotPoint = (kind: LookKind, animation: string): boolean =>
  KINDS[kind].shotHeight !== null && KINDS[kind].animations[animation]?.body === "main";

const bodyOf = (look: Look, which: BodyName | null | undefined): Size | undefined =>
  which === "main" ? look.body : which === "slide" ? look.slideBody : undefined;

// A pose's hitbox in its own picture's pixels, or null for a pose without one.
export function poseBox(look: Look, kind: LookKind, animation: string): LookBox | null {
  const at = look.animations[animation]?.at;
  const size = bodyOf(look, KINDS[kind].animations[animation]?.body);
  return at && size ? { ...at, ...size } : null;
}

// Every pose's shot point, by animation.
export const shotPoints = (look: Look): Record<string, number> =>
  Object.fromEntries(Object.entries(look.animations).flatMap(([name, a]) => (a.shotY === undefined ? [] : [[name, a.shotY]])));
```

4. Rewrite `lookProblems`. Character-wide checks come first (commands report the first problem), then each pose in the kind's order:

```ts
export function lookProblems(kind: LookKind, look: Look, name: string): string[] {
  const rule = KINDS[kind];
  const problems: string[] = [];
  const possessive = `${name}'s`;

  if (look.body.w < BODY_MIN || look.body.h < BODY_MIN) problems.push(`${possessive} hitbox must be at least ${BODY_MIN} by ${BODY_MIN}.`);
  if (kind === "hero" && look.body.h > HERO_BODY_MAX_H) {
    problems.push(`${possessive} hitbox is ${look.body.h} tall; at most ${HERO_BODY_MAX_H}, so it fits through 2-tile gaps.`);
  }
  if (kind === "hero" && look.body.w > HERO_BODY_MAX_W) {
    problems.push(`${possessive} hitbox is ${look.body.w} wide; at most ${HERO_BODY_MAX_W}, so it fits on a ladder beside a wall.`);
  }
  if (kind === "hero") {
    if (!look.slideBody) problems.push(`${name} has no sliding hitbox.`);
    else {
      if (look.slideBody.w < BODY_MIN || look.slideBody.h < BODY_MIN) problems.push(`${possessive} sliding hitbox must be at least ${BODY_MIN} by ${BODY_MIN}.`);
      if (look.slideBody.h > SLIDE_BODY_MAX_H) {
        problems.push(`${possessive} sliding hitbox is ${look.slideBody.h} tall; at most ${SLIDE_BODY_MAX_H}, so it fits under 1-tile gaps.`);
      }
    }
  } else if (look.slideBody) {
    problems.push(`${name} can't slide, so it can't have a sliding hitbox.`);
  }

  for (const [animation, limits] of Object.entries(rule.animations)) {
    const anim = look.animations[animation];
    const label = ANIMATION_NAMES[animation];
    const pose = `${possessive} ${label}`;
    if (!anim) {
      problems.push(`${name} has no ${label} animation.`);
      continue;
    }
    const { w, h } = anim.size;
    const fixed = isFixed(limits);
    if (w < limits.min.w || w > limits.max.w || h < limits.min.h || h > limits.max.h) {
      problems.push(
        fixed
          ? `${pose} must be ${limits.min.w} by ${limits.min.h}.`
          : `${pose} is ${w} by ${h}; it can be ${limits.min.w} to ${limits.max.w} wide and ${limits.min.h} to ${limits.max.h} tall.`,
      );
    } else if (!fixed && (w % 2 !== 0 || h % 2 !== 0)) {
      problems.push(`${pose} is ${w} by ${h}; its sides must be even.`);
    }
    anim.frames.forEach((frame, i) => {
      const where = `${pose} frame ${i + 1}`;
      if (frame.length !== h || frame.some((row) => row.length !== w)) {
        problems.push(`${where} is not ${w} by ${h} pixels.`);
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
        problems.push(`${where} uses colour ${highest}, but ${name.replace(/^The /, "the ")} only has ${count} colour${count === 1 ? "" : "s"}.`);
      }
    });
    const size = bodyOf(look, limits.body);
    if (limits.body === null) {
      if (anim.at) problems.push(`${pose} can't have a hitbox.`);
    } else if (!anim.at) {
      problems.push(`${pose} has no hitbox position.`);
    } else if (size) {
      if (size.w > w || size.h > h) problems.push(`${pose} is ${w} by ${h}; its hitbox needs ${size.w} by ${size.h}.`);
      else if (!inside({ ...anim.at, ...size }, anim.size)) problems.push(`${pose} hitbox doesn't fit inside its picture.`);
    }
    if (hasShotPoint(kind, animation)) {
      if (anim.shotY === undefined) problems.push(`${pose} has no shot point.`);
      else if (anim.shotY < 0 || anim.shotY > look.body.h - rule.shotHeight!) problems.push(`${pose} shot point is outside its hitbox.`);
    } else if (anim.shotY !== undefined) {
      problems.push(rule.shotHeight === null ? `${name} doesn't shoot, so it can't have a shot point.` : `${pose} can't have a shot point.`);
    }
  }
  for (const animation of Object.keys(look.animations)) {
    if (!rule.animations[animation]) problems.push(`${name} has an animation "${animation}" it can't use.`);
  }
  return [...new Set(problems)];
}
```

5. Make `cutsDrawing` read the named pose:

```ts
// Whether resizing a pose would cut off any drawn pixel of its frames.
export function cutsDrawing(look: Look, animation: string, w: number, h: number): boolean {
  const frames = look.animations[animation].frames;
  return drawn(frames.map((rows) => reframeRows(rows, w, h))) < drawn(frames);
}
```

6. Make `lookForKind` carry the poses whole. When two poses become one, the later frames are reframed to the first pose's size. Shot points are kept or added at the middle in each pose, or dropped:

```ts
export function lookForKind(look: Look, from: LookKind, to: LookKind): Look {
  const olds = Object.keys(KINDS[from].animations).map((a) => look.animations[a]);
  const names = Object.keys(KINDS[to].animations);
  let groups: Animation[];
  if (olds.length === names.length) groups = olds;
  else if (olds.length === 1) {
    const [first, ...rest] = olds[0].frames;
    groups = [{ ...olds[0], frames: [first] }, ...names.slice(1).map(() => ({ ...olds[0], frames: rest.length > 0 ? rest : [first] }))];
  } else {
    const { w, h } = olds[0].size;
    groups = [{ ...olds[0], frames: olds.flatMap((a) => a.frames.map((f) => reframeRows(f, w, h))).slice(0, MAX_FRAMES) }];
  }
  const shotHeight = KINDS[to].shotHeight;
  const middle = shotHeight === null ? 0 : Math.round(look.body.h / 2) - Math.round(shotHeight / 2);
  const highest = shotHeight === null ? 0 : Math.max(0, look.body.h - shotHeight);
  const animations = Object.fromEntries(
    names.map((name, i) => {
      const { shotY, ...pose } = groups[i] ?? groups[0];
      if (shotHeight === null) return [name, pose];
      return [name, { ...pose, shotY: Math.max(0, Math.min(shotY ?? middle, highest)) }];
    }),
  );
  return { ...look, animations };
}
```

7. Delete the old `canvases` loop, the old body, slide and shot blocks of `lookProblems`, and the `rule.canvases` references. Keep `inside`.

Create `src/model/poses.ts`:

```ts
import { fitBody, HERO_BODY_MAX_H, HERO_BODY_MAX_W, KINDS, poseBox, reframeRows, SLIDE_BODY_MAX_H, type Look, type LookBox, type LookKind, type Point, type Size } from "./look";

// Changes to one pose of a look: its picture size, and its hitbox (whose size every pose shares).

// Moves a hitbox's corner so the box lies inside the picture (to the top-left when it can't fit).
export function nudgeInside(at: Point, box: Size, picture: Size): Point {
  return { x: Math.max(0, Math.min(at.x, picture.w - box.w)), y: Math.max(0, Math.min(at.y, picture.h - box.h)) };
}

// Resizes one pose: its frames padded or trimmed evenly at the sides and at the top (the feet stay
// on the bottom row), its hitbox moving with the pixels and nudged back inside.
export function resizePose(look: Look, kind: LookKind, animation: string, w: number, h: number): Look {
  const anim = look.animations[animation];
  const box = poseBox(look, kind, animation);
  const left = Math.floor((w - anim.size.w) / 2);
  const top = h - anim.size.h;
  const at = box ? nudgeInside({ x: box.x + left, y: box.y + top }, box, { w, h }) : undefined;
  return {
    ...look,
    animations: {
      ...look.animations,
      [animation]: { ...anim, frames: anim.frames.map((rows) => reframeRows(rows, w, h)), size: { w, h }, ...(at ? { at } : {}) },
    },
  };
}

// Sets one pose's hitbox: its position there, and its size in every pose that shares it. The
// other poses keep their box's bottom edge and centre, nudged inside their pictures. Every pose
// keeps its shot point on the same row of its picture, inside the new box.
export function setPoseBody(look: Look, kind: LookKind, animation: string, box: LookBox): Look {
  const which = KINDS[kind].animations[animation].body;
  const old = which === "slide" ? look.slideBody : look.body;
  if (which === null || !old) return look;
  const size = { w: box.w, h: box.h };
  const shotHeight = KINDS[kind].shotHeight;
  const animations = Object.fromEntries(
    Object.entries(look.animations).map(([name, anim]) => {
      if (KINDS[kind].animations[name]?.body !== which || !anim.at) return [name, anim];
      const at =
        name === animation
          ? { x: box.x, y: box.y }
          : nudgeInside({ x: anim.at.x + Math.floor((old.w - box.w) / 2), y: anim.at.y + old.h - box.h }, size, anim.size);
      if (anim.shotY === undefined || shotHeight === null) return [name, { ...anim, at }];
      const shotY = Math.max(0, Math.min(anim.shotY + anim.at.y - at.y, box.h - shotHeight));
      return [name, { ...anim, at, shotY }];
    }),
  );
  return { ...look, animations, ...(which === "slide" ? { slideBody: size } : { body: size }) };
}

// The hitbox fitted to a pose's first frame. Hero hitboxes keep within their limits, and a
// shooter's stays at least as tall as its shot, growing upwards from its feet.
export function fittedPoseBody(look: Look, kind: LookKind, animation: string): LookBox {
  const anim = look.animations[animation];
  const which = KINDS[kind].animations[animation].body;
  const maxH = kind !== "hero" ? null : which === "slide" ? SLIDE_BODY_MAX_H : HERO_BODY_MAX_H;
  const maxW = kind === "hero" && which === "main" ? HERO_BODY_MAX_W : null;
  const box = fitBody(anim.frames[0], anim.size, maxH, maxW);
  const shotHeight = which === "main" ? KINDS[kind].shotHeight : null;
  if (shotHeight === null || box.h >= shotHeight) return box;
  const h = Math.min(shotHeight, anim.size.h);
  return { ...box, y: Math.max(0, box.y + box.h - h), h };
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/model/poses.test.ts tests/model/look.test.ts`
Expected: PASS, except look.test's "the hero's width", which needs Task 2's `heroLookFrom`. Record that test name in the ledger.

- [ ] **Step 5: Commit**

```bash
git add -A src/model tests/model
git commit -m "feat: give every pose its own picture size, hitbox position and shot point

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Format 5, the upgrade, and the snow pack

**Files:**
- Modify: `src/model/lookUpgrade.ts`, `src/model/parse.ts`, `src/model/schema.ts` (`FORMAT_VERSION = 5`)
- Test: `tests/model/lookUpgrade.test.ts`, `tests/model/parse.test.ts`

**Interfaces:**
- Consumes: `Look`, `KINDS`, `LookKind`, `lookProblems` (Task 1).
- Produces:
  - `type Format4Look = { colours: number[]; canvases: Record<string, Size>; animations: Record<string, { frames: string[][]; speed: AnimationSpeed }>; body: LookBox; slideBody?: LookBox; shotY?: number }`;
  - `lookFromFormat4(kind: LookKind, old: Format4Look): Look`;
  - `heroLookFrom` and `designLookFrom`, which now return format 5 looks.
  - `src/content/snow/*` and `tests/fixtures/testPack.ts` need no edits: they go through `heroLookFrom` and `designLookFrom`.

- [ ] **Step 1: Write the failing tests**

In `tests/model/lookUpgrade.test.ts`, change the first test's expectations to the format 5 shape:

```ts
    const look = heroLookFrom(oldHero());
    expect(lookProblems("hero", look, "The hero")).toEqual([]);
    for (const a of ["stand", "standShoot", "run", "runShoot", "jump", "jumpShoot", "climb", "hurt"]) {
      expect(look.animations[a], a).toMatchObject({ size: { w: 16, h: 24 }, at: { x: 1, y: 2 }, shotY: 8 });
    }
    expect(look.animations.slide).toMatchObject({ size: { w: 24, h: 16 }, at: { x: 5, y: 2 } });
    expect(look.animations.slide.shotY).toBeUndefined();
    expect(look.animations.shot.size).toEqual({ w: 6, h: 4 });
    expect(look.animations.shot.at).toBeUndefined();
    expect(look.animations.chargedShot.size).toEqual({ w: 12, h: 10 });
    expect(look.body).toEqual({ w: 14, h: 22 });
    expect(look.slideBody).toEqual({ w: 14, h: 14 });
```

In the Blizzard Bot test, replace `expect(look.shotY).toBe(11)` with `expect(shotPoints(look)).toEqual({ stand: 11, jump: 11, attack: 11 })`, importing `shotPoints` from `@/model/look`.

Add:

```ts
describe("lookFromFormat4", () => {
  it("gives every pose its old group's size, hitbox position and shot point", () => {
    const old: Format4Look = {
      colours: [13],
      canvases: { main: { w: 16, h: 16 } },
      animations: { idle: { frames: [fill(16, 16, "1")], speed: "fast" } },
      body: { x: 2, y: 4, w: 12, h: 12 },
      shotY: 3,
    };
    expect(lookFromFormat4("turret", old)).toEqual({
      colours: [13],
      animations: { idle: { frames: [fill(16, 16, "1")], speed: "fast", size: { w: 16, h: 16 }, at: { x: 2, y: 4 }, shotY: 3 } },
      body: { w: 12, h: 12 },
    });
  });
});
```

Import `lookFromFormat4` and `type Format4Look` from `@/model/lookUpgrade`.

In `tests/model/parse.test.ts`, add a format 4 file. It is built from the format 5 project the helper already makes, by turning each look back:

```ts
import { KINDS, type Look, type LookKind } from "@/model/look";

// The format 4 shape of a format 5 look, as format 4 games stored it: one canvas per group, one boxed hitbox, one shot point.
function format4(kind: LookKind, look: Look) {
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

describe("format 4 games", () => {
  it("open with every pose sized, placed and shooting as before", () => {
    const project = /* the file's existing helper for a game with an enemy (use the one the format 3 tests use) */;
    const doc = {
      ...project,
      formatVersion: 4,
      hero: { ...project.hero, look: format4("hero", project.hero.look) },
      enemies: project.enemies.map((e) => ({ ...e, look: format4(e.behaviour, e.look) })),
    };
    const result = parseProject(JSON.parse(JSON.stringify(doc)), getPack);
    expect(result.ok && result.project).toEqual(project);
  });

  it("refuses a damaged format 4 look without throwing", () => {
    const project = /* same helper */;
    const look = format4("hero", project.hero.look) as Record<string, unknown>;
    delete look.canvases;
    const result = parseProject({ ...project, formatVersion: 4, hero: { ...project.hero, look: { ...look, canvases: {} } } }, getPack);
    expect(result.ok).toBe(false);
    const unknownKind = parseProject({ ...project, formatVersion: 4, enemies: [{ ...project.enemies[0], behaviour: "ghost", look: format4("walker", project.enemies[0].look) }] }, getPack);
    expect(unknownKind.ok).toBe(false);
  });
});
```

Before writing these, read `tests/model/parse.test.ts`. Use its existing helper for a saved game with an enemy, and its `getPack`. The two `/* … */` slots are the only parts to fill in from that file; if it has no such helper, build the project with `newProject` and one `addEnemy` command, as `tests/commands/helpers.ts` does.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/model/lookUpgrade.test.ts tests/model/parse.test.ts`
Expected: FAIL. `lookFromFormat4` doesn't exist, and the looks still have `canvases`.

- [ ] **Step 3: Write the upgrade**

In `src/model/lookUpgrade.ts`:

```ts
import type { AnimationSpeed, Look, LookBox, LookKind, Size } from "./look";
import { KINDS } from "./look";

export type Format4Look = {
  colours: number[];
  canvases: Record<string, Size>;
  animations: Record<string, { frames: string[][]; speed: AnimationSpeed }>;
  body: LookBox;
  slideBody?: LookBox;
  shotY?: number;
};

// Format 4 kept one canvas per group (the hero's standing poses shared "main"), one boxed hitbox
// and one shot point. Format 5 gives each pose its own: every pose starts with its group's.
const format4Group = (kind: LookKind, animation: string): string =>
  kind === "hero" && (animation === "slide" || animation === "shot" || animation === "chargedShot") ? animation : "main";

export function lookFromFormat4(kind: LookKind, old: Format4Look): Look {
  const shoots = KINDS[kind].shotHeight !== null;
  const animations = Object.fromEntries(
    Object.entries(old.animations).map(([name, anim]) => {
      const group = format4Group(kind, name);
      const box = group === "main" ? old.body : group === "slide" ? old.slideBody : undefined;
      return [
        name,
        {
          ...anim,
          size: old.canvases[group],
          ...(box ? { at: { x: box.x, y: box.y } } : {}),
          ...(shoots && group === "main" && old.shotY !== undefined ? { shotY: old.shotY } : {}),
        },
      ];
    }),
  );
  return {
    colours: old.colours,
    animations,
    body: { w: old.body.w, h: old.body.h },
    ...(old.slideBody ? { slideBody: { w: old.slideBody.w, h: old.slideBody.h } } : {}),
  };
}
```

`heroLookFrom` builds the same format 4 object as today (as a `Format4Look`) and returns `lookFromFormat4("hero", …)`. `designLookFrom` does likewise with `lookFromFormat4(kind, …)`. `const still` returns `{ frames, speed: "normal" as const }`. Keep the comment above them, saying they build format 4 looks and convert.

In `src/model/parse.ts`, add `UPGRADES[4]` after `3`:

```ts
  // Version 5 gave each pose its own picture size, hitbox position and shot point. Looks that the
  // version 3 step just made are already version 5 (they have no canvases) and are left alone.
  4: (doc) => ({
    ...doc,
    formatVersion: 5,
    hero: upgradeLook4(doc.hero, "hero"),
    enemies: Array.isArray(doc.enemies)
      ? doc.enemies.map((e) => (isObject(e) && typeof e.behaviour === "string" ? upgradeLook4(e, e.behaviour as LookKind) : e))
      : doc.enemies,
    boss: upgradeLook4(doc.boss, "boss"),
  }),
```

```ts
function upgradeLook4(owner: unknown, kind: LookKind): unknown {
  if (!isObject(owner) || !isObject(owner.look) || !isObject(owner.look.canvases)) return owner;
  try {
    return { ...owner, look: lookFromFormat4(kind, owner.look as unknown as Format4Look) };
  } catch {
    return owner; // a damaged old look, or an unknown kind: the schema or the checks refuse it
  }
}
```

`KINDS[kind]` is undefined for an unknown behaviour, so `lookFromFormat4` throws there, and the catch handles it. Set `FORMAT_VERSION = 5` in `src/model/schema.ts`.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/model`
Expected: PASS, including look.test's "the hero's width" from Task 1.

- [ ] **Step 5: Commit**

```bash
git add -A src/model tests/model
git commit -m "feat: game file format 5, upgrading every pose from its format 4 group

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The look commands, per pose

**Files:**
- Modify: `src/commands/look.ts`; `src/commands/enemies.ts` (no change expected: `lookForKind` keeps its signature)
- Test: `tests/commands/look.test.ts`

**Interfaces:**
- Consumes:
  - `resizePose`, `setPoseBody` and `fittedPoseBody` (Task 1, `src/model/poses.ts`);
  - `KINDS[k].animations[a].body`.
- Produces these commands (`target` as now):
  - `resizePose { target, animation, w, h }`;
  - `setBody { target, animation, body: { x, y, w, h } }`;
  - `fitBody { target, animation }`;
  - `setShotY { target, animation, y }`.

  `resizeCanvas` and the `which` argument go. `addFrame` makes a blank frame at the pose's `size`.

- [ ] **Step 1: Write the failing tests**

Replace the `"the canvas, body and shot point"`, `"fitting the hero's hitboxes to wide drawings"` and `"fitting a short shooter"` blocks of `tests/commands/look.test.ts` with:

```ts
describe("a pose's size, hitbox and shot point", () => {
  it("resizes one pose, padding evenly at the sides and top, its hitbox moving with the pixels", () => {
    const project = run(baseProject(), "resizePose", { ...hero, animation: "jumpShoot", w: 20, h: 28 });
    const look = project.hero.look;
    expect(look.animations.jumpShoot.size).toEqual({ w: 20, h: 28 });
    const before = baseProject().hero.look.animations.jumpShoot.frames[0];
    expect(look.animations.jumpShoot.frames[0]).toEqual([...fill(20, 4, "."), ...before.map((row) => `..${row}..`)]);
    expect(look.animations.jumpShoot.at).toEqual({ x: 3, y: 6 });
    expect(look.animations.stand).toEqual(baseProject().hero.look.animations.stand);
    expect(look.body).toEqual(baseProject().hero.look.body);
  });

  it("trims one pose, and one undo puts it back", () => {
    const start = baseProject();
    const history = createHistory(start);
    const { history: shrunk } = runCommand(history, { name: "resizePose", args: { ...hero, animation: "stand", w: 14, h: 24 } }, ctx);
    expect(shrunk.project.hero.look.animations.stand.frames[0]).toEqual(start.hero.look.animations.stand.frames[0].map((row) => row.slice(1, 15)));
    expect(undo(shrunk).project).toBe(start);
  });

  it("refuses sizes outside the limits, or smaller than the hitbox", () => {
    expect(runError(baseProject(), "resizePose", { ...hero, animation: "run", w: 34, h: 24 })).toBe(
      "The hero's Run is 34 by 24; it can be 12 to 32 wide and 16 to 32 tall.",
    );
    expect(runError(baseProject(), "resizePose", { ...hero, animation: "shot", w: 8, h: 4 })).toBe("The hero's Shot must be 6 by 4.");
    expect(runError(baseProject(), "resizePose", { ...hero, animation: "jumpShoot", w: 12, h: 24 })).toBe(
      "The hero's Jump and shoot is 12 by 24; its hitbox needs 14 by 22.",
    );
  });

  it("moves the hitbox in one pose and resizes it in all, refusing a size a smaller pose can't hold", () => {
    let project = run(baseProject(), "setBody", { ...hero, animation: "jumpShoot", body: { x: 2, y: 4, w: 12, h: 20 } });
    expect(project.hero.look.body).toEqual({ w: 12, h: 20 });
    expect(project.hero.look.animations.jumpShoot.at).toEqual({ x: 2, y: 4 });
    expect(project.hero.look.animations.stand.at).toEqual({ x: 2, y: 4 }); // feet and centre kept: (1 + 1, 2 + 22 - 20)
    project = run(project, "resizePose", { ...hero, animation: "run", w: 12, h: 24 });
    expect(runError(project, "setBody", { ...hero, animation: "stand", body: { x: 1, y: 2, w: 14, h: 22 } })).toBe(
      "The hero's Run is 12 by 24; its hitbox needs 14 by 22.",
    );
    expect(runError(project, "setBody", { ...hero, animation: "shot", body: { x: 0, y: 0, w: 4, h: 4 } })).toBe("Shot has no hitbox.");
  });

  it("fits a pose's hitbox to that pose's drawing", () => {
    const wide = run(baseProject(), "resizePose", { ...hero, animation: "stand", w: 24, h: 24 });
    const filled = run(wide, "setFrame", { ...hero, animation: "stand", frame: 0, rows: fill(24, 24, "1") });
    const fitted = run(filled, "fitBody", { ...hero, animation: "stand" });
    expect(fitted.hero.look.animations.stand.at).toEqual({ x: 4, y: 0 });
    expect(fitted.hero.look.body).toEqual({ w: 16, h: 24 }); // at most 16 wide, around its middle
    const slid = run(baseProject(), "fitBody", { ...hero, animation: "slide" });
    expect(slid.hero.look.slideBody!.h).toBeLessThanOrEqual(14);
  });

  it("keeps a short shooter's fitted hitbox at least as tall as its shot", () => {
    let project = run(baseProject(), "addEnemy", { enemyId: "e1", name: "Ice Eye", behaviour: "turret" });
    const target = { enemy: "e1" };
    const flat = Array.from({ length: 16 }, (_, y) => (y >= 13 ? "1".repeat(16) : ".".repeat(16))); // 3 rows drawn
    project = run(project, "setFrame", { target, animation: "idle", frame: 0, rows: flat });
    project = run(project, "fitBody", { target, animation: "idle" });
    expect(project.enemies[0].look.body.h).toBeGreaterThanOrEqual(6);
  });

  it("sets one pose's shot point", () => {
    const project = run(baseProject(), "setShotY", { ...hero, animation: "jumpShoot", y: 12 });
    expect(project.hero.look.animations.jumpShoot.shotY).toBe(12);
    expect(project.hero.look.animations.standShoot.shotY).toBe(8);
    expect(runError(project, "setShotY", { ...hero, animation: "jumpShoot", y: 21 })).toBe("The hero's Jump and shoot shot point is outside its hitbox.");
    expect(runError(project, "setShotY", { ...hero, animation: "slide", y: 2 })).toBe("The hero's Slide can't have a shot point.");
  });

  it("aims at an enemy or the boss", () => {
    let project = run(baseProject(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    project = run(project, "addFrame", { target: { enemy: "e1" }, animation: "walk", after: 1 });
    expect(project.enemies[0].look.animations.walk.frames[2]).toEqual(fill(16, 16, "."));
    expect(runError(project, "setShotY", { target: { enemy: "e1" }, animation: "walk", y: 2 })).toBe("Frost Fang doesn't shoot, so it can't have a shot point.");
    expect(runError(project, "setFrame", { target: { enemy: "e9" }, animation: "walk", frame: 0, rows: ["1"] })).toBe(
      'There is no enemy with the id "e9".',
    );
    expect(runError(project, "setAnimationSpeed", { target: "boss", animation: "stand", speed: "slow" })).toBe(
      "Your game has no boss of its own yet.",
    );
  });
});
```

Then update the other tests in `tests/commands/` that send the old commands (`grep -rn "resizeCanvas\|which:\|setShotY\|setBody\|fitBody" tests/commands`), using the mapping table above. Use `animation: "stand"` for the hero and the kind's first animation for enemies and the boss.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/commands`
Expected: FAIL. There's no `resizePose` command, and `animation` is an unknown argument to the strict `setBody` and `setShotY`.

- [ ] **Step 3: Rewrite the four commands**

In `src/commands/look.ts`:
- delete `bodyFor`, `withShotInside`, `whichArg` and `resizeCanvas`;
- import `resizePose`, `setPoseBody` and `fittedPoseBody` from `@/model/poses`;
- drop the now-unused imports (`firstStanding`, `fitBody`, `reframeRows`, the `*_MAX_*` constants).

Add a guard:

```ts
// A pose that carries a hitbox, or a message naming the one that doesn't.
function poseWithBody(found: Found, animation: string): string | null {
  const anim = animationOf(found, animation);
  if (typeof anim === "string") return anim;
  return KINDS[found.kind].animations[animation].body === null ? `${ANIMATION_NAMES[animation]} has no hitbox.` : null;
}
```

```ts
const resizePoseCommand = defineCommand({
  name: "resizePose",
  description:
    "Resize one of a character's poses (animations): every frame padded or trimmed evenly at the sides and at the top (the feet stay on the bottom), its hitbox moving with the drawing.",
  args: z.strictObject({ target: targetArg, animation: animationArg, w: z.number().int().min(1).max(64), h: z.number().int().min(1).max(64) }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      return resizePose(found.look, found.kind, args.animation, args.w, args.h);
    });
  },
});

const boxArg = z.strictObject({ x: z.number().int(), y: z.number().int(), w: z.number().int().min(1), h: z.number().int().min(1) });

const setBody = defineCommand({
  name: "setBody",
  description:
    "Set a character's hitbox in one pose's pixels: its position in that pose, and its size in every pose (the hero's Slide has a sliding hitbox of its own).",
  args: z.strictObject({ target: targetArg, animation: animationArg, body: boxArg }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const problem = poseWithBody(found, args.animation);
      return problem ?? setPoseBody(found.look, found.kind, args.animation, args.body);
    });
  },
});

const fitBodyCommand = defineCommand({
  name: "fitBody",
  description: "Fit a character's hitbox to one pose's drawing: its position in that pose, and its size in every pose.",
  args: z.strictObject({ target: targetArg, animation: animationArg }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const problem = poseWithBody(found, args.animation);
      return problem ?? setPoseBody(found.look, found.kind, args.animation, fittedPoseBody(found.look, found.kind, args.animation));
    });
  },
});

const setShotY = defineCommand({
  name: "setShotY",
  description: "Set where shots come out in one of a character's poses: pixels below the top of its hitbox.",
  args: z.strictObject({ target: targetArg, animation: animationArg, y: z.number().int().min(-64).max(64) }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      return { ...found.look, animations: { ...found.look.animations, [args.animation]: { ...anim, shotY: args.y } } };
    });
  },
});
```

In `addFrame`, the blank frame becomes `Array.from({ length: anim.size.h }, () => ".".repeat(anim.size.w))`. `lookCommands` lists `resizePoseCommand` in place of `resizeCanvas`.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/commands tests/model`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A src/commands tests/commands
git commit -m "feat: resize, fit and place the hitbox and shot point of one pose

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The game draws and fires each pose

**Files:**
- Create: `src/runtime/sim/pose.ts`
- Modify:
  - `src/runtime/render/animate.ts`, `src/runtime/render/lookArt.ts`, `src/runtime/render/heroArt.ts`, `src/runtime/render/draw.ts`;
  - `src/runtime/sim/state.ts`, `src/runtime/sim/shots.ts`;
  - `src/runtime/sim/entities/types.ts`, `src/runtime/sim/entities/spawn.ts`, `src/runtime/sim/entities/motion.ts`, `src/runtime/sim/entities/enemies.ts`, `src/runtime/sim/entities/boss.ts`;
  - `src/model/contentPack.ts`, `src/model/gamePack.ts`, `src/checker/cache.ts`, `src/editor/zoneView.ts`.
- Test:
  - `tests/runtime/poseShots.test.ts` (new);
  - `tests/runtime/heroBody.test.ts`, `tests/runtime/animate.test.ts`, `tests/runtime/art.test.ts`, `tests/runtime/bossAttacks.test.ts`, `tests/runtime/ownEnemies.test.ts`, `tests/runtime/render.test.ts`;
  - `tests/model/gamePack.test.ts`, `tests/checker/cache.test.ts`, `tests/checker/pieces.test.ts`, `tests/editor/zoneView.test.ts`.

**Interfaces:**
- Consumes: `poseBox`, `shotPoints`, `KINDS` and `firstStanding` (Task 1); the commands (Task 3) in tests.
- Produces:
  - `heroPose(p: Player, shooting: boolean): string` and `entityPose(e: Entity): string` (`src/runtime/sim/pose.ts`);
  - `heroShotY(p: Player): number` and `entityShotY(e: Entity): number`;
  - `Player.shotYs: Record<string, number>`, which replaces `Player.shotY`;
  - `Entity.shotYs: Record<string, number>`, which replaces `Entity.shotY`;
  - `ThingDef.shotYs?: Record<string, number>`, which replaces `ThingDef.shotY`;
  - `AnimSprites` gains `size: Size` and `box: LookBox | null`, and `lookSprites(look, kind)` takes the kind;
  - `HeroArt` loses `body`, `slideBody` and `canvases`;
  - `OwnSkin.body` and `OwnSkin.canvas` are the first pose's box and size, for the zone view.

- [ ] **Step 1: Write the failing tests**

Create `tests/runtime/poseShots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyCommand } from "@/commands";
import { snowPack } from "@/content/snow/pack";
import { createCheckCache } from "@/checker/cache";
import { placeOn } from "@/runtime/render/draw";
import { lookSprites } from "@/runtime/render/lookArt";
import { createSim, NO_INPUT } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { game } from "../ai/helpers";

const press = (keys: Partial<typeof NO_INPUT>) => ({ ...NO_INPUT, ...keys });
function apply(project: ReturnType<typeof game>, commands: [string, unknown][]) {
  for (const [name, args] of commands) {
    const result = applyCommand(project, { name, args }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
  }
  return project;
}
// The snow hero with a big Jump and shoot (24 by 28) that fires from 4, and a Stand and shoot that fires from 14.
const posedGame = () =>
  apply(game(), [
    ["resizePose", { target: "hero", animation: "jumpShoot", w: 24, h: 28 }],
    ["setShotY", { target: "hero", animation: "jumpShoot", y: 4 }],
    ["setShotY", { target: "hero", animation: "standShoot", y: 14 }],
    ["setShotY", { target: "hero", animation: "climb", y: 2 }],
  ]);
const land = (sim: ReturnType<typeof createSim>) => {
  for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
};

describe("each pose in the game", () => {
  it("fires from Stand and shoot's shot point on the ground and Jump and shoot's in the air", () => {
    const sim = createSim(posedGame(), "L1", snowPack);
    land(sim);
    step(sim, press({ shoot: true }));
    expect(sim.shots[0].y).toBe(sim.player.y + 14);
    step(sim, NO_INPUT);
    step(sim, press({ jump: true }));
    step(sim, press({ jump: true }));
    expect(sim.player.onGround).toBe(false);
    step(sim, press({ jump: true, shoot: true }));
    expect(sim.shots.at(-1)!.y).toBe(sim.player.y + 4);
  });

  it("keeps the body's size and collisions whatever the poses' pictures", () => {
    const plain = createSim(game(), "L1", snowPack);
    const posed = createSim(posedGame(), "L1", snowPack);
    const moves = [press({ right: true }), press({ right: true, jump: true }), press({ left: true, shoot: true }), NO_INPUT];
    for (let i = 0; i < 240; i++) {
      const input = moves[Math.floor(i / 30) % moves.length];
      step(plain, input);
      step(posed, input);
    }
    expect([posed.player.x, posed.player.y, posed.player.w, posed.player.h]).toEqual([plain.player.x, plain.player.y, plain.player.w, plain.player.h]);
  });

  it("draws a pose so its hitbox lies on the body, facing either way", () => {
    const sprites = lookSprites(posedGame().hero.look, "hero");
    const jump = sprites.jumpShoot;
    expect(jump.size).toEqual({ w: 24, h: 28 });
    expect(jump.box).toEqual({ x: 5, y: 6, w: 14, h: 22 });
    const body = { x: 100, y: 50, w: 14, h: 22 };
    expect(placeOn(body, jump.box!, jump.size.w, false)).toEqual({ x: 95, y: 44 });
    expect(placeOn(body, jump.box!, jump.size.w, true)).toEqual({ x: 95, y: 44 }); // centred hitbox: mirroring keeps it
  });

  it("checks the level again when only one pose's shot point changes", () => {
    const cache = createCheckCache();
    const project = game();
    const levelId = project.levels[0].id;
    const zoneId = project.levels[0].zones[0].id;
    const first = cache.zone(project, levelId, zoneId, snowPack);
    const moved = apply(project, [["setShotY", { target: "hero", animation: "climb", y: 3 }]]);
    expect(cache.zone(moved, levelId, zoneId, snowPack)).not.toBe(first);
    const drawn = apply(project, [["setFrame", { target: "hero", animation: "stand", frame: 0, rows: project.hero.look.animations.stand.frames[0] }]]);
    expect(cache.zone(drawn, levelId, zoneId, snowPack)).toBe(first); // drawing alone needs no new check
  });
});
```

Also add a test of enemy and boss shot points to `tests/runtime/bossAttacks.test.ts`, beside the test that sets `boss.shotY = 0`. Change that line to `boss.shotYs = { attack: 0 }`, so the attack pose's shot point is used. Add one turret case to `tests/runtime/ownEnemies.test.ts`:

```ts
  it("fires a turret's shots from its Idle pose's shot point", () => {
    // In the file's existing own-turret setup: set the turret's idle shot point to 1 with
    // setShotY { target: { enemy: id }, animation: "idle", y: 1 }, run until it fires, and expect
    // sim.enemyShots[0].y === turret.y + 1.
  });
```

Write this test with the file's own helpers for placing an own enemy and stepping until it fires. Read the file first; its turret tests show the setup.

Fix the remaining listed tests by the mapping table:
- `shotY: 8` becomes `shotYs: { standShoot: 8 }` in the Player and Entity literals of `animate.test.ts` and `art.test.ts`;
- `heroBody.test.ts`'s `tallGame` sends `resizePose` for every standing pose, `setBody` with `animation: "stand"` (and `"slide"`), and `setShotY` with `animation: "standShoot"`;
- `gamePack.test.ts` expects `shotYs` in place of `shotY`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/runtime tests/checker tests/model/gamePack.test.ts tests/editor/zoneView.test.ts`
Expected: FAIL. `lookSprites` has no `size` or `box`, `p.shotY` is undefined (the shots come out at NaN), and the cache keys on the old fields.

- [ ] **Step 3: Make the game read poses**

Create `src/runtime/sim/pose.ts`:

```ts
import { ENEMY_SHOT_SIZE } from "./constants";
import type { Entity } from "./entities/types";
import type { Player } from "./state";

// Which pose (animation) a character is in, from the game's state alone: the renderer draws it,
// and shots come out at its shot point.

export function heroPose(p: Player, shooting: boolean): string {
  if (p.h < p.standH) return "slide";
  if (p.hurt > 0) return "hurt";
  if (p.onLadder) return "climb";
  if (!p.onGround) return shooting ? "jumpShoot" : "jump";
  if (p.vx !== 0) return shooting ? "runShoot" : "run";
  return shooting ? "standShoot" : "stand";
}

const BOSS_ATTACK_MODES = new Set(["spread", "aimed", "rain", "big"]);

export function entityPose(e: Entity): string {
  switch (e.behaviour) {
    case "flyer":
      return "fly";
    case "turret":
      return "idle";
    case "jumper":
      return e.onGround ? "ground" : "air";
    case "shielded":
      return e.mode === "open" ? "open" : "closed";
    case "dropper":
      return e.mode === "hang" ? "hang" : "fall";
    case "boss":
      return e.mode === "jump" ? "jump" : BOSS_ATTACK_MODES.has(e.mode) ? "attack" : "stand";
    default:
      return "walk";
  }
}

// Where the hero's shots come out as it fires: the shooting pose's shot point (8, as always, for a pose without one).
export const heroShotY = (p: Player): number => p.shotYs[heroPose(p, true)] ?? 8;

// Where an enemy's shots come out: its pose's shot point, or the middle of its hitbox, as always.
export const entityShotY = (e: Entity): number => e.shotYs[entityPose(e)] ?? Math.round(e.h / 2 - ENEMY_SHOT_SIZE / 2);
```

Check where `ENEMY_SHOT_SIZE` is exported (`grep -rn "export const ENEMY_SHOT_SIZE" src`) and import it from there.

- **`animate.ts`:** `heroShown` takes its animation from `heroPose(p, p.shotTimer > 0)`:
  - `"slide"` loops;
  - `"hurt"` plays once over `HURT_STEPS - p.hurt`;
  - `"climb"` keeps today's rung logic;
  - `"jump"` / `"jumpShoot"` play once over `p.airSteps`;
  - `"run"` / `"runShoot"` loop with `baseFor`;
  - anything else loops.

  `entityShown` takes `entityPose(e)`. The boss's `"jump"` and `"attack"` play once over `e.modeSteps`; everything else loops. Delete `BOSS_ATTACKS` from `animate.ts`.
- **`state.ts`:** `Player.shotY` becomes `shotYs: Record<string, number>; // each pose's shot point, below the hitbox's top`, and `createSim` sets `shotYs: shotPoints(look)`.
- **`shots.ts`:** the normal shot uses `heroShotY(p)`, and the charged shot uses `heroShotY(p) + SHOT_H / 2 - CHARGED_H / 2`.
- **`contentPack.ts`:** `shotY?: number` becomes `shotYs?: Record<string, number>; // the kid's own types: each pose's shot point, below the hitbox's top`.
- **`gamePack.ts` `bodyOf`:**

  ```ts
  const bodyOf = (look: Look): Pick<ThingDef, "body" | "shotYs"> => {
    const shotYs = shotPoints(look);
    return { body: { w: look.body.w, h: look.body.h }, ...(Object.keys(shotYs).length > 0 ? { shotYs } : {}) };
  };
  ```
- **`types.ts`:** `shotY: number` becomes `shotYs: Record<string, number>; // each pose's shot point, below its top`.
- **`spawn.ts`:** `shotYs: def.shotYs ?? {}` (the middle fallback now lives in `entityShotY`).
- **`motion.ts` `fireAt`, `enemies.ts` turret and `boss.ts` aimed:** `e.shotY` becomes `entityShotY(e)`.
- **`lookArt.ts`:**

  ```ts
  export type AnimSprites = { frames: Sprite[]; speed: AnimationSpeed; size: Size; box: LookBox | null };

  // Every pose of a look as sprites, with its picture size and its hitbox in that picture.
  export function lookSprites(look: Look, kind: LookKind): Record<string, AnimSprites> {
    return Object.fromEntries(
      Object.entries(look.animations).map(([name, anim]) => [
        name,
        { frames: anim.frames.map((rows) => sprite(rows)), speed: anim.speed, size: anim.size, box: poseBox(look, kind, name) },
      ]),
    );
  }
  ```

  In `ownSkins`, the skin's `animations = lookSprites(look, kind)`. Set `body` to the first pose's box and `canvas` to its size: `const first = animations[firstStanding(kind)]; body: first.box!, canvas: first.size`. These are kept for the zone view, which draws the first frame.
- **`heroArt.ts`:**
  - `lookSprites(look, "hero")`;
  - drop the `body`, `slideBody` and `canvases` fields and their lines.
- **`draw.ts`:**
  - Own entity: `const anim = own.animations[shown.animation]; const at = placeOn(e, anim.box ?? own.body, anim.size.w, shown.flip);`.
  - Hero: `const anim = art.animations[shown.animation]; const at = placeOn(p, anim.box!, anim.size.w, shown.flip);`. The `sliding` choice goes, because the slide pose carries its own box.
- **`checker/cache.ts`:**
  - replace the cached `shotY` with `shots: string` (`JSON.stringify(shotPoints(project.hero.look))`);
  - compare `hit.shots === JSON.stringify(shotPoints(project.hero.look))`;
  - keep `body` and `slideBody`, which are now the size objects.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/runtime tests/checker tests/model tests/commands tests/editor/zoneView.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: draw each pose on the body, and fire from the shown pose's shot point

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The editor's controls work on the chosen pose

**Files:**
- Modify: `src/editor/components/AnimationEditor.tsx`, plus any other editor file `npm run typecheck` names
- Test: `tests/editor/sizeAndHitbox.test.tsx`, `tests/editor/hitbox.test.ts`, and every remaining red test; `e2e/enemies.spec.ts`
- Docs: `docs/superpowers/STATUS.md`

**Interfaces:**
- Consumes:
  - the Task 1 names: `poseBox`, `hasShotPoint`, `isFixed`, `cutsDrawing(look, animation, w, h)`;
  - the Task 3 commands;
  - `lookSprites(look, kind)` (Task 4).
- Produces: no new names. The Size group, the Hitbox tool, Fit to drawing and the Shot point tool act on the chosen pose.

- [ ] **Step 1: Write the failing test**

Add to `tests/editor/sizeAndHitbox.test.tsx`, using the file's existing setup helpers, which read the file first:

```ts
  it("resizes and sets the shot point of the chosen pose only", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Jump and shoot"); // the animation button
    await userEvent.click(screen.getByRole("button", { name: "Wider" }));
    expect(saved().hero.look.animations.jumpShoot.size).toEqual({ w: 18, h: 24 });
    expect(saved().hero.look.animations.stand.size).toEqual({ w: 16, h: 24 });
    expect(within(screen.getByRole("group", { name: "Size" })).getByText("18 × 24")).toBeTruthy();
    await choose("Stand");
    expect(within(screen.getByRole("group", { name: "Size" })).getByText("16 × 24")).toBeTruthy();
  });
```

If `choose` doesn't press animation buttons by name, use the file's way of choosing an animation (the buttons' names are "Jump and shoot, 1 frame" and so on). Then change the file's existing expectations to the mapping table: `look.canvases.main` becomes `look.animations.stand.size`, `look.body` becomes `poseBox(look, "hero", "stand")`, and `look.shotY` becomes `look.animations.stand.shotY`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/editor/sizeAndHitbox.test.tsx`
Expected: FAIL. `AnimationEditor` reads `look.canvases` (a TypeError) or sends `resizeCanvas`.

- [ ] **Step 3: Rewire `AnimationEditor`**

Replace the lines from `const group = rule.animations[animation];` to the `resize` function with:

```ts
  const poseRule = rule.animations[animation];
  const size = anim.size;
  const body = poseBox(look, kind, animation);
  const colour = Math.min(slot, look.colours.length);
  const fixed = isFixed(poseRule); // the hero's shots
  const resize = (w: number, h: number) => {
    if (cutsDrawing(look, animation, w, h) && !confirm("This cuts off part of your drawing. You can undo it.")) return;
    send("resizePose", { animation, w, h });
  };
```

- `which` becomes `const which = poseRule.body;`.
- In `hitboxLimits`, `canvas: size`. The `maxW`, `maxH` and `minH` conditions compare `which` to `"main"` and `"slide"` as now.
- `shotHere` becomes `hasShotPoint(kind, animation) && body !== null`.
- The hitbox tool's `release` sends `send("setBody", { animation, body: next })` alone. The command keeps every pose's shot row, so drop the `shotY` adjustment and the `onBegin` / `onCommit` pair around it.
- The shot tool's `release` sends `send("setShotY", { animation, y })` when `y !== anim.shotY`.
- `shownShotY` becomes `draft?.shotY ?? anim.shotY`.
- **Fit to drawing:** `send("fitBody", { animation })`.
- **Size group:**
  - it reads `size.w` and `size.h`;
  - `limits` becomes `poseRule.min` / `poseRule.max`;
  - the readout is `` `${size.w} × ${size.h}` ``.
- **`partners` (Copy from):** frames of poses with the same size, `names.filter((other) => look.animations[other].size.w === size.w && look.animations[other].size.h === size.h)`. Plan 2 opens it to every size.
- **`Player`:** `size={size}`.
- **`PictureEditor`:**
  - `size={size}`;
  - `feet={poseRule.body !== null}`;
  - `importTarget={{ ...size, stand: poseRule.body !== null }}`.
- `const sprites = useMemo(() => lookSprites(look, kind), [look, kind]);`.
- Update the imports: add `poseBox`, `hasShotPoint` and `isFixed`; drop `KINDS`'s `canvases` use.

Run `npm run typecheck` and fix every remaining error by the mapping table. Then run the whole suite. Fix every red test by the mapping table: a test that sends an old command gets the new name and an `animation`, and one that reads an old field reads the pose. `e2e/enemies.spec.ts` reads the size readout and the hitbox. Keep what each test checks; change only how it reads or sends.

- [ ] **Step 4: Run everything**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build && npx playwright test`
Expected: all pass. Look at `test-results/characters-*.png`: the Characters screen must look as before.

- [ ] **Step 5: Update STATUS.md and commit**

In `docs/superpowers/STATUS.md`:
- **Document table:** add `plans/2026-10-10-pose-sizes-plan-1-model-and-game.md | Pose sizes plan 1 of 2, implemented` (the final review marks it reviewed and merged).
- **"Where things stand" paragraph:** say each pose now has its own picture size, hitbox position and shot point, game files are format 5, and give the new test counts.
- **Spec row:** mark it "approved".

```bash
git add -A src tests e2e docs
git commit -m "feat: the editor's size, hitbox and shot point tools work on the chosen pose

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
