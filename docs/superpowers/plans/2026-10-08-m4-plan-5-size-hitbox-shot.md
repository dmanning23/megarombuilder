# Size, Hitbox and Shot Point in the Editor Implementation Plan (Milestone 4, Plan 5 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Hero, Enemies and Boss tabs, kids change a character's canvas size with step buttons, drag the hitbox's edges on the canvas (or press Fit to drawing), and drag the shot point up and down; the level canvas and the checker keep up with those changes.

**Architecture:** Two new drawing tools join Pencil, Eraser, Fill and Pick colour in the animation editor: **Hitbox**, which drags the nearest edge of the hitbox, and **Shot point** (for characters that shoot), which drags the line shots come out of. Their pixel maths lives in a small pure module, `src/editor/hero/hitbox.ts`. A **Size** control steps the canvas of the chosen animation by 2 pixels, asking first when shrinking would cut off drawn pixels. The level canvas places the kid's characters on their hitboxes the way the game does, and the checker's cache notices a change to the kid's boss.

**Tech Stack:** as plan 1. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-07-milestone-4-characters-that-fit-design.md` (section 6, "Size", "Hitbox", "Shot point"; section 8; section 9, "Screens" and the browser test; build order item 5)

**Plan series for milestone 4:**

1. The shared look, format 4, the upgrade, the look commands (done)
2. Animations in the game (done)
3. Sizes, hitboxes and shot points in the game (done)
4. The animation editor (done)
5. Size, hitbox and shot point in the editor (this plan)

## Global Constraints

- Every change is one undo step: a size step, a whole hitbox drag, a whole shot point drag, Fit to drawing.
- Nothing is offered that would be refused: size buttons stop at the limits, the hitbox drag stops at the canvas, at 4 by 4, and (for the hero) at 30 tall, 16 wide and a 14-high slide; the shot point stays inside the hitbox.
- Kid-friendly words. Shrinking over drawn pixels asks: "This cuts off part of your drawing. You can undo it."
- Import alias `@/` maps to `src/`. Component tests run in jsdom.

## Decisions this plan makes

- **The Size control** shows the chosen animation's canvas ("16 × 24") with **Narrower**, **Wider**, **Shorter** and **Taller** buttons, each 2 pixels, turned off at the kind's limits. The hero's shots have fixed sizes, so their animations show no Size control. Resizing refits the hitbox to the drawing (plan 1's `resizeCanvas`), so a kid sees the hitbox follow.
- **The Hitbox tool:** pressing on the canvas grabs the hitbox edge nearest the press, and dragging moves that edge; the outline follows live, and letting go saves it as one `setBody`. On the slide only the top edge moves (the slide's feet stay on the floor, and its width isn't used). **Fit to drawing** sits beside the tools while the Hitbox tool is chosen.
- **The Shot point tool** (hero, turret, shield guard, boss, on the main canvas): pressing or dragging moves a yellow line across the hitbox to that row; letting go saves it with `setShotY`. The line is always drawn on the main canvas for characters that shoot, so kids see where shots come from.
- **The level canvas** draws the kid's own characters lined up on their hitboxes, exactly as the game does (`placeOn`, now exported). (Settles plan 3's deferred item.)
- **The checker's cache** keys on the kid's boss too, so resizing it rechecks its warnings. (Settles plan 3's deferred item.)

## Review Focus

1. **Dragging the hitbox past the canvas edge or through its opposite edge:** it stops at the canvas and at 4 pixels across, never flips or vanishes. Tested in Task 1.
2. **A hero's hitbox dragged taller than 30 or wider than 16:** it stops at the limit, and nothing is refused. Tested in Task 1.
3. **Shrinking an empty part of the canvas:** no question asked; shrinking over drawn pixels asks, and saying no changes nothing. Tested in Task 2.
4. **Undo after a hitbox drag of many pixels:** one undo puts the whole hitbox back. Tested in Task 3.
5. **Switching to an animation on another canvas (the slide) with the Hitbox tool chosen:** the tool works on that canvas's hitbox. Tested in Task 3.

## File Structure

```
src/model/look.ts                       reframeRows and cutsDrawing (reframe moved from commands)
src/commands/look.ts                    uses reframeRows
src/editor/hero/hitbox.ts               pickEdge, moveEdge, shotYAt
src/editor/hero/pixels.ts               drawPixels draws a shot line; its options object
src/editor/components/PixelCanvas.tsx, PictureEditor.tsx   extra tools; the shot line
src/editor/components/AnimationEditor.tsx   the Size control, the Hitbox and Shot point tools, Fit to drawing
src/editor/components/HeroScreen.tsx, EnemiesScreen.tsx, BossScreen.tsx   pass confirm
src/runtime/render/draw.ts              exports placeOn
src/editor/zoneView.ts                  the kid's characters lined up on their hitboxes
src/checker/cache.ts                    keys on the kid's boss
tests/model/look.test.ts, tests/editor/hitbox.test.ts, tests/editor/heroPixels.test.ts, tests/editor/sizeAndHitbox.test.tsx, tests/editor/zoneView.test.ts, tests/checker/cache.test.ts, e2e/enemies.spec.ts
```

---

### Task 1: The pure parts

**Files:**
- Create: `src/editor/hero/hitbox.ts`
- Modify: `src/model/look.ts`, `src/commands/look.ts`, `src/editor/hero/pixels.ts`, `src/editor/components/PixelCanvas.tsx` (only for `drawPixels`'s new signature)
- Test: `tests/editor/hitbox.test.ts`, additions to `tests/model/look.test.ts`, `tests/editor/heroPixels.test.ts`

**Interfaces:**
- Produces:
  - `reframeRows(rows: string[], w: number, h: number): string[]` and `cutsDrawing(look: Look, kind: LookKind, canvas: string, w: number, h: number): boolean` in `@/model/look`
  - `type Edge = "left" | "right" | "top" | "bottom"`; `type HitboxLimits = { canvas: { w: number; h: number }; maxW: number | null; maxH: number | null }`; `pickEdge(body: LookBox, p: Pixel): Edge`; `moveEdge(body: LookBox, edge: Edge, p: Pixel, limits: HitboxLimits): LookBox`; `shotYAt(body: LookBox, p: Pixel, shotHeight: number): number` in `@/editor/hero/hitbox`
  - `drawPixels(ctx, rows, palette, size, body, feet, extras: { under?: string[]; shot?: { y: number; h: number } } = {})`

- [ ] **Step 1: Write the failing tests**

`tests/editor/hitbox.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { moveEdge, pickEdge, shotYAt } from "@/editor/hero/hitbox";

const body = { x: 2, y: 4, w: 10, h: 12 }; // columns 2..11, rows 4..15
const limits = { canvas: { w: 16, h: 20 }, maxW: null, maxH: null };

describe("pickEdge", () => {
  it("grabs the edge nearest the press", () => {
    expect(pickEdge(body, { x: 2, y: 9 })).toBe("left");
    expect(pickEdge(body, { x: 12, y: 9 })).toBe("right");
    expect(pickEdge(body, { x: 6, y: 3 })).toBe("top");
    expect(pickEdge(body, { x: 6, y: 15 })).toBe("bottom");
  });
});

describe("moveEdge", () => {
  it("moves one edge to the pixel, keeping the others", () => {
    expect(moveEdge(body, "right", { x: 13, y: 0 }, limits)).toEqual({ x: 2, y: 4, w: 12, h: 12 });
    expect(moveEdge(body, "top", { x: 0, y: 1 }, limits)).toEqual({ x: 2, y: 1, w: 10, h: 15 });
  });

  it("stops at the canvas and at four pixels across, never flipping", () => {
    expect(moveEdge(body, "left", { x: -5, y: 0 }, limits)).toEqual({ x: 0, y: 4, w: 12, h: 12 });
    expect(moveEdge(body, "left", { x: 15, y: 0 }, limits)).toEqual({ x: 8, y: 4, w: 4, h: 12 });
    expect(moveEdge(body, "bottom", { x: 0, y: 99 }, limits)).toEqual({ x: 2, y: 4, w: 10, h: 16 });
    expect(moveEdge(body, "bottom", { x: 0, y: 0 }, limits)).toEqual({ x: 2, y: 4, w: 10, h: 4 });
  });

  it("stops at the hero's limits", () => {
    const hero = { canvas: { w: 32, h: 32 }, maxW: 16, maxH: 30 };
    expect(moveEdge({ x: 4, y: 4, w: 14, h: 22 }, "top", { x: 0, y: 0 }, hero)).toEqual({ x: 4, y: 0, w: 14, h: 26 });
    expect(moveEdge({ x: 4, y: 2, w: 14, h: 26 }, "top", { x: 0, y: -9 }, { ...hero, canvas: { w: 32, h: 40 } }).h).toBeLessThanOrEqual(30);
    expect(moveEdge({ x: 4, y: 4, w: 14, h: 22 }, "right", { x: 31, y: 0 }, hero)).toEqual({ x: 4, y: 4, w: 16, h: 22 });
  });
});

describe("shotYAt", () => {
  it("puts the shot at the pressed row, inside the hitbox", () => {
    expect(shotYAt(body, { x: 0, y: 9 }, 4)).toBe(5);
    expect(shotYAt(body, { x: 0, y: 0 }, 4)).toBe(0);
    expect(shotYAt(body, { x: 0, y: 99 }, 4)).toBe(8); // 12 high, a 4-high shot: 8 at most
  });
});
```

Add to `tests/model/look.test.ts` (importing `cutsDrawing`, `reframeRows`):

```ts
describe("resizing pictures", () => {
  it("pads evenly at the sides and on top, keeping the feet row", () => {
    expect(reframeRows(["11", "22"], 4, 3)).toEqual(["....", ".11.", ".22."]);
    expect(reframeRows(["1234", "5678"], 2, 1)).toEqual(["67"]);
  });

  it("knows when shrinking would cut off drawn pixels", () => {
    const look: Look = {
      colours: [13],
      canvases: { main: { w: 16, h: 16 } },
      animations: { walk: { frames: [Array.from({ length: 16 }, (_, y) => (y < 2 ? "................" : "....11111111....")), Array.from({ length: 16 }, () => "................")], speed: "normal" } },
      body: { x: 4, y: 2, w: 8, h: 14 },
    };
    expect(cutsDrawing(look, "walker", "main", 8, 14)).toBe(false); // only empty columns and rows go
    expect(cutsDrawing(look, "walker", "main", 6, 14)).toBe(true);
    expect(cutsDrawing(look, "walker", "main", 16, 12)).toBe(true);
  });
});
```

Add to `tests/editor/heroPixels.test.ts`: change the onion skin test's call to `drawPixels(ctx, ["1.", ".."], {...}, { w: 2, h: 2 }, null, false, { under: ["..", ".2"] })`, and add:

```ts
describe("the shot line", () => {
  it("is drawn across the canvas at the shot's rows", () => {
    const fills: { colour: string; x: number; y: number; w: number; h: number }[] = [];
    const ctx = {
      fillStyle: "",
      globalAlpha: 1,
      fillRect(x: number, y: number, w: number, h: number) {
        fills.push({ colour: String(this.fillStyle), x, y, w, h });
      },
    };
    drawPixels(ctx, blankRows(16, 24), {}, { w: 16, h: 24 }, { x: 1, y: 2, w: 14, h: 22 }, true, { shot: { y: 10, h: 4 } });
    expect(fills).toContainEqual({ colour: SHOT_LINE, x: 0, y: 10 * ZOOM, w: 16 * ZOOM, h: 2 });
    expect(fills).toContainEqual({ colour: SHOT_LINE, x: 0, y: 14 * ZOOM - 2, w: 16 * ZOOM, h: 2 });
  });
});
```

(import `SHOT_LINE` from `@/editor/hero/pixels`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/hitbox.test.ts tests/model/look.test.ts tests/editor/heroPixels.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`src/model/look.ts`: move `reframe` from `src/commands/look.ts` here as `export function reframeRows(...)` (same body and comment), and add:

```ts
const drawn = (frames: string[][]) => frames.reduce((n, rows) => n + rows.join("").replace(/\./g, "").length, 0);

// Whether resizing a canvas would cut off any drawn pixel of the frames on it.
export function cutsDrawing(look: Look, kind: LookKind, canvas: string, w: number, h: number): boolean {
  const frames = Object.entries(look.animations)
    .filter(([name]) => KINDS[kind].animations[name] === canvas)
    .flatMap(([, anim]) => anim.frames);
  return drawn(frames.map((rows) => reframeRows(rows, w, h))) < drawn(frames);
}
```

`src/commands/look.ts` imports and uses `reframeRows`.

`src/editor/hero/hitbox.ts`:

```ts
import { BODY_MIN, type LookBox } from "@/model/look";
import type { Pixel } from "./pixels";

// The maths of the Hitbox and Shot point tools: which edge a press grabs, where a drag puts it, and
// which row a shot comes out of. Plain code, so it can be tested without a canvas.

export type Edge = "left" | "right" | "top" | "bottom";
export type HitboxLimits = { canvas: { w: number; h: number }; maxW: number | null; maxH: number | null };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function pickEdge(body: LookBox, p: Pixel): Edge {
  const right = body.x + body.w - 1;
  const bottom = body.y + body.h - 1;
  const distances: [Edge, number][] = [
    ["left", Math.abs(p.x - body.x)],
    ["right", Math.abs(p.x - right)],
    ["top", Math.abs(p.y - body.y)],
    ["bottom", Math.abs(p.y - bottom)],
  ];
  return distances.reduce((best, d) => (d[1] < best[1] ? d : best))[0];
}

// Moves one edge of the hitbox to the pixel, keeping it on the canvas, at least BODY_MIN across, and
// within the hero's limits.
export function moveEdge(body: LookBox, edge: Edge, p: Pixel, limits: HitboxLimits): LookBox {
  const right = body.x + body.w - 1;
  const bottom = body.y + body.h - 1;
  const maxW = limits.maxW ?? limits.canvas.w;
  const maxH = limits.maxH ?? limits.canvas.h;
  if (edge === "left") {
    const x = clamp(p.x, Math.max(0, right - maxW + 1), right - BODY_MIN + 1);
    return { ...body, x, w: right - x + 1 };
  }
  if (edge === "right") {
    const r = clamp(p.x, body.x + BODY_MIN - 1, Math.min(limits.canvas.w - 1, body.x + maxW - 1));
    return { ...body, w: r - body.x + 1 };
  }
  if (edge === "top") {
    const y = clamp(p.y, Math.max(0, bottom - maxH + 1), bottom - BODY_MIN + 1);
    return { ...body, y, h: bottom - y + 1 };
  }
  const b = clamp(p.y, body.y + BODY_MIN - 1, Math.min(limits.canvas.h - 1, body.y + maxH - 1));
  return { ...body, h: b - body.y + 1 };
}

export const shotYAt = (body: LookBox, p: Pixel, shotHeight: number): number =>
  clamp(p.y - body.y, 0, Math.max(0, body.h - shotHeight));
```

Check `moveEdge(body, "top", { y: 1 })`: bottom 15, y = clamp(1, max(0, 15 − 20 + 1) = 0, 12) = 1, h 15. Check the hero top case: bottom 25, y = clamp(0, max(0, 25 − 30 + 1) = 0, 22) = 0, h 26.

`src/editor/hero/pixels.ts`: `export const SHOT_LINE = "#ffd400";` and `drawPixels`'s last parameter becomes `extras: { under?: string[]; shot?: { y: number; h: number } } = {}` (the onion skin reads `extras.under`). After the outline, when `extras.shot` is given, draw two lines across the canvas: `ctx.fillStyle = SHOT_LINE; ctx.fillRect(0, shot.y * ZOOM, w * ZOOM, 2); ctx.fillRect(0, (shot.y + shot.h) * ZOOM - 2, w * ZOOM, 2);`. `PixelCanvas` passes `{ under, shot }` (a new optional `shot` prop, in the effect's dependencies).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: add the maths for dragging hitboxes and shot points, and for resizing without losing drawing"
```

---

### Task 2: The Size control

**Files:**
- Modify: `src/editor/components/AnimationEditor.tsx`, `src/editor/components/HeroScreen.tsx`, `src/editor/components/EnemiesScreen.tsx`, `src/editor/components/BossScreen.tsx`
- Test: `tests/editor/sizeAndHitbox.test.tsx`

**Interfaces:**
- Consumes: Task 1's `cutsDrawing`; `KINDS[kind].canvases[group]` limits
- Produces: `AnimationEditor`'s new prop `confirm(message: string): boolean`

- [ ] **Step 1: Write the failing tests**

`tests/editor/sizeAndHitbox.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

const size = () => screen.getByRole("group", { name: "Size" });
const sizeButton = (name: string) => within(size()).getByRole("button", { name });
const chooseAnimation = (name: string) =>
  userEvent.click(within(screen.getByRole("group", { name: "Animations" })).getByRole("button", { name: new RegExp(`^${name},`) }));

describe("the Size control", () => {
  it("grows the canvas two pixels at a time, and the hitbox follows the drawing", async () => {
    const { open, saved } = setupHero();
    await open();
    expect(within(size()).getByText("16 × 24")).toBeTruthy();
    await userEvent.click(sizeButton("Taller"));
    await userEvent.click(sizeButton("Wider"));
    expect(within(size()).getByText("18 × 26")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Stand frame 1, 18 by 26 pixels" })).toBeTruthy();
    expect(saved().hero.look.canvases.main).toEqual({ w: 18, h: 26 });
  });

  it("asks before cutting off drawing, and does nothing if the kid says no", async () => {
    const confirm = vi.fn(() => false);
    const { open, saved } = setupHero(undefined, confirm);
    await open();
    await userEvent.click(sizeButton("Narrower")); // the snow hero fills its width: this cuts
    expect(confirm).toHaveBeenCalledWith("This cuts off part of your drawing. You can undo it.");
    expect(saved().hero.look.canvases.main).toEqual({ w: 16, h: 24 });
  });

  it("doesn't ask when only empty space goes", async () => {
    const confirm = vi.fn(() => true);
    const { open, saved } = setupHero(undefined, confirm);
    await open();
    await userEvent.click(sizeButton("Taller"));
    await userEvent.click(sizeButton("Shorter")); // takes back the empty row it added
    expect(confirm).not.toHaveBeenCalledWith("This cuts off part of your drawing. You can undo it.");
    expect(saved().hero.look.canvases.main).toEqual({ w: 16, h: 24 });
  });

  it("stops at the limits, sizes the slide on its own canvas, and has no Size for the shots", async () => {
    const { open } = setupHero();
    await open();
    for (let i = 0; i < 4; i++) await userEvent.click(sizeButton("Taller"));
    expect(sizeButton("Taller")).toHaveProperty("disabled", true); // 32 is the most
    await chooseAnimation("Slide");
    expect(within(size()).getByText("24 × 16")).toBeTruthy();
    expect(sizeButton("Taller")).toHaveProperty("disabled", true); // a slide is 16 high at most
    await chooseAnimation("Shot");
    expect(screen.queryByRole("group", { name: "Size" })).toBeNull();
  });
});
```

(`setupHero(initial, confirm)` already takes a confirm. The snow hero is 16 wide with pixels in its outer columns, so Narrower cuts; check its stand frame's first and last columns have drawn pixels, and if not, pick a step that cuts.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/sizeAndHitbox.test.tsx`
Expected: FAIL (no Size group).

- [ ] **Step 3: Write the implementation**

In `AnimationEditor.tsx`, add `confirm(message: string): boolean` to the props, and a Size control after the play row, shown when the chosen animation's canvas isn't fixed:

```tsx
  const limits = rule.canvases[group];
  const fixed = limits.min.w === limits.max.w && limits.min.h === limits.max.h;
  const resize = (w: number, h: number) => {
    if (cutsDrawing(look, kind, group, w, h) && !confirm("This cuts off part of your drawing. You can undo it.")) return;
    send("resizeCanvas", { canvas: group, w, h });
  };
```

```tsx
      {!fixed && (
        <div role="group" aria-label="Size" className={styles.steps}>
          <span className={styles.abilityLabel}>Size</span>
          <span className={styles.note}>{`${canvas.w} × ${canvas.h}`}</span>
          <button type="button" className={styles.step} disabled={canvas.w - 2 < limits.min.w} onClick={() => resize(canvas.w - 2, canvas.h)}>Narrower</button>
          <button type="button" className={styles.step} disabled={canvas.w + 2 > limits.max.w} onClick={() => resize(canvas.w + 2, canvas.h)}>Wider</button>
          <button type="button" className={styles.step} disabled={canvas.h - 2 < limits.min.h} onClick={() => resize(canvas.w, canvas.h - 2)}>Shorter</button>
          <button type="button" className={styles.step} disabled={canvas.h + 2 > limits.max.h} onClick={() => resize(canvas.w, canvas.h + 2)}>Taller</button>
        </div>
      )}
```

Pass `confirm={confirm}` to `AnimationEditor` from `HeroScreen`, `EnemiesScreen` and `BossScreen` (each already has a `confirm` prop).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: let kids resize a character's canvas, asking before cutting off drawing"
```

---

### Task 3: The Hitbox and Shot point tools

**Files:**
- Modify: `src/editor/components/PictureEditor.tsx`, `src/editor/components/AnimationEditor.tsx`
- Test: additions to `tests/editor/sizeAndHitbox.test.tsx`; `tests/editor/enemiesScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1's `pickEdge`, `moveEdge`, `shotYAt`, the shot line; `HERO_BODY_MAX_H`, `HERO_BODY_MAX_W`, `SLIDE_BODY_MAX_H`, `KINDS[kind].shotHeight`
- Produces: `PictureEditor`'s new props `extraTools?: { id: string; label: string; press(p: Pixel): void; drag(p: Pixel): void; release(): void }[]`, `shot?: { y: number; h: number }`, and the widened `DrawTool = "pencil" | "eraser" | "fill" | "pick" | string`

- [ ] **Step 1: Write the failing tests**

Add to `tests/editor/sizeAndHitbox.test.tsx` (importing `fireEvent` and `ZOOM` from `@/editor/hero/pixels`):

```tsx
function canvasPress(testId: string) {
  const el = () => {
    const c = screen.getByTestId(testId) as HTMLCanvasElement;
    c.getBoundingClientRect = () => ({ left: 0, top: 0, width: c.width, height: c.height, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    return c;
  };
  const at = (x: number, y: number) => ({ clientX: x * ZOOM + ZOOM / 2, clientY: y * ZOOM + ZOOM / 2, button: 0 });
  return {
    drag(from: [number, number], ...path: [number, number][]) {
      fireEvent.pointerDown(el(), at(...from));
      for (const p of path) fireEvent.pointerMove(el(), at(...p));
      const last = path.at(-1) ?? from;
      fireEvent.pointerUp(el(), at(...last));
    },
  };
}

describe("the Hitbox tool", () => {
  it("drags the nearest edge, saves it as one undo step, and stops at the limits", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    canvasPress("hero-canvas").drag([14, 12], [13, 12], [12, 12], [11, 12]); // the right edge, in by 3
    expect(saved().hero.look.body).toEqual({ x: 1, y: 2, w: 11, h: 22 });
  });

  it("undoes a whole drag in one step", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    canvasPress("hero-canvas").drag([8, 2], [8, 3], [8, 4], [8, 5], [8, 6]); // the top edge, down by 4
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().hero.look.body).toEqual({ x: 1, y: 2, w: 14, h: 22 });
  });

  it("moves only the slide's top edge, on the slide's own canvas", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    await chooseAnimation("Slide");
    canvasPress("hero-canvas").drag([12, 2], [12, 6]);
    expect(saved().hero.look.slideBody).toEqual({ x: 5, y: 6, w: 14, h: 10 });
  });

  it("fits the hitbox to the drawing", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    canvasPress("hero-canvas").drag([14, 12], [8, 12]);
    await choose("Fit to drawing");
    expect(saved().hero.look.body.w).toBeGreaterThan(8);
  });
});

describe("the Shot point tool", () => {
  it("moves where shots come out, inside the hitbox", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Shot point");
    canvasPress("hero-canvas").drag([8, 14], [8, 16]);
    expect(saved().hero.look.shotY).toBe(14); // row 16, the hitbox starting at row 2
  });

  it("isn't offered on the slide or the shots", async () => {
    const { open } = setupHero();
    await open();
    await chooseAnimation("Slide");
    expect(screen.queryByRole("button", { name: "Shot point" })).toBeNull();
  });
});
```

Add to `tests/editor/enemiesScreen.test.tsx`: a walker has no Shot point tool, a turret does:

```tsx
  it("offers the Shot point tool only to enemies that shoot", async () => {
    const { open } = setup();
    await open();
    await make("Frost Fang", "Walker");
    expect(screen.queryByRole("button", { name: "Shot point" })).toBeNull();
    await make("Ice Eye", "Turret");
    expect(screen.getByRole("button", { name: "Shot point" })).toBeTruthy();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/sizeAndHitbox.test.tsx tests/editor/enemiesScreen.test.tsx`
Expected: FAIL (no Hitbox tool).

- [ ] **Step 3: Extra tools in the picture editor**

`PictureEditor`:
- `export type DrawTool = string;` (the four drawing tools keep their ids; extra tools add theirs).
- New props `extraTools?: { id: string; label: string; press(p: Pixel): void; drag(p: Pixel): void; release(): void }[]` and `shot?: { y: number; h: number }` (passed to `PixelCanvas`).
- `press`, `drag` and `release` hand off to the chosen extra tool when there is one:

```tsx
  const extra = extraTools?.find((t) => t.id === tool);
  const press = (p: Pixel) => {
    if (locked) return;
    if (extra) return extra.press(p);
    // ...as now
  };
  const drag = (p: Pixel, fresh: boolean) => {
    if (extra) return extra.drag(p);
    // ...as now
  };
  const release = () => {
    if (extra) return extra.release();
    // ...as now
  };
```

- The "Drawing tools" group lists the extra tools after the four drawing tools.

- [ ] **Step 4: The tools in the animation editor**

In `AnimationEditor.tsx`:

```tsx
  // A hitbox or shot point being dragged: shown live, saved once when the press ends.
  const [draft, setDraft] = useState<{ body?: LookBox; shotY?: number; edge?: Edge } | null>(null);
  const which = group === "slide" ? "slide" : "main";
  const shotHeight = rule.shotHeight;
  const hitboxLimits: HitboxLimits = {
    canvas,
    maxW: kind === "hero" && which === "main" ? HERO_BODY_MAX_W : null,
    maxH: kind === "hero" ? (which === "slide" ? SLIDE_BODY_MAX_H : HERO_BODY_MAX_H) : null,
  };
  const shownBody = draft?.body ?? body;
  const shownShotY = draft?.shotY ?? look.shotY;

  const extraTools =
    body === null
      ? []
      : [
          {
            id: "hitbox",
            label: "Hitbox",
            press: (p: Pixel) => {
              const edge = which === "slide" ? "top" : pickEdge(body, p);
              setDraft({ edge, body: moveEdge(body, edge, p, hitboxLimits) });
            },
            drag: (p: Pixel) => setDraft((d) => (d?.edge ? { ...d, body: moveEdge(body, d.edge, p, hitboxLimits) } : d)),
            release: () => {
              if (draft?.body) send("setBody", { which, body: draft.body });
              setDraft(null);
            },
          },
          ...(shotHeight !== null && which === "main"
            ? [
                {
                  id: "shot",
                  label: "Shot point",
                  press: (p: Pixel) => setDraft({ shotY: shotYAt(body, p, shotHeight) }),
                  drag: (p: Pixel) => setDraft({ shotY: shotYAt(body, p, shotHeight) }),
                  release: () => {
                    if (draft?.shotY !== undefined) send("setShotY", { y: draft.shotY });
                    setDraft(null);
                  },
                },
              ]
            : []),
        ];
```

`release` reads `draft` from the render it was made in; a press, drags and a release are separate pointer events and each re-renders, so the release sees the last drag's draft. If a test shows the release seeing a stale draft, keep the draft in a ref beside the state (`draftRef.current = next` wherever it's set) and read the ref in `release`.

Pass to `PictureEditor`: `body={shownBody}`, `extraTools={extraTools}`, `shot={shotHeight !== null && which === "main" && shownShotY !== undefined && shownBody ? { y: shownBody.y + shownShotY, h: shotHeight } : undefined}`. If the chosen tool isn't offered for this animation (the Shot point tool on the slide), fall back to the pencil: `const activeTool = tool === "shot" && !extraTools.some((t) => t.id === "shot") ? "pencil" : tool;`.

Beside the drawing tools, while the Hitbox tool is chosen, show **Fit to drawing**: `<button type="button" className={styles.swatch} onClick={() => send("fitBody", { which })}>Fit to drawing</button>`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: let kids drag a character's hitbox and shot point on the canvas"
```

---

### Task 4: The level canvas and the checker keep up; in a browser

**Files:**
- Modify: `src/runtime/render/draw.ts`, `src/editor/zoneView.ts`, `src/checker/cache.ts`, `e2e/enemies.spec.ts`, `docs/superpowers/STATUS.md`
- Test: additions to `tests/editor/zoneView.test.ts`, `tests/checker/cache.test.ts`

**Interfaces:**
- Produces: `export function placeOn(box, body, canvasW, flip)` from `draw.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/editor/zoneView.test.ts`, following its own setup for drawing a zone with skins (it records `drawImage` calls):

```ts
  it("draws the kid's own enemies lined up on their hitboxes, as the game does", () => {
    // A walker of the kid's, its canvas 24 by 24 with its hitbox at the left: placed at tile (6, 12).
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    project = run(project, "resizeCanvas", { target: { enemy: "e1" }, canvas: "main", w: 24, h: 24 });
    project = run(project, "setBody", { target: { enemy: "e1" }, body: { x: 0, y: 10, w: 14, h: 14 } });
    project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 6, y: 12 });
    // ...draw the zone with ownSkins(project.enemies, ...), then find the drawImage call for the enemy's first frame:
    // the picture's left is the hitbox's left (6 * 16 + 1), and its top is the hitbox's top minus 10.
  });
```

Write it with the file's own helpers: `drawZoneView` on `gamePack(project, pack)`'s zone with `own: ownSkins(project.enemies, () => fake)`, then `expect(call.x).toBe(6 * 16 + 1)` and `expect(call.y).toBe(12 * 16 + 2 - 10)` (the hitbox is 14 wide on a 16-wide tile, so its left is at 97; 14 high with its feet on the tile's bottom, so its top is 194, and the picture's top is 10 above that).

Add to `tests/checker/cache.test.ts`:

```ts
  it("checks a zone again after the kid's boss changes", () => {
    const cache = createCheckCache();
    let project = run(game(), { name: "createBoss", args: { name: "Volt Viper" } });
    const first = cache.zone(project, "L1", "boss", pack);
    project = run(project, { name: "resizeCanvas", args: { target: "boss", canvas: "main", w: 32, h: 32 } });
    expect(cache.zone(project, "L1", "boss", pack)).not.toBe(first);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/zoneView.test.ts tests/checker/cache.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`draw.ts`: `export function placeOn(...)`. `zoneView.ts`: for the kid's own types, draw at `placeOn(box, own.body, own.canvas.w, false)`; the content pack's things keep today's bottom-centring.

`cache.ts`: the cached entry keeps `boss: project.boss`, and a hit needs `hit.boss === project.boss`.

- [ ] **Step 4: The browser test**

In `e2e/enemies.spec.ts`, after adding the walk frames, make the enemy bigger and play:

```ts
  await page.getByRole("group", { name: "Size" }).getByRole("button", { name: "Taller" }).click();
  await page.getByRole("group", { name: "Size" }).getByRole("button", { name: "Wider" }).click();
  await expect.poll(async () => (await saved(page)).enemies[0].look.canvases.main).toEqual({ w: 18, h: 18 });
  await page.screenshot({ path: "test-results/enemy-resized.png", fullPage: true });
```

(extending `Saved` with `canvases: { main: { w: number; h: number } }`). Run `npm run e2e`; open `test-results/enemy-resized.png` and check the Size control, the drawing tools (with Hitbox) and the canvas sit together without overlapping.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass.

- [ ] **Step 6: Update the status and commit**

In `docs/superpowers/STATUS.md`: mark this plan implemented, reviewed and merged, and milestone 4 complete; say kids resize characters, drag hitboxes and shot points, and the level canvas and checker keep up; remove plan 3's deferred items about the zone canvas and the boss cache key; update the test counts; add this plan's deferred review findings.

```bash
git add -A src tests e2e docs/superpowers/STATUS.md
git commit -m "feat: line the kid's characters up on their hitboxes in the level canvas, and recheck when the boss changes"
```

---

## Self-review

- **Spec coverage:** section 6's Size (width and height step buttons, steps of 2, asking before cutting off drawing), Hitbox (outline, handles on its edges, Fit to drawing) and Shot point (dragged up and down for the hero, turret, shield guard and boss) → Tasks 1 to 3; every change one undo step → Task 3's undo test and Task 2's single commands; section 8's "shrinking over drawn pixels asks first" and "a size, body or shot point past its limits is not offered" → Tasks 1 and 2; section 9's screen tests for size, hitbox handles and shot marker on each tab (hero in full, enemy for the shot point tool) and the browser test's "resize it, and play" → Tasks 2 to 4. The level canvas and cache items close plan 3's deferred list.
- **Placeholder scan:** Task 4's zone view test is described with its exact expected numbers and written in the file's own pattern; Task 3 notes the one place a ref may be needed and how to tell.
- **Types:** `reframeRows`, `cutsDrawing`, `Edge`, `HitboxLimits`, `pickEdge`, `moveEdge`, `shotYAt`, `SHOT_LINE`, `extraTools`, `placeOn` are defined once and used with the same names.
- **Known limits, accepted:** hitbox edges are dragged with a pointer; keyboard users get Fit to drawing and the size buttons, not edge-by-edge nudges.
