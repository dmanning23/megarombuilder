# Picture Import Implementation Plan (Milestone 2, Plan 4 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the hero screen, "Import picture" brings a PNG (or any picture the browser can read) into the current pose: fitted into the frame keeping its shape, see-through areas kept empty, a plain background removed if wanted, every pixel snapped to the 8-bit palette and cut down to the hero's eight colours. A before/after view shows the result; "Use this" makes it one undo step, ready to touch up with the pencil.

**Architecture:** The fitting and colour work is plain code in `src/editor/hero/importPicture.ts`, working on an RGBA pixel array, tested without a browser. Only `src/editor/hero/readPicture.ts` uses the browser (decode the file, shrink very large pictures, read the pixels). `ImportDialog` shows before and after and the background toggle; the hero screen turns "Use this" into `setHeroColours` (when colours are added) and `setHeroPose`, inside one command group.

**Tech Stack:** as plan 3. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-milestone-2-your-own-hero-design.md` (section 7; the import rows of sections 9 and 10; build order item 4)

**Plan series for milestone 2:**

1. Hero data and abilities (done)
2. Slide and charge shot (done)
3. The hero screen (done)
4. Picture import (this plan)
5. The assistant

## Global Constraints

- The fitting and colour work has no DOM; only reading the file into pixels uses the browser.
- Importing changes nothing until "Use this"; then it is one undo step.
- Files over 5 MB, and files that aren't readable pictures, are refused with: "That file isn't a picture we can use. Try a PNG." Nothing changes.
- A hero never gets more than eight colours.
- Interface text is short, plain and in sentence case.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **Fitting:** the picture is scaled by the largest factor that fits the frame (up or down), keeping its shape. Poses sit centred with their bottom on the feet line; shots sit centred.
- **Each frame pixel takes the colour most of its source pixels snap to** (a vote over the block of source pixels it covers). Pixel art stays crisp; big pictures still read well. Ties go to the colour seen first.
- **See-through:** a source pixel with alpha below 128 counts as empty.
- **Background:** when a picture has no see-through pixels and its four corners share a colour (each channel summed within 24), that colour is the background. The "Remove background" toggle appears only then, and starts on. Removing it makes pixels within that tolerance empty.
- **Colours:** palette colours are taken most-used first. One the hero already has is reused; one within a redmean distance of 2000 of a hero colour reuses that colour; otherwise a new slot is added, up to eight; after that, it merges into the nearest hero colour. Existing slots are never changed, so other pictures keep their colours.
- **Very large pictures** are shrunk in the browser to at most 256 pixels on their long side before the vote, so a photo imports quickly.
- **The palette module gains `nearestIndex(r, g, b)`, `colourDistance(a, b)` and `PALETTE_RGB`;** `nearestColour(hex)` uses them.

## Review Focus

1. **A picture far bigger or smaller than the frame, or very wide or very tall**: it fits, keeps its shape, sits on the feet line, and nothing is written outside the frame. Tested in Task 1.
2. **A picture with more colours than the hero has room for**: never more than eight hero colours, and no pixel names a slot that doesn't exist. Tested in Task 1.
3. **A picture with a see-through background and also corners of one colour** (a transparent PNG): no toggle is shown and nothing extra is removed. Tested in Task 1.
4. **A file that isn't a picture, or is huge**: the plain message, no dialog, nothing changed. Tested in Task 2.
5. **Importing, then undo**: one undo removes both the new colours and the picture. Tested in Task 2.

## File Structure

```
src/model/palette.ts                     PALETTE_RGB, colourDistance, nearestIndex
src/editor/hero/importPicture.ts         RawImage, Imported, hasTransparency, backgroundOf, importPicture
src/editor/hero/readPicture.ts           MAX_FILE_BYTES, NOT_A_PICTURE, readPicture (browser)
src/editor/components/ImportDialog.tsx   before/after, Remove background, Use this, Cancel
src/editor/components/HeroScreen.tsx     Import picture
src/editor/Editor.tsx                    passes an optional readPicture through (for tests)
src/editor/editor.module.css             dialog styles
tests/editor/importPicture.test.ts, tests/editor/heroImport.test.tsx, e2e/hero.spec.ts
```

---

### Task 1: Fitting a picture into a pose

**Files:**
- Modify: `src/model/palette.ts`
- Create: `src/editor/hero/importPicture.ts`
- Test: `tests/editor/importPicture.test.ts`, additions to `tests/model/palette.test.ts`

**Interfaces:**
- Consumes: `PALETTE_8BIT`, `nearestColour` (plan 1); `PICTURE_SIZES`, `MAX_COLOURS`, `type HeroPicture` (plan 1)
- Produces:
  - `PALETTE_RGB: readonly [number, number, number][]`, `colourDistance(a: [number, number, number], b: [number, number, number]): number`, `nearestIndex(r: number, g: number, b: number): number`
  - `type RawImage = { width: number; height: number; data: ArrayLike<number> }` (RGBA, row by row)
  - `type Imported = { rows: string[]; colours: number[] }`
  - `hasTransparency(image: RawImage): boolean`
  - `backgroundOf(image: RawImage): [number, number, number] | null`
  - `importPicture(image: RawImage, picture: HeroPicture, colours: number[], removeBackground: boolean): Imported`

- [ ] **Step 1: Write the failing tests**

Add to `tests/model/palette.test.ts` (importing `colourDistance`, `nearestIndex` and `PALETTE_RGB` too):

```ts
describe("nearestIndex and colourDistance", () => {
  it("agree with nearestColour", () => {
    expect(nearestIndex(0x1a, 0x1c, 0x2c)).toBe(nearestColour("#1a1c2c"));
    expect(PALETTE_RGB[nearestIndex(255, 0, 0)]).toEqual([...PALETTE_RGB[nearestColour("#ff0000")]]);
  });

  it("measure nothing between a colour and itself, and more for colours further apart", () => {
    expect(colourDistance([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(colourDistance([0, 0, 0], [255, 255, 255])).toBeGreaterThan(colourDistance([0, 0, 0], [40, 40, 40]));
  });
});
```

`tests/editor/importPicture.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { backgroundOf, hasTransparency, importPicture, type RawImage } from "@/editor/hero/importPicture";
import { nearestColour, PALETTE_8BIT } from "@/model/palette";

type Rgba = [number, number, number, number];
const RED: Rgba = [248, 56, 0, 255]; // exactly an 8-bit colour
const BLUE: Rgba = [0, 88, 248, 255];
const WHITE: Rgba = [248, 248, 248, 255];
const CLEAR: Rgba = [0, 0, 0, 0];

// A picture from letters: each letter is a colour, "." is see-through.
function image(art: string[], colours: Record<string, Rgba> = { r: RED, b: BLUE, w: WHITE }): RawImage {
  const height = art.length;
  const width = art[0].length;
  const data: number[] = [];
  for (const row of art) for (const ch of row) data.push(...(ch === "." ? CLEAR : colours[ch]));
  return { width, height, data };
}

const solid = (w: number, h: number, ch: string) => Array.from({ length: h }, () => ch.repeat(w));
const red = nearestColour("#f83800");
const blue = nearestColour("#0058f8");
const white = nearestColour("#f8f8f8");

describe("importPicture", () => {
  it("keeps a picture the frame's size pixel for pixel, adding its colour as a new slot", () => {
    const art = solid(16, 24, ".");
    art[3] = "...rrrr.........";
    const result = importPicture(image(art), "stand", [13], false);
    expect(result.colours).toEqual([13, red]);
    expect(result.rows[3]).toBe("...2222.........");
    expect(result.rows.filter((row, y) => y !== 3).every((row) => row === "................")).toBe(true);
  });

  it("shrinks a big picture to fit, keeping its shape, with its bottom on the feet line", () => {
    const result = importPicture(image(solid(32, 32, "r")), "stand", [13], false);
    expect(result.rows.slice(0, 8).every((row) => row === "................")).toBe(true);
    expect(result.rows.slice(8).every((row) => row === "2222222222222222")).toBe(true);
    expect(result.rows).toHaveLength(24);
  });

  it("grows a small picture to fit, keeping it crisp", () => {
    const result = importPicture(image(["rr", "rb"]), "stand", [13], false);
    // 2x2 grows by 8 to 16x16, sitting on the feet line; red is used most, so it gets the first new slot
    expect(result.colours).toEqual([13, red, blue]);
    expect(result.rows[8]).toBe("2222222222222222");
    expect(result.rows[23]).toBe("2222222233333333");
  });

  it("centres a shot", () => {
    const result = importPicture(image(solid(4, 4, "r")), "shot", [13], false);
    expect(result.rows).toEqual([".2222.", ".2222.", ".2222.", ".2222."]);
  });

  it("fits a very wide picture across the frame, centred low", () => {
    const result = importPicture(image(solid(64, 4, "r")), "stand", [13], false);
    expect(result.rows.slice(0, 23).every((row) => row === "................")).toBe(true);
    expect(result.rows[23]).toBe("2222222222222222");
  });

  it("gives each pixel the colour most of its block snaps to", () => {
    const blocks = Array.from({ length: 48 }, (_, y) => (y % 2 === 0 ? "rb" : "rr").repeat(16));
    const result = importPicture(image(blocks), "stand", [13], false);
    expect(result.rows.every((row) => row === "2222222222222222")).toBe(true);
  });

  it("leaves see-through and nearly see-through pixels empty", () => {
    const art = solid(16, 24, "r");
    art[0] = "................";
    const picture = image(art, { r: RED });
    const faint = { ...picture, data: Array.from(picture.data) };
    faint.data[(1 * 16 + 0) * 4 + 3] = 100; // pixel (0, 1) is faint
    const result = importPicture(faint, "stand", [13], false);
    expect(result.rows[0]).toBe("................");
    expect(result.rows[1][0]).toBe(".");
    expect(result.rows[1][1]).toBe("2");
  });

  it("snaps colours to the nearest 8-bit colour", () => {
    const result = importPicture(image(solid(16, 24, "x"), { x: [247, 58, 2, 255] }), "stand", [13], false);
    expect(result.colours).toEqual([13, red]);
  });

  it("reuses a hero colour that is close enough", () => {
    const nearWhite = nearestColour("#fcfcfc");
    const result = importPicture(image(solid(16, 24, "w")), "stand", [13, nearWhite], false);
    expect(result.colours).toEqual([13, nearWhite]);
    expect(result.rows[0]).toBe("2222222222222222");
    expect(white).not.toBe(nearWhite);
  });

  it("never goes past eight colours, merging the rest into the nearest", () => {
    const seven = [13, 0, 1, 9, 22, 30, 40];
    const art = solid(16, 24, ".");
    art[0] = "rrrrrrrrrrrr....";
    art[1] = "bbbbbbbb........";
    art[2] = "wwww............";
    const result = importPicture(image(art), "stand", seven, false);
    expect(result.colours).toHaveLength(8);
    expect(result.colours.slice(0, 7)).toEqual(seven);
    expect(result.colours[7]).toBe(red); // the most-used new colour gets the last slot
    const used = new Set(result.rows.join("").replace(/\./g, ""));
    for (const ch of used) expect(Number(ch)).toBeLessThanOrEqual(8);
    expect(PALETTE_8BIT[result.colours[Number(result.rows[1][0]) - 1]]).toBeDefined();
  });
});

describe("backgrounds", () => {
  const framed = ["wwww", "wrrw", "wrrw", "wwww"];

  it("finds a plain background on a picture with no see-through pixels", () => {
    expect(backgroundOf(image(framed))).toEqual([248, 248, 248]);
    expect(hasTransparency(image(framed))).toBe(false);
  });

  it("finds none when corners differ, or when the picture already has see-through pixels", () => {
    expect(backgroundOf(image(["wwwr", "wrrw", "wrrw", "wwww"]))).toBeNull();
    expect(backgroundOf(image(["w..w", "wrrw", "wrrw", "wwww"]))).toBeNull();
    expect(hasTransparency(image(["w..w"]))).toBe(true);
  });

  it("removes the background when asked, and keeps it when not", () => {
    const removed = importPicture(image(framed), "shot", [13], true);
    expect(removed.rows).toEqual(["..22..", "..22..", "..22..", "..22.."].map((row, y) => (y === 0 || y === 3 ? "......" : row)));
    const kept = importPicture(image(framed), "shot", [13], false);
    expect(kept.rows[0]).toBe(".2222.");
    expect(kept.colours).toEqual([13, white, red]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/importPicture.test.ts tests/model/palette.test.ts`
Expected: FAIL (`@/editor/hero/importPicture` cannot be resolved; `nearestIndex` is not exported).

- [ ] **Step 3: Palette distances**

In `src/model/palette.ts`, replace `const RGB = PALETTE_8BIT.map(channels);` and `nearestColour` with:

```ts
export const PALETTE_RGB: readonly [number, number, number][] = PALETTE_8BIT.map(channels);

// How different two colours look, by the "redmean" approximation of how eyes see colour.
export function colourDistance(a: [number, number, number], b: [number, number, number]): number {
  const mean = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
}

// The palette colour that looks closest.
export function nearestIndex(r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Infinity;
  PALETTE_RGB.forEach((colour, i) => {
    const distance = colourDistance([r, g, b], colour);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

export function nearestColour(hex: string): number {
  const [r, g, b] = channels(hex);
  return nearestIndex(r, g, b);
}
```

- [ ] **Step 4: Fitting and colours**

`src/editor/hero/importPicture.ts`:

```ts
import { MAX_COLOURS, PICTURE_SIZES, type HeroPicture } from "@/model/hero";
import { colourDistance, nearestIndex, PALETTE_RGB } from "@/model/palette";

// Turning a picture into a hero picture: fit it, keep its see-through parts, snap it to the 8-bit
// palette and fit it into the hero's colours. Plain code on RGBA pixels, so it can be tested
// without a browser.

export type RawImage = { width: number; height: number; data: ArrayLike<number> }; // RGBA, row by row
export type Imported = { rows: string[]; colours: number[] };

type Rgb = [number, number, number];

const OPAQUE = 128; // alpha at or above this is a pixel; below it is see-through
const SAME = 24; // colours within this (channels summed) count as one background
const CLOSE = 2000; // a palette colour this close to a hero colour reuses it

function pixel(image: RawImage, x: number, y: number): [number, number, number, number] {
  const i = (y * image.width + x) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
}

const near = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= SAME;

export function hasTransparency(image: RawImage): boolean {
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i] < OPAQUE) return true;
  return false;
}

// The background colour, when the picture has no see-through pixels and its four corners share a colour.
export function backgroundOf(image: RawImage): Rgb | null {
  if (image.width === 0 || image.height === 0 || hasTransparency(image)) return null;
  const { width: w, height: h } = image;
  const corners = [pixel(image, 0, 0), pixel(image, w - 1, 0), pixel(image, 0, h - 1), pixel(image, w - 1, h - 1)];
  if (!corners.every((c) => near(c, corners[0]))) return null;
  return [corners[0][0], corners[0][1], corners[0][2]];
}

export function importPicture(image: RawImage, picture: HeroPicture, colours: number[], removeBackground: boolean): Imported {
  const { w, h } = PICTURE_SIZES[picture];
  const scale = Math.min(w / image.width, h / image.height);
  const tw = Math.max(1, Math.min(w, Math.round(image.width * scale)));
  const th = Math.max(1, Math.min(h, Math.round(image.height * scale)));
  const left = Math.floor((w - tw) / 2);
  const shot = picture === "shot" || picture === "chargedShot";
  const top = shot ? Math.floor((h - th) / 2) : h - th; // poses stand on the feet line
  const key = removeBackground ? backgroundOf(image) : null;

  // Each frame pixel takes the palette colour most of its block of source pixels snaps to.
  const snapped = new Map<number, number>();
  const snap = (r: number, g: number, b: number) => {
    const k = (r << 16) | (g << 8) | b;
    let index = snapped.get(k);
    if (index === undefined) {
      index = nearestIndex(r, g, b);
      snapped.set(k, index);
    }
    return index;
  };
  const grid: (number | null)[][] = Array.from({ length: h }, () => new Array<number | null>(w).fill(null));
  const counts = new Map<number, number>();
  for (let ty = 0; ty < th; ty++) {
    const sy0 = Math.floor((ty * image.height) / th);
    const sy1 = Math.max(sy0 + 1, Math.floor(((ty + 1) * image.height) / th));
    for (let tx = 0; tx < tw; tx++) {
      const sx0 = Math.floor((tx * image.width) / tw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((tx + 1) * image.width) / tw));
      const votes = new Map<number, number>(); // palette index, or -1 for empty
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const p = pixel(image, sx, sy);
          const vote = p[3] < OPAQUE || (key && near(p, key)) ? -1 : snap(p[0], p[1], p[2]);
          votes.set(vote, (votes.get(vote) ?? 0) + 1);
        }
      }
      let winner = -1;
      let most = 0;
      for (const [vote, count] of votes) {
        if (count > most) {
          most = count;
          winner = vote;
        }
      }
      if (winner < 0) continue;
      grid[top + ty][left + tx] = winner;
      counts.set(winner, (counts.get(winner) ?? 0) + 1);
    }
  }

  // Fit the picture's colours into the hero's: reuse, add up to eight, then merge.
  const next = [...colours];
  const slotOf = new Map<number, number>();
  const used = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([index]) => index);
  for (const index of used) {
    let slot = next.indexOf(index);
    if (slot < 0) {
      let nearest = 0;
      let distance = Infinity;
      next.forEach((colour, s) => {
        const d = colourDistance(PALETTE_RGB[colour], PALETTE_RGB[index]);
        if (d < distance) {
          distance = d;
          nearest = s;
        }
      });
      if (distance <= CLOSE || next.length >= MAX_COLOURS) slot = nearest;
      else {
        next.push(index);
        slot = next.length - 1;
      }
    }
    slotOf.set(index, slot);
  }

  return {
    rows: grid.map((row) => row.map((c) => (c === null ? "." : String(slotOf.get(c)! + 1))).join("")),
    colours: next,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/editor/importPicture.test.ts tests/model && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/model/palette.ts src/editor/hero/importPicture.ts tests/editor/importPicture.test.ts tests/model/palette.test.ts
git commit -m "feat: fit a picture into a hero pose: shape, see-through, background, 8-bit colours"
```

---

### Task 2: Import picture on the hero screen

**Files:**
- Create: `src/editor/hero/readPicture.ts`, `src/editor/components/ImportDialog.tsx`
- Modify: `src/editor/components/HeroScreen.tsx`, `src/editor/Editor.tsx`, `src/editor/editor.module.css`
- Test: `tests/editor/heroImport.test.tsx`

**Interfaces:**
- Consumes: Task 1; `setHeroColours`, `setHeroPose` (plan 1); `HeroScreen` (plan 3)
- Produces:
  - `MAX_FILE_BYTES = 5 * 1024 * 1024`, `NOT_A_PICTURE`, `readPicture(file: File): Promise<RawImage>` (rejects with `NOT_A_PICTURE` for big or unreadable files)
  - `ImportDialog` props `{ picture: HeroPicture; colours: number[]; image: RawImage; onUse(result: Imported): void; onCancel(): void }`; a `role="dialog"` named "Import a picture into Stand" (or the picture's name)
  - `HeroScreen` and `Editor` gain an optional prop `readPicture?: (file: File) => Promise<RawImage>` (default: the browser one)
  - the hero screen's file input is labelled "Picture file"; its button reads "Import picture"

- [ ] **Step 1: Write the failing test**

`tests/editor/heroImport.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { Editor } from "@/editor/Editor";
import type { RawImage } from "@/editor/hero/importPicture";
import { MAX_FILE_BYTES, NOT_A_PICTURE, readPicture } from "@/editor/hero/readPicture";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(cleanup);

let n = 0;
const makeId = () => `id-${++n}`;

// A 16 by 24 picture: see-through, with a red block, or on a white background.
function picture(background: "clear" | "white"): RawImage {
  const data: number[] = [];
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 16; x++) {
      const block = x >= 4 && x < 12 && y >= 8;
      if (block) data.push(248, 56, 0, 255);
      else if (background === "white") data.push(248, 248, 248, 255);
      else data.push(0, 0, 0, 0);
    }
  }
  return { width: 16, height: 24, data };
}

function setup(read: (file: File) => Promise<RawImage>) {
  const initial = newProject("Import", makeId);
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const view = render(<Editor initial={initial} store={{ save }} makeId={makeId} saveDelay={60_000} readPicture={read} />);
  const saved = (): Project => {
    view.unmount();
    return save.mock.calls.at(-1)?.[0] ?? initial;
  };
  const choose = async () => {
    await userEvent.click(screen.getByRole("button", { name: "Hero" }));
    await userEvent.upload(screen.getByLabelText("Picture file"), new File(["x"], "hero.png", { type: "image/png" }));
  };
  return { saved, choose };
}

describe("importing a picture", () => {
  it("shows before and after, and puts the picture in the pose as one undo step", async () => {
    const { saved, choose } = setup(async () => picture("clear"));
    await choose();
    expect(screen.getByRole("dialog", { name: "Import a picture into Stand" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Remove background" })).toBeNull(); // already see-through
    expect(screen.getByText("This adds 1 colour to your hero.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Redo" }));
    const look = saved().hero.look;
    expect(look.colours).toHaveLength(8);
    expect(look.poses.stand[8]).toBe("....88888888....");
    expect(look.poses.stand[0]).toBe("................");
  });

  it("undoes the colours and the picture together", async () => {
    const { saved, choose } = setup(async () => picture("clear"));
    await choose();
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().hero.look).toEqual(snowHero);
  });

  it("changes nothing on Cancel", async () => {
    const { saved, choose } = setup(async () => picture("clear"));
    await choose();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saved().hero.look).toEqual(snowHero);
  });

  it("removes a plain background unless told not to", async () => {
    const removed = setup(async () => picture("white"));
    await removed.choose();
    expect(screen.getByRole("checkbox", { name: "Remove background" })).toHaveProperty("checked", true);
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(removed.saved().hero.look.poses.stand[0]).toBe("................");
    cleanup();

    const kept = setup(async () => picture("white"));
    await kept.choose();
    await userEvent.click(screen.getByRole("checkbox", { name: "Remove background" }));
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(kept.saved().hero.look.poses.stand[0]).toBe("4444444444444444"); // white is the snow hero's colour 4
  });

  it("says plainly when a file isn't a picture, and changes nothing", async () => {
    const { saved, choose } = setup(async () => {
      throw new Error(NOT_A_PICTURE);
    });
    await choose();
    expect((await screen.findByRole("alert")).textContent).toContain("That file isn't a picture we can use. Try a PNG.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saved().hero.look).toEqual(snowHero);
  });
});

describe("readPicture", () => {
  it("refuses files over 5 MB", async () => {
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "huge.png", { type: "image/png" });
    await expect(readPicture(big)).rejects.toThrow(NOT_A_PICTURE);
  });

  it("refuses files the browser can't read as a picture", async () => {
    await expect(readPicture(new File(["not a picture"], "notes.txt", { type: "text/plain" }))).rejects.toThrow(NOT_A_PICTURE);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/editor/heroImport.test.tsx`
Expected: FAIL (`@/editor/hero/readPicture` cannot be resolved).

- [ ] **Step 3: Reading a file**

`src/editor/hero/readPicture.ts`:

```ts
import type { RawImage } from "./importPicture";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const NOT_A_PICTURE = "That file isn't a picture we can use. Try a PNG.";

const MAX_SIDE = 256; // very large pictures are shrunk on the way in, so importing stays quick

// Reads a picture file into RGBA pixels, using the browser to decode it.
export async function readPicture(file: File): Promise<RawImage> {
  if (file.size > MAX_FILE_BYTES || typeof createImageBitmap !== "function") throw new Error(NOT_A_PICTURE);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(NOT_A_PICTURE);
  }
  try {
    if (bitmap.width === 0 || bitmap.height === 0) throw new Error(NOT_A_PICTURE);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(NOT_A_PICTURE);
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return { width, height, data: ctx.getImageData(0, 0, width, height).data };
  } finally {
    bitmap.close();
  }
}
```

- [ ] **Step 4: The dialog**

`src/editor/components/ImportDialog.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PICTURE_NAMES, type HeroPicture } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import styles from "../editor.module.css";
import { backgroundOf, importPicture, type Imported, type RawImage } from "../hero/importPicture";

type Props = {
  picture: HeroPicture;
  colours: number[];
  image: RawImage;
  onUse(result: Imported): void;
  onCancel(): void;
};

// The picture as chosen.
function Before({ image }: { image: RawImage }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  }, [image]);
  return <canvas ref={ref} width={image.width} height={image.height} className={styles.importPreview} aria-hidden="true" />;
}

// The picture as it will be, in the hero's colours.
function After({ rows, colours }: Imported) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, rows[0].length, rows.length);
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === ".") return;
        ctx.fillStyle = PALETTE_8BIT[colours[Number(ch) - 1]];
        ctx.fillRect(x, y, 1, 1);
      }),
    );
  }, [rows, colours]);
  return <canvas ref={ref} width={rows[0].length} height={rows.length} className={styles.importPreview} aria-hidden="true" />;
}

export function ImportDialog({ picture, colours, image, onUse, onCancel }: Props) {
  const background = useMemo(() => backgroundOf(image), [image]);
  const [remove, setRemove] = useState(background !== null);
  const result = useMemo(() => importPicture(image, picture, colours, remove), [image, picture, colours, remove]);
  const added = result.colours.length - colours.length;
  const use = useRef<HTMLButtonElement>(null);
  useEffect(() => use.current?.focus(), []);

  return (
    <div className={styles.overlay}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className={styles.dialog}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        <h3 id="import-title" className={styles.heroHeading}>
          Import a picture into {PICTURE_NAMES[picture]}
        </h3>
        <div className={styles.beforeAfter}>
          <figure>
            <Before image={image} />
            <figcaption>Before</figcaption>
          </figure>
          <figure>
            <After {...result} />
            <figcaption>After</figcaption>
          </figure>
        </div>
        {background !== null && (
          <label className={styles.check}>
            <input type="checkbox" checked={remove} onChange={(e) => setRemove(e.target.checked)} />
            Remove background
          </label>
        )}
        {added > 0 && (
          <p className={styles.note}>
            This adds {added} colour{added === 1 ? "" : "s"} to your hero.
          </p>
        )}
        <div className={styles.drawTools}>
          <button ref={use} type="button" className={styles.primary} onClick={() => onUse(result)}>
            Use this
          </button>
          <button type="button" className={styles.swatch} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire it into the hero screen**

In `src/editor/components/HeroScreen.tsx`:
- import `ImportDialog` from `"./ImportDialog"`, `type Imported, type RawImage` from `"../hero/importPicture"`, and `NOT_A_PICTURE, readPicture as readPictureFile` from `"../hero/readPicture"`;
- add `readPicture?: (file: File) => Promise<RawImage>;` to `Props` and take `readPicture = readPictureFile` in the parameters;
- add state and handlers after the stroke handling:

```tsx
  // Importing a picture: read the file, show the dialog, and on "Use this" make it one undo step.
  const [importing, setImporting] = useState<RawImage | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      setImporting(await readPicture(file));
    } catch {
      setImportError(NOT_A_PICTURE);
    }
  };
  const useImport = (result: Imported) => {
    release();
    onBegin("Import a picture");
    if (result.colours.length !== look.colours.length) {
      onCommand({ name: "setHeroColours", args: { colours: result.colours } });
    }
    onCommand({ name: "setHeroPose", args: { picture, rows: result.rows } });
    onCommit();
    setImporting(null);
  };
```

- show the import error with the other error, just after the existing `{error && …}` alert:

```tsx
      {importError && (
        <p className={styles.alert} role="alert">
          {importError}
          <button type="button" onClick={() => setImportError(null)}>
            Dismiss
          </button>
        </p>
      )}
```

- add, at the end of the "Picture tools" group:

```tsx
          <button type="button" className={styles.swatch} onClick={() => fileInput.current?.click()}>
            Import picture
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            aria-label="Picture file"
            className={styles.fileInput}
            onChange={(e) => {
              void pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
```

- and, as the last child of the fieldset:

```tsx
      {importing && (
        <ImportDialog
          picture={picture}
          colours={look.colours}
          image={importing}
          onUse={useImport}
          onCancel={() => setImporting(null)}
        />
      )}
```

In `src/editor/Editor.tsx`, add `readPicture?: (file: File) => Promise<RawImage>;` to `Props` (importing `type RawImage` from `"./hero/importPicture"`), take `readPicture` in the parameters, and pass `readPicture={readPicture}` to `HeroScreen`.

Add to `src/editor/editor.module.css`:

```css
/* Importing a picture */
.fileInput {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}
.overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(16 33 58 / 0.6);
  z-index: 10;
}
.dialog {
  background: var(--paper);
  color: var(--ink);
  border-radius: 14px;
  padding: 1.25rem;
  width: min(30rem, calc(100vw - 2rem));
  display: grid;
  gap: 0.75rem;
}
.beforeAfter {
  display: flex;
  gap: 1.5rem;
}
.beforeAfter figure {
  margin: 0;
  display: grid;
  justify-items: center;
  gap: 0.3rem;
}
.importPreview {
  width: 96px;
  height: 144px;
  object-fit: contain;
  image-rendering: pixelated;
  background: #fff;
  border: 2px solid var(--panel);
  border-radius: 6px;
}
.check {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A src tests
git commit -m "feat: import a picture into a hero pose, with a before and after view"
```

---

### Task 3: Importing in a real browser, and the status

**Files:**
- Modify: `e2e/hero.spec.ts`, `docs/superpowers/status.md`

**Interfaces:**
- Consumes: Tasks 1 and 2.

- [ ] **Step 1: Add the browser test**

Add to `e2e/hero.spec.ts`:

```ts
test("import a picture into the hero", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("Imported Hero");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Hero" }).click();

  // A real PNG: 32 by 48, see-through, with a red block in the lower half.
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f83800";
    ctx.fillRect(8, 16, 16, 32);
    return canvas.toDataURL("image/png");
  });
  await page.getByLabel("Picture file").setInputFiles({
    name: "hero.png",
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByRole("dialog", { name: "Import a picture into Stand" })).toBeVisible();
  await page.screenshot({ path: "test-results/hero-import.png" });
  await page.getByRole("button", { name: "Use this" }).click();
  await expect.poll(async () => (await saved(page)).hero.look.poses.stand[8]).toBe("....88888888....");
});
```

- [ ] **Step 2: Run the browser tests**

Run: `npm run e2e`
Expected: 10 passed. Look at `test-results/hero-import.png`: the dialog shows the picture before and after.

- [ ] **Step 3: Update the status**

In `docs/superpowers/status.md`: mark this plan implemented, reviewed and merged in the table; add to the hero screen sentence "or import a picture and touch it up"; update the test counts; add this plan's deferred review findings.

- [ ] **Step 4: Commit**

```bash
git add e2e/hero.spec.ts docs/superpowers/status.md
git commit -m "test: import a real picture into the hero in a browser"
```

---

## Self-review

- **Spec coverage (section 7):** choosing a picture up to 5 MB → Task 2; fitting keeping its shape, bottom on the feet line → Task 1; see-through kept, "Remove background" toggle on by default when corners share a colour → Tasks 1 and 2; snapping to the palette, reusing close slots, adding up to eight, merging beyond → Task 1; before/after, "Use this" as one undo step, "Cancel" changing nothing → Task 2; plain code on pixel arrays, only reading the file uses the browser → Tasks 1 and 2. Section 9's import rows → Task 2. Section 10's import tests → Tasks 1–3.
- **Types:** `RawImage`, `Imported`, `importPicture`, `backgroundOf`, `readPicture`, `NOT_A_PICTURE` are defined once and used with the same names.
- **Known limits, accepted:** a picture always goes into the current pose (no sprite sheets); pictures larger than 256 pixels are shrunk by the browser before the colour vote; the merge picks the nearest colour by eye-distance, which can be surprising for a picture with many colours (the before/after view shows it first).
