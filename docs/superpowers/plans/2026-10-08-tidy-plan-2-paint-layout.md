# Character Editor Tidy-up, Plan 2 of 2: The Paint-App Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The look editor reads like a drawing program: the animations on the left; in the middle a frames bar above the canvas, the drawing tools down the canvas's left side and the picture tools underneath; labelled panels for Animation, Size, Colours and Preview on the right; and a canvas that grows with the space.

**Architecture:** `AnimationEditor` becomes three columns (`.lookList`, `.lookMiddle`, `.lookPanels`). `PictureEditor` lays itself out as a grid with the drawing tools in a column beside the canvas and the picture tools in a bar beneath, and takes extra buttons for that bar (Fit to drawing). The canvas's zoom becomes a prop: a pure `chooseZoom` picks a whole number from 12 to 24 from the space the middle column has, measured with a `ResizeObserver`. The right column's panels get `h2` headings.

**Tech Stack:** as before. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-character-editor-cleanup-design.md` (sections 3, 5, 6; build order item 2)

## Global Constraints

- No behaviour changes; every control keeps its accessible name and role.
- Whole-number zoom from 12 to 24 screen pixels per picture pixel, so pixels stay square and crisp.
- Under about 900 pixels wide the columns stack: the animations scroll sideways in a row, then the canvas area, then the panels.
- Import alias `@/` maps to `src/`. Component tests run in jsdom (no `ResizeObserver` there: the zoom stays 12).

## Review Focus

1. **A picture larger than the space (the boss at 48 × 48 on a small window):** the zoom stays at 12 and the canvas scrolls inside its column rather than spilling over. Tested in Task 1 (`chooseZoom`) and checked by screenshot in Task 3.
2. **Resizing the window while drawing:** the zoom changes between strokes without breaking a stroke in progress (pointer positions are read from the canvas's size on screen). Tested in Task 1.
3. **Choosing the Hitbox tool:** Fit to drawing appears in the picture bar under the canvas; nothing above the canvas moves. Tested in Task 2.
4. **The shots (6 × 4 and 12 × 10):** the zoom is capped at 24, so they don't fill the screen. Tested in Task 1.
5. **A phone-width window:** the columns stack and nothing spills sideways. Checked by Task 3's screenshots and overflow test.

## File Structure

```
src/editor/hero/zoom.ts                    chooseZoom
src/editor/hero/pixels.ts                  drawPixels takes a zoom
src/editor/components/PixelCanvas.tsx      a zoom prop
src/editor/components/PictureEditor.tsx    tools beside the canvas, a picture bar under it, extra picture buttons, zoom
src/editor/components/AnimationEditor.tsx  three columns; panels with h2 headings; measures its middle column
src/editor/components/Colours.tsx          an h2 heading, inside a panel
src/editor/editor.module.css               the layout; dead rules removed
tests/editor/zoom.test.ts, tests/editor/heroPixels.test.ts, tests/editor/animationEditor.test.tsx, e2e/characters.spec.ts
```

---

### Task 1: A canvas that grows

**Files:**
- Create: `src/editor/hero/zoom.ts`
- Modify: `src/editor/hero/pixels.ts`, `src/editor/components/PixelCanvas.tsx`, `src/editor/components/PictureEditor.tsx`
- Test: `tests/editor/zoom.test.ts`, additions to `tests/editor/heroPixels.test.ts`

**Interfaces:**
- Produces: `MIN_ZOOM = 12`, `MAX_ZOOM = 24`, `chooseZoom(space: { w: number; h: number }, picture: { w: number; h: number }): number`; `drawPixels(ctx, rows, palette, size, body, feet, extras, zoom = ZOOM)`; `PixelCanvas` and `PictureEditor` prop `zoom?: number` (default `ZOOM`, 12)

- [ ] **Step 1: Write the failing tests**

`tests/editor/zoom.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chooseZoom, MAX_ZOOM, MIN_ZOOM } from "@/editor/hero/zoom";

describe("chooseZoom", () => {
  it("fills the space with whole screen pixels per picture pixel", () => {
    expect(chooseZoom({ w: 400, h: 600 }, { w: 16, h: 24 })).toBe(24); // 25 and 25, capped
    expect(chooseZoom({ w: 320, h: 600 }, { w: 16, h: 24 })).toBe(20);
    expect(chooseZoom({ w: 600, h: 300 }, { w: 16, h: 16 })).toBe(18); // the height decides
  });

  it("never goes below 12 (the canvas scrolls instead) or above 24 (small pictures stay sensible)", () => {
    expect(chooseZoom({ w: 300, h: 300 }, { w: 48, h: 48 })).toBe(MIN_ZOOM);
    expect(chooseZoom({ w: 2000, h: 2000 }, { w: 6, h: 4 })).toBe(MAX_ZOOM);
    expect(chooseZoom({ w: 0, h: 0 }, { w: 16, h: 24 })).toBe(MIN_ZOOM); // not measured yet
  });
});
```

Add to `tests/editor/heroPixels.test.ts`:

```ts
describe("drawing at another zoom", () => {
  it("draws each pixel at the zoom it is given", () => {
    const rects: { colour: string; x: number; y: number; w: number; h: number }[] = [];
    const ctx = {
      fillStyle: "",
      globalAlpha: 1,
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ colour: String(this.fillStyle), x, y, w, h });
      },
    };
    drawPixels(ctx, ["..", ".1"], { "1": "#ff0000" }, { w: 2, h: 2 }, null, false, {}, 20);
    expect(rects).toContainEqual({ colour: "#ff0000", x: 20, y: 20, w: 20, h: 20 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/zoom.test.ts tests/editor/heroPixels.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`src/editor/hero/zoom.ts`:

```ts
// How big to draw a picture: whole screen pixels per picture pixel, so pixels stay square and crisp,
// as big as the space allows, from 12 (the canvas scrolls if even that doesn't fit) to 24.

export const MIN_ZOOM = 12;
export const MAX_ZOOM = 24;

export function chooseZoom(space: { w: number; h: number }, picture: { w: number; h: number }): number {
  const fit = Math.min(Math.floor(space.w / picture.w), Math.floor(space.h / picture.h));
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit));
}
```

`pixels.ts`: `drawPixels` gains a last parameter `zoom = ZOOM` and uses it everywhere it used `ZOOM`. `PixelCanvas`: a `zoom?: number` prop (default `ZOOM`) used for the canvas's `width`/`height` and passed to `drawPixels` (and in the effect's dependencies). `PictureEditor`: a `zoom?: number` prop passed to `PixelCanvas`. Pointer positions already come from the canvas's on-screen rectangle (`pixelFromPointer`), so they need no change.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: let the drawing canvas grow with whole-number zoom"
```

---

### Task 2: The paint-app layout

**Files:**
- Modify: `src/editor/components/PictureEditor.tsx`, `src/editor/components/AnimationEditor.tsx`, `src/editor/components/Colours.tsx`, `src/editor/editor.module.css`
- Test: additions to `tests/editor/animationEditor.test.tsx`, `tests/editor/sizeAndHitbox.test.tsx`

**Interfaces:**
- Consumes: Task 1's `chooseZoom`, the `zoom` prop
- Produces: `PictureEditor` prop `pictureButtons?: React.ReactNode` (extra buttons at the end of the "Picture tools" bar); the right column's panels as `section`s with `h2` headings: "Animation", "Size", "Colours", "Preview"

- [ ] **Step 1: Write the failing tests**

Add to `tests/editor/animationEditor.test.tsx`:

```tsx
  it("groups the editor like a drawing program", async () => {
    const { open } = setupHero();
    await open();
    const look = screen.getByRole("region", { name: "Look" });
    for (const name of ["Animation", "Size", "Colours", "Preview"]) {
      expect(within(look).getByRole("heading", { level: 2, name })).toBeTruthy();
    }
    const animation = screen.getByRole("region", { name: "Animation" });
    expect(within(animation).getByRole("button", { name: "Play animation" })).toBeTruthy();
    expect(within(animation).getByRole("group", { name: "Animation speed" })).toBeTruthy();
    expect(within(animation).getByRole("button", { name: "Onion skin" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Size" })).getByRole("button", { name: "Wider" })).toBeTruthy();
  });
```

Add to `tests/editor/sizeAndHitbox.test.tsx`, in `describe("the Hitbox tool")`:

```tsx
  it("offers Fit to drawing in the picture bar under the canvas", async () => {
    const { open, choose } = setupHero();
    await open();
    expect(screen.queryByRole("button", { name: "Fit to drawing" })).toBeNull();
    await choose("Hitbox");
    expect(within(screen.getByRole("group", { name: "Picture tools" })).getByRole("button", { name: "Fit to drawing" })).toBeTruthy();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/animationEditor.test.tsx tests/editor/sizeAndHitbox.test.tsx`
Expected: FAIL (no h2 headings or regions; Fit to drawing sits above the canvas).

- [ ] **Step 3: The picture editor's layout**

`PictureEditor.tsx`: the root keeps its import-error alert, then lays out as a grid (`className={styles.pictureEditor}`):

```tsx
    <div className={styles.pictureEditor}>
      {importError && (/* the alert, as now, spanning both columns */)}
      <div className={styles.toolColumn} role="group" aria-label="Drawing tools">
        {[...TOOLS, ...extraTools].map((t) => (/* the tool buttons, as now */))}
      </div>
      <div className={styles.canvasWrap}>
        <PixelCanvas … zoom={zoom} />
      </div>
      <div className={styles.pictureBar} role="group" aria-label="Picture tools">
        {/* Copy from, Flip, Clear, Import picture and the file input, as now */}
        {pictureButtons}
      </div>
      {importing && (/* the ImportDialog, as now */)}
    </div>
```

New prop `pictureButtons?: ReactNode`. The extra tools (Hitbox, Shot point) follow the four drawing tools in the column after a small gap (`.toolGap`, an empty `span` before the first extra tool).

- [ ] **Step 4: The look editor's three columns**

`AnimationEditor.tsx` renders:

```tsx
    <section className={styles.animationEditor} aria-label="Look">
      <div className={styles.lookList}>{/* the Animations group, as now */}</div>
      <div className={styles.lookMiddle} ref={middle}>
        <div className={styles.framesBar}>
          {/* the Frames group (thumbnails) and the Frame tools group (Add, Copy, Delete, Move left, Move right), and the 8-frames note, as now */}
        </div>
        <PictureEditor
          … as now …
          zoom={zoom}
          pictureButtons={activeTool === "hitbox" ? (
            <button type="button" className={styles.action} onClick={() => send("fitBody", { which })}>Fit to drawing</button>
          ) : null}
        />
      </div>
      <div className={styles.lookPanels}>
        <section className={styles.panel} aria-label="Animation">
          <h2 className={styles.panelHeading}>Animation</h2>
          {/* Play animation / Stop animation and the play box, the Animation speed group, Onion skin */}
        </section>
        {!fixed && (
          <section className={styles.panel} aria-label="Size">
            <h2 className={styles.panelHeading}>Size</h2>
            {/* the size readout and Narrower, Wider, Shorter, Taller (the "Size" group stays, without its old inline label) */}
          </section>
        )}
        <section className={styles.panel} aria-label="Colours">{/* <Colours … /> */}</section>
        {preview && (
          <section className={styles.panel} aria-label="Preview">
            <h2 className={styles.panelHeading}>Preview</h2>
            {preview}
          </section>
        )}
      </div>
    </section>
```

The Fit to drawing button that sat above the canvas goes. Measure the middle column for the zoom:

```tsx
  const middle = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = middle.current;
    if (!el || typeof ResizeObserver === "undefined") return; // jsdom: stay at the smallest zoom
    const observer = new ResizeObserver(([entry]) => {
      // Leave room for the tools column (about 9rem) and keep the canvas within most of the window's height.
      setSpace({ w: entry.contentRect.width - 150, h: window.innerHeight * 0.65 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const zoom = chooseZoom(space, canvas);
```

`Colours.tsx`: its heading becomes `<h2 className={styles.panelHeading}>Colours</h2>` (the "Colours" section label stays on its own `section`, so the region test finds one: drop the `aria-label` from whichever of the two wrappers would duplicate it).

- [ ] **Step 5: The CSS**

In `editor.module.css`, replace the `.animationEditor`, `.animationMiddle`, `.animationColours`, `.frameStrip`, `.playRow` rules (and the dead `.frameStrip .drawTools .swatch` and `.playRow > .swatch` selectors) with:

```css
/* The look editor: animations | frames, tools and canvas | labelled panels. */
.animationEditor {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr) 17rem;
  gap: 1.25rem;
  align-items: start;
  min-width: 0;
}
.lookList,
.lookMiddle,
.lookPanels {
  display: grid;
  gap: 0.75rem;
  align-content: start;
  min-width: 0;
}
.framesBar {
  display: grid;
  gap: 0.5rem;
}
/* The drawing tools in a column beside the canvas, the picture tools in a bar beneath it. */
.pictureEditor {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    "alert alert"
    "tools canvas"
    ". bar";
  gap: 0.6rem 0.75rem;
  align-items: start;
}
.pictureEditor > .alert {
  grid-area: alert;
}
.toolColumn {
  grid-area: tools;
  display: grid;
  gap: 0.35rem;
}
.toolGap {
  height: 0.5rem;
}
.canvasWrap {
  grid-area: canvas;
  overflow: auto; /* a picture bigger than the space scrolls here */
  max-width: 100%;
}
.pictureBar {
  grid-area: bar;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: end;
}
@media (max-width: 900px) {
  .animationEditor {
    grid-template-columns: minmax(0, 1fr);
  }
  .lookList .poses {
    display: flex;
    overflow-x: auto;
  }
  .lookList .poses .swatch {
    width: auto;
    flex: none;
  }
}
@media (max-width: 520px) {
  .pictureEditor {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "alert" "tools" "canvas" "bar";
  }
  .toolColumn {
    display: flex;
    flex-wrap: wrap;
  }
}
```

(Delete the old 760px rule for `.animationEditor`. Check with `grep -rn "styles.animationMiddle\|styles.animationColours\|styles.frameStrip\|styles.playRow" src` that nothing still uses the removed classes.)

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. Tests that found a control inside a removed wrapper are updated to find it inside its new region; names are unchanged.

- [ ] **Step 7: Commit**

```bash
git add -A src tests
git commit -m "feat: lay out the look editor like a drawing program"
```

---

### Task 3: Look at it

**Files:**
- Modify: `e2e/characters.spec.ts`, `docs/superpowers/STATUS.md`

- [ ] **Step 1: Screenshot the whole panel**

The Characters screen scrolls inside its `main`, so a full-page screenshot shows only the top. In `e2e/characters.spec.ts`, take each tab's screenshot of the `main` element after letting it grow to its full height:

```ts
    const shoot = async (name: string) => {
      const main = page.locator("main");
      await main.evaluate((el) => {
        (el as HTMLElement).style.overflow = "visible";
        (el as HTMLElement).style.height = "auto";
      });
      await page.locator("body").evaluate((el) => ((el as HTMLElement).style.height = "auto"));
      await page.screenshot({ path: `test-results/characters-${name}-${size.name}.png`, fullPage: true });
    };
```

and call `await shoot("hero")`, `shoot("enemies")` and `shoot("boss")` where the three screenshots were taken. (If the editor's `.app` keeps its `100vh` height, also set its `height` to `auto` in the same way; the point is a picture of everything on the tab.) Add, on the boss at 1280 pixels, a check that the canvas's width is at least 24 × 12 pixels and at most 24 × 24 (the zoom stays in range).

- [ ] **Step 2: Run the browser tests and look**

Run: `npm run e2e`
Expected: all pass. Open all nine `test-results/characters-*.png` and check, for each: the three columns at 1280 and 1600 (animations; frames bar, tools beside the canvas, picture bar under it; the Animation, Size, Colours and Preview panels); the canvas bigger at 1600 than at 1280 when there is room; the stacked layout at phone width with the animations in a sideways-scrolling row; nothing overlapping.

- [ ] **Step 3: Update the status and commit**

In `docs/superpowers/STATUS.md`: mark this plan implemented, reviewed and merged, and the tidy-up done; describe the paint-app layout and the growing canvas; remove tidy plan 1's deferred items this plan settles (the headings now go h1 → h2 on the Characters screen's panels; the dead CSS selectors; the screenshots that missed the bottom of the panel); update the test counts; add this plan's deferred review findings.

```bash
git add -A e2e docs/superpowers/STATUS.md
git commit -m "test: look at the whole Characters screen at three sizes"
```

---

## Self-review

- **Spec coverage:** section 3 (animations on the left; frames bar with thumbnails and Add, Copy, Delete, Move; tools column with the drawing tools, a gap, Hitbox and Shot point; the growing canvas from 12 to 24; the picture bar with Copy from, Flip, Clear, Import and Fit to drawing; the Animation, Size, Colours and Preview panels with headings) → Tasks 1 and 2; section 5 (stacking under about 900 pixels, the animations as a sideways row) → Task 2's CSS and Task 3's screenshots; section 6 (Fit to drawing not moving the canvas, the zoom as a pure function tested alone, screenshots at three sizes) → Tasks 1 to 3.
- **Placeholder scan:** Task 2's JSX names each moved block rather than repeating it; the moved markup is unchanged. Task 3's screenshot helper notes the one adjustment (`.app`'s height) that may be needed.
- **Types:** `chooseZoom`, `MIN_ZOOM`, `MAX_ZOOM`, `zoom`, `pictureButtons`, `.pictureEditor`, `.toolColumn`, `.canvasWrap`, `.pictureBar`, `.lookList`, `.lookMiddle`, `.lookPanels`, `.framesBar` are defined once and used with the same names.
