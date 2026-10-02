# Runtime Core Implementation Plan (Milestone 1, Plan 2 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ] `) syntax for tracking.

**Goal:** Build the game runtime's core so a hand-made level can be played in the browser: the player's movement, tiles, ladders, hazards, shots, zone transitions, camera, rendering and keyboard input.

**Architecture:** `src/runtime/sim/` is a deterministic fixed-step simulation in plain TypeScript with no DOM: `step(sim, input)` advances a mutable `Sim` by 1/60 second. `src/runtime/render/` draws a `Sim` to a 2D canvas, reads the keyboard and runs the frame loop. A React client component hosts them on a `/play` page with a demo level built through the plan 1 commands.

**Tech Stack:** TypeScript (strict), Vitest, React client component, 2D canvas. No game engine.

**Spec:** `docs/superpowers/specs/2026-10-02-playable-core-ai-level-builder-design.md` (section 5)

**Plan series for milestone 1** (the runtime is now two plans, so there are six):

1. Project model and commands (done)
2. Runtime core: player, tiles, zones, camera, rendering, a playable demo level (this plan)
3. Runtime things: enemies, moving platforms, pickups, boss, damage
4. Snow content pack, level pieces and the checker
5. Editor UI and IndexedDB storage
6. AI assistant

## Global Constraints

- A tile is 16 by 16 pixels. The screen is 256 by 240 pixels.
- The simulation runs at a fixed 60 steps per second. Units are pixels and steps.
- Player movement numbers come from `project.player` (`PlayerSettings`), never from constants in the runtime.
- `src/runtime/sim/` has no React, no Next.js, no DOM globals and no randomness. Given the same inputs it produces the same result.
- `step` never throws for anything a level can contain. A level that cannot be crossed kills the player and respawns them.
- The renderer draws plain coloured rectangles in this plan. Sprite art arrives with the snow pack.
- Keyboard: arrows to move and climb, Z to jump, X to shoot.
- Import alias `@/` maps to `src/`.
- No Capcom names, sprites or tiles anywhere in the repo.

## Out of scope for this plan

Enemies, moving platforms, pickups, the boss, boss doors, damage with knockback and invulnerability (all plan 3). Sprite art (plan 4). The Escape key and the editor's Play button (plan 5).

## Review Focus

1. **A long frame** (tab in the background, a slow device): the loop must run at most a few steps and drop the rest, never thousands. Tested in Task 7.
2. **Keys held when the window loses focus**: the player must not keep running after the user switches away and back. Tested in Task 7.
3. **A key held across a zone transition or a death**: it must not fire a jump or a shot on the first step afterwards. Tested in Tasks 4 and 6.
4. **Arriving somewhere unsafe** (a bottom entry with no ladder, or a mismatched connection between zones): the game must not crash; the player dies and respawns. Tested in Task 6.
5. **Starting from a level or zone that does not exist**: a clear error, not a blank canvas. Tested in Task 2.

## File Structure

```
src/runtime/sim/constants.ts   sizes and timings that are not player settings
src/runtime/sim/math.ts        clamp
src/runtime/sim/tilemap.ts     what each tile of a zone does, including the zone's edges
src/runtime/sim/state.ts       Sim, Player, Input types; createSim; entryPosition
src/runtime/sim/player.ts      running, jumping, ice, ladders, collision
src/runtime/sim/hazards.ts     spikes, death, respawn, checkpoints
src/runtime/sim/shots.ts       firing and moving shots
src/runtime/sim/view.ts        camera and the transition slide
src/runtime/sim/edges.ts       leaving a zone: transitions and pits
src/runtime/sim/step.ts        one simulation step
src/runtime/sim/index.ts       re-exports
src/runtime/render/draw.ts     draws a Sim to a 2D canvas context
src/runtime/render/keyboard.ts keyboard to Input
src/runtime/render/loop.ts     fixed-step accumulator
src/runtime/render/PlayCanvas.tsx  React client component hosting a game
src/content/demo.ts            demo content pack and hand-made demo level
src/app/play/page.tsx          the /play page
tests/runtime/helpers.ts       build zones from text art
tests/runtime/simHelpers.ts    makeSim, run, runUntil, standOn
tests/runtime/bot.ts           a simple scripted player
tests/runtime/*.test.ts
```

How the pieces fit: `step` calls `updatePlayer`, then shots, checkpoints, spikes and `checkEdges` in that order. `tilemap` is the only module that reads a zone's tile grid. The zone's left edge is always a wall; its right edge is a wall except across a right-hand exit opening; above and below are open.

---

### Task 1: Tile map

**Files:**
- Create: `src/runtime/sim/constants.ts`, `src/runtime/sim/math.ts`, `src/runtime/sim/tilemap.ts`
- Create: `tests/runtime/helpers.ts`
- Test: `tests/runtime/tilemap.test.ts`

**Interfaces:**
- Consumes (plan 1): `Zone`, `Project`, `Checkpoint` from `@/model/schema`; `ContentPack`, `TileBehaviour` from `@/model/contentPack`; `TILE_SIZE`, `zoneSize`, `tileIndex`, `Opening` from `@/model/geometry`; `createProject`, `createLevel`, `createZone` from `@/model/factory`; `testPack` from `tests/fixtures/testPack` (tiles: 1 ground solid, 2 ladder, 3 spike, 4 ice, 5 ledge oneWay)
- Produces:
  - `PLAYER_W = 14`, `PLAYER_H = 22`, `SHOT_W = 6`, `SHOT_H = 4`, `SHOT_SPEED = 4`, `ICE_ACCEL = 0.05`, `JUMP_CUT_SPEED = 1`, `TRANSITION_STEPS = 48`, `RESPAWN_STEPS = 90`, `SCREEN_W = 256`, `SCREEN_H = 240`
  - `clamp(value: number, min: number, max: number): number`
  - `type Cell = TileBehaviour | "empty"`
  - `type TileMap = { zone: Zone; width: number; height: number; widthPx: number; heightPx: number; behaviourAt(tx: number, ty: number): Cell }`
  - `createTileMap(zone: Zone, pack: ContentPack): TileMap`
  - `isSolid(cell: Cell): boolean` (solid or ice)
  - `isPlatform(map: TileMap, tx: number, ty: number): boolean` (a one-way tile, or the top tile of a ladder)
  - `firstTile(px: number): number`, `lastTile(px: number): number` (the first and last tile index covered by a span starting or ending at `px`)
  - `ladderAtPx(map: TileMap, px: number, py: number): boolean`
  - `touchingLadder(map: TileMap, box: { x: number; y: number; w: number; h: number }): boolean` (a ladder at the box's centre or at its feet)
  - Test helpers: `rowWith(cells, width?)`, `flatArt(overrides?, screens?)`, `type ZoneArt = { art: string[]; entry?: Opening; exit?: Opening | null }`, `projectFromArt(zones: ZoneArt[], checkpoints?: Checkpoint[]): Project`

Text art glyphs: `.` empty, `#` ground, `H` ladder, `^` spike, `~` ice, `=` ledge. Fifteen rows make a horizontal zone; more make a vertical zone.

- [ ] **Step 1: Write the test helpers**

`tests/runtime/helpers.ts`:

```ts
import { createLevel, createProject, createZone } from "@/model/factory";
import type { Opening } from "@/model/geometry";
import type { Checkpoint, Project, Zone } from "@/model/schema";
import { testPack } from "../fixtures/testPack";

const GLYPHS: Record<string, number> = { ".": 0, "#": 1, H: 2, "^": 3, "~": 4, "=": 5 };

export type ZoneArt = { art: string[]; entry?: Opening; exit?: Opening | null };

// A row of empty tiles with the given glyphs at the given columns.
export function rowWith(cells: Record<number, string>, width = 16): string {
  const row = new Array<string>(width).fill(".");
  for (const [x, glyph] of Object.entries(cells)) row[Number(x)] = glyph;
  return row.join("");
}

// A horizontal zone with a two-row floor. Overrides replace whole rows by index.
export function flatArt(overrides: Record<number, string> = {}, screens = 1): string[] {
  const width = 16 * screens;
  return Array.from({ length: 15 }, (_, y) => overrides[y] ?? (y >= 13 ? "#" : ".").repeat(width));
}

function zoneFromArt(base: Zone, { art, entry, exit }: ZoneArt): Zone {
  const vertical = art.length > 15;
  const width = art[0].length;
  const screens = vertical ? art.length / 15 : width / 16;
  const wholeScreens = Number.isInteger(screens) && (vertical ? width === 16 : art.length === 15);
  if (!wholeScreens || art.some((row) => row.length !== width)) {
    throw new Error("Zone art must be whole screens with rows of equal length.");
  }
  const tiles = art.flatMap((row) =>
    [...row].map((glyph) => {
      const tile = GLYPHS[glyph];
      if (tile === undefined) throw new Error(`Unknown glyph "${glyph}".`);
      return tile;
    }),
  );
  return {
    ...base,
    scroll: vertical ? "vertical" : "horizontal",
    screens,
    tiles,
    entry: entry ?? base.entry,
    exit: exit === undefined ? base.exit : exit,
  };
}

// A project whose level "L1" has the given zones (z1, z2, ...), then "corridor" and "boss".
export function projectFromArt(zones: ZoneArt[], checkpoints: Checkpoint[] = []): Project {
  const project = createProject({ id: "p1", name: "Game" }, testPack);
  const level = createLevel(
    { id: "L1", name: "Stage", zoneIds: ["z1", "corridor", "boss"] },
    testPack,
  );
  const [first, corridor, boss] = level.zones;
  const made = zones.map((spec, i) =>
    zoneFromArt(
      i === 0 ? first : createZone({ id: `z${i + 1}`, name: `Zone ${i + 1}` }, testPack),
      spec,
    ),
  );
  return { ...project, levels: [{ ...level, zones: [...made, corridor, boss], checkpoints }] };
}
```

- [ ] **Step 2: Write the failing test**

`tests/runtime/tilemap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createTileMap,
  firstTile,
  isPlatform,
  isSolid,
  ladderAtPx,
  lastTile,
  touchingLadder,
} from "@/runtime/sim/tilemap";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith } from "./helpers";

function mapOf(art: string[], exit?: { edge: "right" | "top" | "bottom"; from: number; to: number } | null) {
  const zone = projectFromArt([{ art, exit }]).levels[0].zones[0];
  return createTileMap(zone, testPack);
}

describe("createTileMap", () => {
  const map = mapOf(
    flatArt({ 5: rowWith({ 4: "H" }), 6: rowWith({ 4: "H", 8: "=" }), 12: rowWith({ 2: "^", 3: "~" }) }),
  );

  it("measures the zone", () => {
    expect(map.width).toBe(16);
    expect(map.height).toBe(15);
    expect(map.widthPx).toBe(256);
    expect(map.heightPx).toBe(240);
  });

  it("reads what each tile does", () => {
    expect(map.behaviourAt(0, 0)).toBe("empty");
    expect(map.behaviourAt(0, 13)).toBe("solid");
    expect(map.behaviourAt(4, 5)).toBe("ladder");
    expect(map.behaviourAt(2, 12)).toBe("spike");
    expect(map.behaviourAt(3, 12)).toBe("ice");
    expect(map.behaviourAt(8, 6)).toBe("oneWay");
  });

  it("walls off the left edge at every height", () => {
    expect(map.behaviourAt(-1, 5)).toBe("solid");
    expect(map.behaviourAt(-1, -3)).toBe("solid");
    expect(map.behaviourAt(-1, 20)).toBe("solid");
  });

  it("walls off the right edge except across the exit opening", () => {
    expect(map.behaviourAt(16, 8)).toBe("solid");
    expect(map.behaviourAt(16, 9)).toBe("empty");
    expect(map.behaviourAt(16, 12)).toBe("empty");
    expect(map.behaviourAt(16, 13)).toBe("solid");
  });

  it("walls off the whole right edge when the exit is elsewhere or missing", () => {
    expect(mapOf(flatArt(), { edge: "top", from: 4, to: 5 }).behaviourAt(16, 10)).toBe("solid");
    expect(mapOf(flatArt(), null).behaviourAt(16, 10)).toBe("solid");
  });

  it("is open above and below", () => {
    expect(map.behaviourAt(5, -1)).toBe("empty");
    expect(map.behaviourAt(5, 15)).toBe("empty");
  });

  it("treats solid and ice as solid", () => {
    expect(isSolid("solid")).toBe(true);
    expect(isSolid("ice")).toBe(true);
    expect(isSolid("ladder")).toBe(false);
    expect(isSolid("spike")).toBe(false);
    expect(isSolid("oneWay")).toBe(false);
    expect(isSolid("empty")).toBe(false);
  });

  it("treats one-way tiles and ladder tops as platforms", () => {
    expect(isPlatform(map, 8, 6)).toBe(true);
    expect(isPlatform(map, 4, 5)).toBe(true);
    expect(isPlatform(map, 4, 6)).toBe(false);
    expect(isPlatform(map, 0, 13)).toBe(false);
  });

  it("finds ladders by pixel and by box", () => {
    expect(ladderAtPx(map, 70, 85)).toBe(true);
    expect(ladderAtPx(map, 90, 85)).toBe(false);
    // centre in the ladder
    expect(touchingLadder(map, { x: 65, y: 80, w: 14, h: 22 })).toBe(true);
    // centre above the ladder, feet in it
    expect(touchingLadder(map, { x: 65, y: 62, w: 14, h: 22 })).toBe(true);
    // feet exactly on top of the ladder
    expect(touchingLadder(map, { x: 65, y: 58, w: 14, h: 22 })).toBe(false);
  });
});

describe("firstTile and lastTile", () => {
  it("give the tiles a span covers", () => {
    expect(firstTile(0)).toBe(0);
    expect(firstTile(15.9)).toBe(0);
    expect(firstTile(16)).toBe(1);
    expect(firstTile(-0.5)).toBe(-1);
    expect(lastTile(16)).toBe(0);
    expect(lastTile(16.25)).toBe(1);
    expect(lastTile(32)).toBe(1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tests/runtime/tilemap.test.ts`
Expected: FAIL, cannot resolve `@/runtime/sim/tilemap`.

- [ ] **Step 4: Implement constants, math and the tile map**

`src/runtime/sim/constants.ts`:

```ts
export const SCREEN_W = 256;
export const SCREEN_H = 240;

export const PLAYER_W = 14;
export const PLAYER_H = 22;

export const SHOT_W = 6;
export const SHOT_H = 4;
export const SHOT_SPEED = 4;

// How fast speed changes per step when running on ice.
export const ICE_ACCEL = 0.05;
// Releasing jump while rising faster than this cuts the rise to this speed.
export const JUMP_CUT_SPEED = 1;

export const TRANSITION_STEPS = 48;
export const RESPAWN_STEPS = 90;
```

`src/runtime/sim/math.ts`:

```ts
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

`src/runtime/sim/tilemap.ts`:

```ts
import type { ContentPack, TileBehaviour } from "@/model/contentPack";
import { TILE_SIZE, tileIndex, zoneSize } from "@/model/geometry";
import type { Zone } from "@/model/schema";

export type Cell = TileBehaviour | "empty";

export type TileMap = {
  zone: Zone;
  width: number;
  height: number;
  widthPx: number;
  heightPx: number;
  behaviourAt(tx: number, ty: number): Cell;
};

export function createTileMap(zone: Zone, pack: ContentPack): TileMap {
  const size = zoneSize(zone.scroll, zone.screens);
  const behaviours = new Map(pack.tiles.map((t) => [t.id, t.behaviour]));
  const exit = zone.exit;
  return {
    zone,
    width: size.width,
    height: size.height,
    widthPx: size.width * TILE_SIZE,
    heightPx: size.height * TILE_SIZE,
    behaviourAt(tx, ty) {
      // The left edge is always a wall. The right edge is a wall except across a right-hand exit.
      if (tx < 0) return "solid";
      if (tx >= size.width) {
        const open = exit !== null && exit.edge === "right" && ty >= exit.from && ty <= exit.to;
        return open ? "empty" : "solid";
      }
      if (ty < 0 || ty >= size.height) return "empty";
      return behaviours.get(zone.tiles[tileIndex(size, tx, ty)]) ?? "empty";
    },
  };
}

export const isSolid = (cell: Cell): boolean => cell === "solid" || cell === "ice";

// Something the player can land on from above but pass through from below.
export function isPlatform(map: TileMap, tx: number, ty: number): boolean {
  const cell = map.behaviourAt(tx, ty);
  return cell === "oneWay" || (cell === "ladder" && map.behaviourAt(tx, ty - 1) !== "ladder");
}

// The first tile covered by a span that starts at px.
export const firstTile = (px: number): number => Math.floor(px / TILE_SIZE);
// The last tile covered by a span that ends at px.
export const lastTile = (px: number): number => Math.ceil(px / TILE_SIZE) - 1;

export function ladderAtPx(map: TileMap, px: number, py: number): boolean {
  return map.behaviourAt(firstTile(px), firstTile(py)) === "ladder";
}

// True when there is a ladder at the box's centre or at its feet.
export function touchingLadder(
  map: TileMap,
  box: { x: number; y: number; w: number; h: number },
): boolean {
  const cx = box.x + box.w / 2;
  return ladderAtPx(map, cx, box.y + box.h / 2) || ladderAtPx(map, cx, box.y + box.h - 1);
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/runtime/sim tests/runtime
git commit -m "feat: add runtime tile map"
```

---

### Task 2: Sim state, running, jumping and ice

**Files:**
- Create: `src/runtime/sim/state.ts`, `src/runtime/sim/player.ts`, `src/runtime/sim/step.ts`
- Create: `tests/runtime/simHelpers.ts`
- Test: `tests/runtime/movement.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produces; `Level`, `PlayerSettings`, `Project` from `@/model/schema`; `DEFAULT_PLAYER` values (`runSpeed` 1.375, `jumpVelocity` 4.875, `gravity` 0.25, `maxFallSpeed` 7, `ladderSpeed` 1.25, `maxHealth` 28, `maxShots` 3)
- Produces:
  - `type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; shoot: boolean }`, `NO_INPUT: Input`
  - `type Player = { x: number; y: number; vx: number; vy: number; w: number; h: number; facing: 1 | -1; onGround: boolean; onIce: boolean; onLadder: boolean; health: number }`
  - `type Shot = { x: number; y: number; vx: number }`
  - `type Camera = { x: number; y: number }`
  - `type Phase = "play" | "transition" | "dead"`
  - `type Transition = { fromIndex: number; fromCamera: Camera; direction: "right" | "up" | "down" }`
  - `type Sim = { level: Level; pack: ContentPack; settings: PlayerSettings; zoneIndex: number; map: TileMap; player: Player; shots: Shot[]; phase: Phase; timer: number; transition: Transition | null; respawn: { zoneIndex: number; x: number; y: number }; prev: Input; steps: number }`
  - `entryPosition(map: TileMap, carry: number | null): { x: number; y: number }`
  - `createSim(project: Project, levelId: string, pack: ContentPack, opts?: { startZoneId?: string }): Sim` (throws `Error` for an unknown level or zone)
  - `moveX(map: TileMap, p: Player, dx: number): void`, `moveY(map: TileMap, p: Player, dy: number, dropThrough: boolean): void`
  - `updatePlayer(sim: Sim, input: Input): void`
  - `step(sim: Sim, input: Input): void`
  - Test helpers: `makeSim(zones, checkpoints?, startZoneId?)`, `press(keys?)`, `run(sim, keys, steps)`, `runUntil(sim, keys, done, limit?)`, `standOn(sim, tx, ty)`

`entryPosition` places the player at the zone's entry. `carry` is how far along the previous zone's exit opening the player was, in pixels: the feet height below the opening's top for a side opening, or the centre's distance from the opening's start for a top or bottom opening. `null` means a fresh start: feet at the bottom of a left opening, or centred in a top or bottom opening.

Movement rules: speed is set at once on normal ground and in the air; on ice it changes by `ICE_ACCEL` per step. A jump starts only on the ground on the step jump is first pressed. Each step: gravity is added, then the player moves sideways, then vertically, stopping at solid tiles and landing on platforms only when falling onto them from above.

- [ ] **Step 1: Write the sim test helpers**

`tests/runtime/simHelpers.ts`:

```ts
import type { Checkpoint } from "@/model/schema";
import { createSim, NO_INPUT, type Input, type Sim } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { testPack } from "../fixtures/testPack";
import { projectFromArt, type ZoneArt } from "./helpers";

export function makeSim(
  zones: ZoneArt[],
  checkpoints: Checkpoint[] = [],
  startZoneId?: string,
): Sim {
  return createSim(projectFromArt(zones, checkpoints), "L1", testPack, { startZoneId });
}

export const press = (keys: Partial<Input> = {}): Input => ({ ...NO_INPUT, ...keys });

export function run(sim: Sim, keys: Partial<Input>, steps: number): void {
  for (let i = 0; i < steps; i++) step(sim, press(keys));
}

// Steps with the given keys until the condition holds. Returns the number of steps taken.
export function runUntil(
  sim: Sim,
  keys: Partial<Input>,
  done: (sim: Sim) => boolean,
  limit = 600,
): number {
  for (let i = 0; i < limit; i++) {
    if (done(sim)) return i;
    step(sim, press(keys));
  }
  throw new Error("The condition was not reached.");
}

// Puts the player's feet on top of tile (tx, ty) and runs one step so they settle.
export function standOn(sim: Sim, tx: number, ty: number): void {
  const p = sim.player;
  p.x = tx * 16 + 1;
  p.y = ty * 16 - p.h;
  p.vx = 0;
  p.vy = 0;
  p.onLadder = false;
  step(sim, press());
}
```

- [ ] **Step 2: Write the failing test**

`tests/runtime/movement.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSim } from "@/runtime/sim/state";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith } from "./helpers";
import { makeSim, run, standOn } from "./simHelpers";

const FLOOR_Y = 13 * 16 - 22; // the player's y when standing on the default floor

describe("createSim", () => {
  it("starts the player at the bottom of the first zone's entry", () => {
    const sim = makeSim([{ art: flatArt() }]);
    expect(sim.zoneIndex).toBe(0);
    expect(sim.phase).toBe("play");
    expect(sim.player).toMatchObject({ x: 2, y: FLOOR_Y, w: 14, h: 22, facing: 1, health: 28 });
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 2, y: FLOOR_Y });
  });

  it("can start from a named zone", () => {
    const sim = makeSim([{ art: flatArt() }], [], "boss");
    expect(sim.zoneIndex).toBe(2);
    expect(sim.map.zone.id).toBe("boss");
  });

  it("centres the player in a bottom entry and grabs a ladder there", () => {
    // The centre of a two-tile opening falls in its second column.
    const art = Array.from({ length: 30 }, () => rowWith({ 8: "H" }));
    const sim = makeSim([{ art, entry: { edge: "bottom", from: 7, to: 8 } }]);
    expect(sim.player.x).toBe(121);
    expect(sim.player.y).toBe(480 - 22);
    expect(sim.player.onLadder).toBe(true);
  });

  it("throws a clear error for an unknown level or zone", () => {
    const project = projectFromArt([{ art: flatArt() }]);
    expect(() => createSim(project, "nope", testPack)).toThrow(/no level with id "nope"/);
    expect(() => createSim(project, "L1", testPack, { startZoneId: "zz" })).toThrow(
      /no zone with id "zz"/,
    );
  });
});

describe("standing and running", () => {
  it("rests on the floor", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 10);
    expect(sim.player.y).toBe(FLOOR_Y);
    expect(sim.player.onGround).toBe(true);
    expect(sim.steps).toBe(10);
  });

  it("runs right at the project's run speed", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, { right: true }, 60);
    expect(sim.player.x).toBe(2 + 60 * 1.375);
    expect(sim.player.facing).toBe(1);
  });

  it("runs left, faces left and stops at the zone's left edge", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, { left: true }, 20);
    expect(sim.player.x).toBe(0);
    expect(sim.player.facing).toBe(-1);
  });

  it("stops against a wall", () => {
    const sim = makeSim([{ art: flatArt({ 12: rowWith({ 5: "#" }) }) }]);
    run(sim, { right: true }, 120);
    expect(sim.player.x).toBe(5 * 16 - 14);
  });

  it("uses the project's player settings", () => {
    const project = projectFromArt([{ art: flatArt() }]);
    const fast = { ...project, player: { ...project.player, runSpeed: 2 } };
    const sim = createSim(fast, "L1", testPack);
    run(sim, { right: true }, 10);
    expect(sim.player.x).toBe(22);
  });
});

describe("jumping", () => {
  function apexOf(sim: ReturnType<typeof makeSim>, hold: number): number {
    let top = sim.player.y;
    for (let i = 0; i < 60; i++) {
      run(sim, { jump: i < hold }, 1);
      top = Math.min(top, sim.player.y);
    }
    return FLOOR_Y - top;
  }

  it("rises about 45 pixels on a full jump and lands again", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 1);
    expect(apexOf(sim, 60)).toBeCloseTo(45.125);
    expect(sim.player.y).toBe(FLOOR_Y);
    expect(sim.player.onGround).toBe(true);
  });

  it("makes a short hop when jump is released early", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 1);
    expect(apexOf(sim, 1)).toBeLessThan(10);
  });

  it("does not jump again in the air", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 1);
    run(sim, { jump: true }, 5);
    run(sim, {}, 1);
    run(sim, { jump: true }, 1);
    expect(sim.player.vy).toBe(-0.5);
  });

  it("does not jump again while jump stays held on landing", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 1);
    run(sim, { jump: true }, 120);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("bumps its head on a ceiling", () => {
    const sim = makeSim([{ art: flatArt({ 10: "#".repeat(16) }) }]);
    run(sim, {}, 1);
    let top = sim.player.y;
    for (let i = 0; i < 40; i++) {
      run(sim, { jump: true }, 1);
      top = Math.min(top, sim.player.y);
    }
    expect(top).toBe(11 * 16);
  });

  it("jumps up through a ledge and lands on it", () => {
    const sim = makeSim([{ art: flatArt({ 11: rowWith({ 3: "=", 4: "=", 5: "=" }) }) }]);
    standOn(sim, 4, 13);
    run(sim, { jump: true }, 60);
    expect(sim.player.y).toBe(11 * 16 - 22);
    expect(sim.player.onGround).toBe(true);
  });
});

describe("ice", () => {
  const ice = { art: flatArt({ 13: "~".repeat(16) }) };

  it("builds up speed slowly", () => {
    const sim = makeSim([ice]);
    run(sim, {}, 1);
    run(sim, { right: true }, 10);
    expect(sim.player.onIce).toBe(true);
    expect(sim.player.vx).toBeCloseTo(0.5);
  });

  it("keeps sliding after the key is released", () => {
    const sim = makeSim([ice]);
    run(sim, {}, 1);
    run(sim, { right: true }, 10);
    run(sim, {}, 5);
    expect(sim.player.vx).toBeCloseTo(0.25);
  });

  it("is not slippery on normal ground", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, { right: true }, 10);
    run(sim, {}, 1);
    expect(sim.player.vx).toBe(0);
    expect(sim.player.onIce).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tests/runtime/movement.test.ts`
Expected: FAIL, cannot resolve `@/runtime/sim/state`.

- [ ] **Step 4: Implement the sim state**

`src/runtime/sim/state.ts`:

```ts
import type { ContentPack } from "@/model/contentPack";
import { TILE_SIZE } from "@/model/geometry";
import type { Level, PlayerSettings, Project } from "@/model/schema";
import { PLAYER_H, PLAYER_W } from "./constants";
import { clamp } from "./math";
import { createTileMap, touchingLadder, type TileMap } from "./tilemap";

export type Input = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  shoot: boolean;
};

export const NO_INPUT: Input = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  shoot: false,
};

export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  onGround: boolean;
  onIce: boolean;
  onLadder: boolean;
  health: number;
};

export type Shot = { x: number; y: number; vx: number };

export type Camera = { x: number; y: number };

export type Phase = "play" | "transition" | "dead";

export type Transition = {
  fromIndex: number;
  fromCamera: Camera;
  direction: "right" | "up" | "down";
};

export type Sim = {
  level: Level;
  pack: ContentPack;
  settings: PlayerSettings;
  zoneIndex: number;
  map: TileMap;
  player: Player;
  shots: Shot[];
  phase: Phase;
  timer: number;
  transition: Transition | null;
  respawn: { zoneIndex: number; x: number; y: number };
  prev: Input;
  steps: number;
};

// Where the player appears at a zone's entry. `carry` is how far along the previous
// zone's exit opening they were, in pixels, or null for a fresh start.
export function entryPosition(map: TileMap, carry: number | null): { x: number; y: number } {
  const entry = map.zone.entry;
  const start = entry.from * TILE_SIZE;
  const end = (entry.to + 1) * TILE_SIZE;
  if (entry.edge === "left" || entry.edge === "right") {
    const feet = carry === null ? end : clamp(start + carry, start + PLAYER_H, end);
    return { x: 2, y: feet - PLAYER_H };
  }
  const half = PLAYER_W / 2;
  const centre = carry === null ? (start + end) / 2 : clamp(start + carry, start + half, end - half);
  return { x: centre - half, y: entry.edge === "bottom" ? map.heightPx - PLAYER_H : 0 };
}

export function createSim(
  project: Project,
  levelId: string,
  pack: ContentPack,
  opts: { startZoneId?: string } = {},
): Sim {
  const level = project.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`There is no level with id "${levelId}".`);
  const zoneIndex =
    opts.startZoneId === undefined ? 0 : level.zones.findIndex((z) => z.id === opts.startZoneId);
  if (zoneIndex < 0) throw new Error(`There is no zone with id "${opts.startZoneId}".`);

  const map = createTileMap(level.zones[zoneIndex], pack);
  const start = entryPosition(map, null);
  const player: Player = {
    ...start,
    vx: 0,
    vy: 0,
    w: PLAYER_W,
    h: PLAYER_H,
    facing: 1,
    onGround: false,
    onIce: false,
    onLadder: false,
    health: project.player.maxHealth,
  };
  player.onLadder = touchingLadder(map, player);
  return {
    level,
    pack,
    settings: project.player,
    zoneIndex,
    map,
    player,
    shots: [],
    phase: "play",
    timer: 0,
    transition: null,
    respawn: { zoneIndex, ...start },
    prev: NO_INPUT,
    steps: 0,
  };
}
```

- [ ] **Step 5: Implement player movement and the step**

`src/runtime/sim/player.ts`:

```ts
import { TILE_SIZE } from "@/model/geometry";
import { ICE_ACCEL, JUMP_CUT_SPEED } from "./constants";
import { clamp } from "./math";
import type { Input, Player, Sim } from "./state";
import { firstTile, isPlatform, isSolid, lastTile, type TileMap } from "./tilemap";

// Moves sideways and stops at solid tiles.
export function moveX(map: TileMap, p: Player, dx: number): void {
  if (dx === 0) return;
  p.x += dx;
  const top = firstTile(p.y);
  const bottom = lastTile(p.y + p.h);
  const tx = dx > 0 ? lastTile(p.x + p.w) : firstTile(p.x);
  for (let ty = top; ty <= bottom; ty++) {
    if (!isSolid(map.behaviourAt(tx, ty))) continue;
    p.x = dx > 0 ? tx * TILE_SIZE - p.w : (tx + 1) * TILE_SIZE;
    p.vx = 0;
    return;
  }
}

// Moves vertically. Falling lands on solid tiles, and on platforms when coming from above
// unless dropThrough is set. Rising stops at solid tiles.
export function moveY(map: TileMap, p: Player, dy: number, dropThrough: boolean): void {
  if (dy === 0) return;
  const prevBottom = p.y + p.h;
  p.y += dy;
  const left = firstTile(p.x);
  const right = lastTile(p.x + p.w);
  if (dy > 0) {
    const ty = lastTile(p.y + p.h);
    for (let tx = left; tx <= right; tx++) {
      const lands =
        isSolid(map.behaviourAt(tx, ty)) ||
        (!dropThrough && isPlatform(map, tx, ty) && prevBottom <= ty * TILE_SIZE);
      if (!lands) continue;
      p.y = ty * TILE_SIZE - p.h;
      p.vy = 0;
      p.onGround = true;
      p.onIce = map.behaviourAt(firstTile(p.x + p.w / 2), ty) === "ice";
      return;
    }
  } else {
    const ty = firstTile(p.y);
    for (let tx = left; tx <= right; tx++) {
      if (!isSolid(map.behaviourAt(tx, ty))) continue;
      p.y = (ty + 1) * TILE_SIZE;
      p.vy = 0;
      return;
    }
  }
}

export function updatePlayer(sim: Sim, input: Input): void {
  const { map, player: p, settings, prev } = sim;
  const jumpPressed = input.jump && !prev.jump;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

  const target = dir * settings.runSpeed;
  if (p.onGround && p.onIce) p.vx += clamp(target - p.vx, -ICE_ACCEL, ICE_ACCEL);
  else p.vx = target;

  if (jumpPressed && p.onGround) p.vy = -settings.jumpVelocity;
  else if (!input.jump && p.vy < -JUMP_CUT_SPEED) p.vy = -JUMP_CUT_SPEED;

  p.vy = Math.min(p.vy + settings.gravity, settings.maxFallSpeed);
  p.onGround = false;
  p.onIce = false;
  moveX(map, p, p.vx);
  moveY(map, p, p.vy, false);
}
```

`src/runtime/sim/step.ts`:

```ts
import { updatePlayer } from "./player";
import type { Input, Sim } from "./state";

// Advances the simulation by one step of 1/60 second.
export function step(sim: Sim, input: Input): void {
  sim.steps++;
  updatePlayer(sim, input);
  sim.prev = input;
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 7: Commit**

```bash
git add src/runtime/sim tests/runtime
git commit -m "feat: add sim state with running, jumping and ice"
```

---

### Task 3: Ladders

**Files:**
- Modify: `src/runtime/sim/player.ts` (replace `updatePlayer`, add `climb`)
- Test: `tests/runtime/ladder.test.ts`

**Interfaces:**
- Consumes: `moveY`, `updatePlayer` (Task 2); `ladderAtPx`, `touchingLadder`, `firstTile` (Task 1); test helpers (Tasks 1 and 2)
- Produces: `updatePlayer(sim, input)` now handles ladders. No new exports.

Ladder rules: pressing up with the player's centre on a ladder grabs it; pressing down while standing on a ladder's top tile grabs it too. On a ladder the player is centred on its column, ignores gravity, and moves up or down at `ladderSpeed`. Jump lets go. Climbing off the top leaves the player standing on the ladder's top tile. Climbing down onto solid ground, or off the bottom of the ladder, lets go.

- [ ] **Step 1: Write the failing test**

`tests/runtime/ladder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { flatArt, rowWith } from "./helpers";
import { makeSim, run, standOn } from "./simHelpers";

const FLOOR_Y = 13 * 16 - 22;
const LADDER_TOP_Y = 5 * 16 - 22; // standing on the top of a ladder whose top tile is row 5

// A ladder in column 4 from row 5 down to the floor.
function ladderSim() {
  const overrides: Record<number, string> = {};
  for (let y = 5; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
  return makeSim([{ art: flatArt(overrides) }]);
}

describe("ladders", () => {
  it("grabs a ladder when up is pressed, centring on it", () => {
    const sim = ladderSim();
    standOn(sim, 4, 13);
    sim.player.x = 62;
    run(sim, { up: true }, 1);
    expect(sim.player.onLadder).toBe(true);
    expect(sim.player.x).toBe(65);
    expect(sim.player.y).toBe(FLOOR_Y - 1.25);
  });

  it("does not grab when there is no ladder", () => {
    const sim = ladderSim();
    standOn(sim, 8, 13);
    run(sim, { up: true }, 5);
    expect(sim.player.onLadder).toBe(false);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("does not grab without pressing up", () => {
    const sim = ladderSim();
    standOn(sim, 4, 13);
    run(sim, {}, 5);
    expect(sim.player.onLadder).toBe(false);
  });

  it("hangs still, ignoring gravity and sideways keys", () => {
    const sim = ladderSim();
    standOn(sim, 4, 13);
    run(sim, { up: true }, 20);
    const { x, y } = sim.player;
    run(sim, { right: true }, 20);
    expect(sim.player.onLadder).toBe(true);
    expect(sim.player.x).toBe(x);
    expect(sim.player.y).toBe(y);
  });

  it("lets go on jump and falls", () => {
    const sim = ladderSim();
    standOn(sim, 4, 13);
    run(sim, { up: true }, 40);
    run(sim, { jump: true }, 1);
    expect(sim.player.onLadder).toBe(false);
    run(sim, {}, 60);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("climbs off the top and stands on the ladder", () => {
    const sim = ladderSim();
    standOn(sim, 4, 13);
    run(sim, { up: true }, 200);
    expect(sim.player.onLadder).toBe(false);
    expect(sim.player.onGround).toBe(true);
    expect(sim.player.y).toBe(LADDER_TOP_Y);
  });

  it("stays on top of the ladder when idle", () => {
    const sim = ladderSim();
    standOn(sim, 4, 5);
    run(sim, {}, 30);
    expect(sim.player.y).toBe(LADDER_TOP_Y);
    expect(sim.player.onGround).toBe(true);
  });

  it("climbs down from the top when down is pressed", () => {
    const sim = ladderSim();
    standOn(sim, 4, 5);
    run(sim, { down: true }, 1);
    expect(sim.player.onLadder).toBe(true);
    expect(sim.player.y).toBe(LADDER_TOP_Y + 1.25);
  });

  it("lets go on reaching the floor", () => {
    const sim = ladderSim();
    standOn(sim, 4, 5);
    run(sim, { down: true }, 200);
    expect(sim.player.onLadder).toBe(false);
    expect(sim.player.onGround).toBe(true);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("lets go when climbing off the bottom of a ladder that ends in the air", () => {
    const sim = makeSim([
      { art: flatArt({ 5: rowWith({ 4: "H" }), 6: rowWith({ 4: "H" }), 7: rowWith({ 4: "H" }) }) },
    ]);
    standOn(sim, 4, 5);
    run(sim, { down: true }, 200);
    expect(sim.player.onLadder).toBe(false);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("stops climbing at a solid ceiling", () => {
    const overrides: Record<number, string> = { 4: "#".repeat(16) };
    for (let y = 5; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
    const sim = makeSim([{ art: flatArt(overrides) }]);
    standOn(sim, 4, 13);
    run(sim, { up: true }, 200);
    expect(sim.player.onLadder).toBe(true);
    expect(sim.player.y).toBe(5 * 16);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/runtime/ladder.test.ts`
Expected: FAIL. The grab tests report `onLadder` is `false`.

- [ ] **Step 3: Implement ladders**

In `src/runtime/sim/player.ts`, change the tilemap import to:

```ts
import {
  firstTile,
  isPlatform,
  isSolid,
  ladderAtPx,
  lastTile,
  touchingLadder,
  type TileMap,
} from "./tilemap";
```

Replace the whole `updatePlayer` function with these two functions:

```ts
// One step on a ladder: no gravity, up and down only.
function climb(sim: Sim, input: Input, jumpPressed: boolean): void {
  const { map, player: p, settings } = sim;
  p.vx = 0;
  p.vy = 0;
  if (jumpPressed) {
    p.onLadder = false;
    return;
  }
  const dy = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * settings.ladderSpeed;
  p.onGround = false;
  p.onIce = false;
  moveY(map, p, dy, true);
  if (p.onGround) {
    p.onLadder = false; // climbed down onto solid ground
    return;
  }
  if (touchingLadder(map, p)) return;
  p.onLadder = false;
  if (dy < 0) {
    // Climbed off the top: stand on the ladder's top tile.
    p.y = (firstTile(p.y + p.h - 1) + 1) * TILE_SIZE - p.h;
    p.onGround = true;
  }
}

export function updatePlayer(sim: Sim, input: Input): void {
  const { map, player: p, settings, prev } = sim;
  const jumpPressed = input.jump && !prev.jump;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

  if (!p.onLadder) {
    const cx = p.x + p.w / 2;
    const grabUp = input.up && ladderAtPx(map, cx, p.y + p.h / 2);
    const grabDown = input.down && p.onGround && ladderAtPx(map, cx, p.y + p.h);
    if (grabUp || grabDown) {
      p.onLadder = true;
      p.x = firstTile(cx) * TILE_SIZE + (TILE_SIZE - p.w) / 2;
    }
  }
  if (p.onLadder) {
    climb(sim, input, jumpPressed);
    return;
  }

  const target = dir * settings.runSpeed;
  if (p.onGround && p.onIce) p.vx += clamp(target - p.vx, -ICE_ACCEL, ICE_ACCEL);
  else p.vx = target;

  if (jumpPressed && p.onGround) p.vy = -settings.jumpVelocity;
  else if (!input.jump && p.vy < -JUMP_CUT_SPEED) p.vy = -JUMP_CUT_SPEED;

  p.vy = Math.min(p.vy + settings.gravity, settings.maxFallSpeed);
  p.onGround = false;
  p.onIce = false;
  moveX(map, p, p.vx);
  moveY(map, p, p.vy, false);
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS, including the Task 2 movement tests; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/sim/player.ts tests/runtime/ladder.test.ts
git commit -m "feat: add ladders"
```

---

### Task 4: Spikes, pits, death, respawn and checkpoints

**Files:**
- Create: `src/runtime/sim/hazards.ts`
- Modify: `src/runtime/sim/step.ts` (replace the file)
- Test: `tests/runtime/hazards.test.ts`

**Interfaces:**
- Consumes: `Sim`, `NO_INPUT` (Task 2); `createTileMap`, `touchingLadder`, `firstTile`, `lastTile` (Task 1); `RESPAWN_STEPS` (Task 1); `updatePlayer` (Task 3)
- Produces:
  - `touchingSpike(sim: Sim): boolean`
  - `kill(sim: Sim): void` (enters the dead phase; does nothing if already dead)
  - `respawn(sim: Sim): void` (returns the player to `sim.respawn` with full health)
  - `touchCheckpoints(sim: Sim): void` (touching a checkpoint in the current zone sets `sim.respawn`)
  - `step` now handles the dead phase, spikes, pits and checkpoints

Rules: touching any spike tile, or falling below the bottom of the zone, kills the player. Death lasts `RESPAWN_STEPS` steps, during which input is ignored; then the player reappears at the respawn point with full health and no shots. A checkpoint's respawn position is standing on the tile below the checkpoint's tile.

Pit deaths are handled inline in `step` here. Task 6 moves that check into `checkEdges`, where a bottom exit can turn a fall into a transition.

- [ ] **Step 1: Write the failing test**

`tests/runtime/hazards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RESPAWN_STEPS } from "@/runtime/sim/constants";
import { kill } from "@/runtime/sim/hazards";
import { flatArt, rowWith } from "./helpers";
import { makeSim, run, runUntil, standOn } from "./simHelpers";

const FLOOR_Y = 13 * 16 - 22;
const GAP = { 13: "###...##########", 14: "###...##########" };

describe("pits", () => {
  it("kills a player who falls out of the bottom of the zone", () => {
    const sim = makeSim([{ art: flatArt(GAP) }]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, (s) => s.phase === "dead", 120);
    expect(sim.player.health).toBe(0);
    expect(sim.timer).toBe(RESPAWN_STEPS);
  });

  it("ignores input while dead", () => {
    const sim = makeSim([{ art: flatArt(GAP) }]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, (s) => s.phase === "dead", 120);
    const { x, y } = sim.player;
    run(sim, { right: true, jump: true }, 10);
    expect(sim.player.x).toBe(x);
    expect(sim.player.y).toBe(y);
  });

  it("respawns at the level start with full health", () => {
    const sim = makeSim([{ art: flatArt(GAP) }]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, (s) => s.phase === "dead", 120);
    run(sim, {}, RESPAWN_STEPS - 1);
    expect(sim.phase).toBe("dead");
    run(sim, {}, 1);
    expect(sim.phase).toBe("play");
    expect(sim.player).toMatchObject({ x: 2, y: FLOOR_Y, vx: 0, vy: 0, health: 28 });
  });

  it("does not jump on respawn because jump was held through the death", () => {
    const sim = makeSim([{ art: flatArt(GAP) }]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, (s) => s.phase === "dead", 120);
    run(sim, { jump: true }, RESPAWN_STEPS + 20);
    expect(sim.phase).toBe("play");
    expect(sim.player.y).toBe(FLOOR_Y);
  });
});

describe("spikes", () => {
  const spiked = { art: flatArt({ 13: "######^#########" }) };

  it("kills a player who walks onto them", () => {
    const sim = makeSim([spiked]);
    runUntil(sim, { right: true }, (s) => s.phase === "dead", 120);
    expect(sim.player.x).toBeGreaterThan(5 * 16 - 14);
    expect(sim.player.x).toBeLessThan(7 * 16);
  });

  it("leaves a player standing beside them alone", () => {
    const sim = makeSim([spiked]);
    standOn(sim, 4, 13);
    run(sim, {}, 30);
    expect(sim.phase).toBe("play");
  });

  it("kills from the side too", () => {
    const sim = makeSim([{ art: flatArt({ 12: rowWith({ 6: "^" }) }) }]);
    runUntil(sim, { right: true }, (s) => s.phase === "dead", 120);
    expect(sim.phase).toBe("dead");
  });
});

describe("checkpoints", () => {
  it("moves the respawn point when touched", () => {
    const sim = makeSim([{ art: flatArt() }], [{ zoneId: "z1", x: 8, y: 12 }]);
    run(sim, { right: true }, 60);
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 2, y: FLOOR_Y });
    run(sim, { right: true }, 60);
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 8 * 16 + 1, y: FLOOR_Y });
  });

  it("respawns the player there", () => {
    const sim = makeSim([{ art: flatArt() }], [{ zoneId: "z1", x: 8, y: 12 }]);
    run(sim, { right: true }, 120);
    kill(sim);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.phase).toBe("play");
    expect(sim.player).toMatchObject({ x: 8 * 16 + 1, y: FLOOR_Y, health: 28 });
  });

  it("ignores checkpoints that belong to other zones", () => {
    const sim = makeSim([{ art: flatArt() }], [{ zoneId: "boss", x: 8, y: 12 }]);
    run(sim, { right: true }, 120);
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 2, y: FLOOR_Y });
  });
});

describe("kill", () => {
  it("does not restart the timer when already dead", () => {
    const sim = makeSim([{ art: flatArt() }]);
    kill(sim);
    run(sim, {}, 10);
    kill(sim);
    expect(sim.timer).toBe(RESPAWN_STEPS - 10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/runtime/hazards.test.ts`
Expected: FAIL, cannot resolve `@/runtime/sim/hazards`.

- [ ] **Step 3: Implement hazards**

`src/runtime/sim/hazards.ts`:

```ts
import { TILE_SIZE } from "@/model/geometry";
import { RESPAWN_STEPS } from "./constants";
import type { Sim } from "./state";
import { createTileMap, firstTile, lastTile, touchingLadder } from "./tilemap";

export function touchingSpike(sim: Sim): boolean {
  const { map, player: p } = sim;
  for (let ty = firstTile(p.y); ty <= lastTile(p.y + p.h); ty++) {
    for (let tx = firstTile(p.x); tx <= lastTile(p.x + p.w); tx++) {
      if (map.behaviourAt(tx, ty) === "spike") return true;
    }
  }
  return false;
}

export function kill(sim: Sim): void {
  if (sim.phase === "dead") return;
  sim.phase = "dead";
  sim.timer = RESPAWN_STEPS;
  sim.transition = null;
  sim.player.health = 0;
  sim.player.vx = 0;
  sim.player.vy = 0;
}

export function respawn(sim: Sim): void {
  const p = sim.player;
  sim.zoneIndex = sim.respawn.zoneIndex;
  sim.map = createTileMap(sim.level.zones[sim.zoneIndex], sim.pack);
  p.x = sim.respawn.x;
  p.y = sim.respawn.y;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.onIce = false;
  p.onLadder = touchingLadder(sim.map, p);
  p.health = sim.settings.maxHealth;
  sim.shots = [];
  sim.phase = "play";
  sim.timer = 0;
}

// Touching a checkpoint in the current zone makes it the respawn point.
export function touchCheckpoints(sim: Sim): void {
  const { map, player: p } = sim;
  for (const checkpoint of sim.level.checkpoints) {
    if (checkpoint.zoneId !== map.zone.id) continue;
    const left = checkpoint.x * TILE_SIZE;
    const top = checkpoint.y * TILE_SIZE;
    const touching =
      p.x < left + TILE_SIZE && p.x + p.w > left && p.y < top + TILE_SIZE && p.y + p.h > top;
    if (!touching) continue;
    sim.respawn = {
      zoneIndex: sim.zoneIndex,
      x: left + (TILE_SIZE - p.w) / 2,
      y: top + TILE_SIZE - p.h,
    };
  }
}
```

Replace `src/runtime/sim/step.ts` with:

```ts
import { kill, respawn, touchCheckpoints, touchingSpike } from "./hazards";
import { updatePlayer } from "./player";
import type { Input, Sim } from "./state";

// Advances the simulation by one step of 1/60 second.
export function step(sim: Sim, input: Input): void {
  sim.steps++;
  if (sim.phase === "dead") {
    if (--sim.timer <= 0) respawn(sim);
    sim.prev = input;
    return;
  }
  updatePlayer(sim, input);
  touchCheckpoints(sim);
  if (touchingSpike(sim) || sim.player.y > sim.map.heightPx) kill(sim);
  sim.prev = input;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/sim tests/runtime/hazards.test.ts
git commit -m "feat: add spikes, pits, respawn and checkpoints"
```

---

### Task 5: Shots and the camera

**Files:**
- Create: `src/runtime/sim/shots.ts`, `src/runtime/sim/view.ts`
- Modify: `src/runtime/sim/step.ts` (replace the file)
- Test: `tests/runtime/shots.test.ts`, `tests/runtime/view.test.ts`

**Interfaces:**
- Consumes: `Sim`, `Camera`, `Shot` (Task 2); `SCREEN_W`, `SCREEN_H`, `SHOT_W`, `SHOT_H`, `SHOT_SPEED` (Task 1); `clamp` (Task 1); `isSolid`, `firstTile` (Task 1)
- Produces:
  - `cameraFor(sim: Pick<Sim, "map" | "player">): Camera` (centres on the player, clamped to the zone)
  - `shoot(sim: Sim): void` (adds a shot in front of the player if fewer than `settings.maxShots` exist)
  - `updateShots(sim: Sim): void` (moves shots; removes those that hit a solid tile or leave the screen)
  - `step` now fires on the step shoot is first pressed, and moves shots

- [ ] **Step 1: Write the failing tests**

`tests/runtime/view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cameraFor } from "@/runtime/sim/view";
import { flatArt, rowWith } from "./helpers";
import { makeSim } from "./simHelpers";

describe("cameraFor", () => {
  it("stays at the left edge at the start of a zone", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    expect(cameraFor(sim)).toEqual({ x: 0, y: 0 });
  });

  it("centres on the player in the middle of a wide zone", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    sim.player.x = 400;
    expect(cameraFor(sim)).toEqual({ x: 400 + 7 - 128, y: 0 });
  });

  it("stops at the right edge", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    sim.player.x = 760;
    expect(cameraFor(sim)).toEqual({ x: 768 - 256, y: 0 });
  });

  it("follows the player up and down a vertical zone", () => {
    const art = Array.from({ length: 30 }, () => rowWith({ 7: "H" }));
    const sim = makeSim([{ art, entry: { edge: "bottom", from: 7, to: 8 } }]);
    expect(cameraFor(sim)).toEqual({ x: 0, y: 240 });
    sim.player.y = 300;
    expect(cameraFor(sim)).toEqual({ x: 0, y: 300 + 11 - 120 });
    sim.player.y = 10;
    expect(cameraFor(sim)).toEqual({ x: 0, y: 0 });
  });
});
```

`tests/runtime/shots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RESPAWN_STEPS } from "@/runtime/sim/constants";
import { flatArt, rowWith } from "./helpers";
import { makeSim, run } from "./simHelpers";

describe("shots", () => {
  it("fires one shot in the facing direction when shoot is pressed", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 1);
    run(sim, { shoot: true }, 1);
    expect(sim.shots).toHaveLength(1);
    expect(sim.shots[0]).toEqual({ x: 2 + 14 + 4, y: sim.player.y + 8, vx: 4 });
  });

  it("fires left when facing left", () => {
    const sim = makeSim([{ art: flatArt() }]);
    sim.player.x = 100;
    run(sim, { left: true }, 1);
    const x = sim.player.x;
    run(sim, { shoot: true }, 1);
    expect(sim.shots[0]).toMatchObject({ x: x - 6 - 4, vx: -4 });
  });

  it("does not fire again while shoot is held", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, { shoot: true }, 10);
    expect(sim.shots).toHaveLength(1);
  });

  it("allows only the project's maximum number of shots at once", () => {
    const sim = makeSim([{ art: flatArt() }]);
    for (let i = 0; i < 5; i++) {
      run(sim, { shoot: true }, 1);
      run(sim, {}, 1);
    }
    expect(sim.shots).toHaveLength(3);
  });

  it("removes a shot that hits a wall", () => {
    const sim = makeSim([{ art: flatArt({ 12: rowWith({ 5: "#" }), 11: rowWith({ 5: "#" }) }) }]);
    run(sim, { shoot: true }, 1);
    run(sim, {}, 30);
    expect(sim.shots).toEqual([]);
  });

  it("removes a shot that leaves the screen", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    run(sim, { shoot: true }, 1);
    run(sim, {}, 30);
    expect(sim.shots).toHaveLength(1);
    run(sim, {}, 40);
    expect(sim.shots).toEqual([]);
  });

  it("clears shots on death", () => {
    const sim = makeSim([{ art: flatArt({ 13: "######^#########" }) }]);
    run(sim, { shoot: true }, 1);
    sim.player.x = 5 * 16;
    run(sim, { right: true }, 30);
    expect(sim.phase).toBe("dead");
    expect(sim.shots).toHaveLength(1);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.phase).toBe("play");
    expect(sim.shots).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/runtime/shots.test.ts tests/runtime/view.test.ts`
Expected: FAIL. `view.test.ts` cannot resolve `@/runtime/sim/view`; the shot tests report `sim.shots` has length 0.

- [ ] **Step 3: Implement the camera and shots**

`src/runtime/sim/view.ts`:

```ts
import { SCREEN_H, SCREEN_W } from "./constants";
import { clamp } from "./math";
import type { Camera, Sim } from "./state";

// The top-left corner of the screen in zone pixels: centred on the player, kept inside the zone.
export function cameraFor(sim: Pick<Sim, "map" | "player">): Camera {
  const { map, player: p } = sim;
  return {
    x: clamp(p.x + p.w / 2 - SCREEN_W / 2, 0, map.widthPx - SCREEN_W),
    y: clamp(p.y + p.h / 2 - SCREEN_H / 2, 0, map.heightPx - SCREEN_H),
  };
}
```

`src/runtime/sim/shots.ts`:

```ts
import { SCREEN_W, SHOT_H, SHOT_SPEED, SHOT_W } from "./constants";
import type { Sim } from "./state";
import { firstTile, isSolid } from "./tilemap";
import { cameraFor } from "./view";

export function shoot(sim: Sim): void {
  const p = sim.player;
  if (sim.shots.length >= sim.settings.maxShots) return;
  sim.shots.push({
    x: p.facing > 0 ? p.x + p.w : p.x - SHOT_W,
    y: p.y + 8,
    vx: p.facing * SHOT_SPEED,
  });
}

// Moves shots, removing any that hit a solid tile or leave the screen.
export function updateShots(sim: Sim): void {
  const camera = cameraFor(sim);
  sim.shots = sim.shots.filter((shot) => {
    shot.x += shot.vx;
    const cx = shot.x + SHOT_W / 2;
    const cy = shot.y + SHOT_H / 2;
    if (isSolid(sim.map.behaviourAt(firstTile(cx), firstTile(cy)))) return false;
    return shot.x + SHOT_W > camera.x && shot.x < camera.x + SCREEN_W;
  });
}
```

Replace `src/runtime/sim/step.ts` with:

```ts
import { kill, respawn, touchCheckpoints, touchingSpike } from "./hazards";
import { updatePlayer } from "./player";
import { shoot, updateShots } from "./shots";
import type { Input, Sim } from "./state";

// Advances the simulation by one step of 1/60 second.
export function step(sim: Sim, input: Input): void {
  sim.steps++;
  if (sim.phase === "dead") {
    if (--sim.timer <= 0) respawn(sim);
    sim.prev = input;
    return;
  }
  updatePlayer(sim, input);
  if (input.shoot && !sim.prev.shoot) shoot(sim);
  updateShots(sim);
  touchCheckpoints(sim);
  if (touchingSpike(sim) || sim.player.y > sim.map.heightPx) kill(sim);
  sim.prev = input;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/sim tests/runtime/shots.test.ts tests/runtime/view.test.ts
git commit -m "feat: add shots and camera"
```

---

### Task 6: Zone transitions

**Files:**
- Create: `src/runtime/sim/edges.ts`, `src/runtime/sim/index.ts`
- Modify: `src/runtime/sim/step.ts` (replace the file), `src/runtime/sim/view.ts` (add `viewFor`)
- Test: `tests/runtime/transitions.test.ts`; add to `tests/runtime/view.test.ts`

**Interfaces:**
- Consumes: `Sim`, `Camera`, `entryPosition` (Task 2); `createTileMap`, `touchingLadder` (Task 1); `kill` (Task 4); `cameraFor` (Task 5); `TRANSITION_STEPS`, `SCREEN_W`, `SCREEN_H` (Task 1)
- Produces:
  - `checkEdges(sim: Sim): void` (starts a transition when the player crosses the exit opening; kills a player who falls out of the bottom anywhere else)
  - `type View = { camera: Camera; incoming: { dx: number; dy: number }; outgoing: { zoneIndex: number; camera: Camera; dx: number; dy: number } | null }`
  - `viewFor(sim: Sim): View` (where to draw the current zone and, during a transition, the previous one)
  - `step` in its final form
  - `src/runtime/sim/index.ts` re-exporting `constants`, `state`, `step`, `tilemap` and `view`

Transition rules:

| Exit edge | Triggers when | Carry passed to `entryPosition` |
|---|---|---|
| right | the player's centre passes the zone's right edge | feet height below the top of the exit opening |
| top | the player's top is above the zone and their centre is within the opening's columns | centre's distance from the opening's first column |
| bottom | the player's top is below the zone and their centre is within the opening's columns | the same |

On a transition the sim switches to the next zone at once, places the player at its entry, clears shots, and enters the `transition` phase for `TRANSITION_STEPS` steps, during which nothing moves. The boss room has no exit, so nothing triggers there. If the next zone's entry is on an edge that does not pair with the exit, the player is still placed at that entry.

During a transition `viewFor` slides the screens: with progress `t` from 0 to 1, moving right the incoming zone is drawn at `dx = (1 - t) * 256` and the outgoing at `dx = -t * 256`; moving up the incoming is at `dy = -(1 - t) * 240` and the outgoing at `dy = t * 240`; moving down the signs are reversed.

- [ ] **Step 1: Write the failing tests**

`tests/runtime/transitions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RESPAWN_STEPS, TRANSITION_STEPS } from "@/runtime/sim/constants";
import { flatArt, rowWith, type ZoneArt } from "./helpers";
import { makeSim, run, runUntil, standOn } from "./simHelpers";

const FLOOR_Y = 13 * 16 - 22;
const inZone = (index: number) => (s: { zoneIndex: number }) => s.zoneIndex === index;

// A zone with a ladder in column 4 running to the top, and its exit there.
function ladderUp(): ZoneArt {
  const overrides: Record<number, string> = {};
  for (let y = 0; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
  return { art: flatArt(overrides), exit: { edge: "top", from: 4, to: 5 } };
}

// A two-screen vertical zone entered from below, with a ladder in column 7.
function shaft(withLadder: boolean): ZoneArt {
  const art = Array.from({ length: 30 }, () => (withLadder ? rowWith({ 7: "H" }) : rowWith({})));
  return { art, entry: { edge: "bottom", from: 7, to: 8 } };
}

describe("leaving by the right edge", () => {
  it("moves to the next zone at the same height", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt() }]);
    runUntil(sim, { right: true }, inZone(1));
    expect(sim.phase).toBe("transition");
    expect(sim.timer).toBe(TRANSITION_STEPS);
    expect(sim.transition).toMatchObject({ fromIndex: 0, direction: "right" });
    expect(sim.transition?.fromCamera).toEqual({ x: 0, y: 0 });
    expect(sim.map.zone.id).toBe("z2");
    expect(sim.player).toMatchObject({ x: 2, y: FLOOR_Y });
  });

  it("freezes everything during the transition, then resumes", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt() }]);
    runUntil(sim, { right: true }, inZone(1));
    run(sim, { right: true }, TRANSITION_STEPS - 1);
    expect(sim.phase).toBe("transition");
    expect(sim.player.x).toBe(2);
    run(sim, { right: true }, 1);
    expect(sim.phase).toBe("play");
    expect(sim.transition).toBeNull();
    run(sim, { right: true }, 1);
    expect(sim.player.x).toBe(2 + 1.375);
  });

  it("keeps the player's height within the opening", () => {
    const raised = flatArt({ 9: "#".repeat(16) });
    const sim = makeSim([
      { art: raised, entry: { edge: "left", from: 5, to: 8 }, exit: { edge: "right", from: 5, to: 8 } },
      { art: flatArt() },
    ]);
    expect(sim.player.y).toBe(9 * 16 - 22);
    runUntil(sim, { right: true }, inZone(1));
    // feet were at the bottom of a four-tile opening, so they arrive at the bottom of the next one
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("clears shots", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt() }]);
    sim.player.x = 200;
    run(sim, { right: true, shoot: true }, 1);
    expect(sim.shots).toHaveLength(1);
    runUntil(sim, { right: true }, inZone(1));
    expect(sim.shots).toEqual([]);
  });

  it("does not jump after the transition because jump was held through it", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt() }]);
    sim.player.x = 230;
    run(sim, {}, 1);
    runUntil(sim, { right: true }, inZone(1));
    run(sim, { jump: true }, TRANSITION_STEPS + 10);
    expect(sim.phase).toBe("play");
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("is blocked outside the opening's rows", () => {
    const sim = makeSim([
      { art: flatArt(), exit: { edge: "right", from: 2, to: 5 } },
      { art: flatArt() },
    ]);
    run(sim, { right: true }, 300);
    expect(sim.zoneIndex).toBe(0);
    expect(sim.player.x).toBe(256 - 14);
  });
});

describe("leaving by the top", () => {
  it("climbs into the next zone and stays on the ladder", () => {
    const sim = makeSim([ladderUp(), shaft(true)]);
    standOn(sim, 4, 13);
    runUntil(sim, { up: true }, inZone(1));
    expect(sim.transition).toMatchObject({ fromIndex: 0, direction: "up" });
    expect(sim.player.x).toBe(7 * 16 + 1);
    expect(sim.player.y).toBe(480 - 22);
    expect(sim.player.onLadder).toBe(true);
    run(sim, { up: true }, TRANSITION_STEPS + 10);
    expect(sim.player.y).toBe(480 - 22 - 10 * 1.25);
  });

  it("does not trigger outside the opening's columns", () => {
    const sim = makeSim([{ ...ladderUp(), exit: { edge: "top", from: 10, to: 11 } }, shaft(true)]);
    standOn(sim, 4, 13);
    run(sim, { up: true }, 300);
    expect(sim.zoneIndex).toBe(0);
  });

  it("kills and respawns a player who arrives with nothing to stand on", () => {
    const sim = makeSim([ladderUp(), shaft(false)]);
    standOn(sim, 4, 13);
    runUntil(sim, { up: true }, inZone(1));
    runUntil(sim, {}, (s) => s.phase === "dead", TRANSITION_STEPS + 60);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.phase).toBe("play");
    expect(sim.zoneIndex).toBe(0);
    expect(sim.player).toMatchObject({ x: 2, y: FLOOR_Y });
  });
});

describe("leaving by the bottom", () => {
  const holed = flatArt({ 13: "####..##########", 14: "####..##########" });

  it("falls into the next zone from the top", () => {
    const sim = makeSim([
      { art: holed, exit: { edge: "bottom", from: 4, to: 5 } },
      { art: flatArt(), entry: { edge: "top", from: 4, to: 5 } },
    ]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, inZone(1), 120);
    expect(sim.transition).toMatchObject({ fromIndex: 0, direction: "down" });
    expect(sim.player).toMatchObject({ x: 65, y: 0 });
    run(sim, {}, TRANSITION_STEPS + 60);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("is a deadly pit outside the opening's columns", () => {
    const sim = makeSim([
      { art: holed, exit: { edge: "bottom", from: 10, to: 11 } },
      { art: flatArt(), entry: { edge: "top", from: 10, to: 11 } },
    ]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, (s) => s.phase === "dead", 120);
    expect(sim.zoneIndex).toBe(0);
  });
});

describe("edge cases", () => {
  it("has no way out of the boss room", () => {
    const sim = makeSim([{ art: flatArt() }], [], "boss");
    run(sim, { right: true }, 300);
    expect(sim.zoneIndex).toBe(2);
    expect(sim.player.x).toBe(256 - 14);
  });

  it("places the player at the next entry even when the edges do not pair", () => {
    const sim = makeSim([{ art: flatArt() }, shaft(true)]);
    runUntil(sim, { right: true }, inZone(1));
    expect(sim.phase).toBe("transition");
    expect(sim.player.y).toBe(480 - 22);
    // nothing to stand on there, so the player falls, dies and respawns at the start
    runUntil(sim, {}, (s) => s.phase === "dead", TRANSITION_STEPS + 60);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.zoneIndex).toBe(0);
  });

  it("walks the whole default chain to the boss room", () => {
    const sim = makeSim([{ art: flatArt() }]);
    runUntil(sim, { right: true }, inZone(2), 1000);
    expect(sim.map.zone.kind).toBe("bossRoom");
  });
});
```

Add these to the end of `tests/runtime/view.test.ts`, and change its imports to the ones shown:

```ts
import { describe, expect, it } from "vitest";
import { TRANSITION_STEPS } from "@/runtime/sim/constants";
import { cameraFor, viewFor } from "@/runtime/sim/view";
import { flatArt, rowWith } from "./helpers";
import { makeSim, run, runUntil, standOn } from "./simHelpers";
```

```ts
describe("viewFor", () => {
  it("draws only the current zone in normal play", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    sim.player.x = 400;
    expect(viewFor(sim)).toEqual({
      camera: { x: 279, y: 0 },
      incoming: { dx: 0, dy: 0 },
      outgoing: null,
    });
  });

  it("slides the screens sideways when moving right", () => {
    const sim = makeSim([{ art: flatArt({}, 2) }, { art: flatArt() }]);
    runUntil(sim, { right: true }, (s) => s.zoneIndex === 1);
    expect(viewFor(sim)).toEqual({
      camera: { x: 0, y: 0 },
      incoming: { dx: 256, dy: 0 },
      outgoing: { zoneIndex: 0, camera: { x: 256, y: 0 }, dx: 0, dy: 0 },
    });
    run(sim, {}, TRANSITION_STEPS / 2);
    expect(viewFor(sim).incoming).toEqual({ dx: 128, dy: 0 });
    expect(viewFor(sim).outgoing).toMatchObject({ dx: -128, dy: 0 });
  });

  it("slides the screens down when moving up", () => {
    const overrides: Record<number, string> = {};
    for (let y = 0; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
    const shaft = Array.from({ length: 30 }, () => rowWith({ 7: "H" }));
    const sim = makeSim([
      { art: flatArt(overrides), exit: { edge: "top", from: 4, to: 5 } },
      { art: shaft, entry: { edge: "bottom", from: 7, to: 8 } },
    ]);
    standOn(sim, 4, 13);
    runUntil(sim, { up: true }, (s) => s.zoneIndex === 1);
    run(sim, {}, TRANSITION_STEPS / 2);
    expect(viewFor(sim).camera).toEqual({ x: 0, y: 240 });
    expect(viewFor(sim).incoming).toEqual({ dx: 0, dy: -120 });
    expect(viewFor(sim).outgoing).toMatchObject({ zoneIndex: 0, dx: 0, dy: 120 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/runtime/transitions.test.ts tests/runtime/view.test.ts`
Expected: FAIL. The transition tests report "The condition was not reached"; `view.test.ts` reports `viewFor` is not exported.

- [ ] **Step 3: Implement transitions**

`src/runtime/sim/edges.ts`:

```ts
import { TILE_SIZE } from "@/model/geometry";
import { TRANSITION_STEPS } from "./constants";
import { kill } from "./hazards";
import { entryPosition, type Sim, type Transition } from "./state";
import { createTileMap, touchingLadder } from "./tilemap";
import { cameraFor } from "./view";

// Moves to the next zone and starts the screen slide.
function leave(sim: Sim, direction: Transition["direction"], carry: number): void {
  const next = sim.zoneIndex + 1;
  if (next >= sim.level.zones.length) return;
  const p = sim.player;
  sim.transition = { fromIndex: sim.zoneIndex, fromCamera: cameraFor(sim), direction };
  sim.zoneIndex = next;
  sim.map = createTileMap(sim.level.zones[next], sim.pack);
  const position = entryPosition(sim.map, carry);
  p.x = position.x;
  p.y = position.y;
  p.vy = 0;
  p.onLadder = touchingLadder(sim.map, p);
  sim.shots = [];
  sim.phase = "transition";
  sim.timer = TRANSITION_STEPS;
}

// Starts a transition when the player crosses the exit opening. Falling out of the
// bottom anywhere else is a pit.
export function checkEdges(sim: Sim): void {
  const { map, player: p } = sim;
  const exit = map.zone.exit;
  const cx = p.x + p.w / 2;
  const along = exit === null ? 0 : cx - exit.from * TILE_SIZE;
  const inColumns =
    exit !== null && along >= 0 && cx < (exit.to + 1) * TILE_SIZE;

  if (exit?.edge === "right" && cx >= map.widthPx) {
    leave(sim, "right", p.y + p.h - exit.from * TILE_SIZE);
  } else if (exit?.edge === "top" && p.y < 0 && inColumns) {
    leave(sim, "up", along);
  } else if (p.y > map.heightPx) {
    if (exit?.edge === "bottom" && inColumns) leave(sim, "down", along);
    else kill(sim);
  }
}
```

Replace `src/runtime/sim/step.ts` with:

```ts
import { checkEdges } from "./edges";
import { kill, respawn, touchCheckpoints, touchingSpike } from "./hazards";
import { updatePlayer } from "./player";
import { shoot, updateShots } from "./shots";
import type { Input, Sim } from "./state";

// Advances the simulation by one step of 1/60 second.
export function step(sim: Sim, input: Input): void {
  sim.steps++;
  if (sim.phase === "dead") {
    if (--sim.timer <= 0) respawn(sim);
  } else if (sim.phase === "transition") {
    if (--sim.timer <= 0) {
      sim.phase = "play";
      sim.transition = null;
    }
  } else {
    updatePlayer(sim, input);
    if (input.shoot && !sim.prev.shoot) shoot(sim);
    updateShots(sim);
    touchCheckpoints(sim);
    if (touchingSpike(sim)) kill(sim);
    else checkEdges(sim);
  }
  sim.prev = input;
}
```

Add to the end of `src/runtime/sim/view.ts`, and change its imports to the ones shown:

```ts
import { SCREEN_H, SCREEN_W, TRANSITION_STEPS } from "./constants";
import { clamp } from "./math";
import type { Camera, Sim } from "./state";
```

```ts
export type View = {
  camera: Camera;
  incoming: { dx: number; dy: number };
  outgoing: { zoneIndex: number; camera: Camera; dx: number; dy: number } | null;
};

// Where to draw the current zone and, during a transition, the one being left.
export function viewFor(sim: Sim): View {
  const camera = cameraFor(sim);
  const transition = sim.transition;
  if (sim.phase !== "transition" || !transition) {
    return { camera, incoming: { dx: 0, dy: 0 }, outgoing: null };
  }
  const t = 1 - sim.timer / TRANSITION_STEPS;
  const sign = transition.direction === "down" ? 1 : -1;
  const horizontal = transition.direction === "right";
  // Moving right the new screen comes in from the right; moving up, from above; moving down, from below.
  // Adding 0 turns a negative zero into zero.
  const slide = (amount: number) =>
    horizontal
      ? { dx: amount * SCREEN_W + 0, dy: 0 }
      : { dx: 0, dy: sign * amount * SCREEN_H + 0 };
  return {
    camera,
    incoming: slide(1 - t),
    outgoing: { zoneIndex: transition.fromIndex, camera: transition.fromCamera, ...slide(-t) },
  };
}
```

`src/runtime/sim/index.ts`:

```ts
export * from "./constants";
export * from "./state";
export * from "./step";
export * from "./tilemap";
export * from "./view";
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS, including the Task 4 pit tests now that pits go through `checkEdges`; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/sim tests/runtime
git commit -m "feat: add zone transitions and the transition view"
```

---

### Task 7: Drawing, keyboard and the frame loop

**Files:**
- Create: `src/runtime/render/draw.ts`, `src/runtime/render/keyboard.ts`, `src/runtime/render/loop.ts`
- Test: `tests/runtime/render.test.ts`

**Interfaces:**
- Consumes: `Sim`, `Input`, `NO_INPUT` (Task 2); `viewFor` (Task 6); `firstTile`, `lastTile` (Task 1); constants (Task 1); `kill` (Task 4)
- Produces:
  - `type Ctx2D = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">`
  - `PLAYER_COLOUR`, `SHOT_COLOUR`, `BACKGROUNDS: Record<string, string>`
  - `draw(ctx: Ctx2D, sim: Sim): void`
  - `KEY_MAP: Record<string, keyof Input>` (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `KeyZ` jump, `KeyX` shoot)
  - `createKeyboard(target: Pick<EventTarget, "addEventListener" | "removeEventListener">): { read(): Input; dispose(): void }`
  - `STEP_MS = 1000 / 60`, `MAX_STEPS_PER_FRAME = 5`
  - `stepsFor(accumulator: number, elapsedMs: number): { steps: number; accumulator: number }`

Drawing uses plain rectangles: a background colour per zone variant, one colour per tile behaviour (one-way tiles are drawn 4 pixels thick), the player as a rectangle with a small mark on the facing side, shots, and a health bar. Positions are rounded to whole pixels.

The keyboard calls `preventDefault` on mapped keys so the arrows do not scroll the page, and releases every key on `blur`.

`stepsFor` turns elapsed time into a whole number of steps, keeping the remainder. If more than `MAX_STEPS_PER_FRAME` are due, it returns that many and discards the rest.

- [ ] **Step 1: Write the failing test**

`tests/runtime/render.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { kill } from "@/runtime/sim/hazards";
import { BACKGROUNDS, draw, PLAYER_COLOUR, SHOT_COLOUR } from "@/runtime/render/draw";
import { createKeyboard } from "@/runtime/render/keyboard";
import { MAX_STEPS_PER_FRAME, STEP_MS, stepsFor } from "@/runtime/render/loop";
import { NO_INPUT } from "@/runtime/sim/state";
import { flatArt } from "./helpers";
import { makeSim, run, runUntil } from "./simHelpers";

type Call = { colour: string; x: number; y: number; w: number; h: number };

function fakeContext() {
  const calls: Call[] = [];
  return {
    calls,
    fillStyle: "" as string,
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ colour: this.fillStyle, x, y, w, h });
    },
  };
}

describe("draw", () => {
  it("draws the background, the floor, the player and the health bar", () => {
    const sim = makeSim([{ art: flatArt() }]);
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls).toContainEqual({ colour: BACKGROUNDS.outdoor, x: 0, y: 0, w: 256, h: 240 });
    expect(ctx.calls).toContainEqual({ colour: PLAYER_COLOUR, x: 2, y: 186, w: 14, h: 22 });
    // 16 columns by 2 rows of floor
    expect(ctx.calls.filter((c) => c.w === 16 && c.h === 16)).toHaveLength(32);
    // one tick per point of health
    expect(ctx.calls.filter((c) => c.w === 6 && c.h === 1)).toHaveLength(28);
  });

  it("draws only the tiles on screen, offset by the camera", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    sim.player.x = 400;
    const ctx = fakeContext();
    draw(ctx, sim);
    const tiles = ctx.calls.filter((c) => c.w === 16 && c.h === 16);
    // camera x is 279, so columns 17 to 33 show: 17 columns by 2 rows
    expect(tiles).toHaveLength(34);
    expect(Math.min(...tiles.map((t) => t.x))).toBe(17 * 16 - 279);
    expect(ctx.calls).toContainEqual({ colour: PLAYER_COLOUR, x: 400 - 279, y: 186, w: 14, h: 22 });
  });

  it("draws shots", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, { shoot: true }, 1);
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls.filter((c) => c.colour === SHOT_COLOUR)).toHaveLength(1);
  });

  it("does not draw the player while dead", () => {
    const sim = makeSim([{ art: flatArt() }]);
    kill(sim);
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls.filter((c) => c.colour === PLAYER_COLOUR)).toHaveLength(0);
  });

  it("draws both zones during a transition", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt() }]);
    runUntil(sim, { right: true }, (s) => s.zoneIndex === 1);
    run(sim, {}, 24);
    const ctx = fakeContext();
    draw(ctx, sim);
    const backgrounds = ctx.calls.filter((c) => c.w === 256 && c.h === 240 && c.colour !== "#000000");
    expect(backgrounds.map((b) => b.x).sort((a, b) => a - b)).toEqual([-128, 128]);
  });
});

function key(type: string, code: string) {
  return Object.assign(new Event(type, { cancelable: true }), { code });
}

describe("createKeyboard", () => {
  it("reports held keys", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    expect(keyboard.read()).toEqual(NO_INPUT);
    target.dispatchEvent(key("keydown", "ArrowRight"));
    target.dispatchEvent(key("keydown", "KeyZ"));
    expect(keyboard.read()).toEqual({ ...NO_INPUT, right: true, jump: true });
    target.dispatchEvent(key("keyup", "ArrowRight"));
    expect(keyboard.read()).toEqual({ ...NO_INPUT, jump: true });
  });

  it("maps every control", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "KeyX"]) {
      target.dispatchEvent(key("keydown", code));
    }
    expect(keyboard.read()).toEqual({
      left: true,
      right: true,
      up: true,
      down: true,
      jump: true,
      shoot: true,
    });
  });

  it("stops mapped keys scrolling the page and leaves other keys alone", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    const arrow = key("keydown", "ArrowDown");
    const other = key("keydown", "KeyQ");
    target.dispatchEvent(arrow);
    target.dispatchEvent(other);
    expect(arrow.defaultPrevented).toBe(true);
    expect(other.defaultPrevented).toBe(false);
    expect(keyboard.read()).toEqual({ ...NO_INPUT, down: true });
  });

  it("releases every key when the window loses focus", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    target.dispatchEvent(key("keydown", "ArrowRight"));
    target.dispatchEvent(new Event("blur"));
    expect(keyboard.read()).toEqual(NO_INPUT);
  });

  it("returns a copy, so a caller cannot change the held keys", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    keyboard.read().jump = true;
    expect(keyboard.read().jump).toBe(false);
  });

  it("stops listening when disposed", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    keyboard.dispose();
    target.dispatchEvent(key("keydown", "ArrowRight"));
    expect(keyboard.read()).toEqual(NO_INPUT);
  });
});

describe("stepsFor", () => {
  it("runs one step per sixtieth of a second and keeps the remainder", () => {
    const result = stepsFor(0, 17);
    expect(result.steps).toBe(1);
    expect(result.accumulator).toBeCloseTo(17 - STEP_MS);
  });

  it("waits when not enough time has passed", () => {
    expect(stepsFor(0, 8)).toEqual({ steps: 0, accumulator: 8 });
    expect(stepsFor(10, 8).steps).toBe(1);
  });

  it("runs several steps to catch up", () => {
    expect(stepsFor(0, 50).steps).toBe(3);
  });

  it("caps a long frame and drops the rest", () => {
    expect(stepsFor(0, 5000)).toEqual({ steps: MAX_STEPS_PER_FRAME, accumulator: 0 });
  });

  it("ignores negative time", () => {
    expect(stepsFor(3, -100)).toEqual({ steps: 0, accumulator: 3 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/runtime/render.test.ts`
Expected: FAIL, cannot resolve `@/runtime/render/draw`.

- [ ] **Step 3: Implement drawing**

`src/runtime/render/draw.ts`:

```ts
import type { ContentPack, TileBehaviour } from "@/model/contentPack";
import { TILE_SIZE, tileIndex, zoneSize } from "@/model/geometry";
import type { Zone } from "@/model/schema";
import { SCREEN_H, SCREEN_W, SHOT_H, SHOT_W } from "@/runtime/sim/constants";
import type { Camera, Sim } from "@/runtime/sim/state";
import { firstTile, lastTile } from "@/runtime/sim/tilemap";
import { viewFor } from "@/runtime/sim/view";

export type Ctx2D = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">;

// Placeholder colours until the content pack supplies sprite art.
export const BACKGROUNDS: Record<string, string> = { outdoor: "#9bd4ff", cave: "#1c2740" };
export const PLAYER_COLOUR = "#2f6bff";
export const SHOT_COLOUR = "#fff275";
const TILE_COLOURS: Record<TileBehaviour, string> = {
  solid: "#e8f4ff",
  ice: "#7fd6f5",
  ladder: "#c9853a",
  spike: "#ff4d6d",
  oneWay: "#a8b8c8",
};

function rect(ctx: Ctx2D, colour: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

function drawZone(
  ctx: Ctx2D,
  zone: Zone,
  pack: ContentPack,
  camera: Camera,
  dx: number,
  dy: number,
): void {
  const size = zoneSize(zone.scroll, zone.screens);
  const behaviours = new Map(pack.tiles.map((t) => [t.id, t.behaviour]));
  const camX = Math.round(camera.x);
  const camY = Math.round(camera.y);
  rect(ctx, BACKGROUNDS[zone.variant] ?? "#404040", dx, dy, SCREEN_W, SCREEN_H);

  const x0 = Math.max(0, firstTile(camX));
  const x1 = Math.min(size.width - 1, lastTile(camX + SCREEN_W));
  const y0 = Math.max(0, firstTile(camY));
  const y1 = Math.min(size.height - 1, lastTile(camY + SCREEN_H));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const behaviour = behaviours.get(zone.tiles[tileIndex(size, tx, ty)]);
      if (!behaviour) continue;
      const height = behaviour === "oneWay" ? 4 : TILE_SIZE;
      rect(
        ctx,
        TILE_COLOURS[behaviour],
        tx * TILE_SIZE - camX + dx,
        ty * TILE_SIZE - camY + dy,
        TILE_SIZE,
        height,
      );
    }
  }
}

export function draw(ctx: Ctx2D, sim: Sim): void {
  const view = viewFor(sim);
  rect(ctx, "#000000", 0, 0, SCREEN_W, SCREEN_H);
  if (view.outgoing) {
    const { zoneIndex, camera, dx, dy } = view.outgoing;
    drawZone(ctx, sim.level.zones[zoneIndex], sim.pack, camera, Math.round(dx), Math.round(dy));
  }
  const offsetX = Math.round(view.incoming.dx);
  const offsetY = Math.round(view.incoming.dy);
  drawZone(ctx, sim.map.zone, sim.pack, view.camera, offsetX, offsetY);

  const originX = offsetX - Math.round(view.camera.x);
  const originY = offsetY - Math.round(view.camera.y);
  const p = sim.player;
  if (sim.phase !== "dead") {
    const px = Math.round(p.x) + originX;
    const py = Math.round(p.y) + originY;
    rect(ctx, PLAYER_COLOUR, px, py, p.w, p.h);
    rect(ctx, "#ffffff", p.facing > 0 ? px + p.w - 4 : px + 1, py + 4, 3, 3);
  }
  for (const shot of sim.shots) {
    rect(ctx, SHOT_COLOUR, Math.round(shot.x) + originX, Math.round(shot.y) + originY, SHOT_W, SHOT_H);
  }

  // Health bar: one tick per point, filled from the bottom.
  rect(ctx, "#000000", 15, 15, 8, sim.settings.maxHealth * 2 + 1);
  for (let i = 0; i < p.health; i++) {
    rect(ctx, "#ffe08a", 16, 14 + (sim.settings.maxHealth - i) * 2, 6, 1);
  }
}
```

- [ ] **Step 4: Implement the keyboard and the loop**

`src/runtime/render/keyboard.ts`:

```ts
import { NO_INPUT, type Input } from "@/runtime/sim/state";

export const KEY_MAP: Record<string, keyof Input> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  KeyZ: "jump",
  KeyX: "shoot",
};

export function createKeyboard(
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
): { read(): Input; dispose(): void } {
  let held: Input = { ...NO_INPUT };

  const set = (down: boolean) => (event: Event) => {
    const control = KEY_MAP[(event as KeyboardEvent).code];
    if (!control) return;
    held[control] = down;
    event.preventDefault(); // stop the arrow keys scrolling the page
  };
  const onDown = set(true);
  const onUp = set(false);
  // Keys released while the window is unfocused never send keyup, so release them all.
  const onBlur = () => {
    held = { ...NO_INPUT };
  };

  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  target.addEventListener("blur", onBlur);
  return {
    read: () => ({ ...held }),
    dispose() {
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
      target.removeEventListener("blur", onBlur);
    },
  };
}
```

`src/runtime/render/loop.ts`:

```ts
export const STEP_MS = 1000 / 60;
// After a long pause (a background tab, a slow frame) run at most this many steps and drop the rest.
export const MAX_STEPS_PER_FRAME = 5;

// Turns elapsed time into a whole number of simulation steps, keeping the remainder.
export function stepsFor(
  accumulator: number,
  elapsedMs: number,
): { steps: number; accumulator: number } {
  const total = accumulator + Math.max(0, elapsedMs);
  const steps = Math.floor(total / STEP_MS);
  if (steps > MAX_STEPS_PER_FRAME) return { steps: MAX_STEPS_PER_FRAME, accumulator: 0 };
  return { steps, accumulator: total - steps * STEP_MS };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/runtime/render tests/runtime/render.test.ts
git commit -m "feat: add drawing, keyboard input and the frame loop"
```

---

### Task 8: Demo level and the play page

**Files:**
- Create: `src/content/demo.ts`, `src/runtime/render/PlayCanvas.tsx`, `src/app/play/page.tsx`
- Create: `tests/runtime/bot.ts`
- Modify: `src/app/page.tsx` (link to the play page), `tests/boundaries.test.ts` (cover `src/runtime/sim`)
- Test: `tests/runtime/demo.test.ts`

**Interfaces:**
- Consumes: `applyCommand`, `Command` from `@/commands` (plan 1); `createProject`, `structureProblems`, `chainProblems`, `ContentPack`, `Project` from `@/model` (plan 1); `createSim`, `step`, `Sim`, `Input`, `NO_INPUT`, `SCREEN_W`, `SCREEN_H`, `firstTile`, `isSolid`, `isPlatform` from `@/runtime/sim` (Tasks 1 to 6); `draw`, `createKeyboard`, `stepsFor` (Task 7)
- Produces:
  - `demoPack: ContentPack` (id `demo`; tiles 1 ground, 2 ice, 3 ladder, 4 spike, 5 ledge; variants `outdoor`, `cave`; no things or pieces)
  - `DEMO_LEVEL_ID = "demo"`, `createDemoProject(): Project`
  - `PlayCanvas(props: { project: Project; levelId: string; pack: ContentPack; startZoneId?: string; scale?: number })`
  - `botInput(sim: Sim): Input` (test only: runs right, jumps walls and gaps, climbs ladders that lead to a top exit)

The demo level, built through the plan 1 commands:

| Zone | Shape | What it has |
|---|---|---|
| Snowy Path | 3 screens, outdoor | a one-tile step, a two-tile pit, a stretch of ice, a checkpoint, a two-tile-high step |
| Ice Cave | 2 screens, cave | two spike tiles, a ledge, a ladder to a top exit |
| Frozen Shaft | 2 screens tall, cave | a ladder from the bottom entry to a floor near the top, exit right |
| Boss Corridor, Boss Room | 1 screen each | empty |

The bot test is the proof that the demo level can be finished. If the bot dies or stalls, change the level's layout in `demo.ts` until it passes; do not weaken the bot or the test.

- [ ] **Step 1: Write the bot**

`tests/runtime/bot.ts`:

```ts
import {
  firstTile,
  isPlatform,
  isSolid,
  NO_INPUT,
  type Input,
  type Sim,
} from "@/runtime/sim";

// A simple scripted player: runs right, jumps walls and gaps, and climbs any ladder
// it reaches in a zone whose exit is at the top.
export function botInput(sim: Sim): Input {
  const { map, player: p, prev } = sim;
  const input = { ...NO_INPUT };
  const solidAt = (px: number, py: number) =>
    isSolid(map.behaviourAt(firstTile(px), firstTile(py)));

  const cx = p.x + p.w / 2;
  const ladderHere = map.behaviourAt(firstTile(cx), firstTile(p.y + p.h / 2)) === "ladder";
  if (p.onLadder || (map.zone.exit?.edge === "top" && ladderHere)) {
    input.up = true;
    return input;
  }

  input.right = true;
  if (!p.onGround) {
    input.jump = prev.jump; // keep holding for a full-height jump
    return input;
  }
  const front = p.x + p.w + 2;
  const feet = p.y + p.h;
  const wall = solidAt(front, feet - 1) || solidAt(front, p.y);
  const gap = !solidAt(front, feet + 1) && !isPlatform(map, firstTile(front), firstTile(feet + 1));
  if (wall || gap) input.jump = !prev.jump;
  return input;
}
```

- [ ] **Step 2: Write the failing test**

`tests/runtime/demo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDemoProject, DEMO_LEVEL_ID, demoPack } from "@/content/demo";
import { chainProblems, structureProblems } from "@/model/validate";
import { createSim, step } from "@/runtime/sim";
import { botInput } from "./bot";

describe("the demo level", () => {
  it("is a valid project with every zone connected", () => {
    const project = createDemoProject();
    expect(structureProblems(project, demoPack)).toEqual([]);
    expect(chainProblems(project.levels[0])).toEqual([]);
    expect(project.levels[0].zones.map((z) => z.name)).toEqual([
      "Snowy Path",
      "Ice Cave",
      "Frozen Shaft",
      "Boss Corridor",
      "Boss Room",
    ]);
  });

  it("can be played from the start to the boss room without dying", () => {
    const sim = createSim(createDemoProject(), DEMO_LEVEL_ID, demoPack);
    let deaths = 0;
    for (let i = 0; i < 6000 && sim.map.zone.kind !== "bossRoom"; i++) {
      const wasDead = sim.phase === "dead";
      step(sim, botInput(sim));
      if (sim.phase === "dead" && !wasDead) deaths++;
    }
    expect(deaths).toBe(0);
    expect(sim.map.zone.kind).toBe("bossRoom");
  });

  it("sets the respawn point at the checkpoint on the way", () => {
    const sim = createSim(createDemoProject(), DEMO_LEVEL_ID, demoPack);
    for (let i = 0; i < 6000 && sim.zoneIndex === 0; i++) step(sim, botInput(sim));
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 36 * 16 + 1, y: 13 * 16 - 22 });
  });

  it("gives a fresh project each time", () => {
    expect(createDemoProject()).not.toBe(createDemoProject());
    expect(createDemoProject()).toEqual(createDemoProject());
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tests/runtime/demo.test.ts`
Expected: FAIL, cannot resolve `@/content/demo`.

- [ ] **Step 4: Implement the demo content**

`src/content/demo.ts`:

```ts
import { applyCommand, type Command } from "@/commands";
import { createProject, type ContentPack, type Project } from "@/model";

const GROUND = 1;
const ICE = 2;
const LADDER = 3;
const SPIKE = 4;
const LEDGE = 5;

// A stand-in pack with tiles only, until the snow pack arrives.
export const demoPack: ContentPack = {
  id: "demo",
  name: "Demo",
  variants: ["outdoor", "cave"],
  groundTileId: GROUND,
  tiles: [
    { id: GROUND, name: "ground", behaviour: "solid" },
    { id: ICE, name: "ice", behaviour: "ice" },
    { id: LADDER, name: "ladder", behaviour: "ladder" },
    { id: SPIKE, name: "spike", behaviour: "spike" },
    { id: LEDGE, name: "ledge", behaviour: "oneWay" },
  ],
  things: [],
  pieces: [],
};

export const DEMO_LEVEL_ID = "demo";

const L = DEMO_LEVEL_ID;
const fill = (zoneId: string, x: number, y: number, w: number, h: number, tile: number): Command => ({
  name: "fillRect",
  args: { levelId: L, zoneId, x, y, w, h, tile },
});

const COMMANDS: Command[] = [
  {
    name: "createLevel",
    args: {
      levelId: L,
      name: "Demo Stage",
      brief: "A short tour of running, jumping, ice, spikes and ladders.",
      zoneIds: ["path", "corridor", "boss"],
    },
  },

  // Snowy Path: three screens of running and jumping.
  { name: "renameZone", args: { levelId: L, zoneId: "path", name: "Snowy Path" } },
  { name: "resizeZone", args: { levelId: L, zoneId: "path", screens: 3 } },
  fill("path", 10, 12, 3, 1, GROUND), // a one-tile step
  { name: "clearRect", args: { levelId: L, zoneId: "path", x: 18, y: 13, w: 2, h: 2 } }, // a pit
  fill("path", 24, 13, 10, 1, ICE),
  { name: "addCheckpoint", args: { levelId: L, zoneId: "path", x: 36, y: 12 } },
  fill("path", 38, 11, 4, 2, GROUND), // a two-tile-high step

  // Ice Cave: spikes, then a ladder up and out.
  {
    name: "addZone",
    args: { levelId: L, zoneId: "cave", name: "Ice Cave", screens: 2, variant: "cave" },
  },
  fill("cave", 8, 13, 2, 1, SPIKE),
  fill("cave", 14, 10, 3, 1, LEDGE),
  fill("cave", 28, 0, 1, 13, LADDER),
  {
    name: "setZoneOpenings",
    args: { levelId: L, zoneId: "cave", exit: { edge: "top", from: 28, to: 29 } },
  },

  // Frozen Shaft: climb to a floor near the top and leave to the right.
  {
    name: "addZone",
    args: {
      levelId: L,
      zoneId: "shaft",
      name: "Frozen Shaft",
      scroll: "vertical",
      screens: 2,
      variant: "cave",
    },
  },
  fill("shaft", 7, 4, 1, 26, LADDER),
  fill("shaft", 8, 4, 8, 1, GROUND),
  {
    name: "setZoneOpenings",
    args: { levelId: L, zoneId: "shaft", exit: { edge: "right", from: 0, to: 3 } },
  },
];

// Builds the demo project through the same commands the editor and the AI use.
export function createDemoProject(): Project {
  let project = createProject({ id: "demo-project", name: "Demo" }, demoPack);
  for (const command of COMMANDS) {
    const result = applyCommand(project, command, { pack: demoPack });
    if (!result.ok) throw new Error(`Demo level: ${command.name} failed: ${result.error}`);
    project = result.project;
  }
  return project;
}
```

- [ ] **Step 5: Run the demo test**

Run: `npm test -- tests/runtime/demo.test.ts`
Expected: PASS. If the bot dies or does not reach the boss room, adjust the layout in `COMMANDS` (not the bot or the test) and rerun.

- [ ] **Step 6: Extend the boundary test to the simulation**

In `tests/boundaries.test.ts`, change the loop's file list from:

```ts
    for (const file of [...sourceFiles("src/model"), ...sourceFiles("src/commands")]) {
```

to:

```ts
    for (const file of [
      ...sourceFiles("src/model"),
      ...sourceFiles("src/commands"),
      ...sourceFiles("src/runtime/sim"),
    ]) {
```

and change that test's name to `"keeps React, Next.js, the DOM and randomness out of model, commands and the simulation"`.

Run: `npm test -- tests/boundaries.test.ts`
Expected: PASS.

- [ ] **Step 7: Add the play component and page**

`src/runtime/render/PlayCanvas.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { Project } from "@/model/schema";
import { createSim, SCREEN_H, SCREEN_W, step } from "@/runtime/sim";
import { draw } from "./draw";
import { createKeyboard } from "./keyboard";
import { stepsFor } from "./loop";

type Props = {
  project: Project;
  levelId: string;
  pack: ContentPack;
  startZoneId?: string;
  scale?: number;
};

// Runs a level on a canvas until unmounted.
export function PlayCanvas({ project, levelId, pack, startZoneId, scale = 3 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const sim = createSim(project, levelId, pack, { startZoneId });
    const keyboard = createKeyboard(window);
    let accumulator = 0;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const due = stepsFor(accumulator, now - last);
      last = now;
      accumulator = due.accumulator;
      for (let i = 0; i < due.steps; i++) step(sim, keyboard.read());
      draw(ctx, sim);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      keyboard.dispose();
    };
  }, [project, levelId, pack, startZoneId]);

  return (
    <canvas
      ref={canvasRef}
      width={SCREEN_W}
      height={SCREEN_H}
      style={{ width: SCREEN_W * scale, height: SCREEN_H * scale, imageRendering: "pixelated" }}
    />
  );
}
```

`src/app/play/page.tsx`:

```tsx
"use client";

import { createDemoProject, DEMO_LEVEL_ID, demoPack } from "@/content/demo";
import { PlayCanvas } from "@/runtime/render/PlayCanvas";

const project = createDemoProject();

export default function PlayPage() {
  return (
    <main style={{ display: "grid", justifyItems: "center", gap: 12, padding: 24 }}>
      <h1>Demo Stage</h1>
      <PlayCanvas project={project} levelId={DEMO_LEVEL_ID} pack={demoPack} />
      <p>Arrow keys to move and climb. Z to jump. X to shoot.</p>
    </main>
  );
}
```

Replace `src/app/page.tsx` with:

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>MegaRomBuilder</h1>
      <p>The editor arrives in a later plan.</p>
      <p>
        <Link href="/play">Play the demo stage</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 8: Run every check**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: every test file PASSES; typecheck and lint report nothing; the build completes and lists the `/` and `/play` routes.

- [ ] **Step 9: Check the page serves**

Run:

```bash
(npm run start -- --port 3210 > /dev/null 2>&1 &) ; sleep 3 ; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210/play ; curl -s http://localhost:3210/play | grep -o "<canvas[^>]*>" ; pkill -f "next start"
```

Expected: `200`, then a `<canvas` tag with `width="256"` and `height="240"`.

This confirms the page renders. It does not confirm the game looks or feels right; that needs a person to open `/play` and try it.

- [ ] **Step 10: Commit**

```bash
git add src/content src/runtime/render/PlayCanvas.tsx src/app tests/runtime tests/boundaries.test.ts
git commit -m "feat: add demo level and play page"
```

---

## Done when

- `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all succeed.
- The bot finishes the demo level from the start to the boss room without dying.
- `/play` serves a 256 by 240 canvas.
- `src/runtime/sim/` contains no React, Next.js, DOM or random-value code.
- A person has opened `/play` and confirmed the level is playable with the keyboard. This is the one check the automated tests cannot make.

Plan 3 (runtime things) builds on `Sim`, `step`, `Player`, `Shot`, `kill`, `moveX`, `moveY`, `TileMap` and `draw` from this plan.
