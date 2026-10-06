# The Hero Screen Implementation Plan (Milestone 2, Plan 3 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Hero screen in the editor where a kid draws their hero pose by pose (pencil, eraser, fill, pick colour, copy, flip, clear), picks up to eight colours from the 8-bit palette, chooses abilities with step buttons, sees a live preview of the hero running, jumping, shooting, sliding and charging, and is told at once which zones their hero can no longer finish.

**Architecture:** Pure helpers in `src/editor/hero/` do the pixel work (set pixels along a line, flood fill, flip, the body outline, drawing a picture big) and build the preview (a one-zone game and a scripted loop of inputs, played by the real simulation and drawn by the real renderer). React components in `src/editor/components/` (`HeroScreen`, `HeroCanvas`, `HeroColours`, `HeroAbilities`, `HeroPreview`) turn presses into plan 1's hero commands; a drawing stroke is one command group, like a paint stroke. The editor swaps its level area for the hero screen with a Hero/Level button; the zone list, the chat and undo stay.

**Tech Stack:** as plan 2. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-milestone-2-your-own-hero-design.md` (section 6, and sections 4, 9 and 10 where they cover the hero screen; build order item 3)

**Plan series for milestone 2:**

1. Hero data and abilities (done)
2. Slide and charge shot (done)
3. The hero screen (this plan)
4. Picture import
5. The assistant

## Global Constraints

- Every change to the hero is a plan 1 command (`setHeroAbilities`, `setHeroColours`, `setHeroPose`, `resetHeroLook`); one drawing stroke is one undo step.
- Model, commands, the simulation and the checker stay plain TypeScript; the pixel and preview helpers in `src/editor/hero/` have no React and no DOM.
- Everything works with mouse, pen and finger, and every control is reachable by keyboard.
- Interface text is short, plain and in sentence case, for young users.
- The hero screen is locked while the assistant works, as the level is.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **The canvas shows pictures at 12× zoom** (a pose is 192×288 pixels on screen) with a light grid, the game's body outline (14×22, or 14×14 for the slide pose; the whole box for shots) and, for poses, the feet line.
- **Tools:** pencil and eraser draw along the pointer's path with no gaps; fill fills the touching patch of one colour (4 directions) with the current colour; pick colour makes the colour under the pointer the current one (a pick on an empty pixel does nothing).
- **Pose tools:** "Copy from" offers only pictures of the same size (any pose for a pose; slide and the shots have no partner); "Flip" mirrors left to right; "Clear" empties.
- **Colours:** slots are shown in order. "Add a colour" appends white (palette index 27) and selects it, up to eight. Only the last colour can be removed ("Remove colour 3"), because pixels name slots by number; removing one still in use is refused by the command, and the editor shows its message.
- **The preview** is a one-screen zone with no way out, played by the real game: stand, run, jump, shoot twice, slide (if it can), charge and fire (if it can), run back, and start again. It replays from the start whenever the look or abilities change.
- **Abilities** are a row of step-button groups (Speed, Jump, Health, Shots on screen, Slide, Charge shot). The note under them comes from the editor's level check: "Checking the level…", "All zones can still be finished.", or "2 zones can't be finished with this hero:" followed by each zone's name as a button that opens it.
- **"Start from the snow hero"** asks first ("Start again from the snow hero's look? You can undo this."), then resets the look; abilities stay.
- **Deferred review fixes folded in here:** `setHeroAbilities` ignores abilities passed as `undefined`; `setHeroPose` checks only the picture it changes (`pictureProblems`); pieces that need slide use `aria-disabled` (so the keyboard reaches the "Needs slide" note) and a press with such a piece selected does nothing while the hero can't slide.

## Review Focus

1. **A stroke that leaves the canvas, or a very fast drag**: no gaps along the line, and the stroke ends as one undo step when the pointer comes up or is lost. Tested in Tasks 1 and 3.
2. **Removing a colour while the current colour is that slot**: the current colour falls back to the last remaining one; drawing never writes a slot that does not exist. Tested in Task 4.
3. **Switching pictures between differently sized pictures** (a pose, then the slide, then a shot): the canvas, outline and pointer mapping follow the new size. Tested in Tasks 1 and 3.
4. **Changing abilities while a zone is open in the level view**: the note and the zone badges agree, and one undo restores both. Tested in Task 5.
5. **The assistant starts a turn while the hero screen is open**: drawing and every hero control are locked until it finishes. Tested in Task 5.

## File Structure

```
src/model/hero.ts                         pictureProblems (one picture's problems)
src/commands/hero.ts                      setHeroAbilities ignores undefined; setHeroPose checks one picture
src/editor/hero/pixels.ts                 setPixels, linePixels, floodFill, flipRows, blankRows, pixelFromPointer, bodyBox, drawPicture, ZOOM
src/editor/hero/preview.ts                previewSim, previewInputs
src/editor/components/HeroPreview.tsx     the animated preview
src/editor/components/HeroCanvas.tsx      the big pixel canvas
src/editor/components/HeroScreen.tsx      poses, drawing tools, pose tools, layout
src/editor/components/HeroColours.tsx     colour slots and the 8-bit palette
src/editor/components/HeroAbilities.tsx   ability steps, the check note, start from the snow hero
src/editor/components/Palette.tsx         exports SpriteSwatch; aria-disabled for locked pieces
src/editor/components/Toolbar.tsx         Hero / Level button
src/editor/Editor.tsx                     swaps in the hero screen
src/editor/editor.module.css              hero screen styles
tests/...                                 named in each task; e2e/hero.spec.ts
```

---

### Task 1: Pixel helpers and the review fixes in the model

**Files:**
- Modify: `src/model/hero.ts`, `src/commands/hero.ts`
- Create: `src/editor/hero/pixels.ts`
- Test: `tests/editor/heroPixels.test.ts`, additions to `tests/model/hero.test.ts` and `tests/commands/hero.test.ts`

**Interfaces:**
- Consumes: `PICTURE_SIZES`, `PICTURE_NAMES`, `HERO_PICTURES`, `pictureRows`, `type HeroPicture` (plan 1); `PLAYER_W`, `PLAYER_H`, `SLIDE_H` (runtime constants)
- Produces:
  - `pictureProblems(look: HeroLook, picture: HeroPicture): string[]` (and `lookProblems` built from it)
  - `type Pixel = { x: number; y: number }`
  - `blankRows(w: number, h: number): string[]`
  - `setPixels(rows: string[], pixels: Pixel[], ch: string): string[]`
  - `linePixels(a: Pixel, b: Pixel): Pixel[]`
  - `floodFill(rows: string[], start: Pixel, ch: string): string[]`
  - `flipRows(rows: string[]): string[]`
  - `pixelFromPointer(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, w: number, h: number): Pixel | null`
  - `bodyBox(picture: HeroPicture): { x: number; y: number; w: number; h: number }`
  - `ZOOM = 12`; `type PixelCtx = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">`; `drawPicture(ctx: PixelCtx, rows: string[], palette: Record<string, string>, picture: HeroPicture): void`

- [ ] **Step 1: Write the failing tests**

`tests/editor/heroPixels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  blankRows,
  bodyBox,
  drawPicture,
  flipRows,
  floodFill,
  linePixels,
  pixelFromPointer,
  setPixels,
  ZOOM,
} from "@/editor/hero/pixels";

describe("pixel helpers", () => {
  it("make blank pictures", () => {
    expect(blankRows(3, 2)).toEqual(["...", "..."]);
  });

  it("set pixels, ignoring any outside the picture", () => {
    expect(setPixels(["...", "..."], [{ x: 1, y: 0 }, { x: 5, y: 5 }, { x: -1, y: 1 }], "2")).toEqual([".2.", "..."]);
  });

  it("join a fast drag with a line, both ends included", () => {
    expect(linePixels({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(linePixels({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([{ x: 2, y: 2 }]);
    expect(linePixels({ x: 0, y: 0 }, { x: 2, y: 4 })).toHaveLength(5);
  });

  it("fill the touching patch of one colour, not diagonally", () => {
    const rows = ["..1.", "111.", "1..."];
    expect(floodFill(rows, { x: 0, y: 0 }, "2")).toEqual(["221.", "111.", "1..."]);
    expect(floodFill(rows, { x: 3, y: 0 }, "2")).toEqual(["..12", "1112", "1222"]);
    expect(floodFill(rows, { x: 0, y: 1 }, "1")).toBe(rows); // already that colour
  });

  it("flip left to right", () => {
    expect(flipRows(["12.", ".3."])).toEqual([".21", ".3."]);
  });

  it("map a pointer to a pixel, or nothing outside", () => {
    const rect = { left: 10, top: 20, width: 16 * ZOOM, height: 24 * ZOOM };
    expect(pixelFromPointer(10 + 3 * ZOOM + 1, 20 + 5 * ZOOM + 1, rect, 16, 24)).toEqual({ x: 3, y: 5 });
    expect(pixelFromPointer(5, 25, rect, 16, 24)).toBeNull();
    expect(pixelFromPointer(10 + 16 * ZOOM, 30, rect, 16, 24)).toBeNull();
  });

  it("know where the game's body sits in each picture", () => {
    expect(bodyBox("stand")).toEqual({ x: 1, y: 2, w: 14, h: 22 });
    expect(bodyBox("slide")).toEqual({ x: 5, y: 2, w: 14, h: 14 });
    expect(bodyBox("chargedShot")).toEqual({ x: 0, y: 0, w: 12, h: 10 });
  });
});

describe("drawPicture", () => {
  function fake() {
    const rects: { colour: string; x: number; y: number; w: number; h: number }[] = [];
    return {
      rects,
      fillStyle: "" as string,
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ colour: this.fillStyle, x, y, w, h });
      },
    };
  }

  it("draws each coloured pixel big, and leaves empty ones", () => {
    const rows = blankRows(6, 4);
    rows[1] = "..1...";
    const ctx = fake();
    drawPicture(ctx, rows, { "1": "#ff0000" }, "shot");
    expect(ctx.rects).toContainEqual({ colour: "#ff0000", x: 2 * ZOOM, y: 1 * ZOOM, w: ZOOM, h: ZOOM });
    expect(ctx.rects.filter((r) => r.colour === "#ff0000")).toHaveLength(1);
  });

  it("outlines the body and draws the feet line on poses", () => {
    const ctx = fake();
    drawPicture(ctx, blankRows(16, 24), {}, "stand");
    const outline = ctx.rects.filter((r) => r.colour === "#ff2d95");
    expect(outline.some((r) => r.x === 1 * ZOOM && r.y === 2 * ZOOM && r.h === 22 * ZOOM)).toBe(true); // left side
    expect(ctx.rects.some((r) => r.colour === "#2ec4b6" && r.y === 24 * ZOOM - 3 && r.w === 16 * ZOOM)).toBe(true);
  });
});
```

Add to `tests/model/hero.test.ts`, in "hero looks":

```ts
  it("checks one picture on its own", () => {
    const bad = withPicture(withPicture(look(), "standShoot", solid(16, 23)), "stand", solid(16, 24));
    expect(pictureProblems(bad, "stand")).toEqual([]);
    expect(pictureProblems(bad, "standShoot")).toEqual(["Stand and shoot is 16 by 23 pixels, not 16 by 24."]);
  });
```

(adding `pictureProblems` to the import from `@/model/hero`).

Add to `tests/commands/hero.test.ts`:

```ts
describe("hero commands and review fixes", () => {
  it("setHeroAbilities ignores abilities given as undefined", () => {
    const project = run(baseProject(), "setHeroAbilities", { jump: undefined, speed: "fast" });
    expect(project.hero.abilities).toEqual({ ...DEFAULT_ABILITIES, speed: "fast" });
    expect(runError(baseProject(), "setHeroAbilities", { jump: undefined })).toBe("Give at least one ability to change.");
  });

  it("setHeroPose is not blocked by a problem in a similarly named picture", () => {
    const project = baseProject();
    const broken = {
      ...project,
      hero: { ...project.hero, look: { ...project.hero.look, poses: { ...project.hero.look.poses, standShoot: ["1"] } } },
    };
    const result = applyCommand(broken, { name: "setHeroPose", args: { picture: "stand", rows: solid(16, 24, ".") } }, ctx);
    expect(result.ok).toBe(true);
  });
});
```

(adding `import { applyCommand } from "@/commands/registry";`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/heroPixels.test.ts tests/model/hero.test.ts tests/commands/hero.test.ts`
Expected: FAIL (`@/editor/hero/pixels` cannot be resolved; `pictureProblems` is not exported; `{ jump: undefined }` writes `undefined`).

- [ ] **Step 3: One picture's problems**

In `src/model/hero.ts`, split `lookProblems` so the per-picture body is its own exported function:

```ts
// Everything wrong with one picture of a look: its size, and pixels naming missing colours.
// A pixel is "." (transparent) or a digit naming a colour slot, "1" for the first.
export function pictureProblems(look: HeroLook, picture: HeroPicture): string[] {
  const name = PICTURE_NAMES[picture];
  const { w, h } = PICTURE_SIZES[picture];
  const pixels = pictureRows(look, picture);
  if (pixels.length !== h || pixels[0].length !== w) {
    return [`${name} is ${pixels[0].length} by ${pixels.length} pixels, not ${w} by ${h}.`];
  }
  const ragged = pixels.findIndex((row) => row.length !== w);
  if (ragged >= 0) return [`${name} row ${ragged + 1} is ${pixels[ragged].length} pixels wide, not ${w}.`]; // counted from 1
  const odd = [...pixels.join("")].find((ch) => ch !== "." && !/[1-8]/.test(ch));
  if (odd) return [`${name} has a pixel "${odd}" that is not a colour.`];
  const highest = Math.max(0, ...[...pixels.join("")].filter((ch) => ch !== ".").map(Number));
  const count = look.colours.length;
  if (highest > count) {
    return [`${name} uses colour ${highest}, but the hero only has ${count} colour${count === 1 ? "" : "s"}.`];
  }
  return [];
}

// Everything wrong with a look that the schema cannot see.
export function lookProblems(look: HeroLook): string[] {
  return HERO_PICTURES.flatMap((picture) => pictureProblems(look, picture));
}
```

(replacing the old `lookProblems`).

In `src/commands/hero.ts`:
- import `pictureProblems` instead of `lookProblems`;
- in `setHeroPose`, replace the `lookProblems(look).find(…)` line with `const problem = pictureProblems(look, args.picture)[0];`;
- in `setHeroAbilities`, drop keys given as `undefined` before anything else:

```ts
  apply(project, args): CommandResult {
    const given = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
    if (Object.keys(given).length === 0) return fail("Give at least one ability to change.");
    return ok({ ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, ...given } } });
  },
```

- [ ] **Step 4: The pixel helpers**

`src/editor/hero/pixels.ts`:

```ts
import { PICTURE_SIZES, type HeroPicture } from "@/model/hero";
import { PLAYER_H, PLAYER_W, SLIDE_H } from "@/runtime/sim/constants";

// Pixel work for the hero screen. Pictures are rows of characters: "." is empty, a digit is a colour.

export type Pixel = { x: number; y: number };

export const ZOOM = 12; // screen pixels per picture pixel

export const blankRows = (w: number, h: number): string[] => Array.from({ length: h }, () => ".".repeat(w));

export function setPixels(rows: string[], pixels: Pixel[], ch: string): string[] {
  const grid = rows.map((row) => [...row]);
  for (const { x, y } of pixels) {
    if (y >= 0 && y < grid.length && x >= 0 && x < grid[y].length) grid[y][x] = ch;
  }
  return grid.map((row) => row.join(""));
}

// Every pixel on the straight line from a to b, both ends included, so a fast drag leaves no gaps.
export function linePixels(a: Pixel, b: Pixel): Pixel[] {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  const pixels: Pixel[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    pixels.push({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) });
  }
  return pixels;
}

// Fills the patch of one colour touching `start` (side to side and up and down) with `ch`.
export function floodFill(rows: string[], start: Pixel, ch: string): string[] {
  const grid = rows.map((row) => [...row]);
  const target = grid[start.y]?.[start.x];
  if (target === undefined || target === ch) return rows;
  const stack: Pixel[] = [start];
  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    if (grid[y]?.[x] !== target) continue;
    grid[y][x] = ch;
    stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
  }
  return grid.map((row) => row.join(""));
}

export const flipRows = (rows: string[]): string[] => rows.map((row) => [...row].reverse().join(""));

export function pixelFromPointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  w: number,
  h: number,
): Pixel | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * w);
  const y = Math.floor(((clientY - rect.top) / rect.height) * h);
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  return { x, y };
}

// Where the game's body sits in a picture: what counts as the hero for walls and hits. Poses are
// drawn bottom-centred on the body; a shot's picture is its whole box.
export function bodyBox(picture: HeroPicture): { x: number; y: number; w: number; h: number } {
  const { w, h } = PICTURE_SIZES[picture];
  if (picture === "shot" || picture === "chargedShot") return { x: 0, y: 0, w, h };
  const bodyH = picture === "slide" ? SLIDE_H : PLAYER_H;
  return { x: Math.round(w / 2 - PLAYER_W / 2), y: h - bodyH, w: PLAYER_W, h: bodyH };
}

export type PixelCtx = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">;

const BACKGROUND = "#e9eef5";
const GRID = "#c9d3e0";
const OUTLINE = "#ff2d95";
const FEET = "#2ec4b6";

// Draws a picture big, with a light grid, the body's outline and, on poses, the feet line.
export function drawPicture(ctx: PixelCtx, rows: string[], palette: Record<string, string>, picture: HeroPicture): void {
  const { w, h } = PICTURE_SIZES[picture];
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, w * ZOOM, h * ZOOM);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const colour = palette[ch];
      if (!colour) return;
      ctx.fillStyle = colour;
      ctx.fillRect(x * ZOOM, y * ZOOM, ZOOM, ZOOM);
    }),
  );
  ctx.fillStyle = GRID;
  for (let x = 1; x < w; x++) ctx.fillRect(x * ZOOM, 0, 1, h * ZOOM);
  for (let y = 1; y < h; y++) ctx.fillRect(0, y * ZOOM, w * ZOOM, 1);

  const body = bodyBox(picture);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(body.x * ZOOM, body.y * ZOOM, 2, body.h * ZOOM);
  ctx.fillRect((body.x + body.w) * ZOOM - 2, body.y * ZOOM, 2, body.h * ZOOM);
  ctx.fillRect(body.x * ZOOM, body.y * ZOOM, body.w * ZOOM, 2);
  if (picture !== "shot" && picture !== "chargedShot") {
    ctx.fillStyle = FEET;
    ctx.fillRect(0, h * ZOOM - 3, w * ZOOM, 3);
  } else {
    ctx.fillRect(body.x * ZOOM, (body.y + body.h) * ZOOM - 2, body.w * ZOOM, 2);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: add pixel helpers for drawing heroes, and check one hero picture at a time"
```

---

### Task 2: The live preview

**Files:**
- Create: `src/editor/hero/preview.ts`, `src/editor/components/HeroPreview.tsx`
- Test: `tests/editor/heroPreview.test.ts`, `tests/editor/heroPreview.test.tsx`

**Interfaces:**
- Consumes: `createSim`, `step`, `NO_INPUT`, `type Input`, `type Sim` (runtime); `createProject`, `createZone` (model); `draw`, `type Skin`, `heroArt`, `createSpriteCache`, `browserCanvas`, `stepsFor` (render)
- Produces:
  - `previewSim(look: HeroLook, abilities: Abilities, pack: ContentPack): Sim` (one screen, no way out)
  - `previewInputs(abilities: Abilities): Input[]` (one loop of the show)
  - `HeroPreview` props: `{ look: HeroLook; abilities: Abilities; pack: ContentPack; art?: ArtSet }`; renders a canvas with role `img` named "Your hero in action"

- [ ] **Step 1: Write the failing tests**

`tests/editor/heroPreview.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { snowPack } from "@/content/snow/pack";
import { previewInputs, previewSim } from "@/editor/hero/preview";
import { DEFAULT_ABILITIES, type Abilities } from "@/model/hero";
import { SLIDE_H } from "@/runtime/sim/constants";
import { step } from "@/runtime/sim/step";

function play(abilities: Abilities) {
  const sim = previewSim(snowHero, abilities, snowPack);
  const start = sim.player.x;
  let slid = false;
  let charged = false;
  let shots = 0;
  let furthest = start;
  for (const input of previewInputs(abilities)) {
    step(sim, input);
    slid ||= sim.player.h === SLIDE_H;
    charged ||= sim.shots.some((s) => s.charged);
    shots = Math.max(shots, sim.shots.length);
    furthest = Math.max(furthest, sim.player.x);
    expect(sim.phase).toBe("play");
    expect(sim.zoneIndex).toBe(0);
  }
  return { sim, start, slid, charged, shots, furthest };
}

describe("the hero preview", () => {
  it("runs, jumps and shoots, then comes back to where it started", () => {
    const show = play(DEFAULT_ABILITIES);
    expect(show.furthest - show.start).toBeGreaterThan(100);
    expect(show.shots).toBeGreaterThan(0);
    expect(show.slid).toBe(false);
    expect(show.charged).toBe(false);
    expect(show.sim.player.x - show.start).toBeLessThan(16);
  });

  it("slides and charges only when the hero can", () => {
    const show = play({ ...DEFAULT_ABILITIES, slide: true, chargeShot: true });
    expect(show.slid).toBe(true);
    expect(show.charged).toBe(true);
  });

  it("stays on the screen even for the fastest, highest-jumping hero", () => {
    const show = play({ ...DEFAULT_ABILITIES, speed: "veryFast", jump: "veryHigh", slide: true, chargeShot: true });
    expect(show.furthest).toBeLessThan(256 - 14);
    expect(show.sim.player.x - show.start).toBeLessThan(16);
  });
});
```

`tests/editor/heroPreview.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { snowHero } from "@/content/snow/hero";
import { snowPack } from "@/content/snow/pack";
import { HeroPreview } from "@/editor/components/HeroPreview";
import { DEFAULT_ABILITIES } from "@/model/hero";

afterEach(cleanup);

describe("HeroPreview", () => {
  it("shows a game-sized picture of the hero in action", () => {
    render(<HeroPreview look={snowHero} abilities={DEFAULT_ABILITIES} pack={snowPack} art={snowArt} />);
    const canvas = screen.getByRole("img", { name: "Your hero in action" }) as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([256, 240]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/heroPreview.test.ts tests/editor/heroPreview.test.tsx`
Expected: FAIL (modules cannot be resolved).

- [ ] **Step 3: Write the implementation**

`src/editor/hero/preview.ts`:

```ts
import type { ContentPack } from "@/model/contentPack";
import { createProject, createZone } from "@/model/factory";
import type { Abilities, HeroLook } from "@/model/hero";
import type { Level, Project } from "@/model/schema";
import { createSim, NO_INPUT, type Input, type Sim } from "@/runtime/sim/state";

// The hero screen's preview: the real game, on one screen with no way out, playing a short show.

export function previewSim(look: HeroLook, abilities: Abilities, pack: ContentPack): Sim {
  const zone = { ...createZone({ id: "preview", name: "Preview" }, pack), exit: null };
  const level: Level = { id: "preview", name: "Preview", brief: "", zones: [zone], checkpoints: [] };
  const project: Project = {
    ...createProject({ id: "preview", name: "Preview" }, pack),
    hero: { abilities, look },
    levels: [level],
  };
  return createSim(project, "preview", pack);
}

const hold = (keys: Partial<Input>, steps: number): Input[] => new Array<Input>(steps).fill({ ...NO_INPUT, ...keys });

// Stand, run, jump, shoot twice, slide and charge if the hero can, then run back to the start.
export function previewInputs(abilities: Abilities): Input[] {
  return [
    ...hold({}, 40),
    ...hold({ right: true }, 36),
    ...hold({ right: true, jump: true }, 18),
    ...hold({ right: true }, 24),
    ...hold({}, 12),
    ...hold({ shoot: true }, 2),
    ...hold({}, 10),
    ...hold({ shoot: true }, 2),
    ...hold({}, 30),
    ...(abilities.slide ? [...hold({ right: true, down: true }, 1), ...hold({ down: true, jump: true }, 1), ...hold({}, 45)] : []),
    ...(abilities.chargeShot ? [...hold({ shoot: true }, 75), ...hold({}, 40)] : []),
    ...hold({ left: true }, 190),
    ...hold({}, 20),
  ];
}
```

`src/editor/components/HeroPreview.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { Abilities, HeroLook } from "@/model/hero";
import type { ArtSet } from "@/runtime/render/art";
import { draw, type Skin } from "@/runtime/render/draw";
import { heroArt } from "@/runtime/render/heroArt";
import { stepsFor } from "@/runtime/render/loop";
import { browserCanvas, createSpriteCache } from "@/runtime/render/sprites";
import { SCREEN_H, SCREEN_W } from "@/runtime/sim/constants";
import { step } from "@/runtime/sim/step";
import styles from "../editor.module.css";
import { previewInputs, previewSim } from "../hero/preview";

type Props = { look: HeroLook; abilities: Abilities; pack: ContentPack; art?: ArtSet };

// Plays the preview show over and over, starting again whenever the hero changes.
export function HeroPreview({ look, abilities, pack, art }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !art) return;
    const hero = heroArt(look);
    const skin: Skin = {
      set: art,
      image: createSpriteCache(art.palette, browserCanvas),
      hero: {
        art: hero,
        image: createSpriteCache(hero.palette, browserCanvas),
        flashImage: createSpriteCache(hero.flashPalette, browserCanvas),
      },
    };
    const inputs = previewInputs(abilities);
    let sim = previewSim(look, abilities, pack);
    let next = 0;
    let accumulator = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const due = stepsFor(accumulator, now - last);
      last = now;
      accumulator = due.accumulator;
      for (let i = 0; i < due.steps; i++) {
        if (next >= inputs.length || sim.phase !== "play") {
          sim = previewSim(look, abilities, pack);
          next = 0;
        }
        step(sim, inputs[next++]);
      }
      draw(ctx, sim, skin);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [look, abilities, pack, art]);

  return (
    <canvas
      ref={ref}
      width={SCREEN_W}
      height={SCREEN_H}
      role="img"
      aria-label="Your hero in action"
      className={styles.preview}
    />
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/editor/heroPreview.test.ts tests/editor/heroPreview.test.tsx && npm run typecheck && npm run lint`
Expected: PASS. If a step of the show leaves the screen or fails to come back for some ability, adjust the step counts in `previewInputs` (not the tests), and ledger the numbers chosen.

- [ ] **Step 5: Commit**

```bash
git add src/editor/hero/preview.ts src/editor/components/HeroPreview.tsx tests/editor/heroPreview.test.ts tests/editor/heroPreview.test.tsx
git commit -m "feat: add a live preview that plays the hero through a short show in the real game"
```

---
### Task 3: The hero screen: pictures and drawing

**Files:**
- Create: `src/editor/components/HeroCanvas.tsx`, `src/editor/components/HeroScreen.tsx`
- Modify: `src/editor/components/Palette.tsx` (export `SpriteSwatch`), `src/editor/components/Toolbar.tsx`, `src/editor/Editor.tsx`, `src/editor/editor.module.css`
- Test: `tests/editor/heroHelpers.tsx`, `tests/editor/heroScreen.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 and 2; `setHeroPose` (plan 1); the editor reducer's `run`, `begin`, `commit`, `dismissError`
- Produces:
  - `HeroCanvas` props: `{ rows: string[]; palette: Record<string, string>; picture: HeroPicture; onPress(p: Pixel): void; onDrag(p: Pixel): void; onRelease(): void }`; canvas `data-testid="hero-canvas"`, role `img`, named like "Stand, 16 by 24 pixels"
  - `HeroScreen` props (this task): `{ project: Project; pack: ContentPack; art?: ArtSet; locked: boolean; error: string | null; onDismissError(): void; onCommand(command: Command): void; onBegin(label: string): void; onCommit(): void }`
  - `Toolbar` gains `screen: "level" | "hero"` and `onScreen(screen: "level" | "hero"): void`; its button reads "Hero" on the level screen and "Level" on the hero screen
  - `SpriteSwatch` exported from `Palette.tsx`

- [ ] **Step 1: Write the failing tests**

`tests/editor/heroHelpers.tsx` (shared by this task's tests and Tasks 4 and 5):

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Editor } from "@/editor/Editor";
import { ZOOM } from "@/editor/hero/pixels";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

let n = 0;
const makeId = () => `id-${++n}`;

export function setupHero(initial: Project = newProject("Hero", makeId), confirm = () => true) {
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const view = render(
    <Editor initial={initial} store={{ save }} makeId={makeId} saveDelay={60_000} confirm={confirm} />,
  );
  const canvas = () => {
    const el = screen.getByTestId("hero-canvas") as HTMLCanvasElement;
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: el.width, height: el.height, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    return el;
  };
  const at = (x: number, y: number) => ({ clientX: x * ZOOM + ZOOM / 2, clientY: y * ZOOM + ZOOM / 2, button: 0 });
  const press = (x: number, y: number) => {
    const el = canvas();
    fireEvent.pointerDown(el, at(x, y));
    fireEvent.pointerUp(el, at(x, y));
  };
  const drag = (from: [number, number], to: [number, number]) => {
    const el = canvas();
    fireEvent.pointerDown(el, at(...from));
    fireEvent.pointerMove(el, at(...to));
    fireEvent.pointerUp(el, at(...to));
  };
  // Closing the editor saves at once, so the last save is what was made (nothing is saved when
  // the game is back to how it opened).
  const saved = (): Project => {
    view.unmount();
    return save.mock.calls.at(-1)?.[0] ?? initial;
  };
  const open = () => userEvent.click(screen.getByRole("button", { name: "Hero" }));
  const choose = (name: string | RegExp) => userEvent.click(screen.getByRole("button", { name }));
  return { press, drag, saved, open, choose, save };
}
```

`tests/editor/heroScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { flipRows } from "@/editor/hero/pixels";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

describe("the hero screen", () => {
  it("swaps in for the level, and back", async () => {
    const { open } = setupHero();
    await open();
    expect(screen.getByRole("img", { name: "Stand, 16 by 24 pixels" })).toBeTruthy();
    expect(screen.queryByTestId("zone-canvas")).toBeNull();
    expect(screen.getByRole("img", { name: "Your hero in action" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Level" }));
    expect(screen.getByTestId("zone-canvas")).toBeTruthy();
  });

  it("draws a pixel with the pencil in colour 1", async () => {
    const { open, press, saved } = setupHero();
    await open();
    press(3, 3);
    expect(saved().hero.look.poses.stand[3][3]).toBe("1");
  });

  it("draws a whole stroke, with no gaps, as one undo step", async () => {
    const { open, drag, saved } = setupHero();
    await open();
    drag([2, 0], [8, 0]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(saved().hero.look.poses.stand[0]).toBe("..1111111.......");
  });

  it("undoes a stroke in one step", async () => {
    const { open, drag, saved } = setupHero();
    await open();
    drag([2, 0], [8, 0]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().hero.look.poses.stand[0]).toBe("................");
  });

  it("erases", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Eraser");
    press(6, 3);
    expect(saved().hero.look.poses.stand[3][6]).toBe(".");
  });

  it("fills the touching patch", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Fill");
    press(0, 0);
    expect(saved().hero.look.poses.stand[0]).toBe("1111111111111111");
  });

  it("picks a colour from the picture", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Pick colour");
    press(7, 4); // the helmet: colour 2
    await choose("Pencil");
    press(0, 0);
    expect(saved().hero.look.poses.stand[0][0]).toBe("2");
  });

  it("draws on any picture, at its own size", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose(/^Slide/);
    expect(screen.getByRole("img", { name: "Slide, 24 by 16 pixels" })).toBeTruthy();
    press(22, 15);
    await choose("Charged shot");
    expect(screen.getByRole("img", { name: "Charged shot, 12 by 10 pixels" })).toBeTruthy();
    const look = saved().hero.look;
    expect(look.poses.slide[15][22]).toBe("1");
  });

  it("copies, flips and clears a picture", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Run 1");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Copy from" }), "stand");
    await choose("Flip");
    expect(screen.getByRole("combobox", { name: "Copy from" })).toHaveProperty("value", "");
    const flipped = saved().hero.look.poses.run1;
    expect(flipped).toEqual(flipRows(snowHero.poses.stand));
  });

  it("clears a picture", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Clear");
    expect(saved().hero.look.poses.stand.every((row) => /^\.+$/.test(row))).toBe(true);
  });

  it("only offers to copy pictures of the same size", async () => {
    const { open, choose } = setupHero();
    await open();
    const options = () =>
      [...(screen.getByRole("combobox", { name: "Copy from" }) as HTMLSelectElement).options].map((o) => o.value);
    expect(options()).toEqual(["", "standShoot", "run1", "run2", "jump", "jumpShoot", "climb", "hurt"]);
    await choose(/^Slide/);
    expect(screen.queryByRole("combobox", { name: "Copy from" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/heroScreen.test.tsx`
Expected: FAIL (no "Hero" button).

- [ ] **Step 3: The pixel canvas**

`src/editor/components/HeroCanvas.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { PICTURE_NAMES, PICTURE_SIZES, type HeroPicture } from "@/model/hero";
import styles from "../editor.module.css";
import { drawPicture, pixelFromPointer, ZOOM, type Pixel } from "../hero/pixels";

type Props = {
  rows: string[];
  palette: Record<string, string>;
  picture: HeroPicture;
  onPress(p: Pixel): void;
  onDrag(p: Pixel): void;
  onRelease(): void;
};

// One hero picture, big, to draw on with mouse, pen or finger.
export function HeroCanvas({ rows, palette, picture, onPress, onDrag, onRelease }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pressed = useRef(false);
  const last = useRef<string | null>(null);
  const { w, h } = PICTURE_SIZES[picture];

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawPicture(ctx, rows, palette, picture);
  }, [rows, palette, picture]);

  const pixelAt = (clientX: number, clientY: number) =>
    ref.current ? pixelFromPointer(clientX, clientY, ref.current.getBoundingClientRect(), w, h) : null;

  const end = () => {
    if (!pressed.current) return;
    pressed.current = false;
    last.current = null;
    onRelease();
  };

  return (
    <canvas
      ref={ref}
      data-testid="hero-canvas"
      role="img"
      aria-label={`${PICTURE_NAMES[picture]}, ${w} by ${h} pixels`}
      width={w * ZOOM}
      height={h * ZOOM}
      className={styles.heroCanvas}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const p = pixelAt(e.clientX, e.clientY);
        if (!p) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pressed.current = true;
        last.current = `${p.x},${p.y}`;
        onPress(p);
      }}
      onPointerMove={(e) => {
        if (!pressed.current) return;
        const p = pixelAt(e.clientX, e.clientY);
        if (!p) return;
        const key = `${p.x},${p.y}`;
        if (key === last.current) return;
        last.current = key;
        onDrag(p);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    />
  );
}
```

- [ ] **Step 4: The hero screen**

In `src/editor/components/Palette.tsx`, change `function SpriteSwatch(` to `export function SpriteSwatch(`.

`src/editor/components/HeroScreen.tsx`:

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import { HERO_PICTURES, PICTURE_NAMES, PICTURE_SIZES, pictureRows, type HeroPicture } from "@/model/hero";
import type { Project } from "@/model/schema";
import type { ArtSet } from "@/runtime/render/art";
import { heroArt } from "@/runtime/render/heroArt";
import styles from "../editor.module.css";
import { blankRows, flipRows, floodFill, linePixels, setPixels, type Pixel } from "../hero/pixels";
import { HeroCanvas } from "./HeroCanvas";
import { HeroPreview } from "./HeroPreview";
import { SpriteSwatch } from "./Palette";

type DrawTool = "pencil" | "eraser" | "fill" | "pick";

const TOOLS: { id: DrawTool; label: string }[] = [
  { id: "pencil", label: "Pencil" },
  { id: "eraser", label: "Eraser" },
  { id: "fill", label: "Fill" },
  { id: "pick", label: "Pick colour" },
];

type Props = {
  project: Project;
  pack: ContentPack;
  art?: ArtSet;
  locked: boolean; // the assistant is working
  error: string | null;
  onDismissError(): void;
  onCommand(command: Command): void;
  onBegin(label: string): void;
  onCommit(): void;
};

// Draw the hero picture by picture. A stroke is one undo step, like painting tiles.
export function HeroScreen({ project, pack, art, locked, error, onDismissError, onCommand, onBegin, onCommit }: Props) {
  const { look, abilities } = project.hero;
  const sprites = useMemo(() => heroArt(look), [look]);
  const [picture, setPicture] = useState<HeroPicture>("stand");
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [slot, setSlot] = useState(1);
  const colour = Math.min(slot, look.colours.length); // the chosen colour may have been removed
  const stroke = useRef<{ rows: string[]; last: Pixel } | null>(null);

  const rows = pictureRows(look, picture);
  const size = PICTURE_SIZES[picture];
  const save = (next: string[]) => onCommand({ name: "setHeroPose", args: { picture, rows: next } });
  const ink = tool === "eraser" ? "." : String(colour);

  const press = (p: Pixel) => {
    if (locked) return;
    if (tool === "pick") {
      const ch = rows[p.y][p.x];
      if (ch !== ".") setSlot(Number(ch));
      return;
    }
    if (tool === "fill") {
      save(floodFill(rows, p, String(colour)));
      return;
    }
    onBegin(tool === "eraser" ? "Erase" : "Draw");
    const next = setPixels(rows, [p], ink);
    stroke.current = { rows: next, last: p };
    save(next);
  };
  const drag = (p: Pixel) => {
    const current = stroke.current;
    if (!current) return;
    const next = setPixels(current.rows, linePixels(current.last, p), ink);
    stroke.current = { rows: next, last: p };
    save(next);
  };
  const release = () => {
    if (!stroke.current) return;
    stroke.current = null;
    onCommit();
  };

  const partners = HERO_PICTURES.filter(
    (other) => other !== picture && PICTURE_SIZES[other].w === size.w && PICTURE_SIZES[other].h === size.h,
  );
  const spriteOf = (p: HeroPicture) =>
    p === "shot" ? sprites.shot : p === "chargedShot" ? sprites.chargedShot : sprites.poses[p];

  return (
    <fieldset className={styles.heroScreen} disabled={locked} aria-label="Your hero">
      {error && (
        <p className={styles.alert} role="alert">
          {error}
          <button type="button" onClick={onDismissError}>
            Dismiss
          </button>
        </p>
      )}
      <ul className={styles.poses} aria-label="Pictures">
        {HERO_PICTURES.map((p) => (
          <li key={p}>
            <button
              type="button"
              className={styles.swatch}
              aria-pressed={p === picture}
              onClick={() => setPicture(p)}
            >
              <SpriteSwatch sprite={spriteOf(p)} palette={sprites.palette} />
              {PICTURE_NAMES[p]}
              {p === "slide" && !abilities.slide && (
                <>
                  {" "}
                  <span className={styles.needs}>(needs slide)</span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.drawing}>
        <HeroCanvas
          rows={rows}
          palette={sprites.palette}
          picture={picture}
          onPress={press}
          onDrag={drag}
          onRelease={release}
        />
        <div className={styles.drawTools} role="group" aria-label="Drawing tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.swatch}
              aria-pressed={tool === t.id}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.drawTools} role="group" aria-label="Picture tools">
          {partners.length > 0 && (
            <label className={styles.field}>
              Copy from
              <select
                value=""
                onChange={(e) => {
                  const from = e.target.value as HeroPicture;
                  if (from) save(pictureRows(look, from));
                }}
              >
                <option value="">Choose a picture…</option>
                {partners.map((other) => (
                  <option key={other} value={other}>
                    {PICTURE_NAMES[other]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className={styles.swatch} onClick={() => save(flipRows(rows))}>
            Flip
          </button>
          <button type="button" className={styles.swatch} onClick={() => save(blankRows(size.w, size.h))}>
            Clear
          </button>
        </div>
      </div>
      <div className={styles.heroSide}>
        <HeroPreview look={look} abilities={abilities} pack={pack} art={art} />
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 5: The Hero / Level button and the swap**

`src/editor/components/Toolbar.tsx`: add to `Props`

```ts
  screen: "level" | "hero";
  onScreen(screen: "level" | "hero"): void;
```

take `screen` and `onScreen` in the parameters, and add before the Export button:

```tsx
      <button
        type="button"
        className={styles.button}
        disabled={playing}
        onClick={() => onScreen(screen === "level" ? "hero" : "level")}
      >
        {screen === "level" ? "Hero" : "Level"}
      </button>
```

`src/editor/Editor.tsx`:
- import `HeroScreen` from `"./components/HeroScreen"`;
- add `const [screen, setScreen] = useState<"level" | "hero">("level");` next to the other `useState`s;
- add `screen` to the dependencies of the zoom `useEffect` that observes `stageRef` (it becomes `}, [playing, screen]);`), so the zone area is measured again when it comes back;
- pass `screen={screen}` and `onScreen={setScreen}` to `Toolbar`;
- make the main area three-way, with the hero screen between playing and the level:

```tsx
      {state.playing ? (
        <main className={styles.playing}>
          …unchanged…
        </main>
      ) : screen === "hero" ? (
        <main className={styles.heroWork}>
          <HeroScreen
            project={project}
            pack={pack}
            art={art}
            locked={busy}
            error={state.error}
            onDismissError={() => dispatch({ type: "dismissError" })}
            onCommand={run}
            onBegin={(label) => dispatch({ type: "begin", label })}
            onCommit={() => dispatch({ type: "commit" })}
          />
        </main>
      ) : (
        <main className={styles.work}>
          …unchanged…
        </main>
      )}
```

Add to `src/editor/editor.module.css`:

```css
/* The hero screen: pictures, the big canvas, colours and the preview */
.heroWork {
  min-height: 0;
  overflow: auto;
  padding: 1rem;
}
.heroScreen {
  display: grid;
  grid-template-columns: 10rem auto minmax(16rem, 1fr);
  gap: 1rem;
  align-items: start;
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.heroScreen > .alert {
  grid-column: 1 / -1;
}
.poses {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}
.poses .swatch {
  width: 100%;
  justify-content: flex-start;
}
.drawing {
  display: grid;
  gap: 0.6rem;
  justify-items: start;
}
.heroCanvas {
  border: 2px solid var(--panel);
  border-radius: 6px;
  touch-action: none;
  cursor: crosshair;
}
.drawTools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: end;
}
.heroSide {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}
.preview {
  width: 100%;
  max-width: 256px;
  height: auto;
  image-rendering: pixelated;
  border-radius: 6px;
}
@media (max-width: 760px) {
  .heroScreen {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. (The test "draws a whole stroke, with no gaps, as one undo step" checks that undo then redo brings the whole line back, so the stroke was one step.)

- [ ] **Step 7: Commit**

```bash
git add -A src tests
git commit -m "feat: add the hero screen: choose a picture and draw it with pencil, eraser, fill and pick colour"
```

---

### Task 4: Colours

**Files:**
- Create: `src/editor/components/HeroColours.tsx`
- Modify: `src/editor/components/HeroScreen.tsx`, `src/editor/editor.module.css`
- Test: `tests/editor/heroColours.test.tsx`

**Interfaces:**
- Consumes: `setHeroColours` (plan 1); `PALETTE_8BIT`, `MAX_COLOURS`; `setupHero` from `tests/editor/heroHelpers.tsx`
- Produces: `HeroColours` props `{ colours: number[]; slot: number; onSlot(slot: number): void; onColours(colours: number[]): void }`. Slot buttons are named "Colour 1"…; palette buttons "8-bit colour 1"…"8-bit colour 55"; "Add a colour"; "Remove colour N".

- [ ] **Step 1: Write the failing test**

`tests/editor/heroColours.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

describe("hero colours", () => {
  it("shows the hero's colours, with colour 1 chosen", async () => {
    const { open } = setupHero();
    await open();
    const slots = within(screen.getByRole("group", { name: "Your colours" })).getAllByRole("button", { name: /^Colour/ });
    expect(slots).toHaveLength(7);
    expect(slots[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("recolours a colour everywhere from the 8-bit palette", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Colour 2");
    await choose("8-bit colour 22");
    expect(saved().hero.look.colours[1]).toBe(21);
  });

  it("adds a colour, chooses it, and draws with it", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Add a colour");
    expect(screen.getByRole("button", { name: "Colour 8" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Add a colour" })).toBeNull(); // eight is the most
    press(0, 0);
    const look = saved().hero.look;
    expect(look.colours).toHaveLength(8);
    expect(look.colours[7]).toBe(27);
    expect(look.poses.stand[0][0]).toBe("8");
  });

  it("refuses to remove a colour that is still used, and says where", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Remove colour 7");
    expect((await screen.findByRole("alert")).textContent).toContain("Colour 7 is still used in Shot and Charged shot.");
    expect(saved().hero.look.colours).toHaveLength(7);
  });

  it("falls back to the last colour when the chosen one is removed", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Add a colour");
    await choose("Remove colour 8");
    press(0, 0);
    const look = saved().hero.look;
    expect(look.colours).toHaveLength(7);
    expect(look.poses.stand[0][0]).toBe("7");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/editor/heroColours.test.tsx`
Expected: FAIL (no "Your colours" group).

- [ ] **Step 3: Write the implementation**

`src/editor/components/HeroColours.tsx`:

```tsx
"use client";

import { MAX_COLOURS } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import styles from "../editor.module.css";

type Props = {
  colours: number[];
  slot: number; // the chosen colour, from 1
  onSlot(slot: number): void;
  onColours(colours: number[]): void;
};

const WHITE = 27; // a new colour starts white

// The hero's colours, and the 8-bit palette to change the chosen one.
export function HeroColours({ colours, slot, onSlot, onColours }: Props) {
  return (
    <section className={styles.colours} aria-label="Colours">
      <h3 className={styles.heroHeading}>Colours</h3>
      <div className={styles.slots} role="group" aria-label="Your colours">
        {colours.map((colour, i) => (
          <button
            key={i}
            type="button"
            className={styles.slot}
            aria-label={`Colour ${i + 1}`}
            aria-pressed={slot === i + 1}
            style={{ background: PALETTE_8BIT[colour] }}
            onClick={() => onSlot(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className={styles.drawTools}>
        {colours.length < MAX_COLOURS && (
          <button
            type="button"
            className={styles.swatch}
            onClick={() => {
              onColours([...colours, WHITE]);
              onSlot(colours.length + 1);
            }}
          >
            Add a colour
          </button>
        )}
        {colours.length > 1 && (
          <button type="button" className={styles.swatch} onClick={() => onColours(colours.slice(0, -1))}>
            Remove colour {colours.length}
          </button>
        )}
      </div>
      <p className={styles.note}>Pick a new look for colour {slot}:</p>
      <div className={styles.palette8} role="group" aria-label="8-bit colours">
        {PALETTE_8BIT.map((hex, i) => (
          <button
            key={hex}
            type="button"
            className={styles.colour}
            aria-label={`8-bit colour ${i + 1}`}
            title={hex}
            aria-pressed={colours[slot - 1] === i}
            style={{ background: hex }}
            onClick={() => onColours(colours.map((c, j) => (j === slot - 1 ? i : c)))}
          />
        ))}
      </div>
    </section>
  );
}
```

In `src/editor/components/HeroScreen.tsx`, import `HeroColours` and render it at the top of the `heroSide` div:

```tsx
        <HeroColours
          colours={look.colours}
          slot={colour}
          onSlot={setSlot}
          onColours={(colours) => onCommand({ name: "setHeroColours", args: { colours } })}
        />
```

Add to `src/editor/editor.module.css`:

```css
.heroHeading {
  margin: 0 0 0.4rem;
  font-size: 17px;
  font-weight: 700;
}
.slots {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}
.slot {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 8px;
  border: 2px solid var(--panel);
  font: inherit;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 2px #000, 0 0 2px #000;
  cursor: pointer;
}
.slot[aria-pressed="true"],
.colour[aria-pressed="true"] {
  outline: 3px solid var(--signal);
  outline-offset: 2px;
}
.palette8 {
  display: grid;
  grid-template-columns: repeat(11, 1fr);
  gap: 3px;
}
.colour {
  aspect-ratio: 1;
  min-width: 1rem;
  border: 1px solid rgb(0 0 0 / 0.25);
  border-radius: 3px;
  cursor: pointer;
}
.slot:focus-visible,
.colour:focus-visible {
  outline: 3px solid var(--ink);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: let kids choose up to eight hero colours from the 8-bit palette"
```

---

### Task 5: Abilities, the level check, and the review fixes in the editor

**Files:**
- Create: `src/editor/components/HeroAbilities.tsx`
- Modify: `src/editor/components/HeroScreen.tsx`, `src/editor/components/Palette.tsx`, `src/editor/Editor.tsx`, `src/editor/editor.module.css`
- Modify tests: `tests/editor/palettePieces.test.tsx`
- Test: `tests/editor/heroAbilities.test.tsx`

**Interfaces:**
- Consumes: `setHeroAbilities`, `resetHeroLook` (plan 1); `LevelCheck` (checker); `setupHero` (Task 3); `scriptedModel`, `say` (milestone 1 AI test helpers)
- Produces:
  - `HeroAbilities` props `{ abilities: Abilities; level: Level; check: LevelCheck | null; onAbilities(changes: Partial<Abilities>): void; onGoToZone(zoneId: string): void; onReset(): void }`; one `role="group"` per ability, named "Speed", "Jump", "Health", "Shots on screen", "Slide", "Charge shot"; a `role="status"` note
  - `HeroScreen` gains props `level: Level; check: LevelCheck | null; onGoToZone(zoneId: string): void; confirm(message: string): boolean`

- [ ] **Step 1: Write the failing tests**

`tests/editor/heroAbilities.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand } from "@/commands/registry";
import { snowHero } from "@/content/snow/hero";
import { snowPack } from "@/content/snow/pack";
import { Editor } from "@/editor/Editor";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";
import { scriptedModel, say } from "../ai/fakeModel";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

let n = 100;
const makeId = () => `id-${++n}`;

// A new game whose Zone 1 has a wall three tiles high, and a hero who jumps high enough for it.
function walledGame(): Project {
  let project = newProject("Walls", makeId);
  const level = project.levels[0];
  const apply = (name: string, args: unknown) => {
    const result = applyCommand(project, { name, args }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
  };
  apply("fillRect", { levelId: level.id, zoneId: level.zones[0].id, x: 8, y: 10, w: 2, h: 3, tile: 1 });
  apply("setHeroAbilities", { jump: "high" });
  return project;
}

const group = (name: string) => screen.getByRole("group", { name });

describe("hero abilities", () => {
  it("changes an ability with a step button", async () => {
    const { open, saved } = setupHero();
    await open();
    expect(within(group("Jump")).getByRole("button", { name: "Normal" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(within(group("Jump")).getByRole("button", { name: "Very high" }));
    await userEvent.click(within(group("Slide")).getByRole("button", { name: "On" }));
    expect(within(group("Jump")).getByRole("button", { name: "Very high" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^Slide/ }).textContent).not.toContain("needs slide");
    expect(saved().hero.abilities).toMatchObject({ jump: "veryHigh", slide: true });
  });

  it("says which zones the hero can no longer finish, and opens one", async () => {
    const { open } = setupHero(walledGame());
    await open();
    expect(await screen.findByText("All zones can still be finished.", undefined, { timeout: 3000 })).toBeTruthy();
    await userEvent.click(within(group("Jump")).getByRole("button", { name: "Normal" }));
    const note = await screen.findByText(/1 zone can't be finished with this hero/, undefined, { timeout: 3000 });
    await userEvent.click(within(note).getByRole("button", { name: "Zone 1" }));
    expect(screen.getByLabelText("Zone 1, 1 screen")).toBeTruthy();
  });

  it("puts things back with one undo", async () => {
    const { open } = setupHero(walledGame());
    await open();
    await userEvent.click(within(group("Jump")).getByRole("button", { name: "Normal" }));
    await screen.findByText(/1 zone can't be finished/, undefined, { timeout: 3000 });
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("All zones can still be finished.", undefined, { timeout: 3000 })).toBeTruthy();
  });

  it("starts again from the snow hero's look, after asking", async () => {
    const confirm = vi.fn(() => true);
    const { open, press, choose, saved } = setupHero(undefined, confirm);
    await open();
    await userEvent.click(within(group("Speed")).getByRole("button", { name: "Fast" }));
    press(0, 0);
    await choose("Start from the snow hero");
    expect(confirm).toHaveBeenCalledWith("Start again from the snow hero's look? You can undo this.");
    const hero = saved().hero;
    expect(hero.look).toEqual(snowHero);
    expect(hero.abilities.speed).toBe("fast");
  });

  it("is locked while the assistant works", async () => {
    let finish = () => {};
    const waiting = new Promise<void>((resolve) => (finish = resolve));
    const { model } = scriptedModel([async () => (await waiting, say("Done."))]);
    const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
    const view = render(
      <Editor initial={newProject("Busy", makeId)} store={{ save }} makeId={makeId} saveDelay={60_000} model={model} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Hero" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    // Disabled through the hero screen's fieldset, which the button's own property doesn't show.
    await waitFor(() => expect(screen.getByRole("button", { name: "Pencil" }).matches(":disabled")).toBe(true));
    expect(within(group("Jump")).getByRole("button", { name: "High" }).matches(":disabled")).toBe(true);
    await act(async () => finish());
    await screen.findByText("Done.");
    expect(screen.getByRole("button", { name: "Pencil" }).matches(":disabled")).toBe(false);
    view.unmount();
  });
});
```

In `tests/editor/palettePieces.test.tsx`, a locked piece is now `aria-disabled` (still reachable by keyboard) rather than `disabled`: change

```ts
    expect(crawl).toHaveProperty("disabled", true);
```

to

```ts
    expect(crawl.getAttribute("aria-disabled")).toBe("true");
```

and add to that file a test that the editor ignores a press with a locked piece:

```tsx
import { applyCommand } from "@/commands/registry";
import { Editor } from "@/editor/Editor";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";
import { fireEvent } from "@testing-library/react";

  it("does nothing in the level when the hero loses slide with a crawl space chosen", async () => {
    let project = newProject("Slide", () => `id-${Math.random()}`);
    project = (applyCommand(project, { name: "setHeroAbilities", args: { slide: true } }, { pack: snowPack }) as { ok: true; project: Project }).project;
    const save = vi.fn<(p: Project) => Promise<void>>(async () => {});
    const view = render(<Editor initial={project} store={{ save }} saveDelay={60_000} />);
    await userEvent.click(screen.getByRole("tab", { name: "Pieces" }));
    await userEvent.click(screen.getByRole("button", { name: /^Crawl space/ }));
    await userEvent.click(screen.getByRole("button", { name: "Hero" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Slide" })).getByRole("button", { name: "Off" }));
    await userEvent.click(screen.getByRole("button", { name: "Level" }));
    const canvas = screen.getByTestId("zone-canvas");
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 512, height: 480, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40, button: 0 });
    fireEvent.pointerUp(canvas, { clientX: 40, clientY: 40, button: 0 });
    view.unmount();
    const zone = save.mock.calls[save.mock.calls.length - 1][0].levels[0].zones[0];
    expect(zone.tiles.slice(0, 16 * 12).every((t) => t === 0)).toBe(true); // no tunnel stamped
  });
```

(merging the imports into the file's existing ones, with `within` added to the `@testing-library/react` import; `Math.random` is fine in a test).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/heroAbilities.test.tsx tests/editor/palettePieces.test.tsx`
Expected: FAIL (no ability groups; the locked piece is `disabled`; the press stamps a tunnel).

- [ ] **Step 3: The abilities row**

`src/editor/components/HeroAbilities.tsx`:

```tsx
"use client";

import type { LevelCheck } from "@/checker/check";
import { HEALTHS, JUMPS, SHOT_COUNTS, SPEEDS, type Abilities } from "@/model/hero";
import type { Level } from "@/model/schema";
import styles from "../editor.module.css";

type Step = string | number | boolean;

const ROWS: { key: keyof Abilities; label: string; steps: readonly Step[]; name(step: Step): string }[] = [
  {
    key: "speed",
    label: "Speed",
    steps: SPEEDS,
    name: (s) => ({ normal: "Normal", fast: "Fast", veryFast: "Very fast" })[s as string] ?? String(s),
  },
  {
    key: "jump",
    label: "Jump",
    steps: JUMPS,
    name: (s) => ({ low: "Low", normal: "Normal", high: "High", veryHigh: "Very high" })[s as string] ?? String(s),
  },
  {
    key: "health",
    label: "Health",
    steps: HEALTHS,
    name: (s) => ({ fragile: "Fragile", normal: "Normal", tough: "Tough" })[s as string] ?? String(s),
  },
  { key: "shots", label: "Shots on screen", steps: SHOT_COUNTS, name: (s) => String(s) },
  { key: "slide", label: "Slide", steps: [false, true], name: (s) => (s ? "On" : "Off") },
  { key: "chargeShot", label: "Charge shot", steps: [false, true], name: (s) => (s ? "On" : "Off") },
];

type Props = {
  abilities: Abilities;
  level: Level;
  check: LevelCheck | null;
  onAbilities(changes: Partial<Abilities>): void;
  onGoToZone(zoneId: string): void;
  onReset(): void;
};

// The hero's abilities as step buttons, and what the checker now says about the level.
export function HeroAbilities({ abilities, level, check, onAbilities, onGoToZone, onReset }: Props) {
  const failing = check
    ? level.zones.filter((z) => check.zones.some((c) => c.zoneId === z.id && !c.passable))
    : [];
  return (
    <section className={styles.abilities} aria-label="Abilities">
      <h3 className={styles.heroHeading}>Abilities</h3>
      <div className={styles.abilityRows}>
        {ROWS.map((row) => (
          <div key={row.key} role="group" aria-label={row.label} className={styles.ability}>
            <span className={styles.abilityLabel}>{row.label}</span>
            <div className={styles.steps}>
              {row.steps.map((step) => (
                <button
                  key={String(step)}
                  type="button"
                  className={styles.step}
                  aria-pressed={abilities[row.key] === step}
                  onClick={() => onAbilities({ [row.key]: step } as Partial<Abilities>)}
                >
                  {row.name(step)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p role="status" className={check && failing.length > 0 ? styles.bad : styles.good}>
        {!check ? (
          "Checking the level…"
        ) : failing.length === 0 ? (
          "All zones can still be finished."
        ) : (
          <>
            {failing.length === 1 ? "1 zone can't" : `${failing.length} zones can't`} be finished with this hero:{" "}
            {failing.map((zone, i) => (
              <span key={zone.id}>
                {i > 0 && ", "}
                <button type="button" className={styles.link} onClick={() => onGoToZone(zone.id)}>
                  {zone.name}
                </button>
              </span>
            ))}
          </>
        )}
      </p>
      <button type="button" className={styles.swatch} onClick={onReset}>
        Start from the snow hero
      </button>
    </section>
  );
}
```

In `src/editor/components/HeroScreen.tsx`:
- add to `Props`: `level: Level; check: LevelCheck | null; onGoToZone(zoneId: string): void; confirm(message: string): boolean;` (importing `Level` with `Project`, and `type LevelCheck` from `"@/checker/check"`), and take them in the parameters;
- import `HeroAbilities` and render it after the `heroSide` div, still inside the fieldset:

```tsx
      <HeroAbilities
        abilities={abilities}
        level={level}
        check={check}
        onAbilities={(changes) => onCommand({ name: "setHeroAbilities", args: changes })}
        onGoToZone={onGoToZone}
        onReset={() => {
          if (confirm("Start again from the snow hero's look? You can undo this.")) {
            onCommand({ name: "resetHeroLook", args: {} });
          }
        }}
      />
```

In `src/editor/Editor.tsx`, pass the new props to `HeroScreen`:

```tsx
            level={level}
            check={check}
            onGoToZone={(zoneId) => {
              setScreen("level");
              dispatch({ type: "selectZone", zoneId });
            }}
            confirm={confirm}
```

Add to `src/editor/editor.module.css`:

```css
.abilities {
  grid-column: 1 / -1;
}
.abilityRows {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.6rem 1rem;
  margin-bottom: 0.6rem;
}
.abilityLabel {
  display: block;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 0.2rem;
}
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.step {
  font: inherit;
  font-size: 15px;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  border: 2px solid var(--panel-2);
  background: #fff;
  color: var(--ink);
  cursor: pointer;
}
.step[aria-pressed="true"] {
  background: var(--signal);
  border-color: var(--signal);
  font-weight: 700;
}
.step:focus-visible,
.link:focus-visible {
  outline: 3px solid var(--signal);
  outline-offset: 2px;
}
.step:disabled {
  opacity: 0.5;
  cursor: default;
}
.link {
  font: inherit;
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}
```

- [ ] **Step 4: Locked pieces stay reachable, and do nothing**

In `src/editor/components/Palette.tsx`, replace `disabled={locked}` on piece buttons with `aria-disabled={locked || undefined}`, and make the click do nothing when locked:

```tsx
                onClick={() => {
                  if (locked) return;
                  onTool({
                    kind: "piece",
                    pieceId: p.id,
                    settings: Object.fromEntries(p.settings.map((s) => [s.key, s.default])),
                  });
                }}
```

and change the `.swatch:disabled` CSS rule to also cover `[aria-disabled="true"]`:

```css
.swatch:disabled,
.swatch[aria-disabled="true"] {
  opacity: 0.5;
  cursor: default;
}
```

In `src/editor/Editor.tsx`, ignore a press with a piece the hero can no longer use: at the top of `press`, change `if (busy) return;` to

```ts
    if (busy) return; // the assistant is changing the level
    const tool = state.tool;
    const needs = tool.kind === "piece" ? pack.pieces.find((p) => p.id === tool.pieceId)?.needs : undefined;
    if (needs === "slide" && !project.hero.abilities.slide) return; // the hero can't use this piece
```

and remove the now-duplicated `const tool = state.tool;` line that followed.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: choose hero abilities with step buttons and see at once which zones the hero can't finish"
```

---

### Task 6: A browser test, and the status

**Files:**
- Test: `e2e/hero.spec.ts`
- Modify: `docs/superpowers/status.md`

**Interfaces:**
- Consumes: Tasks 3–5.

- [ ] **Step 1: Write the browser test**

`e2e/hero.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

type Saved = { hero: { abilities: { jump: string; slide: boolean }; look: { poses: { stand: string[] } } } };

async function saved(page: Page): Promise<Saved> {
  return page.evaluate(
    () =>
      new Promise<Saved>((resolve, reject) => {
        const request = indexedDB.open("megarombuilder");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const all = request.result.transaction("projects").objectStore("projects").getAll();
          all.onsuccess = () => resolve(all.result[0].project);
        };
      }),
  );
}

test("draw on the hero, give it abilities, and play as it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("My Hero");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Hero" }).click();
  await page.screenshot({ path: "test-results/hero-open.png" });

  const canvas = page.getByTestId("hero-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas");
  const px = box.width / 16;
  await page.mouse.click(box.x + 0.5 * px, box.y + 0.5 * px); // the top-left pixel of the stand pose
  await expect.poll(async () => (await saved(page)).hero.look.poses.stand[0][0]).toBe("1");

  await page.getByRole("group", { name: "Jump" }).getByRole("button", { name: "Very high" }).click();
  await page.getByRole("group", { name: "Slide" }).getByRole("button", { name: "On" }).click();
  await expect.poll(async () => (await saved(page)).hero.abilities).toMatchObject({ jump: "veryHigh", slide: true });
  await expect(page.getByText("All zones can still be finished.")).toBeVisible();
  await page.screenshot({ path: "test-results/hero.png", fullPage: true });

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop playing" })).toBeVisible();
  await page.screenshot({ path: "test-results/hero-playing.png" });
});
```

- [ ] **Step 2: Run the browser tests**

Run: `npm run e2e`
Expected: 9 passed. Look at `test-results/hero.png`: pictures on the left, the big canvas with the body outline in the middle, colours, the 8-bit palette and the preview on the right, abilities below.

- [ ] **Step 3: Update the status**

In `docs/superpowers/status.md`: mark this plan implemented, reviewed and merged in the table; in "Where things stand", say the Hero button opens the hero screen (draw the hero picture by picture, pick its colours, choose its abilities including slide and charge shot, watch the preview, see which zones it can't finish); update the test counts; remove the deferred minors this plan fixed (`setHeroAbilities` and `undefined`, `setHeroPose`'s name-prefix check, keyboard reach and a selected crawl space for "Needs slide" pieces); add this plan's deferred review findings.

- [ ] **Step 4: Commit**

```bash
git add e2e/hero.spec.ts docs/superpowers/status.md
git commit -m "test: draw a hero, give it abilities and play as it in a browser"
```

---

## Self-review

- **Spec coverage (section 6):** the Hero/Level swap with the zone list, chat and undo staying → Task 3; poses list with thumbnails and the slide mark, canvas with tools, body outline and feet line, pose tools → Tasks 1 and 3; colours, add and refuse-to-remove-used → Task 4; preview → Task 2; abilities row with the live check note and zone links, start from the snow hero → Task 5; Play from either screen already works (the toolbar is shared). Section 4's "a drawing stroke is one command group" → Task 3. Section 10's hero screen tests → Tasks 3–6.
- **Types:** `Pixel`, `ZOOM`, `drawPicture`, `previewSim`, `previewInputs`, `HeroScreen`'s props (extended in Task 5), `HeroColours` and `HeroAbilities` props are defined once and used with the same names.
- **Known limits, accepted:** only the last colour can be removed; the preview restarts from the start on every change; the 8-bit palette buttons are named by number ("8-bit colour 22"), with the colour as their tooltip.
