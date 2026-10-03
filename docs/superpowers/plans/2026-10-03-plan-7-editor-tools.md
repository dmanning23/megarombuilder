# Editor Tools Implementation Plan (Milestone 1, Plan 7 of 8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the editor: place and move enemies, pickups, platforms and the boss; stamp the twelve level pieces; see the checker's verdict on every zone as you build; change a zone's length, look, purpose, ways in and out, order, or delete it; add climbing zones; and export and import game files.

**Architecture:** Everything still goes through plan 1 commands via the editor reducer. The canvas reports presses, drags and releases (tile and pixel position); the editor turns them into commands according to the current tool, using small pure helpers in `tools.ts`. The checker (plan 5) runs on the whole level a moment after the project stops changing and feeds the zone badges, a check panel and a marker on the canvas. Export writes the project as JSON; import reads it back through `parseProject` and gives it a new id.

**Tech Stack:** as plan 6. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-playable-core-ai-level-builder-design.md` (section 8 "Editor UI", section 9 "Error handling")

**Plan series for milestone 1:**

1. Project model and commands (done)
2. Runtime core (done)
3. Runtime things (done)
4. Snow pack and pixel art (done)
5. Level pieces and the checker (done)
6. Editor core (done)
7. Editor tools (this plan)
8. AI assistant

## Global Constraints

- As plan 6: every change goes through commands; interface text is short, plain and in sentence case; errors say what happened and what to do; everything works with mouse, pen, finger and keyboard.
- The checker never runs in the middle of a stroke or while playing.
- An imported game always gets a new id, so importing can never overwrite a game already saved.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **Zones are reordered with "Move earlier" and "Move later" buttons**, not drag and drop. The spec asked for dragging; buttons work from the keyboard and on touch screens and are much simpler to get right.
- **Settings for a zone sit under the zone list**, as a "This zone" panel, rather than in a pop-up menu.
- **Ways in and out are fixed sizes**: four tiles high on the left or right side, two tiles wide at the top or bottom, positioned with a "Starts at" choice.
- **Adding zones offers two kinds**: "Add a zone" (one screen, sideways) and "Add a climbing zone" (two screens, up and down, way in at the bottom and way out at the top). There is no command to change a zone's direction.
- **The checker runs in the page**, not a background worker. It takes a fraction of a second for a level (plan 5's timings), after a 400 ms pause in editing. A worker can come later if levels grow.
- **Export files are named after the game**, ending `.megarom.json`, as the spec says.

## Review Focus

1. **A thing that is hard to hit or sits on top of another** (a small pickup; two enemies on one tile): pressing selects the topmost one, and dragging moves only it. Tested in Task 1.
2. **Dragging a thing off the canvas and letting go**: nothing moves and nothing breaks. Tested in Tasks 2 and 7.
3. **A file that is not a game** (a picture, broken JSON, a game from a newer version): a plain message on the home page, and nothing saved. Tested in Task 6.
4. **The checker's verdict going stale** (it describes the zone as it was before the last edit): it is rerun after every change once editing pauses, never mid-stroke. Tested in Task 4.
5. **Changing a way in or out so it doesn't line up with the next zone**: allowed (fixing a connection takes two edits), and shown as a level problem until fixed. Tested in Task 7.

## File Structure

```
src/editor/state.ts                     Tool gains "thing" and "piece"
src/editor/tools.ts                     thingAt, paintCommand, placeCommand
src/editor/zoneView.ts                  spotFromPointer; drawZoneView draws a marker
src/editor/useLevelCheck.ts             runs the checker after editing pauses
src/editor/files.ts                     exportFileName, projectToJson, readProjectText, downloadProject
src/editor/components/ZoneCanvas.tsx    press, drag and release instead of paint strokes
src/editor/components/Palette.tsx       tabs: tiles, enemies and items, pieces (with settings)
src/editor/components/ZoneList.tsx      badges, "Add a climbing zone", disabled while playing
src/editor/components/CheckPanel.tsx    the checker's verdict, warnings and level problems
src/editor/components/ZoneSettings.tsx  length, look, purpose, ways in and out, order, delete
src/editor/components/Toolbar.tsx       Export; play and undo controls off while playing
src/editor/Editor.tsx                   wires it all together
src/editor/ProjectsHome.tsx             Import a game file
src/editor/editor.module.css, home.module.css
tests/editor/*.test.ts(x), e2e/tools.spec.ts
```

---

### Task 1: Tools and what a press does

**Files:**
- Modify: `src/editor/state.ts` (the `Tool` type), `src/editor/zoneView.ts` (add `Spot`, `spotFromPointer`)
- Create: `src/editor/tools.ts`
- Test: `tests/editor/tools.test.ts`

**Interfaces:**
- Consumes: `spawnBox` (plan 3); `zoneSize`; `Command`; `tileFromPointer`, `zonePixels` (plan 6)
- Produces:
  - `type Tool = { kind: "tile"; tile: number } | { kind: "erase" } | { kind: "thing"; type: string } | { kind: "piece"; pieceId: string; settings: Record<string, number> }`
  - `type Spot = { tile: { x: number; y: number }; point: { x: number; y: number } }` (`point` in zone pixels)
  - `spotFromPointer(clientX: number, clientY: number, rect, zone: Zone): Spot | null`
  - `thingAt(zone: Zone, pack: ContentPack, point: { x: number; y: number }): Thing | null` (the last-placed thing whose spawn box contains the point)
  - `paintCommand(tool: { kind: "tile"; tile: number } | { kind: "erase" }, levelId: string, zone: Zone, pack: ContentPack, spot: Spot): Command` (erase removes a thing under the point if there is one, otherwise empties the tile)
  - `placeCommand(tool: { kind: "thing"; type: string } | { kind: "piece"; pieceId: string; settings: Record<string, number> }, levelId: string, zone: Zone, spot: Spot, makeId: () => string): Command` (a thing goes on the pressed tile; a piece's left edge goes on the pressed column, at the top of a sideways zone, or at the pressed row, kept inside, in a climbing zone)

- [ ] **Step 1: Write the failing test**

`tests/editor/tools.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { snowPack } from "@/content/snow/pack";
import { SPIKE } from "@/content/snow/tiles";
import { newProject } from "@/editor/newProject";
import { paintCommand, placeCommand, thingAt } from "@/editor/tools";
import { spotFromPointer } from "@/editor/zoneView";
import type { Zone } from "@/model/schema";

let n = 0;
const makeId = () => `id-${++n}`;
const level = newProject("Tools", makeId).levels[0];
const first = level.zones[0];
const walker = (id: string, x: number, y: number) => ({ id, type: "walker", x, y, settings: {} });
const spot = (tx: number, ty: number, px = tx * 16 + 8, py = ty * 16 + 8) => ({
  tile: { x: tx, y: ty },
  point: { x: px, y: py },
});

describe("spotFromPointer", () => {
  it("gives the tile and the point in zone pixels", () => {
    const rect = { left: 0, top: 0, width: 512, height: 480 };
    expect(spotFromPointer(5 * 32 + 10, 12 * 32 + 20, rect, first)).toEqual({
      tile: { x: 5, y: 12 },
      point: { x: 85, y: 202 },
    });
    expect(spotFromPointer(-1, 0, rect, first)).toBeNull();
  });
});

describe("thingAt", () => {
  const zone: Zone = { ...first, things: [walker("a", 5, 12), walker("b", 5, 12), walker("c", 9, 12)] };

  it("finds the thing under a point, the last placed one first", () => {
    expect(thingAt(zone, snowPack, { x: 88, y: 200 })?.id).toBe("b");
    expect(thingAt(zone, snowPack, { x: 152, y: 200 })?.id).toBe("c");
  });

  it("finds nothing in empty space or for unknown types", () => {
    expect(thingAt(zone, snowPack, { x: 30, y: 30 })).toBeNull();
    const odd: Zone = { ...first, things: [{ id: "x", type: "dragon", x: 1, y: 1, settings: {} }] };
    expect(thingAt(odd, snowPack, { x: 24, y: 24 })).toBeNull();
  });
});

describe("paintCommand", () => {
  it("paints the tile under the press", () => {
    expect(paintCommand({ kind: "tile", tile: SPIKE }, level.id, first, snowPack, spot(3, 4))).toEqual({
      name: "setTiles",
      args: { levelId: level.id, zoneId: first.id, cells: [{ x: 3, y: 4, tile: SPIKE }] },
    });
  });

  it("erases a thing under the press before a tile", () => {
    const zone: Zone = { ...first, things: [walker("a", 5, 12)] };
    expect(paintCommand({ kind: "erase" }, level.id, zone, snowPack, spot(5, 12, 88, 200))).toEqual({
      name: "removeThing",
      args: { levelId: level.id, zoneId: first.id, thingId: "a" },
    });
    expect(paintCommand({ kind: "erase" }, level.id, zone, snowPack, spot(2, 13))).toEqual({
      name: "setTiles",
      args: { levelId: level.id, zoneId: first.id, cells: [{ x: 2, y: 13, tile: 0 }] },
    });
  });
});

describe("placeCommand", () => {
  it("places a thing on the pressed tile with a new id", () => {
    expect(placeCommand({ kind: "thing", type: "walker" }, level.id, first, spot(5, 12), () => "new")).toEqual({
      name: "placeThing",
      args: { levelId: level.id, zoneId: first.id, thingId: "new", type: "walker", x: 5, y: 12 },
    });
  });

  it("stamps a piece from the pressed column, at the top of a sideways zone", () => {
    const tool = { kind: "piece" as const, pieceId: "gap", settings: { width: 2 } };
    expect(placeCommand(tool, level.id, first, spot(4, 9), () => "p")).toEqual({
      name: "insertPiece",
      args: { levelId: level.id, zoneId: first.id, pieceId: "gap", x: 4, y: 0, settings: { width: 2 }, idPrefix: "p" },
    });
  });

  it("stamps a piece at the pressed row of a climbing zone, kept inside it", () => {
    const climb: Zone = { ...first, scroll: "vertical", screens: 2 };
    const tool = { kind: "piece" as const, pieceId: "gap", settings: { width: 2 } };
    expect(placeCommand(tool, level.id, climb, spot(4, 6), () => "p").args).toMatchObject({ y: 6 });
    expect(placeCommand(tool, level.id, climb, spot(4, 25), () => "p").args).toMatchObject({ y: 15 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/editor/tools.test.ts`
Expected: FAIL, cannot resolve `@/editor/tools`.

- [ ] **Step 3: Extend the tool type and add spots**

In `src/editor/state.ts`, replace the `Tool` type with:

```ts
export type Tool =
  | { kind: "tile"; tile: number }
  | { kind: "erase" }
  | { kind: "thing"; type: string }
  | { kind: "piece"; pieceId: string; settings: Record<string, number> };
```

Append to `src/editor/zoneView.ts`:

```ts
// Where a pointer is in a zone: the tile, and the exact point in zone pixels.
export type Spot = { tile: { x: number; y: number }; point: { x: number; y: number } };

export function spotFromPointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  zone: Zone,
): Spot | null {
  const tile = tileFromPointer(clientX, clientY, rect, zone);
  if (!tile) return null;
  const { width, height } = zonePixels(zone);
  return {
    tile,
    point: {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height,
    },
  };
}
```

- [ ] **Step 4: Implement the tools**

`src/editor/tools.ts`:

```ts
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import { zoneSize } from "@/model/geometry";
import type { Thing, Zone } from "@/model/schema";
import { spawnBox } from "@/runtime/sim/entities/spawn";
import type { Spot } from "./zoneView";

// The thing under a point: the last placed one, since it is drawn on top.
export function thingAt(zone: Zone, pack: ContentPack, point: { x: number; y: number }): Thing | null {
  for (let i = zone.things.length - 1; i >= 0; i--) {
    const thing = zone.things[i];
    const def = pack.things.find((d) => d.type === thing.type);
    if (!def) continue;
    const box = spawnBox(thing, def.behaviour);
    if (point.x >= box.x && point.x < box.x + box.w && point.y >= box.y && point.y < box.y + box.h) {
      return thing;
    }
  }
  return null;
}

// What painting or erasing does at one spot of a stroke.
export function paintCommand(
  tool: { kind: "tile"; tile: number } | { kind: "erase" },
  levelId: string,
  zone: Zone,
  pack: ContentPack,
  spot: Spot,
): Command {
  if (tool.kind === "erase") {
    const hit = thingAt(zone, pack, spot.point);
    if (hit) return { name: "removeThing", args: { levelId, zoneId: zone.id, thingId: hit.id } };
  }
  const tile = tool.kind === "tile" ? tool.tile : 0;
  return { name: "setTiles", args: { levelId, zoneId: zone.id, cells: [{ ...spot.tile, tile }] } };
}

// What placing a thing or stamping a piece does at the pressed spot.
export function placeCommand(
  tool: { kind: "thing"; type: string } | { kind: "piece"; pieceId: string; settings: Record<string, number> },
  levelId: string,
  zone: Zone,
  spot: Spot,
  makeId: () => string,
): Command {
  if (tool.kind === "thing") {
    return {
      name: "placeThing",
      args: { levelId, zoneId: zone.id, thingId: makeId(), type: tool.type, x: spot.tile.x, y: spot.tile.y },
    };
  }
  const height = zoneSize(zone.scroll, zone.screens).height;
  const y = zone.scroll === "horizontal" ? 0 : Math.max(0, Math.min(spot.tile.y, height - 15));
  return {
    name: "insertPiece",
    args: {
      levelId,
      zoneId: zone.id,
      pieceId: tool.pieceId,
      x: spot.tile.x,
      y,
      settings: tool.settings,
      idPrefix: makeId(),
    },
  };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing. (The editor still only uses the tile and erase tools, so nothing else changes yet.)

- [ ] **Step 6: Commit**

```bash
git add src/editor tests/editor/tools.test.ts
git commit -m "feat: add thing and piece tools and what a press does"
```

---

### Task 2: The canvas reports presses, drags and releases

**Files:**
- Modify: `src/editor/components/ZoneCanvas.tsx` (replace), `src/editor/zoneView.ts` (`drawZoneView` marker), `tests/editor/components.test.tsx` (the `ZoneCanvas` tests), `tests/editor/zoneView.test.ts`
- Modify: `src/editor/Editor.tsx` (keep it working with the new canvas until Task 7)

**Interfaces:**
- Consumes: `Spot`, `spotFromPointer` (Task 1)
- Produces:
  - `ZoneCanvas(props: { zone; pack; skin?; checkpoints; zoom; marker?: { x: number; y: number } | null; onPress(spot: Spot): void; onDrag(spot: Spot): void; onRelease(spot: Spot | null): void })`
  - `drawZoneView(ctx, zone, pack, skin, checkpoints, marker?)` draws a 2-pixel frame in `MARKER_COLOUR` (`#ef476f`) around the marked tile

Canvas rules: only the primary button (a left click, a touch or a pen) starts anything. A press reports where it happened; moving while pressed reports each new tile; letting go, cancelling or losing the pointer reports the spot it ended on (or `null` if that is off the canvas), once.

- [ ] **Step 1: Write the failing tests**

In `tests/editor/zoneView.test.ts`, add `MARKER_COLOUR` to the `@/editor/zoneView` import and add inside `describe("drawZoneView", ...)`:

```ts
  it("frames a marked tile", () => {
    const ctx = fakeContext();
    drawZoneView(ctx, first, snowPack, skin, [], { x: 5, y: 12 });
    expect(ctx.calls.filter((c) => c.colour === MARKER_COLOUR)).toEqual([
      { colour: MARKER_COLOUR, x: 78, y: 190, w: 20, h: 2 },
      { colour: MARKER_COLOUR, x: 78, y: 208, w: 20, h: 2 },
      { colour: MARKER_COLOUR, x: 78, y: 192, w: 2, h: 16 },
      { colour: MARKER_COLOUR, x: 96, y: 192, w: 2, h: 16 },
    ]);
  });
```

In `tests/editor/components.test.tsx`, replace the whole `describe("ZoneCanvas", ...)` block with:

```tsx
describe("ZoneCanvas", () => {
  function setup() {
    const handlers = { onPress: vi.fn(), onDrag: vi.fn(), onRelease: vi.fn() };
    render(<ZoneCanvas zone={level.zones[0]} pack={snowPack} checkpoints={[]} zoom={2} {...handlers} />);
    const canvas = screen.getByTestId("zone-canvas");
    // jsdom does no layout, so give the canvas the size it would have on screen.
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 512, height: 480, right: 512, bottom: 480, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const at = (tx: number, ty: number) => ({ clientX: tx * 32 + 16, clientY: ty * 32 + 16 });
    return { handlers, canvas, at };
  }

  it("is named after the zone and sized to it at the zoom", () => {
    setup();
    const canvas = screen.getByLabelText("Zone 1, 1 screen") as HTMLCanvasElement;
    expect(canvas.width).toBe(256);
    expect(canvas.style.width).toBe("512px");
  });

  it("reports a press, each new tile dragged over, and the release", () => {
    const { handlers, canvas, at } = setup();
    fireEvent.pointerDown(canvas, { ...at(2, 3), button: 0 });
    expect(handlers.onPress).toHaveBeenCalledWith({ tile: { x: 2, y: 3 }, point: { x: 40, y: 56 } });
    fireEvent.pointerMove(canvas, at(2, 3));
    fireEvent.pointerMove(canvas, at(3, 3));
    fireEvent.pointerMove(canvas, at(3, 3));
    expect(handlers.onDrag).toHaveBeenCalledTimes(1);
    expect(handlers.onDrag).toHaveBeenCalledWith(expect.objectContaining({ tile: { x: 3, y: 3 } }));
    fireEvent.pointerUp(canvas, at(3, 3));
    expect(handlers.onRelease).toHaveBeenCalledWith(expect.objectContaining({ tile: { x: 3, y: 3 } }));
  });

  it("reports a release off the canvas as nowhere, and only once", () => {
    const { handlers, canvas, at } = setup();
    fireEvent.pointerDown(canvas, { ...at(2, 3), button: 0 });
    fireEvent.pointerUp(canvas, { clientX: 900, clientY: 900 });
    fireEvent.lostPointerCapture(canvas);
    expect(handlers.onRelease).toHaveBeenCalledTimes(1);
    expect(handlers.onRelease).toHaveBeenCalledWith(null);
  });

  it("ignores moves without a press, and right or middle clicks", () => {
    const { handlers, canvas, at } = setup();
    fireEvent.pointerMove(canvas, at(1, 1));
    fireEvent.pointerDown(canvas, { ...at(1, 1), button: 2 });
    fireEvent.pointerDown(canvas, { ...at(1, 1), button: 1 });
    fireEvent.pointerUp(canvas, at(1, 1));
    expect(handlers.onPress).not.toHaveBeenCalled();
    expect(handlers.onDrag).not.toHaveBeenCalled();
    expect(handlers.onRelease).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/editor/components.test.tsx tests/editor/zoneView.test.ts`
Expected: FAIL. `MARKER_COLOUR` is missing and the canvas has no `onPress`.

- [ ] **Step 3: Draw the marker**

In `src/editor/zoneView.ts`, add `export const MARKER_COLOUR = "#ef476f";` after the other colours, add a parameter `marker: { x: number; y: number } | null = null` after `checkpoints: Checkpoint[]` in `drawZoneView`, and add at the end of `drawZoneView`:

```ts
  if (marker) {
    const x = marker.x * TILE_SIZE;
    const y = marker.y * TILE_SIZE;
    rect(ctx, MARKER_COLOUR, x - 2, y - 2, TILE_SIZE + 4, 2);
    rect(ctx, MARKER_COLOUR, x - 2, y + TILE_SIZE, TILE_SIZE + 4, 2);
    rect(ctx, MARKER_COLOUR, x - 2, y, 2, TILE_SIZE);
    rect(ctx, MARKER_COLOUR, x + TILE_SIZE, y, 2, TILE_SIZE);
  }
```

- [ ] **Step 4: Replace the canvas**

`src/editor/components/ZoneCanvas.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { Checkpoint, Zone } from "@/model/schema";
import type { Skin } from "@/runtime/render/draw";
import styles from "../editor.module.css";
import { drawZoneView, spotFromPointer, zonePixels, type Spot } from "../zoneView";

type Props = {
  zone: Zone;
  pack: ContentPack;
  skin?: Skin;
  checkpoints: Checkpoint[];
  zoom: number;
  marker?: { x: number; y: number } | null;
  onPress(spot: Spot): void;
  onDrag(spot: Spot): void;
  onRelease(spot: Spot | null): void;
};

export function ZoneCanvas({ zone, pack, skin, checkpoints, zoom, marker = null, onPress, onDrag, onRelease }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pressed = useRef(false);
  const lastTile = useRef<string | null>(null);
  const { width, height } = zonePixels(zone);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawZoneView(ctx, zone, pack, skin, checkpoints, marker);
  }, [zone, pack, skin, checkpoints, marker]);

  const spotAt = (clientX: number, clientY: number) =>
    ref.current ? spotFromPointer(clientX, clientY, ref.current.getBoundingClientRect(), zone) : null;

  const end = (clientX: number, clientY: number) => {
    if (!pressed.current) return;
    pressed.current = false;
    lastTile.current = null;
    onRelease(spotAt(clientX, clientY));
  };

  const label = `${zone.name}, ${zone.screens} screen${zone.screens === 1 ? "" : "s"}`;
  return (
    <canvas
      ref={ref}
      data-testid="zone-canvas"
      aria-label={label}
      role="img"
      width={width}
      height={height}
      className={styles.zoneCanvas}
      style={{ width: width * zoom, height: height * zoom }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const spot = spotAt(e.clientX, e.clientY);
        if (!spot) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pressed.current = true;
        lastTile.current = `${spot.tile.x},${spot.tile.y}`;
        onPress(spot);
      }}
      onPointerMove={(e) => {
        if (!pressed.current) return;
        const spot = spotAt(e.clientX, e.clientY);
        if (!spot) return;
        const key = `${spot.tile.x},${spot.tile.y}`;
        if (key === lastTile.current) return;
        lastTile.current = key;
        onDrag(spot);
      }}
      onPointerUp={(e) => end(e.clientX, e.clientY)}
      onPointerCancel={() => end(Number.NaN, Number.NaN)}
      onLostPointerCapture={(e) => end(e.clientX, e.clientY)}
    />
  );
}
```

- [ ] **Step 5: Keep the editor working**

In `src/editor/Editor.tsx`, replace the `paint` callback and the three stroke props on `<ZoneCanvas>` so painting works through the new canvas (Task 7 replaces this file entirely):

```tsx
  const paint = useCallback(
    (spot: Spot) => {
      if (state.tool.kind !== "tile" && state.tool.kind !== "erase") return;
      dispatch({ type: "run", command: paintCommand(state.tool, level.id, zone, pack, spot) });
    },
    [state.tool, level.id, zone, pack],
  );
```

```tsx
              onPress={(spot) => {
                dispatch({ type: "begin", label: "Paint" });
                paint(spot);
              }}
              onDrag={paint}
              onRelease={() => dispatch({ type: "commit" })}
```

and add the imports `import { paintCommand } from "./tools";` and `import type { Spot } from "./zoneView";`.

- [ ] **Step 6: Run tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all tests PASS, including the plan 6 editor tests; typecheck and lint report nothing.

- [ ] **Step 7: Commit**

```bash
git add src/editor tests/editor
git commit -m "feat: report presses, drags and releases from the zone canvas, and mark a tile"
```

---

### Task 3: The palette: tiles, enemies and items, pieces

**Files:**
- Modify: `src/editor/components/Palette.tsx` (replace), `src/editor/editor.module.css`, `tests/editor/components.test.tsx` (the `Palette` tests), `tests/editor/editor.test.tsx` (the palette's name)
- Test: `tests/editor/components.test.tsx`

**Interfaces:**
- Consumes: `Tool` (Task 1); `ContentPack`, `ArtSet`
- Produces: `Palette(props: { pack: ContentPack; art?: ArtSet; tool: Tool; onTool(tool: Tool): void })`, now with three tabs

The palette has a tab list named "Palette" with tabs "Tiles", "Enemies and items" and "Pieces", one panel showing the chosen tab's buttons, and an "Erase" button that is always there. Thing buttons show the thing's first art frame and its name ("Snow Crawler"). Choosing a piece selects it with its default settings; while a piece is chosen and the Pieces tab is open, its description and one drop-down per setting (labelled with the setting's description, listing every whole number in its range) are shown below.

- [ ] **Step 1: Write the failing test**

In `tests/editor/components.test.tsx`, replace the whole `describe("Palette", ...)` block with:

```tsx
describe("Palette", () => {
  function setup(tool: Parameters<typeof Palette>[0]["tool"] = { kind: "tile", tile: GROUND }) {
    const onTool = vi.fn();
    const view = render(<Palette pack={snowPack} art={snowArt} tool={tool} onTool={onTool} />);
    return { onTool, rerender: (t: typeof tool) => view.rerender(<Palette pack={snowPack} art={snowArt} tool={t} onTool={onTool} />) };
  }

  it("starts on the tiles, showing which is chosen", async () => {
    const { onTool } = setup();
    expect(screen.getByRole("tab", { name: "Tiles" }).getAttribute("aria-selected")).toBe("true");
    for (const name of ["Ground", "Ice", "Ladder", "Spike", "Ledge", "Erase"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Ground" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Spike" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "tile", tile: SPIKE });
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "erase" });
  });

  it("offers every enemy and item by name", async () => {
    const { onTool } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    for (const def of snowPack.things) expect(screen.getByRole("button", { name: def.name })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Snow Crawler" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "thing", type: "walker" });
    expect(screen.queryByRole("button", { name: "Ground" })).toBeNull();
  });

  it("offers every piece, chosen with its default settings", async () => {
    const { onTool } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Pieces" }));
    for (const piece of snowPack.pieces) expect(screen.getByRole("button", { name: piece.name })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Gap" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "piece", pieceId: "gap", settings: { width: 2 } });
  });

  it("lets a chosen piece's settings be changed", async () => {
    const { onTool, rerender } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Pieces" }));
    rerender({ kind: "piece", pieceId: "stairs-up", settings: { steps: 3, rise: 1 } });
    expect(screen.getByText(/Steps rising to the right/)).toBeTruthy();
    const steps = screen.getByRole("combobox", { name: "How many steps" }) as HTMLSelectElement;
    expect([...steps.options].map((o) => o.value)).toEqual(["1", "2", "3", "4"]);
    await userEvent.selectOptions(steps, "4");
    expect(onTool).toHaveBeenLastCalledWith({ kind: "piece", pieceId: "stairs-up", settings: { steps: 4, rise: 1 } });
  });
});
```

In `tests/editor/editor.test.tsx`, change `screen.getByRole("toolbar", { name: "Tiles" })` to `screen.getByRole("tablist", { name: "Palette" })`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/editor/components.test.tsx tests/editor/editor.test.tsx`
Expected: FAIL. There are no tabs.

- [ ] **Step 3: Replace the palette**

`src/editor/components/Palette.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { ArtSet, Sprite } from "@/runtime/render/art";
import styles from "../editor.module.css";
import type { Tool } from "../state";

const label = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

// A sprite painted pixel by pixel into a small canvas, shown at a fixed size.
function SpriteSwatch({ sprite, palette }: { sprite?: Sprite; palette?: Record<string, string> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !sprite || !palette) return;
    ctx.clearRect(0, 0, sprite.w, sprite.h);
    sprite.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const colour = palette[ch];
        if (!colour) return;
        ctx.fillStyle = colour;
        ctx.fillRect(x, y, 1, 1);
      }),
    );
  }, [sprite, palette]);
  return (
    <canvas
      ref={ref}
      width={sprite?.w ?? 16}
      height={sprite?.h ?? 16}
      className={styles.swatchArt}
      aria-hidden="true"
    />
  );
}

const TABS = [
  { id: "tiles", label: "Tiles" },
  { id: "things", label: "Enemies and items" },
  { id: "pieces", label: "Pieces" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);

type Props = { pack: ContentPack; art?: ArtSet; tool: Tool; onTool(tool: Tool): void };

export function Palette({ pack, art, tool, onTool }: Props) {
  const [tab, setTab] = useState<Tab>("tiles");
  const variant = pack.variants[0];
  const piece = tool.kind === "piece" ? pack.pieces.find((p) => p.id === tool.pieceId) : undefined;

  return (
    <div className={styles.palette}>
      <div className={styles.tabs} role="tablist" aria-label="Palette">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.choices} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "tiles" &&
          pack.tiles.map((tile) => {
            const tileArt = art?.tiles[variant]?.[tile.id];
            return (
              <button
                key={tile.id}
                type="button"
                className={styles.swatch}
                aria-pressed={tool.kind === "tile" && tool.tile === tile.id}
                onClick={() => onTool({ kind: "tile", tile: tile.id })}
              >
                <SpriteSwatch sprite={tileArt?.top ?? tileArt?.fill} palette={art?.palette} />
                {label(tile.name)}
              </button>
            );
          })}
        {tab === "things" &&
          pack.things.map((def) => (
            <button
              key={def.type}
              type="button"
              className={styles.swatch}
              aria-pressed={tool.kind === "thing" && tool.type === def.type}
              onClick={() => onTool({ kind: "thing", type: def.type })}
            >
              <SpriteSwatch sprite={art?.things[def.type]?.[0]} palette={art?.palette} />
              {def.name}
            </button>
          ))}
        {tab === "pieces" &&
          pack.pieces.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.swatch}
              aria-pressed={tool.kind === "piece" && tool.pieceId === p.id}
              onClick={() =>
                onTool({
                  kind: "piece",
                  pieceId: p.id,
                  settings: Object.fromEntries(p.settings.map((s) => [s.key, s.default])),
                })
              }
            >
              {p.name}
            </button>
          ))}
        <button
          type="button"
          className={`${styles.swatch} ${styles.erase}`}
          aria-pressed={tool.kind === "erase"}
          onClick={() => onTool({ kind: "erase" })}
        >
          Erase
        </button>
      </div>
      {tab === "pieces" && piece && tool.kind === "piece" && (
        <div className={styles.pieceSettings}>
          <p>{piece.description}</p>
          {piece.settings.map((s) => (
            <label key={s.key} className={styles.field}>
              {s.description}
              <select
                value={tool.settings[s.key] ?? s.default}
                onChange={(e) =>
                  onTool({ ...tool, settings: { ...tool.settings, [s.key]: Number(e.target.value) } })
                }
              >
                {range(s.min, s.max).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Style the tabs**

In `src/editor/editor.module.css`, replace the `.palette` rule with the rules below, and append the rest:

```css
.palette {
  padding: 0.6rem 1rem 0.75rem;
  border-top: 3px solid var(--ink);
  background: #dde4ee;
}
.tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.6rem;
}
.tab {
  font: inherit;
  font-weight: 600;
  font-size: 15px;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  border: 2px solid transparent;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}
.tab[aria-selected="true"] {
  background: var(--ink);
  color: var(--paper);
}
.tab:focus-visible,
.field select:focus-visible,
.field textarea:focus-visible {
  outline: 3px solid var(--signal);
  outline-offset: 2px;
}
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.pieceSettings {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  align-items: end;
  margin-top: 0.6rem;
}
.pieceSettings p {
  flex-basis: 100%;
  margin: 0;
}
.field {
  display: grid;
  gap: 0.2rem;
  font-size: 15px;
  font-weight: 600;
}
.field select,
.field textarea {
  font: inherit;
  font-weight: 400;
  font-size: 15px;
  padding: 0.3rem 0.4rem;
  border-radius: 8px;
  border: 2px solid var(--panel-2);
}
```

and change `.swatchArt` to keep any sprite inside its 32-pixel square:

```css
.swatchArt {
  width: 32px;
  height: 32px;
  object-fit: contain;
  image-rendering: pixelated;
  background: var(--panel);
  border-radius: 4px;
}
```

- [ ] **Step 5: Run tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all tests PASS; typecheck and lint report nothing.

- [ ] **Step 6: Commit**

```bash
git add src/editor tests/editor
git commit -m "feat: add enemies, items and pieces to the palette"
```

---

### Task 4: The checker in the editor

**Files:**
- Create: `src/editor/useLevelCheck.ts`, `src/editor/components/CheckPanel.tsx`
- Modify: `src/editor/components/ZoneList.tsx` (badges, "Add a climbing zone", disabled), `src/editor/editor.module.css`
- Test: `tests/editor/checks.test.tsx`; update `tests/editor/components.test.tsx` (the `ZoneList` props)

**Interfaces:**
- Consumes: `checkLevel`, `ZoneCheck`, `LevelCheck` (plan 5)
- Produces:
  - `useLevelCheck(project: Project, levelId: string, pack: ContentPack, paused: boolean, delay?: number): LevelCheck | null` (reruns `checkLevel` `delay` ms, default 400, after the last change while not paused; keeps the last result meanwhile)
  - `CheckPanel(props: { zoneCheck?: ZoneCheck; problems: string[] })`
  - `ZoneList` gains `checks?: ZoneCheck[]`, `onAddClimb(): void`, `disabled?: boolean`; its root is no longer the side panel (Task 7 wraps it)

The check panel says "Checking…" before the first result. For a zone that can be crossed: "This zone can be crossed. Difficulty N of 10." For one that cannot: "This zone can't be crossed." followed by the checker's reason. Each warning follows as its own line. Level problems, if any, are listed under a "Level problems" heading.

In the zone list, each zone with a check result shows a small badge after its name: the difficulty number for a crossable zone, a "!" for one that cannot be crossed (named "difficulty N" or "can't be crossed" for screen readers).

- [ ] **Step 1: Write the failing test**

`tests/editor/checks.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ZoneCheck } from "@/checker/check";
import { snowPack } from "@/content/snow/pack";
import { CheckPanel } from "@/editor/components/CheckPanel";
import { ZoneList } from "@/editor/components/ZoneList";
import { newProject } from "@/editor/newProject";
import { useLevelCheck } from "@/editor/useLevelCheck";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let n = 0;
const makeId = () => `id-${++n}`;

const zoneCheck = (overrides: Partial<ZoneCheck> = {}): ZoneCheck => ({
  zoneId: "z",
  name: "Zone 1",
  passable: true,
  difficulty: 3,
  reason: null,
  furthest: null,
  warnings: [],
  ...overrides,
});

describe("useLevelCheck", () => {
  it("checks a moment after the project stops changing, and not while paused", () => {
    vi.useFakeTimers();
    const project = newProject("Checked", makeId);
    const levelId = project.levels[0].id;
    const { result, rerender } = renderHook(
      ({ paused }) => useLevelCheck(project, levelId, snowPack, paused, 400),
      { initialProps: { paused: true } },
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBeNull();
    rerender({ paused: false });
    act(() => vi.advanceTimersByTime(399));
    expect(result.current).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current?.zones).toHaveLength(3);
    expect(result.current?.problems).toEqual([]);
  });
});

describe("CheckPanel", () => {
  it("waits for the first check", () => {
    render(<CheckPanel problems={[]} />);
    expect(screen.getByText("Checking…")).toBeTruthy();
  });

  it("gives the difficulty of a crossable zone", () => {
    render(<CheckPanel zoneCheck={zoneCheck()} problems={[]} />);
    expect(screen.getByText("This zone can be crossed. Difficulty 3 of 10.")).toBeTruthy();
  });

  it("explains a zone that can't be crossed, with its warnings", () => {
    render(
      <CheckPanel
        zoneCheck={zoneCheck({ passable: false, reason: "Cannot get past column 5.", warnings: ["The Snow Crawler at (2, 12) is right where the player arrives."] })}
        problems={[]}
      />,
    );
    expect(screen.getByText("This zone can't be crossed.")).toBeTruthy();
    expect(screen.getByText("Cannot get past column 5.")).toBeTruthy();
    expect(screen.getByText("The Snow Crawler at (2, 12) is right where the player arrives.")).toBeTruthy();
  });

  it("lists level problems", () => {
    render(<CheckPanel zoneCheck={zoneCheck()} problems={['The boss room "Boss Room" has no boss, so the level can never be won.']} />);
    expect(screen.getByRole("heading", { name: "Level problems" })).toBeTruthy();
    expect(screen.getByRole("listitem").textContent).toMatch(/has no boss/);
  });
});

describe("ZoneList with checks", () => {
  const level = newProject("Badges", makeId).levels[0];
  const props = () => ({
    level,
    selectedId: level.zones[0].id,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onAdd: vi.fn(),
    onAddClimb: vi.fn(),
  });

  it("shows each zone's difficulty, or that it can't be crossed", () => {
    const checks = [
      zoneCheck({ zoneId: level.zones[0].id, difficulty: 4 }),
      zoneCheck({ zoneId: level.zones[1].id, passable: false }),
    ];
    render(<ZoneList {...props()} checks={checks} />);
    expect(screen.getByRole("button", { name: /Zone 1.*difficulty 4/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Boss Corridor.*can't be crossed/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Boss Room/ }).textContent).not.toMatch(/!|\d$/);
  });

  it("adds a climbing zone", async () => {
    const p = props();
    render(<ZoneList {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a climbing zone" }));
    expect(p.onAddClimb).toHaveBeenCalled();
  });

  it("can be switched off, while playing", () => {
    render(<ZoneList {...props()} disabled />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
```

In `tests/editor/components.test.tsx`, add `onAddClimb: vi.fn(),` to the `ZoneList` test's `props()`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/editor/checks.test.tsx`
Expected: FAIL, cannot resolve `@/editor/useLevelCheck`.

- [ ] **Step 3: Implement the hook and the panel**

`src/editor/useLevelCheck.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { checkLevel, type LevelCheck } from "@/checker/check";
import type { ContentPack } from "@/model/contentPack";
import type { Project } from "@/model/schema";

// Checks the level a moment after editing pauses; keeps the last result while waiting.
export function useLevelCheck(
  project: Project,
  levelId: string,
  pack: ContentPack,
  paused: boolean,
  delay = 400,
): LevelCheck | null {
  const [check, setCheck] = useState<LevelCheck | null>(null);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setCheck(checkLevel(project, levelId, pack)), delay);
    return () => clearTimeout(timer);
  }, [project, levelId, pack, paused, delay]);
  return check;
}
```

`src/editor/components/CheckPanel.tsx`:

```tsx
"use client";

import type { ZoneCheck } from "@/checker/check";
import styles from "../editor.module.css";

type Props = { zoneCheck?: ZoneCheck; problems: string[] };

export function CheckPanel({ zoneCheck, problems }: Props) {
  return (
    <section className={styles.checks} aria-label="Level check">
      {!zoneCheck ? (
        <p>Checking…</p>
      ) : zoneCheck.passable ? (
        <p className={styles.good}>This zone can be crossed. Difficulty {zoneCheck.difficulty} of 10.</p>
      ) : (
        <>
          <p className={styles.bad}>This zone can&apos;t be crossed.</p>
          <p>{zoneCheck.reason}</p>
        </>
      )}
      {zoneCheck?.warnings.map((warning) => (
        <p key={warning} className={styles.warning}>
          {warning}
        </p>
      ))}
      {problems.length > 0 && (
        <>
          <h3 className={styles.problemsTitle}>Level problems</h3>
          <ul className={styles.problems}>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Update the zone list**

In `src/editor/components/ZoneList.tsx`:

Add `import type { ZoneCheck } from "@/checker/check";`. Add to `Props`: `checks?: ZoneCheck[]; onAddClimb(): void; disabled?: boolean;` and to the destructured props: `checks = [], onAddClimb, disabled = false`.

Change the root element from `<nav className={styles.side} aria-labelledby="zones-title">` to `<nav aria-labelledby="zones-title">`.

Add `disabled={disabled}` to the zone `<button>` and to the "Add a zone" button. After `<span className={styles.zoneName}>{zone.name}</span>`, add the badge:

```tsx
                {(() => {
                  const check = checks.find((c) => c.zoneId === zone.id);
                  if (!check) return null;
                  return check.passable ? (
                    <span className={styles.badge} aria-label={`difficulty ${check.difficulty}`}>
                      {check.difficulty}
                    </span>
                  ) : (
                    <span className={styles.badgeBad} aria-label="can't be crossed">
                      !
                    </span>
                  );
                })()}
```

After the "Add a zone" button, add:

```tsx
      <button type="button" className={`${styles.button} ${styles.add}`} disabled={disabled} onClick={onAddClimb}>
        Add a climbing zone
      </button>
```

- [ ] **Step 5: Style the badges and the panel**

Append to `src/editor/editor.module.css`:

```css
.badge,
.badgeBad {
  flex: none;
  min-width: 1.5rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  background: var(--ok);
  color: var(--ink);
}
.badgeBad {
  background: var(--warn);
  color: #fff;
}
.checks {
  max-width: 44rem;
  margin-top: 0.9rem;
  font-size: 15px;
}
.checks p {
  margin: 0.25rem 0;
}
.good {
  font-weight: 600;
  color: #137a70;
}
.bad {
  font-weight: 700;
  color: #c2214a;
}
.warning {
  color: #8a5a00;
}
.problemsTitle {
  font-size: 17px;
  margin: 0.75rem 0 0.25rem;
}
.problems {
  margin: 0;
  padding-left: 1.2rem;
}
.add + .add {
  margin-top: 0.5rem;
}
```

- [ ] **Step 6: Run tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all tests PASS; typecheck and lint report nothing. (The editor passes no `onAddClimb` yet; TypeScript will flag it. Pass `onAddClimb={addZone}` in `Editor.tsx` for now; Task 7 replaces the file.)

- [ ] **Step 7: Commit**

```bash
git add src/editor tests/editor
git commit -m "feat: show the checker's verdict on zones, with badges and a check panel"
```

---

### Task 5: Zone settings

**Files:**
- Create: `src/editor/components/ZoneSettings.tsx`
- Modify: `src/editor/editor.module.css`
- Test: `tests/editor/zoneSettings.test.tsx`

**Interfaces:**
- Consumes: `Command`; `MAX_SCREENS`, `zoneSize`, `Edge`, `Opening`; `Level`, `Zone`, `ContentPack`
- Produces: `ZoneSettings(props: { level: Level; zone: Zone; pack: ContentPack; onCommand(command: Command): void; onDelete(): void })`

A "This zone" panel with:
- **Length**: a drop-down of 1 to 8 screens (1 to 6 for a climbing zone) sending `resizeZone`; for the boss corridor and room, the note "Boss zones are always one screen." instead.
- **Look**: a drop-down of the pack's variants ("Outdoor", "Cave") sending `setZoneVariant`.
- **What it's for**: a text box sending `setZoneIntent` when it loses focus with a changed value.
- **Way in** and (except in the boss room) **Way out**: each a "Side" drop-down (left side, top or bottom for the way in; right side, top or bottom for the way out) and a "Starts at" drop-down of rows (for a side) or columns (for the top or bottom), sending `setZoneOpenings`. A side opening is 4 tiles; a top or bottom one is 2. Choosing a new side starts it near the bottom of a side, or in the middle of the top or bottom.
- **Move earlier** and **Move later** buttons sending `moveZone`, disabled at the ends (not shown for boss zones).
- **Delete this zone** calling `onDelete` (not shown for boss zones).

- [ ] **Step 1: Write the failing test**

`tests/editor/zoneSettings.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowPack } from "@/content/snow/pack";
import { ZoneSettings } from "@/editor/components/ZoneSettings";
import { newProject } from "@/editor/newProject";
import type { Level, Zone } from "@/model/schema";

afterEach(cleanup);

let n = 0;
const makeId = () => `id-${++n}`;
const base = newProject("Settings", makeId).levels[0];
// A level with two ordinary zones before the boss zones.
const second: Zone = { ...base.zones[0], id: "second", name: "Zone 2" };
const level: Level = { ...base, zones: [base.zones[0], second, base.zones[1], base.zones[2]] };

function setup(zone: Zone) {
  const onCommand = vi.fn();
  const onDelete = vi.fn();
  render(<ZoneSettings level={level} zone={zone} pack={snowPack} onCommand={onCommand} onDelete={onDelete} />);
  const ids = { levelId: level.id, zoneId: zone.id };
  return { onCommand, onDelete, ids };
}

describe("ZoneSettings", () => {
  it("changes the length", async () => {
    const { onCommand, ids } = setup(level.zones[0]);
    const length = screen.getByRole("combobox", { name: "Length" }) as HTMLSelectElement;
    expect(length.options).toHaveLength(8);
    await userEvent.selectOptions(length, "3");
    expect(onCommand).toHaveBeenCalledWith({ name: "resizeZone", args: { ...ids, screens: 3 } });
  });

  it("offers up to six screens for a climbing zone", () => {
    setup({ ...level.zones[0], scroll: "vertical", screens: 2 });
    expect((screen.getByRole("combobox", { name: "Length" }) as HTMLSelectElement).options).toHaveLength(6);
  });

  it("changes the look", async () => {
    const { onCommand, ids } = setup(level.zones[0]);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Look" }), "cave");
    expect(onCommand).toHaveBeenCalledWith({ name: "setZoneVariant", args: { ...ids, variant: "cave" } });
  });

  it("saves what the zone is for when you leave the box, if it changed", async () => {
    const { onCommand, ids } = setup(level.zones[0]);
    const box = screen.getByRole("textbox", { name: "What it's for" });
    await userEvent.click(box);
    await userEvent.tab();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.type(box, "Teach the ice floor");
    await userEvent.tab();
    expect(onCommand).toHaveBeenCalledWith({ name: "setZoneIntent", args: { ...ids, intent: "Teach the ice floor" } });
  });

  it("moves the way out to the top, starting in the middle", async () => {
    const { onCommand, ids } = setup(level.zones[0]);
    const side = screen.getByRole("combobox", { name: "Way out side" });
    expect([...(side as HTMLSelectElement).options].map((o) => o.text)).toEqual(["Right side", "Top", "Bottom"]);
    await userEvent.selectOptions(side, "top");
    expect(onCommand).toHaveBeenCalledWith({
      name: "setZoneOpenings",
      args: { ...ids, exit: { edge: "top", from: 7, to: 8 } },
    });
  });

  it("moves the way in along its side", async () => {
    const { onCommand, ids } = setup(level.zones[0]);
    const start = screen.getByRole("combobox", { name: "Way in starts at row" }) as HTMLSelectElement;
    expect(start.value).toBe("9");
    expect(start.options).toHaveLength(12);
    await userEvent.selectOptions(start, "5");
    expect(onCommand).toHaveBeenCalledWith({
      name: "setZoneOpenings",
      args: { ...ids, entry: { edge: "left", from: 5, to: 8 } },
    });
  });

  it("reorders zones, but not past the ends", async () => {
    const first = setup(level.zones[0]);
    expect((screen.getByRole("button", { name: "Move earlier" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Move later" }));
    expect(first.onCommand).toHaveBeenCalledWith({ name: "moveZone", args: { ...first.ids, toIndex: 1 } });
    cleanup();
    setup(second);
    expect((screen.getByRole("button", { name: "Move later" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("deletes through the editor", async () => {
    const { onDelete } = setup(level.zones[0]);
    await userEvent.click(screen.getByRole("button", { name: "Delete this zone" }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("keeps boss zones one screen with no way out of the boss room", () => {
    setup(level.zones[3]);
    expect(screen.getByText("Boss zones are always one screen.")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Length" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Way out side" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete this zone" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move later" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/editor/zoneSettings.test.tsx`
Expected: FAIL, cannot resolve `@/editor/components/ZoneSettings`.

- [ ] **Step 3: Implement the settings panel**

`src/editor/components/ZoneSettings.tsx`:

```tsx
"use client";

import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import { MAX_SCREENS, zoneSize, type Edge, type Opening } from "@/model/geometry";
import type { Level, Zone } from "@/model/schema";
import styles from "../editor.module.css";

const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SIDE_NAMES: Record<Edge, string> = { left: "Left side", right: "Right side", top: "Top", bottom: "Bottom" };
const isSide = (edge: Edge) => edge === "left" || edge === "right";
const lengthOf = (edge: Edge) => (isSide(edge) ? 4 : 2);

function OpeningField(props: {
  legend: string;
  sides: Edge[];
  opening: Opening;
  zone: Zone;
  onChange(opening: Opening): void;
}) {
  const { legend, sides, opening, zone, onChange } = props;
  const size = zoneSize(zone.scroll, zone.screens);
  const last = (edge: Edge) => (isSide(edge) ? size.height : size.width) - lengthOf(edge);
  const set = (edge: Edge, from: number) => onChange({ edge, from, to: from + lengthOf(edge) - 1 });
  const fresh = (edge: Edge) =>
    Math.min(last(edge), isSide(edge) ? size.height - 6 : Math.floor((size.width - 2) / 2));
  return (
    <fieldset className={styles.fieldset}>
      <legend>{legend}</legend>
      <label className={styles.field}>
        <span>Side</span>
        <select
          aria-label={`${legend} side`}
          value={opening.edge}
          onChange={(e) => {
            const edge = e.target.value as Edge;
            set(edge, fresh(edge));
          }}
        >
          {sides.map((edge) => (
            <option key={edge} value={edge}>
              {SIDE_NAMES[edge]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Starts at</span>
        <select
          aria-label={`${legend} starts at ${isSide(opening.edge) ? "row" : "column"}`}
          value={opening.from}
          onChange={(e) => set(opening.edge, Number(e.target.value))}
        >
          {range(0, last(opening.edge)).map((n) => (
            <option key={n} value={n}>
              {isSide(opening.edge) ? `Row ${n}` : `Column ${n}`}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

type Props = {
  level: Level;
  zone: Zone;
  pack: ContentPack;
  onCommand(command: Command): void;
  onDelete(): void;
};

export function ZoneSettings({ level, zone, pack, onCommand, onDelete }: Props) {
  const ids = { levelId: level.id, zoneId: zone.id };
  const boss = zone.kind !== "normal";
  const index = level.zones.findIndex((z) => z.id === zone.id);
  const lastNormal = level.zones.length - 3;

  return (
    <section className={styles.settings} aria-labelledby="zone-settings-title">
      <h2 id="zone-settings-title" className={styles.sideTitle}>
        This zone
      </h2>
      {boss ? (
        <p className={styles.note}>Boss zones are always one screen.</p>
      ) : (
        <label className={styles.field}>
          Length
          <select
            value={zone.screens}
            onChange={(e) => onCommand({ name: "resizeZone", args: { ...ids, screens: Number(e.target.value) } })}
          >
            {range(1, MAX_SCREENS[zone.scroll]).map((n) => (
              <option key={n} value={n}>
                {n} screen{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles.field}>
        Look
        <select
          value={zone.variant}
          onChange={(e) => onCommand({ name: "setZoneVariant", args: { ...ids, variant: e.target.value } })}
        >
          {pack.variants.map((v) => (
            <option key={v} value={v}>
              {capital(v)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        What it&apos;s for
        <textarea
          key={`${zone.id}:${zone.intent}`}
          defaultValue={zone.intent}
          maxLength={200}
          rows={2}
          onBlur={(e) => {
            if (e.target.value !== zone.intent) {
              onCommand({ name: "setZoneIntent", args: { ...ids, intent: e.target.value } });
            }
          }}
        />
      </label>
      <OpeningField
        legend="Way in"
        sides={["left", "top", "bottom"]}
        opening={zone.entry}
        zone={zone}
        onChange={(entry) => onCommand({ name: "setZoneOpenings", args: { ...ids, entry } })}
      />
      {zone.exit && (
        <OpeningField
          legend="Way out"
          sides={["right", "top", "bottom"]}
          opening={zone.exit}
          zone={zone}
          onChange={(exit) => onCommand({ name: "setZoneOpenings", args: { ...ids, exit } })}
        />
      )}
      {!boss && (
        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            disabled={index <= 0}
            onClick={() => onCommand({ name: "moveZone", args: { ...ids, toIndex: index - 1 } })}
          >
            Move earlier
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={index >= lastNormal}
            onClick={() => onCommand({ name: "moveZone", args: { ...ids, toIndex: index + 1 } })}
          >
            Move later
          </button>
        </div>
      )}
      {!boss && (
        <button type="button" className={`${styles.button} ${styles.danger}`} onClick={onDelete}>
          Delete this zone
        </button>
      )}
    </section>
  );
}
```

The "Starts at" drop-downs are named "Way in starts at row" and so on through `aria-label`, so they are distinct for screen readers and tests; the visible label stays short.

- [ ] **Step 4: Style it**

Append to `src/editor/editor.module.css`:

```css
.settings {
  display: grid;
  gap: 0.7rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 2px solid var(--panel-2);
}
.settings .field {
  color: var(--paper);
}
.fieldset {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  margin: 0;
  padding: 0.5rem 0.6rem 0.6rem;
  border: 2px solid var(--panel-2);
  border-radius: 10px;
}
.fieldset legend {
  padding: 0 0.3rem;
  font-weight: 600;
  font-size: 15px;
}
.note {
  margin: 0;
  font-size: 15px;
  opacity: 0.85;
}
.row {
  display: flex;
  gap: 0.5rem;
}
.row .button {
  flex: 1;
  font-size: 15px;
}
.danger {
  border-color: var(--warn);
  background: transparent;
  color: #ff9fb3;
}
```

- [ ] **Step 5: Run tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all tests PASS; typecheck and lint report nothing.

- [ ] **Step 6: Commit**

```bash
git add src/editor tests/editor/zoneSettings.test.tsx
git commit -m "feat: add zone settings: length, look, purpose, ways in and out, order, delete"
```

---

### Task 6: Export and import

**Files:**
- Create: `src/editor/files.ts`
- Modify: `src/editor/ProjectsHome.tsx`, `src/editor/home.module.css`
- Test: `tests/editor/files.test.ts`, `tests/editor/home.test.tsx`

**Interfaces:**
- Consumes: `parseProject`, `ParseResult` (plan 1); `getPack` (plan 6)
- Produces:
  - `FILE_EXTENSION = ".megarom.json"`
  - `exportFileName(project: Project): string` ("Snow Fortress" becomes `snow-fortress.megarom.json`; a name with no letters or digits becomes `game.megarom.json`)
  - `projectToJson(project: Project): string`
  - `readProjectText(text: string, getPack, makeId: () => string): ParseResult` (the parsed project with a new id, or `{ ok: false, error }`; text that is not JSON gives "This file isn't a MegaRomBuilder game.")
  - `downloadProject(project: Project): void` (browser only)
  - `ProjectsHome` gains an "Import a game file" button

This also closes the deferred item about catching `JSON.parse` errors before `parseProject`.

- [ ] **Step 1: Write the failing tests**

`tests/editor/files.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPack } from "@/content/packs";
import { exportFileName, projectToJson, readProjectText } from "@/editor/files";
import { newProject } from "@/editor/newProject";

let n = 0;
const makeId = () => `id-${++n}`;

describe("exportFileName", () => {
  it("is the game's name in lower case with dashes", () => {
    expect(exportFileName(newProject("Snow Fortress!", makeId))).toBe("snow-fortress.megarom.json");
    expect(exportFileName(newProject("???", makeId))).toBe("game.megarom.json");
  });
});

describe("readProjectText", () => {
  it("reads an exported game back, with a new id", () => {
    const game = newProject("Round Trip", makeId);
    const result = readProjectText(projectToJson(game), getPack, () => "fresh");
    expect(result).toEqual({ ok: true, project: { ...game, id: "fresh" } });
  });

  it("refuses text that is not JSON", () => {
    expect(readProjectText("not json {", getPack, makeId)).toEqual({
      ok: false,
      error: "This file isn't a MegaRomBuilder game.",
    });
  });

  it("refuses JSON that is not a game, or is from a newer version", () => {
    expect(readProjectText('{"hello": 1}', getPack, makeId).ok).toBe(false);
    const newer = { ...newProject("Future", makeId), formatVersion: 99 };
    const result = readProjectText(JSON.stringify(newer), getPack, makeId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/);
  });
});
```

Add to `tests/editor/home.test.tsx` (and add `import { projectToJson } from "@/editor/files";` and `import { newProject } from "@/editor/newProject";` to its imports):

```tsx
describe("importing", () => {
  it("imports a game file as a new game and opens it", async () => {
    const { store, navigate, makeId } = setup();
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} />);
    const game = newProject("Shared Game", () => "original");
    const file = new File([projectToJson(game)], "shared-game.megarom.json", { type: "application/json" });
    await userEvent.upload(screen.getByLabelText("Import a game file"), file);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/edit/id-1"));
    expect(store.save.mock.calls[0][0]).toMatchObject({ id: "id-1", name: "Shared Game" });
  });

  it("explains a file that isn't a game and saves nothing", async () => {
    const { store, navigate, makeId } = setup();
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} />);
    const file = new File(["not a game"], "notes.json", { type: "application/json" });
    await userEvent.upload(screen.getByLabelText("Import a game file"), file);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "That file can't be opened. This file isn't a MegaRomBuilder game.",
    );
    expect(store.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/editor/files.test.ts tests/editor/home.test.tsx`
Expected: FAIL, cannot resolve `@/editor/files`.

- [ ] **Step 3: Implement the files module**

`src/editor/files.ts`:

```ts
import type { ContentPack } from "@/model/contentPack";
import { parseProject, type ParseResult } from "@/model/parse";
import type { Project } from "@/model/schema";

export const FILE_EXTENSION = ".megarom.json";

export function exportFileName(project: Project): string {
  const slug = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "game"}${FILE_EXTENSION}`;
}

export const projectToJson = (project: Project): string => JSON.stringify(project, null, 2);

// Reads a game file. An imported game always gets a new id, so it can't overwrite a saved one.
export function readProjectText(
  text: string,
  getPack: (id: string) => ContentPack | undefined,
  makeId: () => string,
): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't a MegaRomBuilder game." };
  }
  const result = parseProject(raw, getPack);
  return result.ok ? { ok: true, project: { ...result.project, id: makeId() } } : result;
}

export function downloadProject(project: Project): void {
  const url = URL.createObjectURL(new Blob([projectToJson(project)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(project);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Add importing to the home page**

In `src/editor/ProjectsHome.tsx`, add the imports `import { getPack } from "@/content/packs";` and `import { readProjectText } from "./files";`, add `const [importError, setImportError] = useState<string | null>(null);` after the other state, and add after the "Start from the demo stage" button (inside the form):

```tsx
        <label className={styles.secondary}>
          Import a game file
          <input
            type="file"
            accept=".json,application/json"
            className={styles.hiddenInput}
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              const result = readProjectText(await file.text(), getPack, makeId);
              input.value = "";
              if (!result.ok) {
                setImportError(result.error);
                return;
              }
              setImportError(null);
              await open(result.project);
            }}
          />
        </label>
```

and after the form:

```tsx
      {importError && (
        <p className={styles.alert} role="alert">
          That file can&apos;t be opened. {importError}
        </p>
      )}
```

Append to `src/editor/home.module.css`:

```css
.hiddenInput {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.secondary:focus-within {
  outline: 3px solid var(--signal);
  outline-offset: 2px;
}
.alert {
  margin: 1rem 0 0;
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  background: var(--warn);
  color: #fff;
  font-weight: 600;
}
```

- [ ] **Step 5: Run tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all tests PASS; typecheck and lint report nothing.

- [ ] **Step 6: Commit**

```bash
git add src/editor tests/editor
git commit -m "feat: export game files and import them as new games"
```

---

### Task 7: Putting the editor together

**Files:**
- Modify: `src/editor/Editor.tsx` (replace), `src/editor/components/Toolbar.tsx`, `tests/editor/components.test.tsx` (the `Toolbar` props)
- Test: `tests/editor/tools.editor.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1 to 6, and plan 6's editor
- Produces:
  - `Toolbar` gains `playing: boolean` (disables Undo, Redo and both Play buttons while true) and `onExport(): void` (an "Export" button)
  - `Editor` gains `confirm?: (message: string) => boolean` (default `window.confirm`)

How the editor uses the tools:

| Tool | Press | Drag | Release |
|---|---|---|---|
| tile, erase | starts a stroke and paints (or erases a thing, or empties the tile) | paints each new tile | ends the stroke (one undo step) |
| thing, on an existing thing | picks it up | nothing yet | moves it to the tile let go on (nothing if off the canvas) |
| thing, on empty space | places a new one | nothing | nothing |
| piece | stamps the piece | nothing | nothing |

The sidebar holds the zone list and, while not playing, the zone settings. The check runs while not playing and not mid-stroke; the selected zone's check marks its furthest point on the canvas when it can't be crossed. "Add a climbing zone" adds a two-screen climbing zone (named with `nextZoneName`) and selects it. Deleting asks first: `Delete "Zone 2"? You can undo this.`

- [ ] **Step 1: Write the failing test**

`tests/editor/tools.editor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@/editor/Editor";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

let n = 0;
const makeId = () => `id-${++n}`;

// Renders the editor and returns helpers to press on tiles and to read the saved project.
function setup(confirm = () => true) {
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const view = render(
    <Editor initial={newProject("Tools", makeId)} store={{ save }} makeId={makeId} saveDelay={60_000} confirm={confirm} />,
  );
  const canvas = () => {
    const el = screen.getByTestId("zone-canvas");
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: el.offsetWidth || Number.parseInt(el.style.width), height: Number.parseInt(el.style.height), right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    return el;
  };
  const at = (tx: number, ty: number) => ({ clientX: tx * 32 + 16, clientY: ty * 32 + 16, button: 0 });
  const click = (tx: number, ty: number) => {
    const el = canvas();
    fireEvent.pointerDown(el, at(tx, ty));
    fireEvent.pointerUp(el, at(tx, ty));
  };
  const drag = (from: [number, number], to: [number, number]) => {
    const el = canvas();
    fireEvent.pointerDown(el, at(...from));
    fireEvent.pointerMove(el, at(...to));
    fireEvent.pointerUp(el, at(...to));
  };
  // Closing the editor saves at once, so the last saved project is what was built.
  const saved = (): Project => {
    view.unmount();
    return save.mock.calls[save.mock.calls.length - 1][0];
  };
  return { click, drag, saved, save };
}

const firstZone = (p: Project) => p.levels[0].zones[0];

describe("building with tools", () => {
  it("places an enemy where you click", async () => {
    const { click, saved } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    await userEvent.click(screen.getByRole("button", { name: "Snow Crawler" }));
    click(5, 12);
    expect(firstZone(saved()).things).toEqual([expect.objectContaining({ type: "walker", x: 5, y: 12 })]);
  });

  it("drags an enemy to a new tile", async () => {
    const { click, drag, saved } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    await userEvent.click(screen.getByRole("button", { name: "Snow Crawler" }));
    click(5, 12);
    drag([5, 12], [9, 12]);
    const things = firstZone(saved()).things;
    expect(things).toHaveLength(1);
    expect(things[0]).toMatchObject({ x: 9, y: 12 });
  });

  it("erases an enemy before the tile under it", async () => {
    const { click, saved } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    await userEvent.click(screen.getByRole("button", { name: "Snow Crawler" }));
    click(5, 12);
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    click(5, 12);
    const zone = firstZone(saved());
    expect(zone.things).toEqual([]);
    expect(zone.tiles[12 * 16 + 5]).toBe(0);
  });

  it("stamps a piece", async () => {
    const { click, saved } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Pieces" }));
    await userEvent.click(screen.getByRole("button", { name: "Gap" }));
    click(4, 5);
    const zone = firstZone(saved());
    expect(zone.tiles[13 * 16 + 6]).toBe(0); // the pit
    expect(zone.tiles[13 * 16 + 5]).toBe(1); // floor before it
  });

  it("shows the checker's verdict after a pause", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    expect(screen.getByText("Checking…")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("This zone can be crossed. Difficulty 1 of 10.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Zone 1.*difficulty 1/ })).toBeTruthy();
  });

  it("shows a way out that no longer lines up as a level problem", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Way out side" }), "top");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("heading", { name: "Level problems" })).toBeTruthy();
    expect(screen.getByText(/must be entered from its bottom edge/)).toBeTruthy();
  });

  it("adds a climbing zone and selects it", async () => {
    const { saved } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add a climbing zone" }));
    expect(screen.getByLabelText("Zone 2, 2 screens")).toBeTruthy();
    expect(saved().levels[0].zones[1]).toMatchObject({ scroll: "vertical", screens: 2 });
  });

  it("deletes a zone after asking, and not if you say no", async () => {
    const answers = [false, true];
    const confirm = vi.fn(() => answers.shift() ?? false);
    setup(confirm);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete this zone" }));
    expect(confirm).toHaveBeenCalledWith('Delete "Zone 2"? You can undo this.');
    expect(screen.getByRole("button", { name: /Zone 2/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Delete this zone" }));
    expect(screen.queryByRole("button", { name: /Zone 2/ })).toBeNull();
  });

  it("exports the game as a file named after it", async () => {
    setup();
    const createObjectURL = vi.fn(() => "blob:game");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    let downloaded = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(downloaded).toBe("tools.megarom.json");
    expect(createObjectURL).toHaveBeenCalled();
  });

  it("switches editing controls off while playing", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Add a zone" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("heading", { name: "This zone" })).toBeNull();
  });
});
```

In `tests/editor/components.test.tsx`, add `playing: false, onExport: vi.fn(),` to the `Toolbar` test's `props()`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/editor/tools.editor.test.tsx`
Expected: FAIL. There is no "Enemies and items" behaviour on the canvas, no Export button, and no zone settings.

- [ ] **Step 3: Extend the toolbar**

In `src/editor/components/Toolbar.tsx`, add `playing: boolean;` and `onExport(): void;` to `Props` and to the destructured props; add `disabled={playing}` to the "Play from this zone" and "Play" buttons; change the Undo and Redo `disabled` to `!canUndo || playing` and `!canRedo || playing`; and add before the Undo button:

```tsx
      <button type="button" className={styles.button} onClick={onExport}>
        Export
      </button>
```

- [ ] **Step 4: Replace the editor**

`src/editor/Editor.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Command } from "@/commands/types";
import { canRedo, canUndo } from "@/commands/history";
import { getArt, getPack } from "@/content/packs";
import type { Project } from "@/model/schema";
import type { Skin } from "@/runtime/render/draw";
import { PlayCanvas } from "@/runtime/render/PlayCanvas";
import { browserCanvas, createSpriteCache } from "@/runtime/render/sprites";
import { CheckPanel } from "./components/CheckPanel";
import { Palette } from "./components/Palette";
import { Toolbar } from "./components/Toolbar";
import { ZoneCanvas } from "./components/ZoneCanvas";
import { ZoneList } from "./components/ZoneList";
import { ZoneSettings } from "./components/ZoneSettings";
import styles from "./editor.module.css";
import { downloadProject } from "./files";
import { currentLevel, currentZone, editorReducer, initialEditor, nextZoneName } from "./state";
import { paintCommand, placeCommand, thingAt } from "./tools";
import { useLevelCheck } from "./useLevelCheck";
import type { Spot } from "./zoneView";

type Props = {
  initial: Project;
  store: { save(project: Project): Promise<void> };
  makeId?: () => string;
  saveDelay?: number;
  confirm?: (message: string) => boolean;
};

const typing = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return (
    el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.tagName === "SELECT" || el?.isContentEditable === true
  );
};

type Drag = { kind: "stroke" } | { kind: "move"; thingId: string } | null;

export function Editor({
  initial,
  store,
  makeId = () => crypto.randomUUID(),
  saveDelay = 600,
  confirm = (message) => window.confirm(message),
}: Props) {
  const pack = getPack(initial.contentPackId);
  if (!pack) throw new Error(`The content pack "${initial.contentPackId}" is not available.`);
  const art = getArt(initial.contentPackId);
  const reducer = useMemo(() => editorReducer({ pack }), [pack]);
  const [state, dispatch] = useReducer(reducer, undefined, () => initialEditor(initial, pack.groundTileId));
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");

  const skin = useMemo<Skin | undefined>(() => {
    if (!art || typeof document === "undefined") return undefined;
    return { set: art, image: createSpriteCache(art.palette, browserCanvas) };
  }, [art]);

  const project = state.history.project;
  const level = currentLevel(state);
  const zone = currentZone(state);
  const strokeOpen = state.history.open !== null;
  const playing = state.playing !== null;

  // Saving. A change is saved a little while after the project last changed (never in the middle
  // of a stroke), and at once when the page is hidden or the editor closes, so the last change is
  // never lost. If the game is opened in another tab, this tab stops saving so neither overwrites
  // the other.
  const lastSaved = useRef(project);
  const pending = useRef<Project | null>(null);
  const elsewhere = useRef(false);
  const saveRef = useRef(store.save);
  useEffect(() => {
    saveRef.current = store.save;
  }, [store]);
  const [openElsewhere, setOpenElsewhere] = useState(false);

  const flush = useCallback(() => {
    const next = pending.current;
    if (!next || elsewhere.current) return;
    pending.current = null;
    Promise.resolve(saveRef.current(next)).then(
      () => {
        lastSaved.current = next;
        setSaveState(pending.current ? "saving" : "saved");
      },
      () => {
        pending.current ??= next;
        setSaveState("error");
      },
    );
  }, []);

  useEffect(() => {
    if (strokeOpen) return;
    if (project === lastSaved.current) {
      pending.current = null; // undone back to what is saved
      setSaveState("saved");
      return;
    }
    pending.current = project;
    setSaveState("saving");
    const timer = setTimeout(flush, saveDelay);
    return () => clearTimeout(timer);
  }, [project, strokeOpen, saveDelay, flush]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      flush();
      if (pending.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", onLeave);
      flush();
    };
  }, [flush]);

  // The newest tab to open a game keeps it; any older tab stops saving and says why.
  const gameId = initial.id;
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("megarombuilder-editors");
    const tab = makeId();
    channel.onmessage = (e: MessageEvent<{ gameId: string; tab: string }>) => {
      if (e.data?.gameId !== gameId || e.data.tab === tab) return;
      elsewhere.current = true;
      setOpenElsewhere(true);
    };
    channel.postMessage({ gameId, tab });
    return () => channel.close();
    // makeId is only used for a token; a new one each render must not reopen the channel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Keyboard: undo and redo, and Escape to stop playing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.playing) {
        if (e.key === "Escape" && !typing(e.target)) dispatch({ type: "stopPlaying" });
        return;
      }
      if (typing(e.target)) return;
      const command = e.metaKey || e.ctrlKey;
      if (command && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.playing]);

  // The checker, rerun once editing pauses.
  const check = useLevelCheck(project, level.id, pack, strokeOpen || playing);
  const zoneCheck = check?.zones.find((z) => z.zoneId === zone.id);
  const marker = zoneCheck && !zoneCheck.passable ? zoneCheck.furthest : null;

  const run = (command: Command) => dispatch({ type: "run", command });

  // What the canvas does with the current tool.
  const drag = useRef<Drag>(null);
  const press = (spot: Spot) => {
    const tool = state.tool;
    if (tool.kind === "tile" || tool.kind === "erase") {
      dispatch({ type: "begin", label: tool.kind === "erase" ? "Erase" : "Paint" });
      run(paintCommand(tool, level.id, zone, pack, spot));
      drag.current = { kind: "stroke" };
      return;
    }
    if (tool.kind === "thing") {
      const hit = thingAt(zone, pack, spot.point);
      if (hit) {
        drag.current = { kind: "move", thingId: hit.id };
        return;
      }
    }
    run(placeCommand(tool, level.id, zone, spot, makeId));
  };
  const dragTo = (spot: Spot) => {
    const tool = state.tool;
    if (drag.current?.kind === "stroke" && (tool.kind === "tile" || tool.kind === "erase")) {
      run(paintCommand(tool, level.id, zone, pack, spot));
    }
  };
  const release = (spot: Spot | null) => {
    const ended = drag.current;
    drag.current = null;
    if (ended?.kind === "stroke") dispatch({ type: "commit" });
    else if (ended?.kind === "move" && spot) {
      run({
        name: "moveThing",
        args: { levelId: level.id, zoneId: zone.id, thingId: ended.thingId, x: spot.tile.x, y: spot.tile.y },
      });
    }
  };

  const addZone = (climb: boolean) => {
    const zoneId = makeId();
    const args = climb
      ? { levelId: level.id, zoneId, name: nextZoneName(level), scroll: "vertical", screens: 2 }
      : { levelId: level.id, zoneId, name: nextZoneName(level) };
    run({ name: "addZone", args });
    dispatch({ type: "selectZone", zoneId });
  };

  const deleteZone = () => {
    if (!confirm(`Delete "${zone.name}"? You can undo this.`)) return;
    run({ name: "removeZone", args: { levelId: level.id, zoneId: zone.id } });
  };

  return (
    <div className={styles.app}>
      <Toolbar
        title={project.name}
        saveState={openElsewhere ? "elsewhere" : saveState}
        canUndo={canUndo(state.history)}
        canRedo={canRedo(state.history)}
        playing={playing}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onPlay={() => dispatch({ type: "play", fromZoneId: null })}
        onPlayFromZone={() => dispatch({ type: "play", fromZoneId: zone.id })}
        onExport={() => downloadProject(project)}
      />
      <aside className={styles.side}>
        <ZoneList
          level={level}
          selectedId={zone.id}
          checks={check?.zones}
          disabled={playing}
          onSelect={(zoneId) => dispatch({ type: "selectZone", zoneId })}
          onRename={(zoneId, name) => run({ name: "renameZone", args: { levelId: level.id, zoneId, name } })}
          onAdd={() => addZone(false)}
          onAddClimb={() => addZone(true)}
        />
        {!playing && <ZoneSettings level={level} zone={zone} pack={pack} onCommand={run} onDelete={deleteZone} />}
      </aside>
      {state.playing ? (
        <main className={styles.playing}>
          <PlayCanvas
            project={project}
            levelId={level.id}
            pack={pack}
            art={art}
            startZoneId={state.playing.fromZoneId ?? undefined}
          />
          <button type="button" className={styles.primary} onClick={() => dispatch({ type: "stopPlaying" })}>
            Stop playing
          </button>
        </main>
      ) : (
        <main className={styles.work}>
          <div className={styles.stage}>
            {openElsewhere && (
              <p className={styles.alert} role="alert">
                This game is open in another tab, so changes here aren&apos;t saved. Keep building in the
                other tab.
              </p>
            )}
            {state.error && (
              <p className={styles.alert} role="alert">
                {state.error}
                <button type="button" onClick={() => dispatch({ type: "dismissError" })}>
                  Dismiss
                </button>
              </p>
            )}
            <ZoneCanvas
              zone={zone}
              pack={pack}
              skin={skin}
              checkpoints={level.checkpoints}
              zoom={2}
              marker={marker}
              onPress={press}
              onDrag={dragTo}
              onRelease={release}
            />
            <CheckPanel zoneCheck={zoneCheck} problems={check?.problems ?? []} />
          </div>
          <Palette pack={pack} art={art} tool={state.tool} onTool={(tool) => dispatch({ type: "tool", tool })} />
        </main>
      )}
    </div>
  );
}
```

Two plan 6 minors are fixed in passing here: Escape typed in a text box no longer stops play, and the typing check now covers drop-downs.

- [ ] **Step 5: Run tests, typecheck, lint and build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all tests PASS, including every plan 6 editor test; typecheck and lint report nothing; the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire the tools, checker, zone settings and export into the editor"
```

---

### Task 8: End to end

**Files:**
- Create: `e2e/tools.spec.ts`

**Interfaces:**
- Consumes: the running app
- Produces: a browser test of building with every tool, the checker's verdict, zone settings, and an export and import round trip; screenshots for a look at the design

- [ ] **Step 1: Write the test**

`e2e/tools.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

async function tileClick(page: Page, x: number, y: number) {
  const box = await page.getByTestId("zone-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  await page.mouse.click(box.x + x * 32 + 16, box.y + y * 32 + 16);
}

test("build with every tool, check, change a zone, export and import", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("Tool Test");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await expect(page.getByText("This zone can be crossed. Difficulty 1 of 10.")).toBeVisible();

  // Pieces: a gap the checker accepts, then one it does not.
  await page.getByRole("tab", { name: "Pieces" }).click();
  await page.getByRole("button", { name: "Gap", exact: true }).click();
  await tileClick(page, 4, 5);
  await expect(page.getByText(/This zone can be crossed/)).toBeVisible();
  await page.getByRole("button", { name: "Erase" }).click();
  for (const x of [8, 9]) {
    await tileClick(page, x, 13);
    await tileClick(page, x, 14);
  }
  await expect(page.getByText("This zone can't be crossed.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Zone 1.*can't be crossed/ })).toBeVisible();
  await page.screenshot({ path: "test-results/tools-blocked.png", fullPage: true });
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(/This zone can be crossed/)).toBeVisible();

  // Enemies: place one, then drag it along.
  await page.getByRole("tab", { name: "Enemies and items" }).click();
  await page.getByRole("button", { name: "Snow Crawler" }).click();
  await tileClick(page, 12, 12);
  const box = await page.getByTestId("zone-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  await page.mouse.move(box.x + 12 * 32 + 16, box.y + 12 * 32 + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 14 * 32 + 16, box.y + 12 * 32 + 20, { steps: 6 });
  await page.mouse.up();

  // Zone settings: two screens long, cave look.
  await page.getByRole("combobox", { name: "Length" }).selectOption("2");
  await expect(page.getByLabel("Zone 1, 2 screens")).toBeVisible();
  await page.getByRole("combobox", { name: "Look" }).selectOption("cave");
  await page.getByRole("button", { name: "Add a climbing zone" }).click();
  await expect(page.getByLabel("Zone 2, 2 screens")).toBeVisible();
  await page.screenshot({ path: "test-results/tools-editor.png", fullPage: true });

  // Export, then import the file as a new game.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tool-test.megarom.json");
  const path = await download.path();
  const exported = JSON.parse(readFileSync(path, "utf8"));
  expect(exported.levels[0].zones[0].things[0]).toMatchObject({ type: "walker", x: 14, y: 12 });

  await page.goto("/");
  await page.getByLabel("Import a game file").setInputFiles(path);
  await expect(page.getByRole("heading", { name: "Tool Test" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Zone 2/ })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open Tool Test" })).toHaveCount(2);
});

test("a file that isn't a game is refused on the home page", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Import a game file").setInputFiles({
    name: "notes.json",
    mimeType: "application/json",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByRole("alert")).toHaveText("That file can't be opened. This file isn't a MegaRomBuilder game.");
});
```

- [ ] **Step 2: Run it**

Run: `npm run e2e`
Expected: all Playwright tests PASS (plan 6's and these).

- [ ] **Step 3: Look at the screenshots**

Open `test-results/tools-blocked.png` and `test-results/tools-editor.png`. Check: the red marker frames the tile where the player gets stuck; the zone badges read clearly; the "This zone" panel fits the sidebar without crowding the zone list; the palette tabs and piece settings are easy to read. Fix anything off in the CSS and rerun.

- [ ] **Step 4: Run every check and commit**

Run: `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e`
Expected: everything passes.

```bash
git add e2e src
git commit -m "test: build with every tool in a browser, and round-trip a game file"
```

---

## Done when

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` and `npm run e2e` all succeed.
- A person can place, move and erase enemies and items, stamp pieces with chosen settings, see each zone's verdict and difficulty as they build, change a zone's length, look, purpose and ways in and out, reorder, add (sideways or climbing) and delete zones, and export a game and import it back.
- A person has built a short level with these tools and judged whether a child could. That is the check no test can make.

Plan 8 (AI assistant) adds the chat panel to this editor and drives the same commands.
