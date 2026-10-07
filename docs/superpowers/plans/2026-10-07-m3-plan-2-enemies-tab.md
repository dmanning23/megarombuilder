# The Characters Screen and the Enemies Tab Implementation Plan (Milestone 3, Plan 2 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The toolbar's Hero button becomes Characters, a screen with Hero and Enemies tabs. On the Enemies tab a kid makes their own enemies (behaviour and name), tunes them with step buttons, draws or imports their two frames, watches them in a live preview, and deletes them; the palette lists them first, marked "Yours", ready to place.

**Architecture:** The hero screen's drawing area (canvas, tools, Copy from, Flip, Clear, Import picture, the import dialog and the stroke lifecycle) becomes a shared `PictureEditor`, given a picture's rows, size and body outline and told how to save; it is rendered with the picture as its key, so a new picture is a new editor and an unfinished stroke ends as one undo step. `HeroColours` becomes `Colours`; `HeroPreview` becomes `GamePreview`, given how to start a game and which inputs to play. The Enemies tab composes these with plan 1's enemy commands.

**Tech Stack:** as plan 1. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-milestone-3-your-own-enemies-and-boss-design.md` (section 6: the Characters screen, the Enemies tab, the palette; sections 8 and 9 where they cover them; build order item 2)

**Plan series for milestone 3:**

1. Enemy data, the game pack, and drawing own enemies (done)
2. The Characters screen and the Enemies tab (this plan)
3. Boss data and the new boss attacks
4. The Boss tab
5. The assistant

## Global Constraints

- Every change is a command; a drawing stroke is one undo step; an import is one undo step.
- The hero screen behaves exactly as before (its tests keep passing, with the button renamed).
- Everything works with mouse, pen, finger and keyboard; screens lock while the assistant works.
- Interface text is short, plain and in sentence case, for young users.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **Behaviour names for kids:** Walker, Flyer, Turret, Hopper (jumper), Shield guard (shielded), Dropper.
- **New enemy** opens a small form: a name box (empty means "Enemy N", the smallest free number) and the six behaviour buttons; choosing a behaviour makes the enemy and selects it.
- **Tuning** shows only the steps its behaviour uses (plan 1's `TUNING_USED`): Health "1 hit / 2 hits / 3 hits / 5 hits", Damage, Speed and Shoots as Low/Normal/High, Slow/Normal/Fast, Rarely/Sometimes/Often.
- **The name** is saved when the box loses focus or Enter is pressed, if it changed; a refused name shows the command's message.
- **Frames** are chosen with "Frame 1" and "Frame 2" buttons; "Copy from" offers the other frame.
- **The enemy's canvas outline** is its behaviour's body, bottom-centred in the 16×16 frame, as the game draws it.
- **The enemy preview** is a one-screen game with the hero standing at the left and the enemy placed where its behaviour shows best (on the floor for walkers, turrets, hoppers and shield guards; in the air for flyers; above the hero for droppers), restarting every six seconds or when the hero is defeated.
- **The palette** lists the kid's enemies first under "Enemies and items", with their own first frame as the swatch and "Yours" after the name.
- **The Boss tab** is plan 4; this plan's Characters screen has two tabs.

## Review Focus

1. **Switching tabs, enemies or frames in the middle of a stroke**: the stroke ends as one undo step in its own picture. Tested in Tasks 1 and 4.
2. **Deleting the selected enemy, or one that is placed**: the selection moves to another enemy (or the empty state), and a placed enemy's refusal is shown plainly. Tested in Task 4.
3. **A name that clashes or is blank**: the clash's message is shown and the name is unchanged; blank names are not sent. Tested in Task 4.
4. **Changing behaviour**: the tuning shown changes to the steps that behaviour uses, and the drawing stays. Tested in Task 4.
5. **The twelfth enemy**: New enemy turns off with "12 is the most". Tested in Task 4.

## File Structure

```
src/runtime/sim/entities/spawn.ts          bodySize(behaviour)
src/editor/hero/pixels.ts                  drawPixels (any size and body), enemyBody; drawPicture uses drawPixels
src/editor/hero/importPicture.ts           ImportTarget: a hero picture, or a size and whether it stands on the feet line
src/editor/hero/preview.ts                 enemyPreviewSim, IDLE_INPUTS
src/editor/components/PixelCanvas.tsx      (was HeroCanvas) any picture size and body
src/editor/components/PictureEditor.tsx    canvas, tools, picture tools, import, stroke lifecycle
src/editor/components/Colours.tsx          (was HeroColours)
src/editor/components/GamePreview.tsx      (was HeroPreview) any game and inputs
src/editor/components/ImportDialog.tsx     a title and an import target
src/editor/components/HeroScreen.tsx       uses the shared pieces
src/editor/components/EnemiesScreen.tsx    the Enemies tab
src/editor/components/CharactersScreen.tsx Hero and Enemies tabs
src/editor/components/Palette.tsx          own enemies first, "Yours"
src/editor/components/Toolbar.tsx          Characters / Level
src/editor/Editor.tsx                      the Characters screen; the palette gets the game pack and own art
tests/...                                  named in each task; e2e/enemies.spec.ts
```

---

### Task 1: Shared picture pieces

**Files:**
- Modify: `src/runtime/sim/entities/spawn.ts`, `src/editor/hero/pixels.ts`, `src/editor/hero/importPicture.ts`, `src/editor/components/ImportDialog.tsx`, `src/editor/components/HeroScreen.tsx`
- Create: `src/editor/components/PixelCanvas.tsx`, `src/editor/components/PictureEditor.tsx`
- Rename: `src/editor/components/HeroCanvas.tsx` → (deleted; replaced by `PixelCanvas`), `src/editor/components/HeroColours.tsx` → `src/editor/components/Colours.tsx` (component `Colours`)
- Test: additions to `tests/editor/heroPixels.test.ts`, `tests/editor/importPicture.test.ts`

**Interfaces:**
- Consumes: milestone 2's hero screen pieces; `ENEMY_FRAME`, `EnemyBehaviour` (plan 1)
- Produces:
  - `bodySize(behaviour: ThingBehaviour): { w: number; h: number }` (spawn.ts)
  - `type Box = { x: number; y: number; w: number; h: number }`; `drawPixels(ctx: PixelCtx, rows: string[], palette: Record<string, string>, size: { w: number; h: number }, body: Box, feet: boolean): void`; `enemyBody(behaviour: EnemyBehaviour): Box`
  - `type ImportTarget = HeroPicture | { w: number; h: number; stand: boolean }`; `importPicture(image, target: ImportTarget, colours, removeBackground)`
  - `ImportDialog` props `{ title: string; target: ImportTarget; colours; image; onUse; onCancel }`
  - `PixelCanvas` props `{ rows; palette; size; body; feet; name; testId; onPress; onDrag; onRelease }` (role `img`, named "<name>, W by H pixels")
  - `type DrawTool`; `PictureEditor` props `{ name; rows; palette; size; body; feet; testId; colours; tool; onTool; slot; onSlot; partners: { id: string; name: string; rows: string[] }[]; importTarget; readPicture; locked; onRows(rows); onImport(result: Imported); onBegin(label); onCommit() }`
  - `Colours` (unchanged props)

- [ ] **Step 1: Write the failing tests**

Add to `tests/editor/heroPixels.test.ts` (importing `drawPixels`, `enemyBody`):

```ts
describe("enemy pictures", () => {
  it("know where each behaviour's body sits in a 16 by 16 frame", () => {
    expect(enemyBody("walker")).toEqual({ x: 1, y: 2, w: 14, h: 14 });
    expect(enemyBody("flyer")).toEqual({ x: 1, y: 4, w: 14, h: 12 });
    expect(enemyBody("shielded")).toEqual({ x: 1, y: 0, w: 14, h: 16 });
  });

  it("are drawn at any size, with the body outline and feet line", () => {
    const rects: { colour: string; x: number; y: number; w: number; h: number }[] = [];
    const ctx = {
      fillStyle: "" as string,
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ colour: this.fillStyle, x, y, w, h });
      },
    };
    drawPixels(ctx, blankRows(16, 16), {}, { w: 16, h: 16 }, enemyBody("walker"), true);
    expect(rects.some((r) => r.colour === "#ff2d95" && r.x === 1 * ZOOM && r.y === 2 * ZOOM && r.h === 14 * ZOOM)).toBe(true);
    expect(rects.some((r) => r.colour === "#2ec4b6" && r.y === 16 * ZOOM - 3)).toBe(true);
  });
});
```

Add to `tests/editor/importPicture.test.ts`:

```ts
describe("import targets", () => {
  it("fit a picture into any size, standing on its feet or centred", () => {
    const standing = importPicture(image(solid(4, 4, "r")), { w: 16, h: 16, stand: true }, [13], false);
    expect(standing.rows).toHaveLength(16);
    expect(standing.rows[15]).toBe("2222222222222222");
    const centred = importPicture(image(solid(4, 2, "r")), { w: 8, h: 8, stand: false }, [13], false);
    expect(centred.rows.map((row) => row.includes("2"))).toEqual([false, false, true, true, true, true, false, false]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/heroPixels.test.ts tests/editor/importPicture.test.ts`
Expected: FAIL (`enemyBody`, `drawPixels` are not exported; `importPicture` does not take a size).

- [ ] **Step 3: Body sizes, drawing at any size, import targets**

In `src/runtime/sim/entities/spawn.ts`, export the body size:

```ts
// How big each kind of thing's body is, in pixels.
export function bodySize(behaviour: ThingBehaviour): { w: number; h: number } {
  const [w, h] = SIZES[behaviour];
  return { w, h };
}
```

In `src/editor/hero/pixels.ts`:
- `import { ENEMY_FRAME, type EnemyBehaviour } from "@/model/designs";` and `import { bodySize } from "@/runtime/sim/entities/spawn";`
- add `export type Box = { x: number; y: number; w: number; h: number };` and use it as `bodyBox`'s return type;
- add, after `bodyBox`:

```ts
// Where an enemy's body sits in its frame: bottom-centred, as the game draws it.
export function enemyBody(behaviour: EnemyBehaviour): Box {
  const { w, h } = bodySize(behaviour);
  return { x: Math.round((ENEMY_FRAME.w - w) / 2), y: ENEMY_FRAME.h - h, w, h };
}
```

- rename the body of `drawPicture` into `drawPixels`, taking the size, the body and whether to draw the feet line, and make `drawPicture` call it:

```ts
// Draws a picture big, with a light grid, the body's outline, and the feet line or the box's bottom edge.
export function drawPixels(
  ctx: PixelCtx,
  rows: string[],
  palette: Record<string, string>,
  size: { w: number; h: number },
  body: Box,
  feet: boolean,
): void {
  const { w, h } = size;
  // …the old drawPicture body, unchanged, with `bodyBox(picture)` replaced by `body` and the
  // `picture !== "shot" && picture !== "chargedShot"` test replaced by `feet`…
}

export function drawPicture(ctx: PixelCtx, rows: string[], palette: Record<string, string>, picture: HeroPicture): void {
  drawPixels(ctx, rows, palette, PICTURE_SIZES[picture], bodyBox(picture), picture !== "shot" && picture !== "chargedShot");
}
```

In `src/editor/hero/importPicture.ts`, accept a size as well as a hero picture:

```ts
// Where an imported picture goes: one of the hero's pictures, or a frame of a size that stands on
// the feet line (or is centred).
export type ImportTarget = HeroPicture | { w: number; h: number; stand: boolean };

function frameOf(target: ImportTarget): { w: number; h: number; stand: boolean } {
  if (typeof target !== "string") return target;
  return { ...PICTURE_SIZES[target], stand: target !== "shot" && target !== "chargedShot" };
}
```

and in `importPicture`, change the `picture: HeroPicture` parameter to `target: ImportTarget`, start with `const { w, h, stand } = frameOf(target);`, and replace the `shot` test with `stand`: `const top = stand ? h - th : Math.floor((h - th) / 2);`.

- [ ] **Step 4: The shared pieces**

`src/editor/components/PixelCanvas.tsx`: `HeroCanvas.tsx`'s component, renamed `PixelCanvas`, taking `size`, `body`, `feet`, `name` and `testId` instead of `picture`:

```tsx
type Props = {
  rows: string[];
  palette: Record<string, string>;
  size: { w: number; h: number };
  body: Box;
  feet: boolean;
  name: string; // "Stand", "Frame 1"
  testId: string;
  onPress(p: Pixel): void;
  onDrag(p: Pixel, fresh: boolean): void;
  onRelease(): void;
};
```

using `const { w, h } = size;`, drawing with `drawPixels(ctx, rows, palette, size, body, feet)` (effect dependencies `[rows, palette, size, body, feet]`), and with `data-testid={testId}` and `aria-label={`${name}, ${w} by ${h} pixels`}`. Delete `HeroCanvas.tsx`.

Rename `src/editor/components/HeroColours.tsx` to `Colours.tsx` and its component to `Colours`.

`src/editor/components/PictureEditor.tsx`: the hero screen's drawing area, for any picture:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../editor.module.css";
import type { Imported, ImportTarget, RawImage } from "../hero/importPicture";
import { blankRows, flipRows, floodFill, linePixels, setPixels, type Box, type Pixel } from "../hero/pixels";
import { NOT_A_PICTURE } from "../hero/readPicture";
import { ImportDialog } from "./ImportDialog";
import { PixelCanvas } from "./PixelCanvas";

export type DrawTool = "pencil" | "eraser" | "fill" | "pick";

const TOOLS: { id: DrawTool; label: string }[] = [
  { id: "pencil", label: "Pencil" },
  { id: "eraser", label: "Eraser" },
  { id: "fill", label: "Fill" },
  { id: "pick", label: "Pick colour" },
];

type Props = {
  name: string;
  rows: string[];
  palette: Record<string, string>;
  size: { w: number; h: number };
  body: Box;
  feet: boolean;
  testId: string;
  colours: number[];
  tool: DrawTool;
  onTool(tool: DrawTool): void;
  slot: number; // the chosen colour, from 1
  onSlot(slot: number): void;
  partners: { id: string; name: string; rows: string[] }[]; // pictures of the same size, to copy from
  importTarget: ImportTarget;
  readPicture(file: File): Promise<RawImage>;
  locked: boolean;
  onRows(rows: string[]): void; // save this picture
  onImport(result: Imported): void; // save an import (colours, then rows), inside a group
  onBegin(label: string): void;
  onCommit(): void;
};

// One picture's drawing area. Render it with the picture as its key: a new picture is a new
// editor, and a stroke left open on the old one ends as one undo step when it goes.
export function PictureEditor({
  name,
  rows,
  palette,
  size,
  body,
  feet,
  testId,
  colours,
  tool,
  onTool,
  slot,
  onSlot,
  partners,
  importTarget,
  readPicture,
  locked,
  onRows,
  onImport,
  onBegin,
  onCommit,
}: Props) {
  const colour = Math.min(slot, colours.length); // the chosen colour may have been removed
  const ink = tool === "eraser" ? "." : String(colour);
  const stroke = useRef<{ rows: string[]; last: Pixel } | null>(null);

  const press = (p: Pixel) => {
    if (locked) return;
    if (tool === "pick") {
      const ch = rows[p.y][p.x];
      if (ch !== ".") onSlot(Number(ch));
      return;
    }
    if (tool === "fill") {
      onRows(floodFill(rows, p, String(colour)));
      return;
    }
    onBegin(tool === "eraser" ? "Erase" : "Draw");
    const next = setPixels(rows, [p], ink);
    stroke.current = { rows: next, last: p };
    onRows(next);
  };
  const drag = (p: Pixel, fresh: boolean) => {
    const current = stroke.current;
    if (!current) return;
    const next = setPixels(current.rows, fresh ? [p] : linePixels(current.last, p), ink);
    stroke.current = { rows: next, last: p };
    onRows(next);
  };
  const release = () => {
    if (!stroke.current) return;
    stroke.current = null;
    onCommit();
  };

  // Going away mid-stroke (another picture, another tab, the level) ends the stroke as one undo step.
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });
  useEffect(() => {
    const open = stroke;
    const commit = commitRef;
    return () => {
      if (!open.current) return;
      open.current = null;
      commit.current();
    };
  }, []);

  // Importing a picture: read the file, show the dialog, and on "Use this" make it one undo step.
  const [importing, setImporting] = useState<RawImage | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const wasImporting = useRef(false);
  useEffect(() => {
    if (wasImporting.current && !importing) importButton.current?.focus();
    wasImporting.current = importing !== null;
  }, [importing]);
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
    onImport(result);
    onCommit();
    setImporting(null);
  };

  return (
    <div className={styles.drawing}>
      {importError && (
        <p className={styles.alert} role="alert">
          {importError}
          <button type="button" onClick={() => setImportError(null)}>
            Dismiss
          </button>
        </p>
      )}
      <PixelCanvas
        rows={rows}
        palette={palette}
        size={size}
        body={body}
        feet={feet}
        name={name}
        testId={testId}
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
            onClick={() => onTool(t.id)}
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
                const from = partners.find((p) => p.id === e.target.value);
                if (from) onRows(from.rows);
              }}
            >
              <option value="">Choose a picture…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className={styles.swatch} onClick={() => onRows(flipRows(rows))}>
          Flip
        </button>
        <button type="button" className={styles.swatch} onClick={() => onRows(blankRows(size.w, size.h))}>
          Clear
        </button>
        <button ref={importButton} type="button" className={styles.swatch} onClick={() => fileInput.current?.click()}>
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
      </div>
      {importing && (
        <ImportDialog
          title={name}
          target={importTarget}
          colours={colours}
          image={importing}
          onUse={useImport}
          onCancel={() => setImporting(null)}
        />
      )}
    </div>
  );
}
```

In `src/editor/components/ImportDialog.tsx`, replace the `picture` prop with `title: string` and `target: ImportTarget`: the heading reads `Import a picture into {title}`, and the result is `importPicture(image, target, colours, remove)` (dependencies `[image, target, colours, remove]`). Remove the `PICTURE_NAMES` and `HeroPicture` imports.

- [ ] **Step 5: The hero screen uses the shared pieces**

In `src/editor/components/HeroScreen.tsx`: keep the props, the error alert, the pictures list, the colours, the preview and the abilities; remove the drawing state and handlers (`stroke`, `press`, `drag`, `release`, the stroke-ending effect, the import state and handlers, `TOOLS`) and the canvas, tool rows and import dialog. Keep `tool` and `slot` as state here (so they survive changing picture). Render, in place of the old `<div className={styles.drawing}>…</div>`:

```tsx
      <PictureEditor
        key={picture}
        name={PICTURE_NAMES[picture]}
        rows={rows}
        palette={sprites.palette}
        size={size}
        body={bodyBox(picture)}
        feet={picture !== "shot" && picture !== "chargedShot"}
        testId="hero-canvas"
        colours={look.colours}
        tool={tool}
        onTool={setTool}
        slot={colour}
        onSlot={setSlot}
        partners={partners.map((p) => ({ id: p, name: PICTURE_NAMES[p], rows: pictureRows(look, p) }))}
        importTarget={picture}
        readPicture={readPicture}
        locked={locked}
        onRows={(next) => onCommand({ name: "setHeroPose", args: { picture, rows: next } })}
        onImport={(result) => {
          if (result.colours.length !== look.colours.length) {
            onCommand({ name: "setHeroColours", args: { colours: result.colours } });
          }
          onCommand({ name: "setHeroPose", args: { picture, rows: result.rows } });
        }}
        onBegin={onBegin}
        onCommit={onCommit}
      />
```

with `const [tool, setTool] = useState<DrawTool>("pencil");`, `const [slot, setSlot] = useState(1);`, `const colour = Math.min(slot, look.colours.length);`, the picture buttons calling `setPicture(p)` directly, `Colours` in place of `HeroColours`, and imports updated (`PictureEditor`, `type DrawTool`, `Colours`, `bodyBox`).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass, including every hero screen, colours and import test unchanged (the canvas's test id and name are the same).

- [ ] **Step 7: Commit**

```bash
git add -A src tests
git commit -m "refactor: share the hero screen's drawing area, colours and import so enemies can use them"
```

---

### Task 2: A preview for any game

**Files:**
- Modify: `src/editor/hero/preview.ts`, `src/editor/components/HeroScreen.tsx`
- Rename: `src/editor/components/HeroPreview.tsx` → `src/editor/components/GamePreview.tsx`
- Modify tests: `tests/editor/heroPreview.test.tsx`
- Test: additions to `tests/editor/heroPreview.test.ts`

**Interfaces:**
- Consumes: plan 1's `ownType`, `EnemyDesign`, `ownSkins`
- Produces:
  - `enemyPreviewSim(enemy: EnemyDesign, hero: Hero, pack: ContentPack): Sim`; `IDLE_INPUTS: Input[]` (360 steps of no input)
  - `GamePreview` props `{ label: string; start: () => Sim; inputs: Input[]; heroLook: HeroLook; enemies: EnemyDesign[]; art?: ArtSet }`

- [ ] **Step 1: Write the failing tests**

Add to `tests/editor/heroPreview.test.ts` (importing `enemyPreviewSim`, `IDLE_INPUTS`, and `defaultTuning`, `ENEMY_BEHAVIOURS`, `type EnemyDesign` from `@/model/designs`, `DEFAULT_ABILITIES` already imported):

```ts
describe("the enemy preview", () => {
  const enemy = (behaviour: (typeof ENEMY_BEHAVIOURS)[number]): EnemyDesign => ({
    id: "e1",
    name: "Frost Fang",
    behaviour,
    tuning: defaultTuning(behaviour),
    look: snowPack.enemyLooks[behaviour],
  });
  const hero = { abilities: DEFAULT_ABILITIES, look: snowHero };

  it("shows every behaviour doing its thing on one screen, with the hero standing still", () => {
    for (const behaviour of ENEMY_BEHAVIOURS) {
      const sim = enemyPreviewSim(enemy(behaviour), hero, snowPack);
      const start = sim.player.x;
      let moved = false;
      let shot = false;
      for (const input of IDLE_INPUTS.slice(0, 180)) {
        step(sim, input);
        const e = sim.slots[0].entity;
        if (e && (e.x !== e.homeX || e.y !== e.homeY)) moved = true;
        if (sim.enemyShots.length > 0) shot = true;
      }
      expect(sim.zoneIndex, behaviour).toBe(0);
      expect(moved || shot, behaviour).toBe(true);
      expect(sim.player.x).toBe(start);
    }
  });

  it("is idle for six seconds", () => {
    expect(IDLE_INPUTS).toHaveLength(360);
  });
});
```

Change `tests/editor/heroPreview.test.tsx` to render `GamePreview`:

```tsx
import { GamePreview } from "@/editor/components/GamePreview";
import { previewInputs, previewSim } from "@/editor/hero/preview";

describe("GamePreview", () => {
  it("shows a game-sized picture of the game, named", () => {
    render(
      <GamePreview
        label="Your hero in action"
        start={() => previewSim(snowHero, DEFAULT_ABILITIES, snowPack)}
        inputs={previewInputs(DEFAULT_ABILITIES)}
        heroLook={snowHero}
        enemies={[]}
        art={snowArt}
      />,
    );
    const canvas = screen.getByRole("img", { name: "Your hero in action" }) as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([256, 240]);
  });
});
```

(replacing the `HeroPreview` import and test).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/heroPreview.test.ts tests/editor/heroPreview.test.tsx`
Expected: FAIL (`enemyPreviewSim` and `GamePreview` don't exist).

- [ ] **Step 3: Write the implementation**

In `src/editor/hero/preview.ts` (importing `ownType` from `"@/model/gamePack"`, `type EnemyBehaviour, type EnemyDesign` from `"@/model/designs"`, `type Hero` from `"@/model/hero"`):

```ts
// Where each behaviour shows best on the preview screen (the hero stands at the left).
const ENEMY_SPOT: Record<EnemyBehaviour, { x: number; y: number }> = {
  walker: { x: 11, y: 12 },
  flyer: { x: 10, y: 8 },
  turret: { x: 12, y: 12 },
  jumper: { x: 11, y: 12 },
  shielded: { x: 11, y: 12 },
  dropper: { x: 1, y: 5 }, // above the hero, so it drops
};

// The enemy preview: one screen, the hero standing still, the enemy doing what it does.
export function enemyPreviewSim(enemy: EnemyDesign, hero: Hero, pack: ContentPack): Sim {
  const spot = ENEMY_SPOT[enemy.behaviour];
  const zone = {
    ...createZone({ id: "preview", name: "Preview" }, pack),
    exit: null,
    things: [{ id: "preview-enemy", type: ownType(enemy.id), x: spot.x, y: spot.y, settings: {} }],
  };
  const level: Level = { id: "preview", name: "Preview", brief: "", zones: [zone], checkpoints: [] };
  const project: Project = {
    ...createProject({ id: "preview", name: "Preview" }, pack),
    hero,
    enemies: [enemy],
    levels: [level],
  };
  return createSim(project, "preview", pack);
}

export const IDLE_INPUTS: Input[] = hold({}, 360);
```

Rename `HeroPreview.tsx` to `GamePreview.tsx`:

```tsx
type Props = {
  label: string;
  start: () => Sim; // a fresh game, each time the show starts again
  inputs: Input[];
  heroLook: HeroLook;
  enemies: EnemyDesign[];
  art?: ArtSet;
};

// Plays a short show over and over, starting again whenever what it shows changes.
export function GamePreview({ label, start, inputs, heroLook, enemies, art }: Props) {
```

The effect builds the skin from `heroLook` (as before) plus `own: ownSkins(enemies, (palette) => createSpriteCache(palette, browserCanvas))`, starts with `let sim = start();`, plays `inputs`, restarts with `sim = start()` (when the inputs run out or the game leaves "play"), and depends on `[start, inputs, heroLook, enemies, art]`. The canvas's `aria-label` is `label`.

In `src/editor/components/HeroScreen.tsx`, replace `<HeroPreview …/>` with:

```tsx
        <GamePreview
          label="Your hero in action"
          start={startPreview}
          inputs={previewShow}
          heroLook={look}
          enemies={[]}
          art={art}
        />
```

with, near the top of the component:

```tsx
  const startPreview = useCallback(() => previewSim(look, abilities, pack), [look, abilities, pack]);
  const previewShow = useMemo(() => previewInputs(abilities), [abilities]);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. If a behaviour does nothing visible in 3 seconds from its spot, move its spot in `ENEMY_SPOT` (not the test) and ledger the change.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: preview any game in the editor, including an enemy doing its thing"
```

---

### Task 3: The Characters screen

**Files:**
- Create: `src/editor/components/CharactersScreen.tsx`
- Modify: `src/editor/components/Toolbar.tsx`, `src/editor/Editor.tsx`, `src/editor/editor.module.css`
- Modify tests: `tests/editor/heroHelpers.tsx`, `tests/editor/heroAbilities.test.tsx`, `tests/editor/palettePieces.test.tsx`, `tests/editor/heroImport.test.tsx`, `tests/editor/components.test.tsx`, `e2e/hero.spec.ts`
- Test: `tests/editor/charactersScreen.test.tsx`

**Interfaces:**
- Consumes: `HeroScreen` (Task 1)
- Produces:
  - `Toolbar`'s `screen` is `"level" | "characters"`; its button reads "Characters" on the level and "Level" on the Characters screen
  - `CharactersScreen` props: `HeroScreen`'s props plus `makeId(): string`; a `role="tablist"` named "Characters" with tabs "Hero" and "Enemies"; the Enemies panel is a placeholder until Task 4

- [ ] **Step 1: Write the failing test, and rename the button in the existing tests**

`tests/editor/charactersScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

describe("the Characters screen", () => {
  it("opens on the Hero tab, and switches to Enemies and back", async () => {
    const { open } = setupHero();
    await open();
    expect(screen.getByRole("tab", { name: "Hero" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("img", { name: "Stand, 16 by 24 pixels" })).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies" }));
    expect(screen.getByRole("tab", { name: "Enemies" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("img", { name: "Stand, 16 by 24 pixels" })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Hero" }));
    expect(screen.getByRole("img", { name: "Stand, 16 by 24 pixels" })).toBeTruthy();
  });

  it("goes back to the level with the Level button", async () => {
    const { open } = setupHero();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Level" }));
    expect(screen.getByTestId("zone-canvas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Characters" })).toBeTruthy();
  });
});
```

Rename the toolbar button in the existing tests: replace `{ name: "Hero" }` with `{ name: "Characters" }` wherever a test clicks the toolbar's Hero button — `tests/editor/heroHelpers.tsx` (`open`), `tests/editor/heroAbilities.test.tsx`, `tests/editor/palettePieces.test.tsx`, `tests/editor/heroImport.test.tsx` and `e2e/hero.spec.ts` (two places). In `tests/editor/components.test.tsx`, the Toolbar test props' `screen: "level" as const` stays valid.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor`
Expected: FAIL (no "Characters" button).

- [ ] **Step 3: Write the implementation**

`src/editor/components/CharactersScreen.tsx`:

```tsx
"use client";

import { useState, type ComponentProps } from "react";
import styles from "../editor.module.css";
import { HeroScreen } from "./HeroScreen";

type Tab = "hero" | "enemies";

const TABS: { id: Tab; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "enemies", label: "Enemies" },
];

type Props = ComponentProps<typeof HeroScreen> & { makeId(): string };

// The kid's characters: their hero, and their own enemies.
export function CharactersScreen({ makeId, ...props }: Props) {
  const [tab, setTab] = useState<Tab>("hero");
  return (
    <div className={styles.characters}>
      <div className={styles.tabs} role="tablist" aria-label="Characters">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`characters-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`characters-panel-${t.id}`}
            className={styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`characters-panel-${tab}`} aria-labelledby={`characters-${tab}`}>
        {tab === "hero" ? <HeroScreen {...props} /> : <p className={styles.note}>Your enemies will be here.</p>}
      </div>
    </div>
  );
}
```

(`makeId` is used from Task 4.)

`src/editor/components/Toolbar.tsx`: change the `screen` type to `"level" | "characters"`, `onScreen` accordingly, and the button:

```tsx
        onClick={() => onScreen(screen === "level" ? "characters" : "level")}
      >
        {screen === "level" ? "Characters" : "Level"}
```

`src/editor/Editor.tsx`: the screen state becomes `useState<"level" | "characters">("level")`; the hero branch becomes `screen === "characters"` and renders `<CharactersScreen … makeId={makeId} />` with the same props it gave `HeroScreen`; `onGoToZone` still sets the screen to `"level"`. Import `CharactersScreen` instead of `HeroScreen`.

Add to `src/editor/editor.module.css`:

```css
.characters {
  display: grid;
  gap: 0.75rem;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests e2e
git commit -m "feat: turn the Hero button into a Characters screen with Hero and Enemies tabs"
```

---

### Task 4: The Enemies tab

**Files:**
- Create: `src/editor/components/EnemiesScreen.tsx`
- Modify: `src/editor/components/CharactersScreen.tsx`, `src/editor/editor.module.css`
- Test: `tests/editor/enemiesScreen.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3; plan 1's enemy commands, `TUNING_USED`, `HEALTH_STEPS` etc., `ENEMY_FRAME`, `MAX_ENEMIES`, `lookArt`
- Produces: `EnemiesScreen` props `{ project; pack; art?; locked; error; onDismissError; onCommand; onBegin; onCommit; confirm; makeId; readPicture? }`

- [ ] **Step 1: Write the failing test**

`tests/editor/enemiesScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand } from "@/commands/registry";
import { snowPack } from "@/content/snow/pack";
import { Editor } from "@/editor/Editor";
import { ZOOM } from "@/editor/hero/pixels";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(cleanup);

let n = 0;
const makeId = () => `id-${++n}`;

function withCommands(project: Project, ...commands: [string, unknown][]): Project {
  for (const [name, args] of commands) {
    const result = applyCommand(project, { name, args }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
  }
  return project;
}

function setup(initial: Project = newProject("Enemies", makeId), confirm = () => true) {
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const view = render(<Editor initial={initial} store={{ save }} makeId={makeId} saveDelay={60_000} confirm={confirm} />);
  const saved = (): Project => {
    view.unmount();
    return save.mock.calls.at(-1)?.[0] ?? initial;
  };
  const open = async () => {
    await userEvent.click(screen.getByRole("button", { name: "Characters" }));
    await userEvent.click(screen.getByRole("tab", { name: "Enemies" }));
  };
  const group = (name: string) => screen.getByRole("group", { name });
  const press = (x: number, y: number) => {
    const el = screen.getByTestId("enemy-canvas") as HTMLCanvasElement;
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: el.width, height: el.height, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const at = { clientX: x * ZOOM + ZOOM / 2, clientY: y * ZOOM + ZOOM / 2, button: 0 };
    fireEvent.pointerDown(el, at);
    fireEvent.pointerUp(el, at);
  };
  return { saved, open, group, press };
}

async function make(name: string, behaviour: string) {
  await userEvent.click(screen.getByRole("button", { name: "New enemy" }));
  if (name) await userEvent.type(screen.getByRole("textbox", { name: "Enemy name" }), name);
  await userEvent.click(within(screen.getByRole("group", { name: "Choose how it behaves" })).getByRole("button", { name: behaviour }));
}

describe("the Enemies tab", () => {
  it("invites the kid to make an enemy", async () => {
    const { open } = setup();
    await open();
    expect(screen.getByText("Make your own enemies to fight. Start with New enemy.")).toBeTruthy();
  });

  it("makes an enemy from the snow drawing for its behaviour, and selects it", async () => {
    const { open, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    expect(screen.getByRole("button", { name: /^Frost Fang/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("img", { name: "Frame 1, 16 by 16 pixels" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Frost Fang in action" })).toBeTruthy();
    const enemy = saved().enemies[0];
    expect(enemy).toMatchObject({ name: "Frost Fang", behaviour: "walker", look: snowPack.enemyLooks.walker });
  });

  it("names a nameless enemy Enemy 1, Enemy 2…", async () => {
    const { open, saved } = setup();
    await open();
    await make("", "Flyer");
    await make("", "Turret");
    expect(saved().enemies.map((e) => e.name)).toEqual(["Enemy 1", "Enemy 2"]);
  });

  it("shows only the tuning its behaviour uses, and tunes it", async () => {
    const { open, group, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    expect(screen.queryByRole("group", { name: "Shoots" })).toBeNull();
    await userEvent.click(within(group("Speed")).getByRole("button", { name: "Fast" }));
    await userEvent.click(within(group("Health")).getByRole("button", { name: "5 hits" }));
    await userEvent.click(within(group("Behaviour")).getByRole("button", { name: "Turret" }));
    expect(screen.getByRole("group", { name: "Shoots" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Speed" })).toBeNull();
    const enemy = saved().enemies[0];
    expect(enemy.behaviour).toBe("turret");
    expect(enemy.tuning).toMatchObject({ speed: "fast", health: 5 });
    expect(enemy.look).toEqual(snowPack.enemyLooks.walker); // the drawing stays
  });

  it("renames, and shows a clashing name's message", async () => {
    const { open, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    await make("Ice Bat", "Flyer");
    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "frost fang{Enter}");
    expect((await screen.findByRole("alert")).textContent).toContain('There is already an enemy called "Frost Fang".');
    await userEvent.clear(name);
    await userEvent.type(name, "Snow Bat{Enter}");
    expect(saved().enemies.map((e) => e.name)).toEqual(["Frost Fang", "Snow Bat"]);
  });

  it("draws on either frame", async () => {
    const { open, press, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    await userEvent.click(screen.getByRole("button", { name: "Frame 2" }));
    expect(screen.getByRole("img", { name: "Frame 2, 16 by 16 pixels" })).toBeTruthy();
    press(0, 0);
    expect(saved().enemies[0].look.frames[1][0][0]).toBe("1");
  });

  it("deletes an enemy after asking, and selects another", async () => {
    const confirm = vi.fn(() => true);
    const { open, saved } = setup(undefined, confirm);
    await open();
    await make("Frost Fang", "Walker");
    await make("Ice Bat", "Flyer");
    await userEvent.click(screen.getByRole("button", { name: "Delete enemy" }));
    expect(confirm).toHaveBeenCalledWith("Delete Ice Bat? You can undo this.");
    expect(screen.getByRole("button", { name: /^Frost Fang/ }).getAttribute("aria-pressed")).toBe("true");
    expect(saved().enemies.map((e) => e.name)).toEqual(["Frost Fang"]);
  });

  it("says plainly why a placed enemy can't be deleted", async () => {
    let project = newProject("Placed", makeId);
    const level = project.levels[0];
    project = withCommands(
      project,
      ["addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" }],
      ["placeThing", { levelId: level.id, zoneId: level.zones[0].id, thingId: "t1", type: "own-e1", x: 6, y: 12 }],
    );
    const { open } = setup(project);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Delete enemy" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Frost Fang is used in Zone 1.");
  });

  it("turns New enemy off at twelve", async () => {
    let project = newProject("Many", makeId);
    for (let i = 0; i < 12; i++) project = withCommands(project, ["addEnemy", { enemyId: `e${i}`, name: `Enemy ${i}`, behaviour: "walker" }]);
    const { open } = setup(project);
    await open();
    expect(screen.getByRole("button", { name: "New enemy" })).toHaveProperty("disabled", true);
    expect(screen.getByText("12 is the most.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/editor/enemiesScreen.test.tsx`
Expected: FAIL (the Enemies tab is a placeholder).

- [ ] **Step 3: Write the implementation**

`src/editor/components/EnemiesScreen.tsx`:

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import {
  DAMAGE_STEPS,
  ENEMY_BEHAVIOURS,
  ENEMY_FRAME,
  HEALTH_STEPS,
  MAX_ENEMIES,
  SHOOT_STEPS,
  SPEED_STEPS,
  TUNING_USED,
  type EnemyBehaviour,
  type EnemyDesign,
  type EnemyTuning,
} from "@/model/designs";
import { tidyName, type Project } from "@/model/schema";
import type { ArtSet } from "@/runtime/render/art";
import { lookArt } from "@/runtime/render/lookArt";
import styles from "../editor.module.css";
import type { RawImage } from "../hero/importPicture";
import { enemyBody } from "../hero/pixels";
import { enemyPreviewSim, IDLE_INPUTS } from "../hero/preview";
import { readPicture as readPictureFile } from "../hero/readPicture";
import { Colours } from "./Colours";
import { GamePreview } from "./GamePreview";
import { SpriteSwatch } from "./Palette";
import { PictureEditor, type DrawTool } from "./PictureEditor";

export const BEHAVIOUR_NAMES: Record<EnemyBehaviour, string> = {
  walker: "Walker",
  flyer: "Flyer",
  turret: "Turret",
  jumper: "Hopper",
  shielded: "Shield guard",
  dropper: "Dropper",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STEP_ROWS: { key: keyof EnemyTuning; label: string; steps: readonly (string | number)[]; name(step: string | number): string }[] = [
  { key: "health", label: "Health", steps: HEALTH_STEPS, name: (s) => (s === 1 ? "1 hit" : `${s} hits`) },
  { key: "damage", label: "Damage", steps: DAMAGE_STEPS, name: (s) => cap(String(s)) },
  { key: "speed", label: "Speed", steps: SPEED_STEPS, name: (s) => cap(String(s)) },
  { key: "shoots", label: "Shoots", steps: SHOOT_STEPS, name: (s) => cap(String(s)) },
];

// "Enemy N" with the smallest N no enemy is called.
function nextName(enemies: EnemyDesign[]): string {
  const taken = new Set(enemies.map((e) => tidyName(e.name).toLowerCase()));
  for (let n = 1; ; n++) if (!taken.has(`enemy ${n}`)) return `Enemy ${n}`;
}

// The enemy doing its thing on one screen, with the hero standing still.
function EnemyPreview({ enemy, project, pack, art }: { enemy: EnemyDesign; project: Project; pack: ContentPack; art?: ArtSet }) {
  const hero = project.hero;
  const start = useCallback(() => enemyPreviewSim(enemy, hero, pack), [enemy, hero, pack]);
  const enemies = useMemo(() => [enemy], [enemy]);
  return (
    <GamePreview
      label={`${tidyName(enemy.name)} in action`}
      start={start}
      inputs={IDLE_INPUTS}
      heroLook={hero.look}
      enemies={enemies}
      art={art}
    />
  );
}

// The name box saves when it loses focus or Enter is pressed, if the name changed.
function NameField({ name, onRename }: { name: string; onRename(name: string): void }) {
  const [text, setText] = useState(name);
  const save = () => {
    if (tidyName(text) && tidyName(text) !== tidyName(name)) onRename(text);
  };
  return (
    <label className={styles.field}>
      Name
      <input
        value={text}
        maxLength={40}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
    </label>
  );
}

type Props = {
  project: Project;
  pack: ContentPack;
  art?: ArtSet;
  locked: boolean;
  error: string | null;
  onDismissError(): void;
  onCommand(command: Command): void;
  onBegin(label: string): void;
  onCommit(): void;
  confirm(message: string): boolean;
  makeId(): string;
  readPicture?: (file: File) => Promise<RawImage>;
};

export function EnemiesScreen({
  project,
  pack,
  art,
  locked,
  error,
  onDismissError,
  onCommand,
  onBegin,
  onCommit,
  confirm,
  makeId,
  readPicture = readPictureFile,
}: Props) {
  const { enemies } = project;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const enemy = enemies.find((e) => e.id === selectedId) ?? enemies[0] ?? null;
  const [making, setMaking] = useState(false);
  const [newName, setNewName] = useState("");
  const [frame, setFrame] = useState<0 | 1>(0);
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [slot, setSlot] = useState(1);
  const arts = useMemo(() => new Map(enemies.map((e) => [e.id, lookArt(e.look)])), [enemies]);

  const create = (behaviour: EnemyBehaviour) => {
    const id = makeId();
    onCommand({ name: "addEnemy", args: { enemyId: id, name: tidyName(newName) || nextName(enemies), behaviour } });
    setSelectedId(id);
    setMaking(false);
    setNewName("");
    setFrame(0);
  };

  return (
    <fieldset className={styles.heroScreen} disabled={locked} aria-label="Your enemies">
      {error && (
        <p className={styles.alert} role="alert">
          {error}
          <button type="button" onClick={onDismissError}>
            Dismiss
          </button>
        </p>
      )}
      <div className={styles.enemyList}>
        <ul className={styles.poses} aria-label="Enemies">
          {enemies.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={styles.swatch}
                aria-pressed={e.id === enemy?.id}
                onClick={() => {
                  setSelectedId(e.id);
                  setFrame(0);
                }}
              >
                <SpriteSwatch sprite={arts.get(e.id)?.frames[0]} palette={arts.get(e.id)?.palette} />
                {tidyName(e.name)}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={styles.swatch}
          disabled={enemies.length >= MAX_ENEMIES}
          onClick={() => setMaking((m) => !m)}
        >
          New enemy
        </button>
        {enemies.length >= MAX_ENEMIES && <p className={styles.note}>12 is the most.</p>}
        {making && (
          <div className={styles.newEnemy}>
            <label className={styles.field}>
              Enemy name
              <input value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <div className={styles.steps} role="group" aria-label="Choose how it behaves">
              {ENEMY_BEHAVIOURS.map((b) => (
                <button key={b} type="button" className={styles.step} onClick={() => create(b)}>
                  {BEHAVIOUR_NAMES[b]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!enemy ? (
        <p className={styles.note}>Make your own enemies to fight. Start with New enemy.</p>
      ) : (
        <>
          <div className={styles.drawing}>
            <NameField
              key={enemy.id}
              name={tidyName(enemy.name)}
              onRename={(name) => onCommand({ name: "renameEnemy", args: { enemyId: enemy.id, name } })}
            />
            <div role="group" aria-label="Behaviour" className={styles.ability}>
              <span className={styles.abilityLabel}>Behaviour</span>
              <div className={styles.steps}>
                {ENEMY_BEHAVIOURS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={styles.step}
                    aria-pressed={enemy.behaviour === b}
                    onClick={() => onCommand({ name: "setEnemyBehaviour", args: { enemyId: enemy.id, behaviour: b } })}
                  >
                    {BEHAVIOUR_NAMES[b]}
                  </button>
                ))}
              </div>
            </div>
            {STEP_ROWS.filter((row) => TUNING_USED[enemy.behaviour].includes(row.key)).map((row) => (
              <div key={row.key} role="group" aria-label={row.label} className={styles.ability}>
                <span className={styles.abilityLabel}>{row.label}</span>
                <div className={styles.steps}>
                  {row.steps.map((step) => (
                    <button
                      key={String(step)}
                      type="button"
                      className={styles.step}
                      aria-pressed={enemy.tuning[row.key] === step}
                      onClick={() => onCommand({ name: "setEnemyTuning", args: { enemyId: enemy.id, [row.key]: step } })}
                    >
                      {row.name(step)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className={styles.drawTools} role="group" aria-label="Frames">
              {([0, 1] as const).map((f) => (
                <button key={f} type="button" className={styles.swatch} aria-pressed={frame === f} onClick={() => setFrame(f)}>
                  Frame {f + 1}
                </button>
              ))}
            </div>
            <PictureEditor
              key={`${enemy.id}:${frame}`}
              name={`Frame ${frame + 1}`}
              rows={enemy.look.frames[frame]}
              palette={arts.get(enemy.id)!.palette}
              size={ENEMY_FRAME}
              body={enemyBody(enemy.behaviour)}
              feet
              testId="enemy-canvas"
              colours={enemy.look.colours}
              tool={tool}
              onTool={setTool}
              slot={Math.min(slot, enemy.look.colours.length)}
              onSlot={setSlot}
              partners={[{ id: String(1 - frame), name: `Frame ${2 - frame}`, rows: enemy.look.frames[1 - frame] }]}
              importTarget={{ ...ENEMY_FRAME, stand: true }}
              readPicture={readPicture}
              locked={locked}
              onRows={(rows) => onCommand({ name: "setEnemyFrame", args: { enemyId: enemy.id, frame, rows } })}
              onImport={(result) => {
                if (result.colours.length !== enemy.look.colours.length) {
                  onCommand({ name: "setEnemyColours", args: { enemyId: enemy.id, colours: result.colours } });
                }
                onCommand({ name: "setEnemyFrame", args: { enemyId: enemy.id, frame, rows: result.rows } });
              }}
              onBegin={onBegin}
              onCommit={onCommit}
            />
          </div>
          <div className={styles.heroSide}>
            <Colours
              colours={enemy.look.colours}
              slot={Math.min(slot, enemy.look.colours.length)}
              onSlot={setSlot}
              onColours={(colours) => onCommand({ name: "setEnemyColours", args: { enemyId: enemy.id, colours } })}
            />
            <EnemyPreview enemy={enemy} project={project} pack={pack} art={art} />
            <button
              type="button"
              className={styles.swatch}
              onClick={() => {
                if (confirm(`Delete ${tidyName(enemy.name)}? You can undo this.`)) {
                  onCommand({ name: "removeEnemy", args: { enemyId: enemy.id } });
                }
              }}
            >
              Delete enemy
            </button>
          </div>
        </>
      )}
    </fieldset>
  );
}
```

In `CharactersScreen.tsx`, render `EnemiesScreen` on the Enemies tab, passing `project`, `pack`, `art`, `locked`, `error`, `onDismissError`, `onCommand`, `onBegin`, `onCommit`, `confirm`, `makeId` and `readPicture` from its props.

Add to `src/editor/editor.module.css`:

```css
.enemyList {
  display: grid;
  gap: 0.5rem;
  align-content: start;
}
.newEnemy {
  display: grid;
  gap: 0.5rem;
  padding: 0.6rem;
  border: 2px dashed var(--panel-2);
  border-radius: 10px;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: add the Enemies tab: make, tune, draw, preview and delete the kid's own enemies"
```

---

### Task 5: The kid's enemies in the palette, and a browser test

**Files:**
- Modify: `src/editor/components/Palette.tsx`, `src/editor/Editor.tsx`, `docs/superpowers/status.md`
- Test: `tests/editor/paletteEnemies.test.tsx`, `e2e/enemies.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–4; plan 1's `gamePack`, `lookArt`, `ownType`
- Produces: `Palette` gains `own?: Record<string, LookArt>` (art by thing type); the Editor gives the palette the game pack and the kid's enemies' art

- [ ] **Step 1: Write the failing tests**

`tests/editor/paletteEnemies.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand } from "@/commands/registry";
import { snowPack } from "@/content/snow/pack";
import { Editor } from "@/editor/Editor";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(cleanup);

function withFang(): Project {
  const project = newProject("Palette", () => `id-${Math.random()}`);
  const result = applyCommand(project, { name: "addEnemy", args: { enemyId: "e1", name: "Frost Fang", behaviour: "walker" } }, { pack: snowPack });
  if (!result.ok) throw new Error(result.error);
  return result.project;
}

describe("the kid's enemies in the palette", () => {
  it("come first, marked Yours, and can be placed", async () => {
    const save = vi.fn<(p: Project) => Promise<void>>(async () => {});
    const view = render(<Editor initial={withFang()} store={{ save }} saveDelay={60_000} />);
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    const swatches = screen.getAllByRole("button").filter((b) => b.className.includes("swatch"));
    expect(swatches[0].textContent).toBe("Frost Fang Yours");
    await userEvent.click(screen.getByRole("button", { name: "Frost Fang Yours" }));
    const canvas = screen.getByTestId("zone-canvas");
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 512, height: 480, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerDown(canvas, { clientX: 6 * 32 + 16, clientY: 12 * 32 + 16, button: 0 });
    fireEvent.pointerUp(canvas, { clientX: 6 * 32 + 16, clientY: 12 * 32 + 16, button: 0 });
    view.unmount();
    const things = save.mock.calls.at(-1)![0].levels[0].zones[0].things;
    expect(things).toContainEqual(expect.objectContaining({ type: "own-e1", x: 6, y: 12, settings: {} }));
  });
});
```

`e2e/enemies.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

type Saved = { enemies: { id: string; name: string; behaviour: string }[]; levels: { zones: { things: { type: string }[] }[] }[] };

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

test("make an enemy, place it, and play against it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("My Enemies");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Characters" }).click();
  await page.getByRole("tab", { name: "Enemies" }).click();
  await page.getByRole("button", { name: "New enemy" }).click();
  await page.getByRole("textbox", { name: "Enemy name" }).fill("Frost Fang");
  await page.getByRole("group", { name: "Choose how it behaves" }).getByRole("button", { name: "Walker" }).click();
  await page.getByRole("group", { name: "Speed" }).getByRole("button", { name: "Fast" }).click();
  await expect.poll(async () => (await saved(page)).enemies.map((e) => e.name)).toEqual(["Frost Fang"]);
  await page.screenshot({ path: "test-results/enemies.png", fullPage: true });

  await page.getByRole("button", { name: "Level" }).click();
  await page.getByRole("tab", { name: "Enemies and items" }).click();
  await page.getByRole("button", { name: "Frost Fang Yours" }).click();
  const box = await page.getByTestId("zone-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  const t = box.height / 15;
  await page.mouse.click(box.x + 8.5 * t, box.y + 12.5 * t);
  await expect.poll(async () => (await saved(page)).levels[0].zones[0].things.map((th) => th.type)).toContainEqual(
    expect.stringMatching(/^own-/),
  );

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop playing" })).toBeVisible();
  await page.screenshot({ path: "test-results/enemies-playing.png" });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `npx vitest run tests/editor/paletteEnemies.test.tsx`
Expected: FAIL (the palette doesn't list "Frost Fang Yours").

- [ ] **Step 3: Write the implementation**

In `src/editor/components/Palette.tsx`: add `own?: Record<string, LookArt>` to `Props` (importing `type LookArt` from `"@/runtime/render/lookArt"`), take `own = {}`, and in the things tab draw an own thing from its own art and mark it:

```tsx
          pack.things.map((def) => {
            const mine = own[def.type];
            return (
              <button
                key={def.type}
                type="button"
                className={styles.swatch}
                aria-pressed={tool.kind === "thing" && tool.type === def.type}
                onClick={() => onTool({ kind: "thing", type: def.type })}
              >
                <SpriteSwatch
                  sprite={mine ? mine.frames[0] : art?.things[def.type]?.[0]}
                  palette={mine ? mine.palette : art?.palette}
                />
                {label(def.name)}
                {def.own && (
                  <>
                    {" "}
                    <span className={styles.needs}>Yours</span>
                  </>
                )}
              </button>
            );
          })
```

(keeping whatever the existing things-tab button rendered for pack things; only the sprite, palette and "Yours" are new).

In `src/editor/Editor.tsx`, give the palette the game pack and the kid's enemies' art:

```tsx
  const ownArt = useMemo(
    () => Object.fromEntries(enemies.map((e) => [ownType(e.id), lookArt(e.look)])),
    [enemies],
  );
```

(importing `ownType` from `"@/model/gamePack"` and `lookArt` from `"@/runtime/render/lookArt"`), and pass `pack={fullPack}` and `own={ownArt}` to `Palette`.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass (11 browser tests). Look at `test-results/enemies.png`.

- [ ] **Step 5: Update the status and commit**

In `docs/superpowers/status.md`: mark this plan implemented, reviewed and merged; say the Characters button opens Hero and Enemies tabs, and the kid's enemies can be made, tuned, drawn, previewed, placed and played; update the test counts; add this plan's deferred review findings.

```bash
git add -A src tests e2e docs/superpowers/status.md
git commit -m "feat: list the kid's own enemies first in the palette, and test making and playing one in a browser"
```

---

## Self-review

- **Spec coverage (section 6):** Characters button with tabs and Level back → Task 3; Enemies tab: list with thumbnails, New enemy (off at 12 with a note), behaviour then name starting from the snow drawing, name, behaviour buttons, tuning showing only used steps, two frames with the shared tools, Copy from the other frame, Flip, Clear, Import picture, colours, preview, Delete after asking and refused while placed → Tasks 1, 2 and 4; the palette listing own enemies first with "Yours" → Task 5. Section 9's screen tests and the browser test → Tasks 3–5. The Boss tab is plan 4.
- **Types:** `PictureEditor`, `PixelCanvas`, `Colours`, `GamePreview`, `ImportTarget`, `drawPixels`, `enemyBody`, `bodySize`, `enemyPreviewSim`, `IDLE_INPUTS`, `BEHAVIOUR_NAMES` are defined once and used with the same names.
- **Known limits, accepted:** the "New enemy" form takes the name before the behaviour on screen, but one click on a behaviour makes the enemy (the spec's order); a blank name becomes "Enemy N".
