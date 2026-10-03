# Level Pieces and Checker Implementation Plan (Milestone 1, Plan 5 of 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the checker that proves a zone can be crossed (and explains why when it cannot), rates each zone's difficulty, catches level-wide mistakes, and give the snow pack its twelve ready-made level pieces, each proven passable by the checker.

**Architecture:** The checker plays the game. It loads a zone into a real simulation (enemies removed, moving platforms' paths turned into one-way tiles), then searches outward from the entry: from each place the player can stand it tries a fixed set of short scripted moves (walk, run and jump at an edge, standing jumps with and without drift, climbing) and records where each one lands. Reaching the exit means the zone is passable, and the inputs along the way are a replayable route. Because it uses `step` itself, the checker can never disagree with the game about what a jump can reach.

**Tech Stack:** TypeScript (strict), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-playable-core-ai-level-builder-design.md` (section 3 "Snow pack contents: Pieces" and section 6 "Checker")

**Plan series for milestone 1:**

1. Project model and commands (done)
2. Runtime core (done)
3. Runtime things (done)
4. Snow pack and pixel art (done)
5. Level pieces and the checker (this plan)
6. Editor UI and IndexedDB storage
7. AI assistant

## Global Constraints

- `src/checker/` is plain TypeScript: no React, no Next.js, no DOM, no randomness. Same project in, same answer out.
- The checker uses the runtime's own `step` and the project's `PlayerSettings`; it has no physics of its own.
- The checker ignores enemies. It treats a moving platform as standable anywhere along its path. It proves a route exists, not that the zone is fun or fair.
- A piece fills whole columns, top to bottom (15 rows). Pieces for horizontal zones are entered on the left and left on the right.
- Thing types placed by pieces must exist in the snow pack.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **The checker searches with the real game instead of computing jump arcs.** The spec described standable cells linked by jump arcs computed from the player settings. Running the actual simulation gives the same answer with no second copy of the physics, and it yields a route that can be replayed to prove the answer.
- **The result shape differs from the spec's `CheckResult`.** `checkZone` returns `{ zoneId, name, passable, difficulty, reason, furthest, warnings }`, and `checkLevel` adds level-wide `problems`. This carries the same information plus the warnings the plan 3 review asked for.
- **Pieces say what height they start and end at.** `PieceResult` gains optional `enterRow` and `exitRow`: the row the player stands on at the left and right edges (13, the normal floor, when not given). Staircases and ladder climbs change the floor height, so the AI needs to know.
- **New level-wide checks** from earlier reviews: the boss room must hold exactly one boss with floor under it, no other zone may hold a boss, and enemies placed right where the player arrives or respawns get a warning.

## Review Focus

1. **A zone the player cannot even start in** (a bottom entry with nothing to stand on or climb): reported as impassable with a clear reason, never a crash or a hang. Tested in Task 2.
2. **A long or complex zone** (eight screens with lots of ledges): the check must finish in reasonable time. Tested in Task 8.
3. **Agreement with the game**: a route the checker approves must actually work when replayed in the simulation. Tested in Tasks 1 and 2.
4. **A failure reason that points at the wrong place**: the reason names the column the player gets stuck at and what is in the way. Tested in Task 3.
5. **Every piece at every setting extreme**: each must be passable on its own. Tested in Tasks 6 and 7.

## File Structure

```
src/checker/probe.ts        checkerZone, createProbe, reset: a sim of one zone for searching
src/checker/moves.ts        the scripted moves the search tries
src/checker/passage.ts      findPassage: breadth-first search from the entry to the exit
src/checker/reasons.ts      jumpReach, stuckReason: why a zone cannot be crossed
src/checker/difficulty.ts   difficulty: a rough 1-10 score
src/checker/check.ts        checkZone, checkLevel: the public checker
src/checker/index.ts        re-exports
src/model/contentPack.ts    PieceResult gains enterRow, exitRow
src/content/snow/tiles.ts   tile id constants (moved out of pack.ts so pieces can use them)
src/content/snow/pieces.ts  the twelve snow pieces
src/content/snow/pack.ts    pieces: snowPieces
tests/checker/*.test.ts, tests/checker/pieceHarness.ts
```

---

### Task 1: The probe, the moves and the search

**Files:**
- Create: `src/checker/probe.ts`, `src/checker/moves.ts`, `src/checker/passage.ts`
- Test: `tests/checker/passage.test.ts`

**Interfaces:**
- Consumes (earlier plans): `createSim`, `step`, `NO_INPUT`, `Input`, `Player`, `Sim` (`@/runtime/sim/state`, `@/runtime/sim/step`); `TileMap`, `firstTile`, `isSolid`, `isPlatform`, `ladderAtPx`, `touchingLadder` (`@/runtime/sim/tilemap`); `num` (`@/runtime/sim/entities/types`); `createZone`, `zoneSize`, `tileIndex`, `TILE_SIZE`, `Zone`, `Level`, `Project`, `PlayerSettings`, `ContentPack`; test helpers `flatArt`, `rowWith`, `thing`, `projectFromArt`, `testPack`
- Produces:
  - `checkerZone(zone: Zone, pack: ContentPack): Zone`
  - `type Probe = { sim: Sim; map: TileMap; zone: Zone }`, `createProbe(zone: Zone, pack: ContentPack, settings: PlayerSettings): Probe`, `reset(probe: Probe, player: Player): void`, `leftZone(sim: Sim): boolean`
  - `type Script = (sim: Sim, t: number) => Input | null`, `type Move = { name: string; jump: boolean; when?: (sim: Sim) => boolean; start: () => Script }`, `MOVES: Move[]`
  - `type Passage = { passable: boolean; start: Player | null; route: Input[]; moves: string[]; jumps: number; furthest: Player | null; explored: number }`
  - `findPassage(zone: Zone, pack: ContentPack, settings: PlayerSettings): Passage`

How the search works. A *node* is a saved player state where the player has come to rest (standing still, or hanging on a ladder). From each node, every move in `MOVES` is tried: the probe is reset to the node's state, the move's script supplies keys step by step until it returns `null`, then no keys are pressed until the player comes to rest again. The result is one of: the player left the zone through its exit (success), died, never came to rest (dropped), or rested somewhere new (a new node, unless a node with the same rounded position has been explored already). Nodes are explored in order of how many jumps it took to reach them, walking first, so the route found uses as few jumps as possible and `jumps` measures how many the zone really needs. At most `MAX_NODES` nodes are explored.

Start nodes come from the zone's entry: the normal start position for a side entry, and one position centred on each column of a top or bottom opening. A zone with no exit (the boss room) is passable if the player can come to rest at the start.

`route` is every input from the start state to the exit, so `reset(probe, start)` followed by stepping through `route` reaches the exit.

- [ ] **Step 1: Write the failing test**

`tests/checker/passage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findPassage, type Passage } from "@/checker/passage";
import { createProbe, leftZone, reset } from "@/checker/probe";
import type { Zone } from "@/model/schema";
import { step } from "@/runtime/sim/step";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, type ZoneArt } from "../runtime/helpers";

const zoneOf = (art: ZoneArt): Zone => projectFromArt([art]).levels[0].zones[0];
const settings = projectFromArt([{ art: flatArt() }]).player;
const passage = (art: ZoneArt): Passage => findPassage(zoneOf(art), testPack, settings);

// Replays a passage's route in a fresh probe and reports whether it leaves by the exit.
function replays(art: ZoneArt, found: Passage): boolean {
  const probe = createProbe(zoneOf(art), testPack, settings);
  if (!found.start) return false;
  reset(probe, found.start);
  for (const input of found.route) {
    step(probe.sim, input);
    if (leftZone(probe.sim)) return true;
  }
  return false;
}

// A floor with the given columns removed (a pit).
const pit = (from: number, width: number, screens = 1) => {
  const row = [...("#".repeat(16 * screens))].map((c, x) => (x >= from && x < from + width ? "." : c)).join("");
  return flatArt({ 13: row, 14: row }, screens);
};

// A wall of the given height (in tiles) standing on the floor from column `from` to the end.
const wall = (from: number, height: number) => {
  const overrides: Record<number, string> = {};
  for (let y = 13 - height; y < 13; y++) overrides[y] = ".".repeat(from) + "#".repeat(16 - from);
  return overrides;
};

describe("findPassage on flat ground", () => {
  it("crosses an empty zone without jumping, with a route that replays", () => {
    const art = { art: flatArt() };
    const found = passage(art);
    expect(found.passable).toBe(true);
    expect(found.jumps).toBe(0);
    expect(found.route.length).toBeGreaterThan(0);
    expect(replays(art, found)).toBe(true);
  });

  it("crosses a long zone", () => {
    expect(passage({ art: flatArt({}, 3) }).passable).toBe(true);
  });

  it("crosses ice", () => {
    expect(passage({ art: flatArt({ 13: "~".repeat(16) }) }).passable).toBe(true);
  });
});

describe("findPassage over gaps", () => {
  it("jumps a three-tile gap, and the route replays", () => {
    const art = { art: pit(6, 3) };
    const found = passage(art);
    expect(found.passable).toBe(true);
    expect(found.jumps).toBe(1);
    expect(replays(art, found)).toBe(true);
  });

  it("cannot cross a four-tile gap", () => {
    const found = passage({ art: pit(6, 4) });
    expect(found.passable).toBe(false);
    expect(found.furthest?.x).toBeLessThan(6 * 16);
  });

  it("jumps a single spike tile but not a five-wide spike floor", () => {
    expect(passage({ art: flatArt({ 13: "######^#########" }) }).passable).toBe(true);
    expect(passage({ art: flatArt({ 13: "####^^^^^#######" }) }).passable).toBe(false);
  });
});

describe("findPassage over walls", () => {
  const exitAbove = { edge: "right" as const, from: 6, to: 9 };

  it("climbs a two-tile wall", () => {
    const art = { art: flatArt(wall(8, 2)), exit: { edge: "right" as const, from: 7, to: 10 } };
    const found = passage(art);
    expect(found.passable).toBe(true);
    expect(replays(art, found)).toBe(true);
  });

  it("cannot climb a three-tile wall", () => {
    expect(passage({ art: flatArt(wall(8, 3)), exit: exitAbove }).passable).toBe(false);
  });

  it("explores what it can reach and no more", () => {
    const found = passage({ art: flatArt(wall(8, 3)), exit: exitAbove });
    expect(found.explored).toBeGreaterThan(1);
    expect(found.explored).toBeLessThan(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/checker/passage.test.ts`
Expected: FAIL, cannot resolve `@/checker/passage`.

- [ ] **Step 3: Implement the probe**

`src/checker/probe.ts`:

```ts
import type { ContentPack } from "@/model/contentPack";
import { createZone } from "@/model/factory";
import { tileIndex, zoneSize } from "@/model/geometry";
import type { Level, PlayerSettings, Project, Zone } from "@/model/schema";
import { num } from "@/runtime/sim/entities/types";
import { createSim, NO_INPUT, type Player, type Sim } from "@/runtime/sim/state";
import type { TileMap } from "@/runtime/sim/tilemap";

const NEXT_ZONE_ID = "__checker_next";

// The zone as the checker sees it: no things, and every moving platform's whole path turned into
// one-way tiles, because a platform can be stood on anywhere along its path (optimistic about timing).
export function checkerZone(zone: Zone, pack: ContentPack): Zone {
  const size = zoneSize(zone.scroll, zone.screens);
  const tiles = zone.tiles.slice();
  const oneWay = pack.tiles.find((t) => t.behaviour === "oneWay")?.id;
  if (oneWay !== undefined) {
    for (const thing of zone.things) {
      const def = pack.things.find((d) => d.type === thing.type);
      if (def?.behaviour !== "platform") continue;
      const settings = { ...def.defaults, ...thing.settings };
      const distance = Math.max(0, Math.round(num(settings, "distance", 4)));
      const vertical = settings.axis === "y";
      const right = thing.x + 1 + (vertical ? 0 : distance);
      const bottom = thing.y + (vertical ? distance : 0);
      for (let y = thing.y; y <= bottom; y++) {
        for (let x = thing.x; x <= right; x++) {
          if (x < 0 || y < 0 || x >= size.width || y >= size.height) continue;
          const i = tileIndex(size, x, y);
          if (tiles[i] === 0) tiles[i] = oneWay;
        }
      }
    }
  }
  return { ...zone, tiles, things: [] };
}

// A simulation of one zone, with an empty zone after it so that leaving by the exit can be seen.
export type Probe = { sim: Sim; map: TileMap; zone: Zone };

export function createProbe(zone: Zone, pack: ContentPack, settings: PlayerSettings): Probe {
  const checked = checkerZone(zone, pack);
  const zones = checked.exit ? [checked, createZone({ id: NEXT_ZONE_ID, name: NEXT_ZONE_ID }, pack)] : [checked];
  const level: Level = { id: "check", name: "check", brief: "", zones, checkpoints: [] };
  const project: Project = {
    formatVersion: 1,
    id: "check",
    name: "check",
    contentPackId: pack.id,
    player: settings,
    levels: [level],
    chat: [],
  };
  const sim = createSim(project, "check", pack);
  return { sim, map: sim.map, zone: checked };
}

// Puts the probe back in its zone with the player in a saved state.
export function reset(probe: Probe, player: Player): void {
  const sim = probe.sim;
  sim.phase = "play";
  sim.timer = 0;
  sim.transition = null;
  sim.zoneIndex = 0;
  sim.map = probe.map;
  sim.shots = [];
  sim.enemyShots = [];
  sim.slots = [];
  sim.prev = NO_INPUT;
  Object.assign(sim.player, player);
}

export const leftZone = (sim: Sim): boolean => sim.zoneIndex !== 0;
```

- [ ] **Step 4: Implement the moves**

`src/checker/moves.ts`:

```ts
import { TILE_SIZE } from "@/model/geometry";
import { NO_INPUT, type Input, type Sim } from "@/runtime/sim/state";
import { firstTile, isPlatform, isSolid, ladderAtPx } from "@/runtime/sim/tilemap";

// A scripted bit of play: the keys to hold on step t, or null when the script is done.
export type Script = (sim: Sim, t: number) => Input | null;
export type Move = {
  name: string;
  jump: boolean;
  when?: (sim: Sim) => boolean; // skip the move unless this holds at the start
  start: () => Script;
};

type Dir = -1 | 0 | 1;
const keys = (k: Partial<Input>): Input => ({ ...NO_INPUT, ...k });
const toward = (d: Dir): Partial<Input> => (d < 0 ? { left: true } : d > 0 ? { right: true } : {});
const side = (d: Dir) => (d < 0 ? "left" : d > 0 ? "right" : "up");
const stepsPerTile = (sim: Sim) => Math.ceil(TILE_SIZE / sim.settings.runSpeed);

function groundAhead(sim: Sim, d: Dir): boolean {
  const p = sim.player;
  const tx = firstTile(d > 0 ? p.x + p.w + 1 : p.x - 1);
  const ty = firstTile(p.y + p.h + 1);
  return isSolid(sim.map.behaviourAt(tx, ty)) || isPlatform(sim.map, tx, ty);
}

// Walks one tile.
const walk = (d: Dir): Move => ({
  name: `walk ${side(d)}`,
  jump: false,
  start: () => (sim, t) => (t < stepsPerTile(sim) ? keys(toward(d)) : null),
});

// Runs toward an edge and jumps at the last moment, holding jump for full height.
const runJump = (d: Dir): Move => ({
  name: `running jump ${side(d)}`,
  jump: true,
  start: () => {
    let jumpedAt = -1;
    return (sim, t) => {
      const p = sim.player;
      if (jumpedAt < 0) {
        if (t > 4 * stepsPerTile(sim)) return null;
        if (p.onGround && !groundAhead(sim, d)) {
          jumpedAt = t;
          return keys({ ...toward(d), jump: true });
        }
        return keys(toward(d));
      }
      if (t > jumpedAt + 2 && p.onGround) return null;
      return keys({ ...toward(d), jump: true });
    };
  },
});

// Jumps from where the player stands, holding jump for `hold` steps and the direction from step `drift`.
const standJump = (d: Dir, hold: number, drift: number): Move => ({
  name: `jump ${side(d)}${hold < 99 ? " (short)" : ""}${drift > 0 ? ` (drift after ${drift})` : ""}`,
  jump: true,
  start: () => (sim, t) => {
    if ((t > 2 && sim.player.onGround) || t > 200) return null;
    return keys({ ...(t >= drift ? toward(d) : {}), jump: t < hold });
  },
});

// Climbs until the player is off the ladder (at the top, the bottom, or through the exit).
const climb = (dir: "up" | "down"): Move => ({
  name: `climb ${dir}`,
  jump: false,
  when: (sim) => {
    const p = sim.player;
    const cx = p.x + p.w / 2;
    if (dir === "up") return ladderAtPx(sim.map, cx, p.y + p.h / 2) || ladderAtPx(sim.map, cx, p.y + p.h - 1);
    return p.onLadder || ladderAtPx(sim.map, cx, p.y + p.h);
  },
  start: () => (sim, t) => {
    if ((t > 2 && !sim.player.onLadder) || t > 1200) return null;
    return keys({ [dir]: true });
  },
});

export const MOVES: Move[] = [
  walk(1),
  walk(-1),
  runJump(1),
  runJump(-1),
  standJump(0, 99, 0),
  standJump(1, 99, 0),
  standJump(-1, 99, 0),
  standJump(1, 6, 0),
  standJump(-1, 6, 0),
  standJump(1, 99, 12),
  standJump(-1, 99, 12),
  standJump(1, 99, 24),
  standJump(-1, 99, 24),
  climb("up"),
  climb("down"),
];
```

- [ ] **Step 5: Implement the search**

`src/checker/passage.ts`:

```ts
import type { ContentPack } from "@/model/contentPack";
import { TILE_SIZE } from "@/model/geometry";
import type { PlayerSettings, Zone } from "@/model/schema";
import { NO_INPUT, type Input, type Player } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { touchingLadder } from "@/runtime/sim/tilemap";
import { MOVES, type Script } from "./moves";
import { createProbe, leftZone, reset, type Probe } from "./probe";

const SCRIPT_STEPS = 1300; // the longest a move's script may run (long ladders)
const SETTLE_STEPS = 120; // after the script, how long to wait for the player to come to rest
const MAX_NODES = 4000;

export type Passage = {
  passable: boolean;
  start: Player | null; // the state the route starts from
  route: Input[]; // every input from the start to the exit, when passable
  moves: string[]; // the names of the moves along the route
  jumps: number; // how many of those moves were jumps
  furthest: Player | null; // the resting state nearest the exit
  explored: number; // how many resting places were searched
};

type Node = { player: Player; parent: Node | null; inputs: Input[]; move: string | null; jump: boolean; origin: Player };

type Outcome =
  | { kind: "exit" | "dead" | "dropped"; inputs: Input[] }
  | { kind: "rest"; inputs: Input[]; player: Player };

const atRest = (p: Player) => p.onLadder || (p.onGround && Math.abs(p.vx) < 0.01);
const keyOf = (p: Player) => `${Math.round(p.x / 8)},${Math.round(p.y / 4)},${p.onLadder ? 1 : 0}`;

// Plays a script from a saved state, then waits for the player to come to rest.
function play(probe: Probe, from: Player, script: Script | null): Outcome {
  reset(probe, from);
  const sim = probe.sim;
  const inputs: Input[] = [];
  let scripted = script !== null;
  let waited = 0;
  for (let t = 0; t < SCRIPT_STEPS + SETTLE_STEPS; t++) {
    let input = NO_INPUT;
    if (scripted && script) {
      const next = script(sim, t);
      if (next) input = next;
      else scripted = false;
    }
    step(sim, input);
    inputs.push(input);
    if (leftZone(sim)) return { kind: "exit", inputs };
    if (sim.phase === "dead") return { kind: "dead", inputs };
    if (!scripted) {
      if (atRest(sim.player)) return { kind: "rest", inputs, player: { ...sim.player } };
      if (++waited > SETTLE_STEPS) break;
    }
  }
  return { kind: "dropped", inputs };
}

// Where the player can start: the normal start, or each column of a top or bottom opening.
function startStates(probe: Probe, fresh: Player): Player[] {
  const entry = probe.zone.entry;
  if (entry.edge === "left" || entry.edge === "right") return [fresh];
  const starts: Player[] = [];
  for (let col = entry.from; col <= entry.to; col++) {
    const p = { ...fresh, x: col * TILE_SIZE + (TILE_SIZE - fresh.w) / 2 };
    p.onLadder = touchingLadder(probe.map, p);
    starts.push(p);
  }
  return starts;
}

function route(node: Node, last: Input[]): { route: Input[]; moves: string[]; jumps: number } {
  const chain: Node[] = [];
  for (let n: Node | null = node; n; n = n.parent) chain.unshift(n);
  return {
    route: [...chain.flatMap((n) => n.inputs), ...last],
    moves: chain.flatMap((n) => (n.move ? [n.move] : [])),
    jumps: chain.filter((n) => n.jump).length,
  };
}

export function findPassage(zone: Zone, pack: ContentPack, settings: PlayerSettings): Passage {
  const probe = createProbe(zone, pack, settings);
  const fresh = { ...probe.sim.player };
  const exit = probe.zone.exit;
  const progress = (p: Player) =>
    !exit ? 0 : exit.edge === "right" ? p.x : exit.edge === "top" ? -p.y : p.y;

  // Searched in order of how many jumps it took to get somewhere, so the route found uses as few
  // jumps as it can. byJumps[k] holds the places reached with k jumps.
  const byJumps: Node[][] = [[]];
  const seen = new Set<string>();
  let furthest: Node | null = null;
  let explored = 0;
  const passed = (node: Node | null, origin: Player, last: Input[], move?: { name: string; jump: boolean }): Passage => {
    const found = node ? route(node, last) : { route: last, moves: [], jumps: 0 };
    if (move) {
      found.moves.push(move.name);
      if (move.jump) found.jumps++;
    }
    return { passable: true, start: origin, ...found, furthest: node?.player ?? null, explored };
  };

  for (const start of startStates(probe, fresh)) {
    const out = play(probe, start, null);
    if (out.kind === "exit") return passed(null, start, out.inputs);
    if (out.kind !== "rest") continue;
    const node: Node = { player: out.player, parent: null, inputs: out.inputs, move: null, jump: false, origin: start };
    if (!exit) return passed(node, start, []);
    byJumps[0].push(node);
  }

  for (let jumps = 0; jumps < byJumps.length && explored < MAX_NODES; jumps++) {
    const queue = byJumps[jumps];
    for (let head = 0; head < queue.length && explored < MAX_NODES; head++) {
      const node = queue[head];
      const key = keyOf(node.player);
      if (seen.has(key)) continue;
      seen.add(key);
      explored++;
      if (!furthest || progress(node.player) > progress(furthest.player)) furthest = node;
      for (const move of MOVES) {
        reset(probe, node.player);
        if (move.when && !move.when(probe.sim)) continue;
        const out = play(probe, node.player, move.start());
        if (out.kind === "exit") return passed(node, node.origin, out.inputs, move);
        if (out.kind !== "rest" || seen.has(keyOf(out.player))) continue;
        const child: Node = {
          player: out.player,
          parent: node,
          inputs: out.inputs,
          move: move.name,
          jump: move.jump,
          origin: node.origin,
        };
        if (move.jump) (byJumps[jumps + 1] ??= []).push(child);
        else queue.push(child);
      }
    }
  }

  return {
    passable: false,
    start: furthest?.origin ?? null,
    route: [],
    moves: [],
    jumps: 0,
    furthest: furthest?.player ?? null,
    explored,
  };
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

If "jumps a three-tile gap" fails, print `found.furthest` and the moves tried from the last node before the gap. The likely cause is the running jump giving up before reaching the edge or jumping one step late; fix the move script, not the test. A three-tile gap (48 pixels) is inside the 52-pixel jump the default settings give.

- [ ] **Step 7: Commit**

```bash
git add src/checker tests/checker
git commit -m "feat: add the checker's probe, moves and passage search"
```

---

### Task 2: Ladders, ledges, platforms and every kind of exit

**Files:**
- Test: `tests/checker/routes.test.ts`

**Interfaces:**
- Consumes: `findPassage`, `createProbe`, `reset`, `leftZone` (Task 1); test helpers
- Produces: no new code if Task 1's search is right. This task proves the search handles every way a zone can be built, and fixes the search where it does not.

- [ ] **Step 1: Write the test**

`tests/checker/routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findPassage, type Passage } from "@/checker/passage";
import { createProbe, leftZone, reset } from "@/checker/probe";
import type { Zone } from "@/model/schema";
import { step } from "@/runtime/sim/step";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith, thing, type ZoneArt } from "../runtime/helpers";

const zoneOf = (art: ZoneArt): Zone => projectFromArt([art]).levels[0].zones[0];
const settings = projectFromArt([{ art: flatArt() }]).player;
const passage = (art: ZoneArt): Passage => findPassage(zoneOf(art), testPack, settings);

function replays(art: ZoneArt, found: Passage): boolean {
  const probe = createProbe(zoneOf(art), testPack, settings);
  if (!found.start) return false;
  reset(probe, found.start);
  for (const input of found.route) {
    step(probe.sim, input);
    if (leftZone(probe.sim)) return true;
  }
  return false;
}

// A ladder in `col` from row `top` down to the floor.
function ladder(col: number, top: number) {
  const overrides: Record<number, string> = {};
  for (let y = top; y <= 12; y++) overrides[y] = rowWith({ [col]: "H" });
  return overrides;
}

describe("ladders", () => {
  it("climbs a ladder to a top exit, and the route replays", () => {
    const art = { art: flatArt(ladder(4, 0)), exit: { edge: "top" as const, from: 4, to: 5 } };
    const found = passage(art);
    expect(found.passable).toBe(true);
    expect(found.moves).toContain("climb up");
    expect(replays(art, found)).toBe(true);
  });

  it("cannot leave by the top without a ladder", () => {
    expect(passage({ art: flatArt(), exit: { edge: "top", from: 4, to: 5 } }).passable).toBe(false);
  });

  it("climbs a vertical shaft from a bottom entry to a right exit near the top", () => {
    const art = Array.from({ length: 30 }, (_, y) =>
      y === 4 ? "........########" : y > 4 ? rowWith({ 7: "H" }) : rowWith({}),
    );
    const found = passage({
      art,
      entry: { edge: "bottom", from: 7, to: 8 },
      exit: { edge: "right", from: 0, to: 3 },
    });
    expect(found.passable).toBe(true);
  });

  it("reports a bottom entry with nothing to stand on as impassable without a crash", () => {
    const art = Array.from({ length: 30 }, () => rowWith({}));
    const found = passage({ art, entry: { edge: "bottom", from: 7, to: 8 }, exit: { edge: "top", from: 7, to: 8 } });
    expect(found.passable).toBe(false);
    expect(found.furthest).toBeNull();
  });
});

describe("ledges and platforms", () => {
  // A wall four tiles high from column 8, too tall to jump straight up.
  const tall: Record<number, string> = {};
  for (let y = 9; y <= 12; y++) tall[y] = "........########";
  const exitAbove = { edge: "right" as const, from: 5, to: 8 };

  it("cannot climb a four-tile wall unaided", () => {
    expect(passage({ art: flatArt(tall), exit: exitAbove }).passable).toBe(false);
  });

  it("climbs it using a one-way ledge as a step", () => {
    const art = flatArt({ ...tall, 11: ".....==.########" });
    const found = passage({ art, exit: exitAbove });
    expect(found.passable).toBe(true);
    expect(replays({ art, exit: exitAbove }, found)).toBe(true);
  });

  it("treats a moving platform's path as somewhere to stand", () => {
    const row = "###......#######";
    const art = flatArt({ 13: row, 14: row });
    expect(passage({ art }).passable).toBe(false);
    const withPlatform = { art, things: [thing("platform", 3, 11, { axis: "x", distance: 4 })] };
    expect(passage(withPlatform).passable).toBe(true);
  });

  it("ignores enemies", () => {
    const things = [thing("walker", 5, 12), thing("turret", 8, 12), thing("boss", 11, 12)];
    expect(passage({ art: flatArt(), things }).passable).toBe(true);
  });
});

describe("other exits", () => {
  it("drops through a hole to a bottom exit", () => {
    const row = "#####..#########";
    const found = passage({
      art: flatArt({ 13: row, 14: row }),
      exit: { edge: "bottom", from: 5, to: 6 },
    });
    expect(found.passable).toBe(true);
  });

  it("counts a zone with no exit as passable when the player can stand at the start", () => {
    const found = passage({ art: flatArt(), exit: null });
    expect(found.passable).toBe(true);
  });

  it("reports a blocked right exit as impassable", () => {
    expect(passage({ art: flatArt(), exit: { edge: "right", from: 0, to: 3 } }).passable).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- tests/checker/routes.test.ts`
Expected: PASS. If a test fails, the search is missing a way to move. Find which move would be needed (print `found.furthest` and the outcomes of `MOVES` from that node) and fix `moves.ts` or `passage.ts`. Do not change the zones in the test: each is a fair, intended level shape.

- [ ] **Step 3: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 4: Commit**

```bash
git add src/checker tests/checker
git commit -m "test: prove the checker handles ladders, ledges, platforms and every exit"
```

---

### Task 3: Why a zone cannot be crossed

**Files:**
- Create: `src/checker/reasons.ts`
- Test: `tests/checker/reasons.test.ts`

**Interfaces:**
- Consumes: `Probe`, `createProbe` (Task 1); `findPassage` (Task 1); `firstTile`, `isSolid`, `isPlatform` (plan 2); `TILE_SIZE`
- Produces:
  - `jumpReach(settings: PlayerSettings): { height: number; distance: number }` (pixels: the highest and furthest a running jump from flat ground reaches)
  - `surfaceRow(p: Player): number` (the row the player stands on)
  - `standingColumn(map: TileMap, p: Player, exitEdge: string | undefined): number` (for a right exit, the rightmost column under the player's feet that holds them up, since a stuck player may overhang an edge; otherwise the column under their centre)
  - `stuckReason(probe: Probe, furthest: Player, settings: PlayerSettings): string`

Reason rules. The furthest resting point gives a column (`standingColumn`) and a surface row (the row the player stands on). For a right exit, scan the columns ahead: the first column with solid tiles at body height is a wall (its height counted upward); the first column with nothing to stand on at or just below the surface row is a gap (its width counted, and called a spike pit if spikes are what is there). For top and bottom exits, say how far the player got.

| Situation | Reason |
|---|---|
| gap | `Cannot get past column 5: a gap 4 tiles wide at column 6, and the longest jump is about 3 tiles.` |
| spikes | `Cannot get past column 3: a spike pit 5 tiles wide at column 4, and the longest jump is about 3 tiles.` |
| wall | `Cannot get past column 7: a wall 3 tiles high at column 8, and the highest jump is about 2 tiles.` |
| top or bottom exit | `Cannot reach the exit at the top. The player gets as far as column 4, row 12.` |
| anything else | `Cannot get past column 5.` |

- [ ] **Step 1: Write the failing test**

`tests/checker/reasons.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findPassage } from "@/checker/passage";
import { createProbe } from "@/checker/probe";
import { jumpReach, stuckReason } from "@/checker/reasons";
import type { Zone } from "@/model/schema";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, type ZoneArt } from "../runtime/helpers";

const zoneOf = (art: ZoneArt): Zone => projectFromArt([art]).levels[0].zones[0];
const settings = projectFromArt([{ art: flatArt() }]).player;

function reasonFor(art: ZoneArt): string {
  const zone = zoneOf(art);
  const found = findPassage(zone, testPack, settings);
  if (found.passable || !found.furthest) throw new Error("expected a zone the player gets stuck in");
  return stuckReason(createProbe(zone, testPack, settings), found.furthest, settings);
}

describe("jumpReach", () => {
  it("matches the default player's jump", () => {
    expect(jumpReach(settings)).toEqual({ height: 45.125, distance: 52.25 });
  });

  it("follows the settings", () => {
    expect(jumpReach({ ...settings, jumpVelocity: 6.875 }).height).toBeGreaterThan(80);
  });
});

describe("stuckReason", () => {
  it("names a gap, where it is, and how far the player can jump", () => {
    const row = "######....######";
    expect(reasonFor({ art: flatArt({ 13: row, 14: row }) })).toBe(
      "Cannot get past column 5: a gap 4 tiles wide at column 6, and the longest jump is about 3 tiles.",
    );
  });

  it("calls a pit full of spikes a spike pit", () => {
    expect(reasonFor({ art: flatArt({ 13: "####^^^^^#######" }) })).toBe(
      "Cannot get past column 3: a spike pit 5 tiles wide at column 4, and the longest jump is about 3 tiles.",
    );
  });

  it("names a wall and how high the player can jump", () => {
    const wall: Record<number, string> = {};
    for (let y = 10; y <= 12; y++) wall[y] = "........########";
    expect(reasonFor({ art: flatArt(wall), exit: { edge: "right", from: 6, to: 9 } })).toBe(
      "Cannot get past column 7: a wall 3 tiles high at column 8, and the highest jump is about 2 tiles.",
    );
  });

  it("says how far the player gets toward a top exit", () => {
    expect(reasonFor({ art: flatArt(), exit: { edge: "top", from: 4, to: 5 } })).toMatch(
      /^Cannot reach the exit at the top\. The player gets as far as column \d+, row 12\.$/,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/checker/reasons.test.ts`
Expected: FAIL, cannot resolve `@/checker/reasons`.

- [ ] **Step 3: Implement the reasons**

`src/checker/reasons.ts`:

```ts
import { TILE_SIZE } from "@/model/geometry";
import type { PlayerSettings } from "@/model/schema";
import type { Player } from "@/runtime/sim/state";
import { firstTile, isPlatform, isSolid, lastTile, type TileMap } from "@/runtime/sim/tilemap";
import type { Probe } from "./probe";

// The highest and furthest a full jump from flat ground reaches, in pixels.
export function jumpReach(settings: PlayerSettings): { height: number; distance: number } {
  let vy = -settings.jumpVelocity;
  let y = 0;
  let top = 0;
  let steps = 0;
  do {
    vy = Math.min(vy + settings.gravity, settings.maxFallSpeed);
    y += vy;
    top = Math.min(top, y);
    steps++;
  } while (y < 0 && steps < 1000);
  return { height: -top, distance: steps * settings.runSpeed };
}

// Whether column c has somewhere to stand at or just below the surface row, and whether spikes are in the way.
function footing(map: TileMap, c: number, surface: number): { stand: boolean; spikes: boolean } {
  for (let r = surface; r <= surface + 2; r++) {
    const cell = map.behaviourAt(c, r);
    if (cell === "spike") return { stand: false, spikes: true };
    if (isSolid(cell) || isPlatform(map, c, r) || cell === "ladder") return { stand: true, spikes: false };
  }
  return { stand: false, spikes: false };
}

// The row the player is standing on.
export const surfaceRow = (p: Player): number => Math.round((p.y + p.h) / TILE_SIZE);

// The column a stuck player is standing in: for a right exit, the rightmost column under their
// feet that holds them up (they may overhang an edge); otherwise the column under their centre.
export function standingColumn(map: TileMap, p: Player, exitEdge: string | undefined): number {
  if (exitEdge !== "right") return firstTile(p.x + p.w / 2);
  const surface = surfaceRow(p);
  for (let c = lastTile(p.x + p.w); c > firstTile(p.x); c--) {
    if (footing(map, c, surface).stand) return c;
  }
  return firstTile(p.x);
}

// Why the player cannot get from where they got stuck to the exit.
export function stuckReason(probe: Probe, furthest: Player, settings: PlayerSettings): string {
  const map = probe.map;
  const exit = probe.zone.exit;
  const col = standingColumn(map, furthest, exit?.edge);
  const surface = surfaceRow(furthest);
  if (!exit || exit.edge !== "right") {
    return `Cannot reach the exit at the ${exit?.edge ?? "end"}. The player gets as far as column ${col}, row ${surface - 1}.`;
  }
  const reach = jumpReach(settings);
  for (let c = col + 1; c < map.width; c++) {
    if (isSolid(map.behaviourAt(c, surface - 1)) || isSolid(map.behaviourAt(c, surface - 2))) {
      let top = surface - 1;
      while (top > 0 && isSolid(map.behaviourAt(c, top - 1))) top--;
      return `Cannot get past column ${col}: a wall ${surface - top} tiles high at column ${c}, and the highest jump is about ${Math.floor(reach.height / TILE_SIZE)} tiles.`;
    }
    if (!footing(map, c, surface).stand) {
      let width = 0;
      let spikes = false;
      while (c + width < map.width) {
        const here = footing(map, c + width, surface);
        if (here.stand) break;
        spikes ||= here.spikes;
        width++;
      }
      return `Cannot get past column ${col}: a ${spikes ? "spike pit" : "gap"} ${width} tiles wide at column ${c}, and the longest jump is about ${Math.floor(reach.distance / TILE_SIZE)} tiles.`;
    }
  }
  return `Cannot get past column ${col}.`;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

If a reason names a column one off from the test, check the furthest node first (`found.furthest`): the reason must name the column the player actually stands in at their furthest. Fix `stuckReason` or the search's choice of furthest node, not the expected text.

- [ ] **Step 5: Commit**

```bash
git add src/checker/reasons.ts tests/checker/reasons.test.ts
git commit -m "feat: explain why a zone cannot be crossed"
```

---

### Task 4: Difficulty

**Files:**
- Create: `src/checker/difficulty.ts`
- Test: `tests/checker/difficulty.test.ts`

**Interfaces:**
- Consumes: `ContentPack`, `ThingBehaviour`, `Zone`, `zoneSize`, `tileIndex`
- Produces: `difficulty(zone: Zone, pack: ContentPack, jumps: number): number` (a whole number from 1 to 10)

The score is `1 + 1.5 × enemy load + hazards + 0.5 × jumps per screen`, rounded and kept between 1 and 10:

- **Enemy load** is the sum of each thing's weight divided by the number of screens. Weights: walker 1, dropper 1, flyer 1.5, turret 1.5, jumper 1.5, shielded 2, health pickup −0.5, platform and boss 0.
- **Hazards** are spike tiles divided by 4, plus pit columns (horizontal zones only: columns whose bottom tile is empty), all divided by the number of screens.
- **Jumps** come from the checker's route.

- [ ] **Step 1: Write the failing test**

`tests/checker/difficulty.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { difficulty } from "@/checker/difficulty";
import type { Zone } from "@/model/schema";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, thing, type ZoneArt } from "../runtime/helpers";

const zoneOf = (art: ZoneArt): Zone => projectFromArt([art]).levels[0].zones[0];
const score = (art: ZoneArt, jumps = 0) => difficulty(zoneOf(art), testPack, jumps);

describe("difficulty", () => {
  it("rates an empty flat zone 1", () => {
    expect(score({ art: flatArt() })).toBe(1);
  });

  it("rises with enemies, weighted by type", () => {
    const walkers = score({ art: flatArt(), things: [thing("walker", 4, 12), thing("walker", 8, 12)] });
    const shielded = score({ art: flatArt(), things: [thing("shielded", 4, 12), thing("shielded", 8, 12)] });
    expect(walkers).toBe(4);
    expect(shielded).toBe(7);
  });

  it("spreads enemies over the zone's screens", () => {
    const things = [thing("walker", 4, 12), thing("walker", 8, 12)];
    expect(score({ art: flatArt({}, 2), things })).toBe(3);
  });

  it("rises with spikes and pits", () => {
    expect(score({ art: flatArt({ 13: "####^^^^########" }) })).toBe(2);
    const row = "####....########";
    expect(score({ art: flatArt({ 13: row, 14: row }) })).toBe(5);
  });

  it("rises with the jumps the route needs", () => {
    expect(score({ art: flatArt() }, 4)).toBe(3);
  });

  it("falls with health pickups but never below 1", () => {
    expect(score({ art: flatArt(), things: [thing("walker", 4, 12), thing("health", 6, 12)] })).toBe(2);
    expect(score({ art: flatArt(), things: [thing("health", 6, 12)] })).toBe(1);
  });

  it("never goes above 10", () => {
    const things = Array.from({ length: 12 }, (_, i) => thing("shielded", i + 2, 12));
    expect(score({ art: flatArt(), things }, 20)).toBe(10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/checker/difficulty.test.ts`
Expected: FAIL, cannot resolve `@/checker/difficulty`.

- [ ] **Step 3: Implement difficulty**

`src/checker/difficulty.ts`:

```ts
import type { ContentPack, ThingBehaviour } from "@/model/contentPack";
import { tileIndex, zoneSize } from "@/model/geometry";
import type { Zone } from "@/model/schema";

const WEIGHTS: Record<ThingBehaviour, number> = {
  walker: 1,
  dropper: 1,
  flyer: 1.5,
  turret: 1.5,
  jumper: 1.5,
  shielded: 2,
  health: -0.5,
  platform: 0,
  boss: 0,
};

// A rough 1-10 guide for the AI and the zone badge. Not a measurement.
export function difficulty(zone: Zone, pack: ContentPack, jumps: number): number {
  const screens = zone.screens;
  const size = zoneSize(zone.scroll, zone.screens);
  const behaviourOf = new Map(pack.tiles.map((t) => [t.id, t.behaviour]));

  let enemyLoad = 0;
  for (const thing of zone.things) {
    const def = pack.things.find((d) => d.type === thing.type);
    if (def) enemyLoad += WEIGHTS[def.behaviour];
  }
  enemyLoad /= screens;

  const spikes = zone.tiles.filter((t) => behaviourOf.get(t) === "spike").length;
  let pits = 0;
  if (zone.scroll === "horizontal") {
    for (let x = 0; x < size.width; x++) {
      if (zone.tiles[tileIndex(size, x, size.height - 1)] === 0) pits++;
    }
  }
  const hazards = (spikes / 4 + pits) / screens;

  const score = 1 + 1.5 * enemyLoad + hazards + 0.5 * (jumps / screens);
  return Math.min(10, Math.max(1, Math.round(score)));
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/checker/difficulty.ts tests/checker/difficulty.test.ts
git commit -m "feat: rate zone difficulty"
```

---

### Task 5: Checking zones and levels

**Files:**
- Create: `src/checker/check.ts`, `src/checker/index.ts`
- Modify: `tests/boundaries.test.ts` (cover `src/checker`)
- Test: `tests/checker/check.test.ts`

**Interfaces:**
- Consumes: `findPassage` (Task 1), `createProbe` (Task 1), `stuckReason`, `standingColumn`, `surfaceRow` (Task 3), `difficulty` (Task 4), `chainProblems` (plan 1), `spawnBox`, `ENEMY_BEHAVIOURS` (plan 3), `createTileMap` (plan 2). The probe's starting player is the arrival position.
- Produces:
  - `type ZoneCheck = { zoneId: string; name: string; passable: boolean; difficulty: number; reason: string | null; furthest: { x: number; y: number } | null; warnings: string[] }` (`furthest` is in tiles: the column under the player's centre and the row they stand in)
  - `type LevelCheck = { zones: ZoneCheck[]; problems: string[] }`
  - `checkZone(project: Project, levelId: string, zoneId: string, pack: ContentPack): ZoneCheck` (throws for an unknown level or zone)
  - `checkLevel(project: Project, levelId: string, pack: ContentPack): LevelCheck`

Warnings (per zone): an enemy whose box centre is within 48 pixels of the player's arrival position, or of a checkpoint's respawn position in that zone: `The Walker at (2, 12) is right where the player arrives.` / `The Walker at (9, 12) is right next to a checkpoint.` (using the thing type's `name` from the pack).

Problems (per level): every problem from `chainProblems`; the boss room holding no boss (`The boss room "Boss Room" has no boss, so the level can never be won.`) or more than one (`The boss room "Boss Room" has 2 bosses. It should have exactly one.`); a boss in any other zone (`"Zone 1" has a boss in it. Bosses belong in the boss room.`); a boss with no floor anywhere below it (`The boss in "Boss Room" has nothing to stand on.`).

- [ ] **Step 1: Write the failing test**

`tests/checker/check.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkLevel, checkZone } from "@/checker/check";
import { createDemoProject, DEMO_LEVEL_ID } from "@/content/demo";
import { snowPack } from "@/content/snow/pack";
import type { Project, Thing } from "@/model/schema";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, thing, type ZoneArt } from "../runtime/helpers";

// A level whose boss room holds the given things.
function withBossRoom(zones: ZoneArt[], bossThings: Thing[]): Project {
  const project = projectFromArt(zones);
  const level = project.levels[0];
  const last = level.zones.length - 1;
  const zonesOut = level.zones.map((z, i) => (i === last ? { ...z, things: bossThings } : z));
  return { ...project, levels: [{ ...level, zones: zonesOut }] };
}

const oneBoss = [thing("boss", 12, 12)];

describe("checkZone", () => {
  it("passes a crossable zone and rates it", () => {
    const result = checkZone(projectFromArt([{ art: flatArt() }]), "L1", "z1", testPack);
    expect(result).toEqual({
      zoneId: "z1",
      name: "Zone 1",
      passable: true,
      difficulty: 1,
      reason: null,
      furthest: null,
      warnings: [],
    });
  });

  it("explains an impassable zone and says where the player gets stuck, in tiles", () => {
    const row = "######....######";
    const result = checkZone(projectFromArt([{ art: flatArt({ 13: row, 14: row }) }]), "L1", "z1", testPack);
    expect(result.passable).toBe(false);
    expect(result.reason).toMatch(/gap 4 tiles wide at column 6/);
    expect(result.furthest).toEqual({ x: 5, y: 12 });
  });

  it("explains a zone the player cannot even start in", () => {
    const art = Array.from({ length: 30 }, () => ".".repeat(16));
    const project = projectFromArt([{ art, entry: { edge: "bottom", from: 7, to: 8 }, exit: { edge: "top", from: 7, to: 8 } }]);
    const result = checkZone(project, "L1", "z1", testPack);
    expect(result.passable).toBe(false);
    expect(result.reason).toBe("The player has nothing to stand on or climb where they arrive.");
  });

  it("warns about an enemy right where the player arrives", () => {
    const project = projectFromArt([{ art: flatArt(), things: [thing("walker", 2, 12)] }]);
    expect(checkZone(project, "L1", "z1", testPack).warnings).toEqual([
      "The Walker at (2, 12) is right where the player arrives.",
    ]);
  });

  it("warns about an enemy right next to a checkpoint", () => {
    const project = projectFromArt(
      [{ art: flatArt(), things: [thing("walker", 9, 12)] }],
      [{ zoneId: "z1", x: 8, y: 12 }],
    );
    expect(checkZone(project, "L1", "z1", testPack).warnings).toEqual([
      "The Walker at (9, 12) is right next to a checkpoint.",
    ]);
  });

  it("throws for a zone that does not exist", () => {
    expect(() => checkZone(projectFromArt([{ art: flatArt() }]), "L1", "zz", testPack)).toThrow(
      /no zone with id "zz"/,
    );
  });
});

describe("checkLevel", () => {
  it("checks every zone", () => {
    const result = checkLevel(withBossRoom([{ art: flatArt() }], oneBoss), "L1", testPack);
    expect(result.zones.map((z) => z.zoneId)).toEqual(["z1", "corridor", "boss"]);
    expect(result.zones.every((z) => z.passable)).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it("reports a boss room with no boss", () => {
    expect(checkLevel(projectFromArt([{ art: flatArt() }]), "L1", testPack).problems).toContain(
      'The boss room "Boss Room" has no boss, so the level can never be won.',
    );
  });

  it("reports a boss room with two bosses", () => {
    const result = checkLevel(withBossRoom([{ art: flatArt() }], [thing("boss", 4, 12), thing("boss", 12, 12)]), "L1", testPack);
    expect(result.problems).toContain('The boss room "Boss Room" has 2 bosses. It should have exactly one.');
  });

  it("reports a boss outside the boss room", () => {
    const result = checkLevel(withBossRoom([{ art: flatArt(), things: [thing("boss", 8, 12)] }], oneBoss), "L1", testPack);
    expect(result.problems).toContain('"Zone 1" has a boss in it. Bosses belong in the boss room.');
  });

  it("reports a boss with nothing under it", () => {
    const project = withBossRoom([{ art: flatArt() }], oneBoss);
    const level = project.levels[0];
    const room = level.zones[2];
    const holed = { ...room, tiles: room.tiles.map((t, i) => (i % 16 >= 10 && i % 16 <= 14 ? 0 : t)) };
    const broken = { ...project, levels: [{ ...level, zones: [level.zones[0], level.zones[1], holed] }] };
    expect(checkLevel(broken, "L1", testPack).problems).toContain(
      'The boss in "Boss Room" has nothing to stand on.',
    );
  });

  it("includes connection problems between zones", () => {
    const result = checkLevel(withBossRoom([{ art: flatArt(), exit: { edge: "top", from: 4, to: 5 } }], oneBoss), "L1", testPack);
    expect(result.problems.join(" ")).toMatch(/must be entered from its bottom edge/);
  });

  it("passes every zone of the demo level with no problems", () => {
    const result = checkLevel(createDemoProject(), DEMO_LEVEL_ID, snowPack);
    expect(result.zones.filter((z) => !z.passable)).toEqual([]);
    expect(result.problems).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/checker/check.test.ts`
Expected: FAIL, cannot resolve `@/checker/check`.

- [ ] **Step 3: Implement the checks**

`src/checker/check.ts`:

```ts
import type { ContentPack } from "@/model/contentPack";
import { TILE_SIZE } from "@/model/geometry";
import type { Level, Project, Zone } from "@/model/schema";
import { chainProblems } from "@/model/validate";
import { spawnBox } from "@/runtime/sim/entities/spawn";
import { ENEMY_BEHAVIOURS } from "@/runtime/sim/entities/types";
import { createTileMap, firstTile, isPlatform, isSolid, lastTile } from "@/runtime/sim/tilemap";
import { difficulty } from "./difficulty";
import { findPassage } from "./passage";
import { createProbe } from "./probe";
import { standingColumn, stuckReason, surfaceRow } from "./reasons";

export type ZoneCheck = {
  zoneId: string;
  name: string;
  passable: boolean;
  difficulty: number;
  reason: string | null;
  furthest: { x: number; y: number } | null; // in tiles: the column and the row the player stands in
  warnings: string[];
};

export type LevelCheck = { zones: ZoneCheck[]; problems: string[] };

const NEAR = 48; // pixels: an enemy this close to an arrival or respawn point gets a warning

function findLevel(project: Project, levelId: string): Level {
  const level = project.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`There is no level with id "${levelId}".`);
  return level;
}

function warningsFor(project: Project, level: Level, zone: Zone, pack: ContentPack, arrival: { x: number; y: number }): string[] {
  const spots = [{ ...arrival, label: "is right where the player arrives" }];
  for (const c of level.checkpoints.filter((c) => c.zoneId === zone.id)) {
    spots.push({ x: c.x * TILE_SIZE + 8, y: c.y * TILE_SIZE + 8, label: "is right next to a checkpoint" });
  }
  const warnings: string[] = [];
  for (const thing of zone.things) {
    const def = pack.things.find((d) => d.type === thing.type);
    if (!def || !ENEMY_BEHAVIOURS.has(def.behaviour)) continue;
    const box = spawnBox(thing, def.behaviour);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    for (const spot of spots) {
      if (Math.hypot(cx - spot.x, cy - spot.y) < NEAR) {
        warnings.push(`The ${def.name} at (${thing.x}, ${thing.y}) ${spot.label}.`);
        break;
      }
    }
  }
  return warnings;
}

export function checkZone(project: Project, levelId: string, zoneId: string, pack: ContentPack): ZoneCheck {
  const level = findLevel(project, levelId);
  const zone = level.zones.find((z) => z.id === zoneId);
  if (!zone) throw new Error(`There is no zone with id "${zoneId}" in level "${level.name}".`);

  const settings = project.player;
  const found = findPassage(zone, pack, settings);
  const probe = createProbe(zone, pack, settings);
  const p = probe.sim.player;
  const arrival = { x: p.x + p.w / 2, y: p.y + p.h / 2 };

  let reason: string | null = null;
  let furthest: ZoneCheck["furthest"] = null;
  if (!found.passable) {
    if (found.furthest) {
      reason = stuckReason(probe, found.furthest, settings);
      furthest = {
        x: standingColumn(probe.map, found.furthest, probe.zone.exit?.edge),
        y: surfaceRow(found.furthest) - 1,
      };
    } else {
      reason = "The player has nothing to stand on or climb where they arrive.";
    }
  }

  return {
    zoneId: zone.id,
    name: zone.name,
    passable: found.passable,
    difficulty: difficulty(zone, pack, found.jumps),
    reason,
    furthest,
    warnings: warningsFor(project, level, zone, pack, arrival),
  };
}

function bossProblems(level: Level, pack: ContentPack): string[] {
  const problems: string[] = [];
  const isBoss = (type: string) => pack.things.find((d) => d.type === type)?.behaviour === "boss";
  const room = level.zones[level.zones.length - 1];
  for (const zone of level.zones) {
    if (zone !== room && zone.things.some((t) => isBoss(t.type))) {
      problems.push(`"${zone.name}" has a boss in it. Bosses belong in the boss room.`);
    }
  }
  if (!room) return problems;
  const bosses = room.things.filter((t) => isBoss(t.type));
  if (bosses.length === 0) problems.push(`The boss room "${room.name}" has no boss, so the level can never be won.`);
  if (bosses.length > 1) problems.push(`The boss room "${room.name}" has ${bosses.length} bosses. It should have exactly one.`);

  const map = createTileMap(room, pack);
  for (const boss of bosses) {
    const box = spawnBox(boss, "boss");
    let floor = false;
    for (let c = firstTile(box.x); c <= lastTile(box.x + box.w) && !floor; c++) {
      for (let r = boss.y + 1; r < map.height && !floor; r++) {
        floor = isSolid(map.behaviourAt(c, r)) || isPlatform(map, c, r);
      }
    }
    if (!floor) problems.push(`The boss in "${room.name}" has nothing to stand on.`);
  }
  return problems;
}

export function checkLevel(project: Project, levelId: string, pack: ContentPack): LevelCheck {
  const level = findLevel(project, levelId);
  return {
    zones: level.zones.map((z) => checkZone(project, levelId, z.id, pack)),
    problems: [...chainProblems(level), ...bossProblems(level, pack)],
  };
}
```

`src/checker/index.ts`:

```ts
export * from "./check";
export * from "./difficulty";
export * from "./passage";
export * from "./reasons";
```

In `tests/boundaries.test.ts`, add `...sourceFiles("src/checker"),` to the list of scanned folders, and change that test's name to `"keeps React, Next.js, the DOM and randomness out of model, commands, the simulation and the checker"`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS, including the demo level; typecheck prints nothing.

If a demo zone is reported impassable, the bot from plan 2 still proves the level can be crossed, so the checker is wrong. Read the zone's `reason` and `furthest`, find the move the search is missing, and fix the search.

- [ ] **Step 5: Commit**

```bash
git add src/checker tests/checker tests/boundaries.test.ts
git commit -m "feat: check zones and levels"
```

---

### Task 6: Piece heights and the first six pieces

**Files:**
- Modify: `src/model/contentPack.ts` (`PieceResult.enterRow`, `exitRow`)
- Create: `src/content/snow/tiles.ts`, `src/content/snow/pieces.ts`
- Modify: `src/content/snow/pack.ts` (tile constants come from `tiles.ts`; `pieces: snowPieces`)
- Create: `tests/checker/pieceHarness.ts`
- Test: `tests/checker/pieces.test.ts`

**Interfaces:**
- Consumes: `PieceDef`, `PieceResult`, `PieceThing` (plan 1); `applyCommand` (plan 1); `createProject`, `createLevel` (plan 1); `checkZone` (Task 5)
- Produces:
  - `PieceResult.enterRow?: number`, `PieceResult.exitRow?: number` (the row the player stands on at the left and right edges; 13 when absent)
  - `src/content/snow/tiles.ts`: `GROUND`, `ICE`, `LADDER`, `SPIKE`, `LEDGE`, `FLOOR = 13` (re-exported from `pack.ts` so existing imports keep working)
  - `snowPieces: PieceDef[]` (six now, twelve after Task 7); `snowPack.pieces === snowPieces`
  - Test helpers: `settingCombos(piece: PieceDef): Record<string, number>[]` (each setting at its minimum, default and maximum, every combination), `zoneWithPiece(piece: PieceDef, settings: Record<string, number>): Project` (level `"L"`, zone `"z"`)

Every piece is 15 rows high and fills its columns completely (air is tile 0). The harness builds a zone with three columns of floor at the piece's entry height, the piece, then floor at its exit height to the end of the zone, with the entry and exit openings sized to those heights.

| Piece | Settings | Shape |
|---|---|---|
| `flat-run` | width 4-16 (6) | floor |
| `stairs-up` | steps 1-4 (3), rise 1-2 (1) | two columns of floor, then steps two columns wide, each `rise` higher; ends `steps × rise` higher |
| `stairs-down` | steps 1-4 (3), rise 1-2 (1) | the mirror of `stairs-up`; starts high, ends on the floor |
| `gap` | width 1-3 (2) | two columns of floor, an open pit `width` wide, two columns of floor |
| `spike-pit` | width 2-5 (3) | as `gap`, but the pit is one deep and lined with spikes; at width 4 and 5 a one-way ledge two rows up spans the middle |
| `spike-pit-platform` | width 4-8 (6) | a spike pit with a moving platform two rows up, travelling across it |

- [ ] **Step 1: Add the piece heights to the model**

In `src/model/contentPack.ts`, change `PieceResult` to:

```ts
export type PieceResult = {
  width: number;
  height: number;
  tiles: number[]; // row by row; KEEP_TILE leaves the existing tile alone
  things: PieceThing[]; // positions relative to the piece's top-left corner
  enterRow?: number; // the row the player stands on at the left edge (13, the normal floor, if absent)
  exitRow?: number; // the row the player stands on at the right edge (13 if absent)
};
```

- [ ] **Step 2: Move the tile constants**

Create `src/content/snow/tiles.ts`:

```ts
export const GROUND = 1;
export const ICE = 2;
export const LADDER = 3;
export const SPIKE = 4;
export const LEDGE = 5;

// The row the player stands on in a normal horizontal zone (the top of the two-row floor).
export const FLOOR = 13;
```

In `src/content/snow/pack.ts`, replace the five `export const` tile lines with:

```ts
import { snowPieces } from "./pieces";
import { GROUND, ICE, LADDER, LEDGE, SPIKE } from "./tiles";

export { FLOOR, GROUND, ICE, LADDER, LEDGE, SPIKE } from "./tiles";
```

and change `pieces: [],` to `pieces: snowPieces,`.

- [ ] **Step 3: Write the harness and the failing test**

`tests/checker/pieceHarness.ts`:

```ts
import { applyCommand, type Command } from "@/commands";
import { snowPack } from "@/content/snow/pack";
import { GROUND } from "@/content/snow/tiles";
import type { PieceDef } from "@/model/contentPack";
import { createLevel, createProject } from "@/model/factory";
import type { Project } from "@/model/schema";

// Each setting at its minimum, default and maximum, in every combination.
export function settingCombos(piece: PieceDef): Record<string, number>[] {
  let combos: Record<string, number>[] = [{}];
  for (const s of piece.settings) {
    const values = [...new Set([s.min, s.default, s.max])];
    combos = combos.flatMap((c) => values.map((v) => ({ ...c, [s.key]: v })));
  }
  return combos;
}

// A one-level project whose zone "z" is: floor, the piece, floor, at the heights the piece says.
export function zoneWithPiece(piece: PieceDef, settings: Record<string, number>): Project {
  const built = piece.build(settings);
  const enter = built.enterRow ?? 13;
  const exit = built.exitRow ?? 13;
  const used = 3 + built.width + 3;
  const screens = Math.ceil(used / 16);
  const width = screens * 16;
  const L = "L";
  const commands: Command[] = [
    { name: "resizeZone", args: { levelId: L, zoneId: "z", screens } },
    { name: "clearRect", args: { levelId: L, zoneId: "z", x: 0, y: 0, w: width, h: 15 } },
    { name: "fillRect", args: { levelId: L, zoneId: "z", x: 0, y: enter, w: 3, h: 15 - enter, tile: GROUND } },
    { name: "insertPiece", args: { levelId: L, zoneId: "z", pieceId: piece.id, x: 3, y: 0, settings, idPrefix: "p" } },
    {
      name: "fillRect",
      args: { levelId: L, zoneId: "z", x: 3 + built.width, y: exit, w: width - 3 - built.width, h: 15 - exit, tile: GROUND },
    },
    {
      name: "setZoneOpenings",
      args: {
        levelId: L,
        zoneId: "z",
        entry: { edge: "left", from: enter - 4, to: enter - 1 },
        exit: { edge: "right", from: exit - 4, to: exit - 1 },
      },
    },
  ];
  let project: Project = {
    ...createProject({ id: "p", name: "Pieces" }, snowPack),
    levels: [createLevel({ id: L, name: "Pieces", zoneIds: ["z", "corridor", "boss"] }, snowPack)],
  };
  for (const command of commands) {
    const result = applyCommand(project, command, { pack: snowPack });
    if (!result.ok) throw new Error(`${piece.id}: ${command.name} failed: ${result.error}`);
    project = result.project;
  }
  return project;
}
```

`tests/checker/pieces.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkZone } from "@/checker/check";
import { snowPack } from "@/content/snow/pack";
import { snowPieces } from "@/content/snow/pieces";
import { settingCombos, zoneWithPiece } from "./pieceHarness";

const EXPECTED = ["flat-run", "stairs-up", "stairs-down", "gap", "spike-pit", "spike-pit-platform"];

describe("snow pieces", () => {
  it("are the snow pack's pieces", () => {
    expect(snowPack.pieces).toBe(snowPieces);
    for (const id of EXPECTED) expect(snowPieces.map((p) => p.id)).toContain(id);
  });

  it("are 15 rows high, fill every cell, and place only known things", () => {
    for (const piece of snowPieces) {
      for (const settings of settingCombos(piece)) {
        const built = piece.build(settings);
        const where = `${piece.id} ${JSON.stringify(settings)}`;
        expect(built.height, where).toBe(15);
        expect(built.tiles, where).toHaveLength(built.width * 15);
        expect(built.tiles.every((t) => t >= 0), where).toBe(true);
        for (const t of built.things) {
          expect(snowPack.things.map((d) => d.type), where).toContain(t.type);
        }
      }
    }
  });

  for (const piece of snowPieces) {
    it(`can be crossed: ${piece.id}, at every setting extreme`, () => {
      for (const settings of settingCombos(piece)) {
        const result = checkZone(zoneWithPiece(piece, settings), "L", "z", snowPack);
        expect(result.passable, `${piece.id} ${JSON.stringify(settings)}: ${result.reason}`).toBe(true);
      }
    });
  }

  it("say the right heights: stairs end higher, and a flat run does not", () => {
    const up = snowPieces.find((p) => p.id === "stairs-up");
    expect(up?.build({ steps: 3, rise: 2 })).toMatchObject({ enterRow: 13, exitRow: 7 });
    const down = snowPieces.find((p) => p.id === "stairs-down");
    expect(down?.build({ steps: 3, rise: 2 })).toMatchObject({ enterRow: 7, exitRow: 13 });
    expect(snowPieces.find((p) => p.id === "flat-run")?.build({ width: 6 })).toMatchObject({ enterRow: 13, exitRow: 13 });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- tests/checker/pieces.test.ts`
Expected: FAIL, cannot resolve `@/content/snow/pieces`.

- [ ] **Step 5: Write the first six pieces**

`src/content/snow/pieces.ts`:

```ts
import type { PieceDef, PieceResult, PieceSettingDef, PieceThing } from "@/model/contentPack";
import type { ThingSettings } from "@/model/schema";
import { FLOOR, GROUND, LEDGE, SPIKE } from "./tiles";

const ROWS = 15;

// A piece being built: every cell starts as air.
class Grid {
  readonly tiles: number[];
  readonly things: PieceThing[] = [];
  constructor(readonly width: number) {
    this.tiles = new Array<number>(width * ROWS).fill(0);
  }
  fill(x: number, y: number, w: number, h: number, tile: number): void {
    for (let r = Math.max(0, y); r < Math.min(ROWS, y + h); r++) {
      for (let c = Math.max(0, x); c < Math.min(this.width, x + w); c++) this.tiles[r * this.width + c] = tile;
    }
  }
  // Solid ground from row `top` to the bottom, in columns x0 to x1.
  ground(x0: number, x1: number, top: number): void {
    this.fill(x0, top, x1 - x0 + 1, ROWS - top, GROUND);
  }
  put(type: string, x: number, y: number, settings: ThingSettings = {}): void {
    this.things.push({ type, x, y, settings });
  }
  done(enterRow = FLOOR, exitRow = FLOOR): PieceResult {
    return { width: this.width, height: ROWS, tiles: this.tiles, things: this.things, enterRow, exitRow };
  }
}

const setting = (key: string, description: string, min: number, max: number, value: number): PieceSettingDef => ({
  key,
  description,
  min,
  max,
  default: value,
});

// A pit `width` wide starting at column 2, lined with spikes one row down.
function spikePit(g: Grid, width: number): void {
  g.ground(0, 1, FLOOR);
  g.ground(width + 2, width + 3, FLOOR);
  g.fill(2, FLOOR, width, 1, SPIKE);
  g.fill(2, FLOOR + 1, width, 1, GROUND);
}

export const snowPieces: PieceDef[] = [
  {
    id: "flat-run",
    name: "Flat run",
    description: "Plain floor to run along.",
    settings: [setting("width", "How many tiles long", 4, 16, 6)],
    build: ({ width }) => {
      const g = new Grid(width);
      g.ground(0, width - 1, FLOOR);
      return g.done();
    },
  },
  {
    id: "stairs-up",
    name: "Staircase up",
    description: "Steps rising to the right. The floor is higher afterwards, by steps times rise.",
    settings: [setting("steps", "How many steps", 1, 4, 3), setting("rise", "How many tiles each step rises", 1, 2, 1)],
    build: ({ steps, rise }) => {
      const g = new Grid(steps * 2 + 2);
      g.ground(0, 1, FLOOR);
      for (let i = 0; i < steps; i++) g.ground(2 + 2 * i, 3 + 2 * i, FLOOR - (i + 1) * rise);
      return g.done(FLOOR, FLOOR - steps * rise);
    },
  },
  {
    id: "stairs-down",
    name: "Staircase down",
    description: "Steps falling to the right. Enter it from a floor higher by steps times rise.",
    settings: [setting("steps", "How many steps", 1, 4, 3), setting("rise", "How many tiles each step drops", 1, 2, 1)],
    build: ({ steps, rise }) => {
      const width = steps * 2 + 2;
      const g = new Grid(width);
      for (let i = 0; i < steps; i++) g.ground(2 * i, 2 * i + 1, FLOOR - (steps - i) * rise);
      g.ground(width - 2, width - 1, FLOOR);
      return g.done(FLOOR - steps * rise, FLOOR);
    },
  },
  {
    id: "gap",
    name: "Gap",
    description: "An open pit to jump over. Falling in loses a life.",
    settings: [setting("width", "How many tiles wide the pit is", 1, 3, 2)],
    build: ({ width }) => {
      const g = new Grid(width + 4);
      g.ground(0, 1, FLOOR);
      g.ground(width + 2, width + 3, FLOOR);
      return g.done();
    },
  },
  {
    id: "spike-pit",
    name: "Spike pit",
    description: "A shallow pit lined with spikes. Wide ones have a ledge in the middle to land on.",
    settings: [setting("width", "How many tiles wide the pit is", 2, 5, 3)],
    build: ({ width }) => {
      const g = new Grid(width + 4);
      spikePit(g, width);
      if (width >= 4) g.fill(3, FLOOR - 2, width - 2, 1, LEDGE);
      return g.done();
    },
  },
  {
    id: "spike-pit-platform",
    name: "Spike pit with moving platform",
    description: "A wide spike pit crossed by riding a moving platform.",
    settings: [setting("width", "How many tiles wide the pit is", 4, 8, 6)],
    build: ({ width }) => {
      const g = new Grid(width + 4);
      spikePit(g, width);
      g.put("platform", 2, FLOOR - 2, { axis: "x", distance: width - 2, speed: 0.5 });
      return g.done();
    },
  },
];
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

If a piece fails at a setting extreme, decide which is wrong: the piece (change its shape so a skilled player can cross it at that setting) or the setting range (narrow it). Never make the harness easier.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add piece heights and the first six snow pieces"
```

---

### Task 7: The other six pieces

**Files:**
- Modify: `src/content/snow/pieces.ts`, `tests/checker/pieces.test.ts`

**Interfaces:**
- Consumes: `Grid`, `setting`, `snowPieces` (Task 6); `ICE`, `LADDER` from `tiles.ts`
- Produces: `snowPieces` with all twelve pieces

| Piece | Settings | Shape |
|---|---|---|
| `ice-run` | width 4-16 (8), difficulty 1-3 (1) | an ice floor; difficulty 2 adds a Snow Crawler near the end; difficulty 3 also opens a two-tile pit in the middle |
| `ladder-climb` | height 3-6 (4) | three columns of floor, a ladder in the third column up the face of a wall `height` tiles high, the wall's top three columns wide; ends `height` higher |
| `ladder-turrets` | height 3-6 (4), difficulty 1-3 (2) | `ladder-climb` with a longer top and `difficulty` Icicle Cannons on it |
| `stepped-platforms` | width 4-8 (6) | an open pit with two-tile one-way ledges every three columns, alternating two and three rows up |
| `enemy-gauntlet` | width 6-14 (10), difficulty 1-3 (2) | floor with a Snow Crawler every four columns; difficulty 2 adds a Frost Bat; difficulty 3 adds a Shield Guard and a Hopper |
| `rest-area` | width 4-8 (5), difficulty 1-3 (1) | floor with a large health pickup at difficulty 1, a small one otherwise |

- [ ] **Step 1: Extend the test**

In `tests/checker/pieces.test.ts`, change `EXPECTED` to all twelve ids:

```ts
const EXPECTED = [
  "flat-run",
  "stairs-up",
  "stairs-down",
  "gap",
  "spike-pit",
  "spike-pit-platform",
  "ice-run",
  "ladder-climb",
  "ladder-turrets",
  "stepped-platforms",
  "enemy-gauntlet",
  "rest-area",
];
```

and add inside the `describe`:

```ts
  it("has twelve pieces with different ids", () => {
    expect(snowPieces).toHaveLength(12);
    expect(new Set(snowPieces.map((p) => p.id)).size).toBe(12);
  });

  it("scale enemies with difficulty", () => {
    const gauntlet = snowPieces.find((p) => p.id === "enemy-gauntlet");
    const count = (difficulty: number) => gauntlet?.build({ width: 10, difficulty }).things.length ?? 0;
    expect(count(1)).toBeLessThan(count(2));
    expect(count(2)).toBeLessThan(count(3));
  });

  it("end ladder climbs higher by their height", () => {
    const climb = snowPieces.find((p) => p.id === "ladder-climb");
    expect(climb?.build({ height: 5 })).toMatchObject({ enterRow: 13, exitRow: 8 });
  });
```

Run: `npm test -- tests/checker/pieces.test.ts`
Expected: FAIL. The new ids are missing and there are only six pieces.

- [ ] **Step 2: Add the six pieces**

In `src/content/snow/pieces.ts`, change the tiles import to `import { FLOOR, GROUND, ICE, LADDER, LEDGE, SPIKE } from "./tiles";`, add this helper above `snowPieces`:

```ts
// A ladder in column 2 up the face of a wall `height` tiles high that starts at column 3.
function ladderWall(g: Grid, height: number): void {
  const top = FLOOR - height;
  g.ground(0, 2, FLOOR);
  g.ground(3, g.width - 1, top);
  g.fill(2, top, 1, height, LADDER);
}
```

and append these six entries to the `snowPieces` array:

```ts
  {
    id: "ice-run",
    name: "Ice run",
    description: "A slippery ice floor. Harder versions add an enemy and then a pit.",
    settings: [setting("width", "How many tiles long", 4, 16, 8), setting("difficulty", "1 easy, 3 hard", 1, 3, 1)],
    build: ({ width, difficulty }) => {
      const g = new Grid(width);
      g.ground(0, width - 1, FLOOR);
      g.fill(0, FLOOR, width, 1, ICE);
      if (difficulty >= 3) {
        const mid = Math.floor(width / 2) - 1;
        g.fill(mid, FLOOR, 2, ROWS - FLOOR, 0);
      }
      if (difficulty >= 2) g.put("walker", width - 2, FLOOR - 1);
      return g.done();
    },
  },
  {
    id: "ladder-climb",
    name: "Ladder climb",
    description: "A ladder up the face of a wall. The floor is higher afterwards, by the height.",
    settings: [setting("height", "How many tiles high the wall is", 3, 6, 4)],
    build: ({ height }) => {
      const g = new Grid(6);
      ladderWall(g, height);
      return g.done(FLOOR, FLOOR - height);
    },
  },
  {
    id: "ladder-turrets",
    name: "Ladder climb with turrets",
    description: "A ladder up a wall, with Icicle Cannons waiting at the top.",
    settings: [
      setting("height", "How many tiles high the wall is", 3, 6, 4),
      setting("difficulty", "How many cannons, 1 to 3", 1, 3, 2),
    ],
    build: ({ height, difficulty }) => {
      const g = new Grid(6 + 2 * difficulty);
      ladderWall(g, height);
      for (let i = 0; i < difficulty; i++) g.put("turret", 5 + 2 * i, FLOOR - height - 1);
      return g.done(FLOOR, FLOOR - height);
    },
  },
  {
    id: "stepped-platforms",
    name: "Stepped platforms over a pit",
    description: "A bottomless pit crossed by hopping between small ledges.",
    settings: [setting("width", "How many tiles wide the pit is", 4, 8, 6)],
    build: ({ width }) => {
      const g = new Grid(width + 4);
      g.ground(0, 1, FLOOR);
      g.ground(width + 2, width + 3, FLOOR);
      for (let k = 0, x = 2; x <= width + 1; k++, x += 3) {
        g.fill(x, k % 2 === 0 ? FLOOR - 2 : FLOOR - 3, Math.min(2, width + 2 - x), 1, LEDGE);
      }
      return g.done();
    },
  },
  {
    id: "enemy-gauntlet",
    name: "Enemy gauntlet",
    description: "A stretch of floor packed with enemies. Harder versions add more kinds.",
    settings: [setting("width", "How many tiles long", 6, 14, 10), setting("difficulty", "1 easy, 3 hard", 1, 3, 2)],
    build: ({ width, difficulty }) => {
      const g = new Grid(width);
      g.ground(0, width - 1, FLOOR);
      for (let x = 3; x < width - 1; x += 4) g.put("walker", x, FLOOR - 1);
      if (difficulty >= 2) g.put("flyer", Math.floor(width / 2), FLOOR - 5);
      if (difficulty >= 3) {
        g.put("shielded", width - 2, FLOOR - 1);
        g.put("jumper", Math.floor(width / 2) + 1, FLOOR - 1);
      }
      return g.done();
    },
  },
  {
    id: "rest-area",
    name: "Rest area",
    description: "A calm stretch with a health pickup, to recover before what comes next.",
    settings: [setting("width", "How many tiles long", 4, 8, 5), setting("difficulty", "1 gives more health", 1, 3, 1)],
    build: ({ width, difficulty }) => {
      const g = new Grid(width);
      g.ground(0, width - 1, FLOOR);
      g.put(difficulty === 1 ? "large-health" : "small-health", Math.floor(width / 2), FLOOR - 1);
      return g.done();
    },
  },
```

- [ ] **Step 3: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 4: Commit**

```bash
git add src/content/snow/pieces.ts tests/checker/pieces.test.ts
git commit -m "feat: add the remaining six snow pieces"
```

---

### Task 8: Checker speed

**Files:**
- Test: `tests/checker/speed.test.ts`
- Modify: `src/checker/passage.ts` or `src/checker/moves.ts` only if the test fails

**Interfaces:**
- Consumes: `checkZone`, `checkLevel` (Task 5); `snowPieces`, `zoneWithPiece` (Tasks 6 and 7)
- Produces: no new interface; time limits the editor and the AI can rely on

The AI checks every zone it changes, so the checker must be quick. Limits: the whole demo level in under 3 seconds; an eight-screen zone made of pieces in under 3 seconds. These are generous ceilings for a test machine, not targets.

- [ ] **Step 1: Write the test**

`tests/checker/speed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyCommand, type Command } from "@/commands";
import { checkLevel, checkZone } from "@/checker/check";
import { createDemoProject, DEMO_LEVEL_ID } from "@/content/demo";
import { snowPack } from "@/content/snow/pack";
import { createLevel, createProject } from "@/model/factory";
import type { Project } from "@/model/schema";

// An eight-screen zone built from a run of pieces that keep the floor level.
function longZone(): Project {
  const pieces: [string, Record<string, number>][] = [
    ["gap", { width: 3 }],
    ["stepped-platforms", { width: 8 }],
    ["spike-pit", { width: 5 }],
    ["ice-run", { width: 12, difficulty: 3 }],
    ["enemy-gauntlet", { width: 14, difficulty: 3 }],
    ["spike-pit-platform", { width: 8 }],
    ["gap", { width: 2 }],
    ["stepped-platforms", { width: 6 }],
    ["spike-pit", { width: 4 }],
    ["flat-run", { width: 16 }],
  ];
  let project: Project = {
    ...createProject({ id: "p", name: "Long" }, snowPack),
    levels: [createLevel({ id: "L", name: "Long", zoneIds: ["z", "corridor", "boss"] }, snowPack)],
  };
  const commands: Command[] = [{ name: "resizeZone", args: { levelId: "L", zoneId: "z", screens: 8 } }];
  let x = 2;
  pieces.forEach(([pieceId, settings], i) => {
    const piece = snowPack.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new Error(pieceId);
    commands.push({ name: "insertPiece", args: { levelId: "L", zoneId: "z", pieceId, x, y: 0, settings, idPrefix: `p${i}` } });
    x += piece.build(settings).width;
  });
  for (const command of commands) {
    const result = applyCommand(project, command, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
  }
  return project;
}

describe("checker speed", () => {
  it("checks the whole demo level in under 3 seconds", () => {
    const started = performance.now();
    checkLevel(createDemoProject(), DEMO_LEVEL_ID, snowPack);
    expect(performance.now() - started).toBeLessThan(3000);
  });

  it("checks an eight-screen zone of pieces in under 3 seconds, and finds it passable", () => {
    const project = longZone();
    const started = performance.now();
    const result = checkZone(project, "L", "z", snowPack);
    expect(performance.now() - started).toBeLessThan(3000);
    expect(result.passable, result.reason ?? "").toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- tests/checker/speed.test.ts`
Expected: PASS. Note the times printed by Vitest for both tests in the ledger.

If either is too slow, profile which zone and which moves dominate. Acceptable fixes, in order: stop a move early once the player is clearly falling to death; skip moves that cannot apply (a running jump with no edge within four tiles); round node positions more coarsely. Do not raise the 3-second limits.

- [ ] **Step 3: Run every check**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: every test PASSES; typecheck and lint report nothing; the build completes.

- [ ] **Step 4: Commit**

```bash
git add tests/checker/speed.test.ts src/checker
git commit -m "test: hold the checker to time limits"
```

---

## Done when

- `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all succeed.
- Every demo zone is passable and the demo level has no problems.
- Every snow piece is passable at every setting extreme.
- A route the checker approves replays in the simulation to the exit.
- `src/checker/` contains no React, Next.js, DOM or random-value code.

Plan 6 (editor) builds on `checkZone` (the overlay and badges), `snowPieces` (the palette), and `snowArt`. Plan 7 (AI) builds on `checkZone`, `checkLevel` and the pieces' descriptions and settings.
