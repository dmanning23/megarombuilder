# Runtime Things Implementation Plan (Milestone 1, Plan 3 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill levels with things: six enemy types, moving platforms, health pickups and a boss, plus player damage, knockback and invulnerability, so the demo level becomes a real stage with a fight at the end.

**Architecture:** Each zone's placed things become *slots* in the sim. Enemies spawn into a slot when their spot scrolls into view and vanish when they wander well off screen; platforms, pickups and the boss exist for as long as the player is in the zone. Each thing type has a behaviour (`walker`, `flyer`, ...) declared by the content pack, and a small update function per behaviour, driven by numbers from the thing's settings. Combat is a separate module: player shots against enemies, contact and enemy-shot damage against the player, and pickups.

**Tech Stack:** TypeScript (strict), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-playable-core-ai-level-builder-design.md` (section 3 "Snow pack contents" and section 5)

**Plan series for milestone 1:**

1. Project model and commands (done)
2. Runtime core (done)
3. Runtime things: enemies, moving platforms, pickups, boss, damage (this plan)
4. Snow content pack, level pieces and the checker
5. Editor UI and IndexedDB storage
6. AI assistant

## Global Constraints

- `src/runtime/sim/` stays plain TypeScript: no React, no Next.js, no DOM globals, no randomness. Same inputs, same result.
- Every enemy and boss number has a default in the runtime and can be overridden by the thing's settings (`speed`, `health`, `damage`, `interval`, and so on). The content pack supplies the defaults it wants.
- A thing type the pack does not know is ignored, never a crash.
- Units are pixels and steps (60 per second).
- No Capcom names, sprites or designs. The boss is the original "Blizzard Bot".
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **Boss doors are not things.** The boss room's entry already acts as the door: zones never lead back, and the boss waits through a one-second intro after the player arrives. The spec's "boss door" and "checkpoint marker" things are dropped; checkpoints stay level data, as plan 1 built them. Task 1 updates the spec to match.
- **Enemies respawn the classic way.** A killed or despawned enemy comes back when its spot scrolls off screen and back on. Every enemy resets when the player respawns. Collected pickups stay collected for the rest of the play session.
- **One shot, one damage.** Player shots do 1 damage. The boss has 28 health and ignores hits for 20 steps after each one.

## Review Focus

1. **Enemy shots over a long session**: a turret firing for minutes must not grow the shot list without limit. Tested in Task 3.
2. **Knockback into a hazard** (spikes or a pit behind the player): the player dies normally; nothing crashes or sticks. Tested in Task 4.
3. **Being hit on a ladder**: the player lets go and is knocked back, not left hanging. Tested in Task 4.
4. **The boss's last hit and the player's death on the same step**: the stage is won. Tested in Task 6.
5. **Things the pack does not know**: ignored without a crash. Tested in Task 1.

## File Structure

```
src/model/contentPack.ts              add ThingBehaviour and ThingDef.behaviour
src/runtime/sim/body.ts               Body type; moveX and moveY moved here from player.ts
src/runtime/sim/entities/types.ts     Entity, EnemyShot, Slot, num(), overlaps()
src/runtime/sim/entities/spawn.ts     spawnBox, createEntity
src/runtime/sim/entities/slots.ts     loadZoneThings, updateSlots, entitiesOf
src/runtime/sim/entities/motion.ts    fall, towardPlayer, patrol, fireAt
src/runtime/sim/entities/enemies.ts   one update function per enemy behaviour; updateEntities
src/runtime/sim/entities/enemyShots.ts updateEnemyShots
src/runtime/sim/entities/platforms.ts updatePlatforms, landOnPlatforms
src/runtime/sim/entities/boss.ts      updateBoss
src/runtime/sim/combat.ts             hurtPlayer, hitEntities, touchEntities
src/runtime/sim/constants.ts          new timings
src/runtime/sim/state.ts              Player and Sim gain fields; createSim loads things
src/runtime/sim/hazards.ts, edges.ts  respawn and transitions reload things
src/runtime/sim/player.ts             hurt and platform landing
src/runtime/sim/step.ts               calls the new modules
src/runtime/render/draw.ts            things, enemy shots, blinking, boss bar, stage clear
src/content/demo.ts                   thing definitions and placements
tests/fixtures/testPack.ts            every behaviour
tests/runtime/helpers.ts, simHelpers.ts  things in zone art; entity lookup
tests/runtime/{spawning,enemies,shooters,combat,platforms,boss}.test.ts
```

The per-step order in the play phase, once every task is done:

1. Move platforms, carrying anyone riding them.
2. Move the player (or knock them back), landing on tiles and platforms.
3. Fire and move player shots; shots hit enemies and the boss. Stop if the boss died.
4. Spawn and despawn enemies; run each thing's behaviour; move enemy shots.
5. Contact damage, enemy-shot damage and pickups. Stop if the player died.
6. Checkpoints, spikes, being inside solid, zone edges.
7. Count down invulnerability.

---

### Task 1: Thing behaviours, slots and spawning

**Files:**
- Modify: `src/model/contentPack.ts`, `tests/fixtures/testPack.ts`, `src/content/demo.ts` (empty `things` stays empty; no change needed beyond typecheck)
- Create: `src/runtime/sim/body.ts`, `src/runtime/sim/entities/types.ts`, `src/runtime/sim/entities/spawn.ts`, `src/runtime/sim/entities/slots.ts`
- Modify: `src/runtime/sim/player.ts` (move `moveX` and `moveY` out), `src/runtime/sim/constants.ts`, `src/runtime/sim/state.ts`, `src/runtime/sim/hazards.ts`, `src/runtime/sim/edges.ts`, `src/runtime/sim/step.ts`
- Modify: `tests/runtime/helpers.ts`, `tests/runtime/simHelpers.ts`
- Modify: `docs/superpowers/specs/2026-10-02-playable-core-ai-level-builder-design.md`
- Test: `tests/runtime/spawning.test.ts`

**Interfaces:**
- Consumes (plan 2): `Sim`, `Player`, `Camera`, `createSim`, `entryPosition`, `cameraFor`, `createTileMap`, `firstTile`, `lastTile`, `isSolid`, `isPlatform`, `TileMap`, `SCREEN_W`, `SCREEN_H`; (plan 1) `Thing`, `ThingSettings`, `TILE_SIZE`
- Produces:
  - `type ThingBehaviour = "walker" | "flyer" | "turret" | "jumper" | "shielded" | "dropper" | "platform" | "health" | "boss"`; `ThingDef.behaviour: ThingBehaviour`
  - `type Body = { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean; onIce: boolean }`; `moveX(map, body, dx)`, `moveY(map, body, dy, dropThrough)` now in `body.ts`
  - `type Entity = Body & { id: string; type: string; behaviour: ThingBehaviour; facing: 1 | -1; health: number; mode: string; timer: number; attack: number; homeX: number; homeY: number; dx: number; dy: number; flash: number; settings: ThingSettings }`
  - `type EnemyShot = { x: number; y: number; vx: number; vy: number; damage: number }`
  - `type Slot = { thing: Thing; def: ThingDef; entity: Entity | null; wasInView: boolean }`
  - `type Box = { x: number; y: number; w: number; h: number }`, `overlaps(a: Box, b: Box): boolean`
  - `num(settings: ThingSettings, key: string, fallback: number): number`
  - `ENEMY_BEHAVIOURS: ReadonlySet<ThingBehaviour>` (the six enemies)
  - `spawnBox(thing: Thing, behaviour: ThingBehaviour): Box`, `createEntity(thing: Thing, def: ThingDef, playerCentreX: number): Entity`
  - `loadZoneThings(sim: Sim): void`, `updateSlots(sim: Sim): void`, `entitiesOf(sim: Sim, behaviour?: ThingBehaviour): Entity[]`, `pickupKey(sim: Sim, id: string): string`
  - `Player` gains `hurt: number`, `invuln: number`, `knockback: 1 | -1`, `ridingId: string | null`
  - `Sim` gains `slots: Slot[]`, `enemyShots: EnemyShot[]`, `collected: Set<string>`; `Phase` gains `"won"`
  - Constants: `DESPAWN_MARGIN = 32`, `ENEMY_GRAVITY = 0.25`, `ENEMY_MAX_FALL = 7`, `ENEMY_SHOT_SIZE = 6`, `ENEMY_FLASH_STEPS = 4`, `HURT_STEPS = 16`, `INVULN_STEPS = 60`, `KNOCKBACK_SPEED = 0.75`, `BOSS_INTRO_STEPS = 60`, `BOSS_IDLE_STEPS = 40`, `BOSS_FLASH_STEPS = 20`
  - Test helpers: `ZoneArt.things?: Thing[]`, `thing(type, x, y, settings?)`, `entity(sim, type): Entity | null`

Sizes and anchors. A thing's tile position says where it stands: its feet sit on the bottom of that tile, centred across it. Exceptions: a flyer is centred in its tile, a dropper hangs from the top of its tile, and a platform lies along the top of its tile starting at the tile's left edge.

| Behaviour | Size (w by h) | Default health |
|---|---|---|
| walker | 14 by 14 | 1 |
| flyer | 14 by 12 | 1 |
| turret | 14 by 14 | 3 |
| jumper | 14 by 14 | 2 |
| shielded | 14 by 16 | 2 |
| dropper | 14 by 12 | 1 |
| platform | 32 by 8 | none |
| health | 10 by 10 | none |
| boss | 24 by 28 | 28 |

Spawning rules: platforms, pickups (unless already collected) and the boss are created when the zone loads. An enemy is created when its spawn box comes on screen having been off screen the step before (or at zone load, if it is on screen then). An enemy is removed when its box is more than `DESPAWN_MARGIN` pixels outside the screen. Entering a zone or respawning reloads every slot. A new enemy faces the player.

- [ ] **Step 1: Add behaviours to the content pack type and the test pack**

In `src/model/contentPack.ts`, replace the `ThingDef` type with:

```ts
export type ThingBehaviour =
  | "walker"
  | "flyer"
  | "turret"
  | "jumper"
  | "shielded"
  | "dropper"
  | "platform"
  | "health"
  | "boss";

export type ThingDef = {
  type: string;
  name: string;
  category: ThingCategory;
  behaviour: ThingBehaviour;
  description: string;
  defaults: ThingSettings;
};
```

Replace the `things` array in `tests/fixtures/testPack.ts` with:

```ts
  things: [
    {
      type: "walker",
      name: "Walker",
      category: "enemy",
      behaviour: "walker",
      description: "Patrols a platform.",
      defaults: { speed: 1 },
    },
    {
      type: "health",
      name: "Health",
      category: "pickup",
      behaviour: "health",
      description: "Restores health.",
      defaults: { amount: 4 },
    },
    { type: "flyer", name: "Flyer", category: "enemy", behaviour: "flyer", description: "Flies.", defaults: {} },
    { type: "turret", name: "Turret", category: "enemy", behaviour: "turret", description: "Shoots.", defaults: {} },
    { type: "jumper", name: "Jumper", category: "enemy", behaviour: "jumper", description: "Hops.", defaults: {} },
    { type: "shielded", name: "Shielded", category: "enemy", behaviour: "shielded", description: "Blocks.", defaults: {} },
    { type: "dropper", name: "Dropper", category: "enemy", behaviour: "dropper", description: "Drops.", defaults: {} },
    { type: "platform", name: "Platform", category: "platform", behaviour: "platform", description: "Moves.", defaults: {} },
    { type: "boss", name: "Boss", category: "boss", behaviour: "boss", description: "Fights.", defaults: {} },
  ],
```

Run: `npm test && npm run typecheck`
Expected: all existing tests PASS (the plan 1 messages that list thing types still start "walker, health"); typecheck prints nothing.

- [ ] **Step 2: Move collision onto a shared Body type**

Create `src/runtime/sim/body.ts` holding `moveX` and `moveY` exactly as they are in `src/runtime/sim/player.ts` today, but typed on `Body` instead of `Player`:

```ts
import { TILE_SIZE } from "@/model/geometry";
import { firstTile, isPlatform, isSolid, lastTile, type TileMap } from "./tilemap";

// Anything that moves through the tile grid: the player, enemies, the boss.
export type Body = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  onIce: boolean;
};

// Moves sideways and stops at solid tiles.
export function moveX(map: TileMap, b: Body, dx: number): void {
  if (dx === 0) return;
  b.x += dx;
  const top = firstTile(b.y);
  const bottom = lastTile(b.y + b.h);
  const tx = dx > 0 ? lastTile(b.x + b.w) : firstTile(b.x);
  for (let ty = top; ty <= bottom; ty++) {
    if (!isSolid(map.behaviourAt(tx, ty))) continue;
    b.x = dx > 0 ? tx * TILE_SIZE - b.w : (tx + 1) * TILE_SIZE;
    b.vx = 0;
    return;
  }
}

// Moves vertically. Falling lands on solid tiles, and on platforms when coming from above
// unless dropThrough is set. Rising stops at solid tiles.
export function moveY(map: TileMap, b: Body, dy: number, dropThrough: boolean): void {
  if (dy === 0) return;
  const prevBottom = b.y + b.h;
  b.y += dy;
  const left = firstTile(b.x);
  const right = lastTile(b.x + b.w);
  if (dy > 0) {
    const ty = lastTile(b.y + b.h);
    for (let tx = left; tx <= right; tx++) {
      const lands =
        isSolid(map.behaviourAt(tx, ty)) ||
        (!dropThrough && isPlatform(map, tx, ty) && prevBottom <= ty * TILE_SIZE);
      if (!lands) continue;
      b.y = ty * TILE_SIZE - b.h;
      b.vy = 0;
      b.onGround = true;
      b.onIce = map.behaviourAt(firstTile(b.x + b.w / 2), ty) === "ice";
      return;
    }
  } else {
    const ty = firstTile(b.y);
    for (let tx = left; tx <= right; tx++) {
      if (!isSolid(map.behaviourAt(tx, ty))) continue;
      b.y = (ty + 1) * TILE_SIZE;
      b.vy = 0;
      return;
    }
  }
}
```

In `src/runtime/sim/player.ts`, delete the `moveX` and `moveY` functions and their comments, and change the imports at the top of the file to:

```ts
import { TILE_SIZE } from "@/model/geometry";
import { moveX, moveY } from "./body";
import { ICE_ACCEL, JUMP_CUT_SPEED } from "./constants";
import { clamp } from "./math";
import type { Input, Sim } from "./state";
import { firstTile, ladderAtPx, touchingLadder } from "./tilemap";
```

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 3: Add the new constants**

Append to `src/runtime/sim/constants.ts`:

```ts
// Enemies vanish when this far outside the screen.
export const DESPAWN_MARGIN = 32;
export const ENEMY_GRAVITY = 0.25;
export const ENEMY_MAX_FALL = 7;
export const ENEMY_SHOT_SIZE = 6;
export const ENEMY_FLASH_STEPS = 4;

// After a hit the player is pushed back for HURT_STEPS, then cannot be hurt until INVULN_STEPS have passed.
export const HURT_STEPS = 16;
export const INVULN_STEPS = 60;
export const KNOCKBACK_SPEED = 0.75;

export const BOSS_INTRO_STEPS = 60;
export const BOSS_IDLE_STEPS = 40;
export const BOSS_FLASH_STEPS = 20;
```

- [ ] **Step 4: Extend the test helpers**

In `tests/runtime/helpers.ts`:

Change the schema import to `import type { Checkpoint, Project, Thing, Zone } from "@/model/schema";`.

Change `ZoneArt` to:

```ts
export type ZoneArt = { art: string[]; entry?: Opening; exit?: Opening | null; things?: Thing[] };
```

Add after `rowWith`:

```ts
// A thing at tile (x, y). Its id is "<type>-<x>-<y>".
export function thing(
  type: string,
  x: number,
  y: number,
  settings: Thing["settings"] = {},
): Thing {
  return { id: `${type}-${x}-${y}`, type, x, y, settings };
}
```

In `zoneFromArt`, change the destructuring to `{ art, entry, exit, things }` and add `things: things ?? base.things,` to the returned object.

Append to `tests/runtime/simHelpers.ts`:

```ts
import type { Entity } from "@/runtime/sim/entities/types";

// The live entity for the first thing of this type in the current zone, if it exists.
export function entity(sim: Sim, type: string): Entity | null {
  return sim.slots.find((s) => s.thing.type === type)?.entity ?? null;
}
```

Move that `import` line up to join the other imports at the top of the file.

- [ ] **Step 5: Write the failing test**

`tests/runtime/spawning.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RESPAWN_STEPS } from "@/runtime/sim/constants";
import { spawnBox } from "@/runtime/sim/entities/spawn";
import { kill } from "@/runtime/sim/hazards";
import { flatArt, thing } from "./helpers";
import { entity, makeSim, run, runUntil } from "./simHelpers";

describe("spawnBox", () => {
  it("stands most things on the bottom of their tile, centred", () => {
    expect(spawnBox(thing("walker", 3, 5), "walker")).toEqual({ x: 49, y: 82, w: 14, h: 14 });
    expect(spawnBox(thing("boss", 3, 5), "boss")).toEqual({ x: 44, y: 68, w: 24, h: 28 });
    expect(spawnBox(thing("health", 3, 5), "health")).toEqual({ x: 51, y: 86, w: 10, h: 10 });
  });

  it("centres flyers, hangs droppers and lays platforms along the top", () => {
    expect(spawnBox(thing("flyer", 3, 5), "flyer")).toEqual({ x: 49, y: 82, w: 14, h: 12 });
    expect(spawnBox(thing("dropper", 3, 5), "dropper")).toEqual({ x: 49, y: 80, w: 14, h: 12 });
    expect(spawnBox(thing("platform", 3, 5), "platform")).toEqual({ x: 48, y: 80, w: 32, h: 8 });
  });
});

describe("slots", () => {
  it("are empty for a zone without things", () => {
    const sim = makeSim([{ art: flatArt() }]);
    expect(sim.slots).toEqual([]);
    expect(sim.enemyShots).toEqual([]);
  });

  it("ignore thing types the pack does not know", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("dragon", 3, 12)] }]);
    expect(sim.slots).toEqual([]);
    run(sim, { right: true }, 10);
    expect(sim.phase).toBe("play");
  });

  it("spawn an enemy that is on screen at the start, facing the player", () => {
    // speed 0 keeps it still once later tasks make walkers move
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 10, 12, { speed: 0 })] }]);
    expect(entity(sim, "walker")).toBeNull();
    run(sim, {}, 1);
    expect(entity(sim, "walker")).toMatchObject({
      x: 161,
      y: 194,
      health: 1,
      facing: -1,
      behaviour: "walker",
      settings: { speed: 0 },
    });
  });

  it("wait to spawn an enemy until its spot scrolls into view", () => {
    const sim = makeSim([{ art: flatArt({}, 3), things: [thing("walker", 40, 12)] }]);
    run(sim, {}, 1);
    expect(entity(sim, "walker")).toBeNull();
    sim.player.x = 600;
    run(sim, {}, 1);
    expect(entity(sim, "walker")).not.toBeNull();
  });

  it("remove an enemy that is well off screen and bring a fresh one back later", () => {
    const sim = makeSim([{ art: flatArt({}, 3), things: [thing("walker", 20, 12)] }]);
    sim.player.x = 300;
    run(sim, {}, 1);
    const first = entity(sim, "walker");
    expect(first).not.toBeNull();
    sim.player.x = 2;
    run(sim, {}, 1);
    expect(entity(sim, "walker")).toBeNull();
    sim.player.x = 300;
    run(sim, {}, 1);
    expect(entity(sim, "walker")).not.toBeNull();
    expect(entity(sim, "walker")).not.toBe(first);
  });

  it("do not bring back a removed enemy while its spot stays on screen", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 10, 12)] }]);
    run(sim, {}, 1);
    sim.slots[0].entity = null;
    run(sim, {}, 30);
    expect(entity(sim, "walker")).toBeNull();
  });

  it("place platforms, pickups and the boss at once, wherever they are", () => {
    const sim = makeSim([
      {
        art: flatArt({}, 3),
        things: [thing("platform", 40, 9), thing("health", 44, 12), thing("boss", 46, 12)],
      },
    ]);
    expect(entity(sim, "platform")).not.toBeNull();
    expect(entity(sim, "health")).not.toBeNull();
    expect(entity(sim, "boss")).toMatchObject({ health: 28, mode: "intro" });
  });

  it("are reloaded on entering the next zone", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt(), things: [thing("walker", 8, 12)] }]);
    expect(sim.slots).toEqual([]);
    runUntil(sim, { right: true }, (s) => s.zoneIndex === 1);
    expect(sim.slots.map((s) => s.thing.type)).toEqual(["walker"]);
  });

  it("are reset when the player respawns", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 10, 12)] }]);
    run(sim, {}, 1);
    const first = entity(sim, "walker");
    kill(sim);
    run(sim, {}, RESPAWN_STEPS + 1);
    expect(entity(sim, "walker")).not.toBe(first);
    expect(entity(sim, "walker")).not.toBeNull();
  });
});

describe("the player", () => {
  it("starts with no damage state", () => {
    const sim = makeSim([{ art: flatArt() }]);
    expect(sim.player).toMatchObject({ hurt: 0, invuln: 0, ridingId: null });
    expect(sim.collected.size).toBe(0);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- tests/runtime/spawning.test.ts`
Expected: FAIL, cannot resolve `@/runtime/sim/entities/spawn`.

- [ ] **Step 7: Implement entity types, spawning and slots**

`src/runtime/sim/entities/types.ts`:

```ts
import type { ThingBehaviour, ThingDef } from "@/model/contentPack";
import type { Thing, ThingSettings } from "@/model/schema";
import type { Body } from "../body";

export type Entity = Body & {
  id: string;
  type: string;
  behaviour: ThingBehaviour;
  facing: 1 | -1;
  health: number;
  mode: string; // behaviour-specific state, such as "walk", "open", "intro"
  timer: number;
  attack: number; // the boss's attack counter
  homeX: number;
  homeY: number;
  dx: number; // last step's movement, for platforms
  dy: number;
  flash: number; // steps left of the hit flash
  settings: ThingSettings;
};

export type EnemyShot = { x: number; y: number; vx: number; vy: number; damage: number };

// One placed thing in the current zone, and its live entity if it exists right now.
export type Slot = { thing: Thing; def: ThingDef; entity: Entity | null; wasInView: boolean };

export type Box = { x: number; y: number; w: number; h: number };

export const ENEMY_BEHAVIOURS: ReadonlySet<ThingBehaviour> = new Set([
  "walker",
  "flyer",
  "turret",
  "jumper",
  "shielded",
  "dropper",
]);

// A number from a thing's settings, or the fallback when it is missing or not a number.
export function num(settings: ThingSettings, key: string, fallback: number): number {
  const value = settings[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
```

`src/runtime/sim/entities/spawn.ts`:

```ts
import type { ThingBehaviour, ThingDef } from "@/model/contentPack";
import { TILE_SIZE } from "@/model/geometry";
import type { Thing } from "@/model/schema";
import { BOSS_INTRO_STEPS } from "../constants";
import { num, type Box, type Entity } from "./types";

const SIZES: Record<ThingBehaviour, [number, number]> = {
  walker: [14, 14],
  flyer: [14, 12],
  turret: [14, 14],
  jumper: [14, 14],
  shielded: [14, 16],
  dropper: [14, 12],
  platform: [32, 8],
  health: [10, 10],
  boss: [24, 28],
};

const HEALTH: Record<ThingBehaviour, number> = {
  walker: 1,
  flyer: 1,
  turret: 3,
  jumper: 2,
  shielded: 2,
  dropper: 1,
  platform: 0,
  health: 0,
  boss: 28,
};

// Where a thing appears. Most stand on the bottom of their tile, centred across it.
export function spawnBox(thing: Thing, behaviour: ThingBehaviour): Box {
  const [w, h] = SIZES[behaviour];
  const left = thing.x * TILE_SIZE;
  const top = thing.y * TILE_SIZE;
  const x = behaviour === "platform" ? left : left + (TILE_SIZE - w) / 2;
  let y = top + TILE_SIZE - h;
  if (behaviour === "flyer") y = top + (TILE_SIZE - h) / 2;
  if (behaviour === "dropper" || behaviour === "platform") y = top;
  return { x, y, w, h };
}

export function createEntity(thing: Thing, def: ThingDef, playerCentreX: number): Entity {
  const behaviour = def.behaviour;
  const box = spawnBox(thing, behaviour);
  const settings = { ...def.defaults, ...thing.settings };
  const initialMode: Partial<Record<ThingBehaviour, string>> = { boss: "intro", dropper: "hang" };
  return {
    ...box,
    vx: 0,
    vy: 0,
    onGround: false,
    onIce: false,
    id: thing.id,
    type: thing.type,
    behaviour,
    facing: playerCentreX < box.x + box.w / 2 ? -1 : 1,
    health: num(settings, "health", HEALTH[behaviour]),
    mode: initialMode[behaviour] ?? "walk",
    timer: behaviour === "boss" ? BOSS_INTRO_STEPS : 0,
    attack: 0,
    homeX: box.x,
    homeY: box.y,
    dx: 0,
    dy: 0,
    flash: 0,
    settings,
  };
}
```

`src/runtime/sim/entities/slots.ts`:

```ts
import type { ThingBehaviour } from "@/model/contentPack";
import { DESPAWN_MARGIN, SCREEN_H, SCREEN_W } from "../constants";
import type { Camera, Sim } from "../state";
import { cameraFor } from "../view";
import { createEntity, spawnBox } from "./spawn";
import type { Box, Entity } from "./types";

// These exist for as long as the player is in the zone; enemies come and go with the screen.
const ALWAYS_PRESENT: ReadonlySet<ThingBehaviour> = new Set(["platform", "health", "boss"]);

const playerCentreX = (sim: Sim) => sim.player.x + sim.player.w / 2;

function inView(box: Box, camera: Camera, margin: number): boolean {
  return (
    box.x < camera.x + SCREEN_W + margin &&
    box.x + box.w > camera.x - margin &&
    box.y < camera.y + SCREEN_H + margin &&
    box.y + box.h > camera.y - margin
  );
}

// Collected pickups are remembered by zone and thing id.
export const pickupKey = (sim: Sim, id: string): string => `${sim.map.zone.id}:${id}`;

// Builds the slots for the current zone. Called on starting, entering a zone and respawning.
export function loadZoneThings(sim: Sim): void {
  sim.enemyShots = [];
  sim.slots = sim.map.zone.things.flatMap((thing) => {
    const def = sim.pack.things.find((d) => d.type === thing.type);
    return def ? [{ thing, def, entity: null, wasInView: false }] : [];
  });
  for (const slot of sim.slots) {
    const behaviour = slot.def.behaviour;
    if (!ALWAYS_PRESENT.has(behaviour)) continue;
    if (behaviour === "health" && sim.collected.has(pickupKey(sim, slot.thing.id))) continue;
    slot.entity = createEntity(slot.thing, slot.def, playerCentreX(sim));
  }
}

// Enemies appear when their spot scrolls into view and vanish when they wander well off screen.
export function updateSlots(sim: Sim): void {
  const camera = cameraFor(sim);
  for (const slot of sim.slots) {
    if (ALWAYS_PRESENT.has(slot.def.behaviour)) continue;
    const visible = inView(spawnBox(slot.thing, slot.def.behaviour), camera, 0);
    if (slot.entity) {
      if (!inView(slot.entity, camera, DESPAWN_MARGIN)) slot.entity = null;
    } else if (visible && !slot.wasInView) {
      slot.entity = createEntity(slot.thing, slot.def, playerCentreX(sim));
    }
    slot.wasInView = visible;
  }
}

export function entitiesOf(sim: Sim, behaviour?: ThingBehaviour): Entity[] {
  const found: Entity[] = [];
  for (const slot of sim.slots) {
    if (slot.entity && (!behaviour || slot.entity.behaviour === behaviour)) found.push(slot.entity);
  }
  return found;
}
```

- [ ] **Step 8: Give the sim its new state**

In `src/runtime/sim/state.ts`:

Add these imports:

```ts
import { loadZoneThings } from "./entities/slots";
import type { EnemyShot, Slot } from "./entities/types";
```

Add these fields to the end of the `Player` type:

```ts
  hurt: number; // steps left of being knocked back
  invuln: number; // steps left of not being hurt
  knockback: 1 | -1;
  ridingId: string | null; // the platform the player is standing on
```

Change `Phase` to `export type Phase = "play" | "transition" | "dead" | "won";`

Add these fields to the end of the `Sim` type:

```ts
  slots: Slot[];
  enemyShots: EnemyShot[];
  collected: Set<string>;
```

In `createSim`, add to the `player` object literal:

```ts
    hurt: 0,
    invuln: 0,
    knockback: 1,
    ridingId: null,
```

and replace the final `return { ... };` with a `const sim: Sim = { ... };` holding the same fields plus `slots: []`, `enemyShots: []` and `collected: new Set()`, followed by:

```ts
  loadZoneThings(sim);
  return sim;
```

In `src/runtime/sim/hazards.ts`, import `loadZoneThings` from `./entities/slots`, and in `respawn` add after `p.health = sim.settings.maxHealth;`:

```ts
  p.hurt = 0;
  p.invuln = 0;
  p.ridingId = null;
```

and after `sim.shots = [];` add `loadZoneThings(sim);`.

In `src/runtime/sim/edges.ts`, import `loadZoneThings` from `./entities/slots`, and in `leave` add `p.ridingId = null;` after `p.onIce = false;`, and `loadZoneThings(sim);` after `sim.shots = [];`.

- [ ] **Step 9: Spawn enemies each step**

Replace `src/runtime/sim/step.ts` with:

```ts
import { checkEdges } from "./edges";
import { updateSlots } from "./entities/slots";
import { insideSolid, kill, respawn, touchCheckpoints, touchingSpike } from "./hazards";
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
  } else if (sim.phase === "play") {
    playStep(sim, input);
  }
  sim.prev = input;
}

function playStep(sim: Sim, input: Input): void {
  updatePlayer(sim, input);
  if (input.shoot && !sim.prev.shoot) shoot(sim);
  updateShots(sim);
  updateSlots(sim);
  touchCheckpoints(sim);
  if (touchingSpike(sim) || insideSolid(sim)) kill(sim);
  else checkEdges(sim);
}
```

- [ ] **Step 10: Update the spec**

In `docs/superpowers/specs/2026-10-02-playable-core-ai-level-builder-design.md`, replace the line

```
- **Other things:** moving platform (horizontal or vertical path), small and
  large health pickup, checkpoint marker, boss door.
```

with

```
- **Other things:** moving platform (horizontal or vertical path), small and
  large health pickup. Checkpoints are level data, not things. There is no boss
  door thing: the boss room's entry is the door, since zones never lead back,
  and the boss waits through a short intro.
```

- [ ] **Step 11: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add thing behaviours, slots and enemy spawning"
```

---

### Task 2: Walking, flying, jumping and dropping enemies

**Files:**
- Create: `src/runtime/sim/entities/motion.ts`, `src/runtime/sim/entities/enemies.ts`
- Modify: `src/runtime/sim/step.ts` (call `updateEntities`)
- Test: `tests/runtime/enemies.test.ts`

**Interfaces:**
- Consumes: `moveX`, `moveY`, `Body` (Task 1); `Entity`, `num` (Task 1); `ENEMY_GRAVITY`, `ENEMY_MAX_FALL` (Task 1); `firstTile`, `isSolid`, `isPlatform`, `TileMap` (plan 2)
- Produces:
  - `fall(map: TileMap, body: Body): void` (gravity and vertical movement)
  - `towardPlayer(sim: Sim, e: Entity): 1 | -1`
  - `patrol(sim: Sim, e: Entity, speed: number): void` (walk; turn at walls and edges; fall)
  - `updateEntities(sim: Sim): void` (runs each live entity's behaviour; counts down enemy hit flashes)

Behaviours and their settings (default in brackets):

| Behaviour | What it does |
|---|---|
| walker | Patrols at `speed` (0.5), turning at walls and at ledges. Falls if unsupported. |
| flyer | Moves toward the player at `speed` (0.75) and bobs up and down `amplitude` (16) pixels every `period` (90) steps around its spawn height. Ignores walls. |
| jumper | Waits `interval` (60) steps on the ground, then hops toward the player with vertical speed `jumpSpeed` (4) and sideways speed `hop` (1). |
| dropper | Hangs still until the player is below it and within `reach` (24) pixels sideways, then falls and, on landing, patrols at `speed` (0.75). |

- [ ] **Step 1: Write the failing test**

`tests/runtime/enemies.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { flatArt, rowWith, thing } from "./helpers";
import { entity, makeSim, run, standOn } from "./simHelpers";

describe("walker", () => {
  it("walks toward the player", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 10, 12)] }]);
    run(sim, {}, 10);
    expect(entity(sim, "walker")).toMatchObject({ x: 151, y: 194, facing: -1, onGround: true });
  });

  it("turns round at a wall", () => {
    const wall = flatArt({ 11: rowWith({ 5: "#" }), 12: rowWith({ 5: "#" }) });
    const sim = makeSim([{ art: wall, things: [thing("walker", 9, 12)] }]);
    run(sim, {}, 60);
    const walker = entity(sim, "walker");
    expect(walker?.facing).toBe(1);
    expect(walker?.x).toBeGreaterThanOrEqual(96);
  });

  it("turns round at a ledge instead of walking off", () => {
    const block = flatArt({ 10: "......#####....." });
    const sim = makeSim([{ art: block, things: [thing("walker", 8, 9)] }]);
    for (let i = 0; i < 200; i++) {
      run(sim, {}, 1);
      const walker = entity(sim, "walker");
      expect(walker?.y).toBe(146);
      expect(walker?.x).toBeGreaterThanOrEqual(95);
      expect(walker?.x).toBeLessThanOrEqual(176 - 14 + 1);
    }
  });

  it("falls to the floor when placed in the air", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 8, 5)] }]);
    run(sim, {}, 60);
    expect(entity(sim, "walker")).toMatchObject({ y: 194, onGround: true });
  });
});

describe("flyer", () => {
  it("flies toward the player, bobbing around its spawn height", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("flyer", 12, 5)] }]);
    const heights: number[] = [];
    for (let i = 0; i < 60; i++) {
      run(sim, {}, 1);
      heights.push(entity(sim, "flyer")?.y ?? NaN);
    }
    expect(entity(sim, "flyer")?.x).toBeCloseTo(193 - 60 * 0.75);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(82 - 16);
    expect(Math.max(...heights)).toBeLessThanOrEqual(82 + 16);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(10);
  });

  it("passes through walls", () => {
    const wall = flatArt(Object.fromEntries([...Array(13).keys()].map((y) => [y, rowWith({ 8: "#" })])));
    const sim = makeSim([{ art: wall, things: [thing("flyer", 12, 5)] }]);
    run(sim, {}, 100);
    expect(entity(sim, "flyer")?.x).toBeLessThan(8 * 16);
  });
});

describe("jumper", () => {
  it("waits on the ground, then hops toward the player", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("jumper", 10, 12)] }]);
    run(sim, {}, 30);
    expect(entity(sim, "jumper")).toMatchObject({ onGround: true, x: 161 });
    let hopped = false;
    for (let i = 0; i < 60; i++) {
      run(sim, {}, 1);
      const jumper = entity(sim, "jumper");
      if (jumper && !jumper.onGround && jumper.vx < 0) hopped = true;
    }
    expect(hopped).toBe(true);
    run(sim, {}, 30);
    expect(entity(sim, "jumper")?.x).toBeLessThan(161);
  });
});

describe("dropper", () => {
  it("hangs still until the player is below it", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("dropper", 8, 3)] }]);
    run(sim, {}, 30);
    expect(entity(sim, "dropper")).toMatchObject({ y: 48, mode: "hang" });
  });

  it("drops onto the floor when the player passes under it, then walks toward them", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("dropper", 8, 3)] }]);
    run(sim, {}, 1);
    standOn(sim, 8, 13);
    run(sim, {}, 60);
    expect(entity(sim, "dropper")).toMatchObject({ y: 196, mode: "walk", onGround: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/runtime/enemies.test.ts`
Expected: FAIL. Enemies stay where they spawned, so the position assertions fail.

- [ ] **Step 3: Implement motion helpers and the enemies**

`src/runtime/sim/entities/motion.ts`:

```ts
import { moveX, moveY, type Body } from "../body";
import { ENEMY_GRAVITY, ENEMY_MAX_FALL } from "../constants";
import type { Sim } from "../state";
import { firstTile, isPlatform, isSolid, type TileMap } from "../tilemap";
import type { Entity } from "./types";

export function fall(map: TileMap, body: Body): void {
  body.vy = Math.min(body.vy + ENEMY_GRAVITY, ENEMY_MAX_FALL);
  body.onGround = false;
  moveY(map, body, body.vy, false);
}

export function towardPlayer(sim: Sim, e: Entity): 1 | -1 {
  return sim.player.x + sim.player.w / 2 < e.x + e.w / 2 ? -1 : 1;
}

function standable(map: TileMap, px: number, py: number): boolean {
  const tx = firstTile(px);
  const ty = firstTile(py);
  return isSolid(map.behaviourAt(tx, ty)) || isPlatform(map, tx, ty);
}

// Walks along the ground, turning round at walls and at edges, and falls when unsupported.
export function patrol(sim: Sim, e: Entity, speed: number): void {
  if (e.onGround) {
    const front = e.facing > 0 ? e.x + e.w + 1 : e.x - 1;
    if (!standable(sim.map, front, e.y + e.h + 1)) e.facing = e.facing > 0 ? -1 : 1;
  }
  e.vx = e.facing * speed;
  moveX(sim.map, e, e.vx);
  if (e.vx === 0 && speed !== 0) e.facing = e.facing > 0 ? -1 : 1; // walked into a wall
  fall(sim.map, e);
}
```

`src/runtime/sim/entities/enemies.ts`:

```ts
import type { ThingBehaviour } from "@/model/contentPack";
import { moveX } from "../body";
import type { Sim } from "../state";
import { fall, patrol, towardPlayer } from "./motion";
import { num, type Entity } from "./types";

type Update = (sim: Sim, e: Entity) => void;

const walker: Update = (sim, e) => patrol(sim, e, num(e.settings, "speed", 0.5));

const flyer: Update = (sim, e) => {
  e.timer++;
  e.facing = towardPlayer(sim, e);
  e.x += e.facing * num(e.settings, "speed", 0.75);
  const period = num(e.settings, "period", 90);
  e.y = e.homeY + Math.sin((e.timer * 2 * Math.PI) / period) * num(e.settings, "amplitude", 16);
};

const jumper: Update = (sim, e) => {
  if (e.onGround) {
    e.vx = 0;
    e.timer++;
    if (e.timer >= num(e.settings, "interval", 60)) {
      e.timer = 0;
      e.facing = towardPlayer(sim, e);
      e.vy = -num(e.settings, "jumpSpeed", 4);
      e.vx = e.facing * num(e.settings, "hop", 1);
    }
  }
  moveX(sim.map, e, e.vx);
  fall(sim.map, e);
};

const dropper: Update = (sim, e) => {
  if (e.mode === "hang") {
    const p = sim.player;
    const sideways = Math.abs(p.x + p.w / 2 - (e.x + e.w / 2));
    if (sideways <= num(e.settings, "reach", 24) && p.y > e.y) e.mode = "fall";
    return;
  }
  if (e.mode === "fall") {
    fall(sim.map, e);
    if (e.onGround) {
      e.mode = "walk";
      e.facing = towardPlayer(sim, e);
    }
    return;
  }
  patrol(sim, e, num(e.settings, "speed", 0.75));
};

const BEHAVIOURS: Partial<Record<ThingBehaviour, Update>> = { walker, flyer, jumper, dropper };

export function updateEntities(sim: Sim): void {
  for (const slot of sim.slots) {
    const e = slot.entity;
    if (!e) continue;
    if (e.flash > 0 && e.behaviour !== "boss") e.flash--;
    BEHAVIOURS[e.behaviour]?.(sim, e);
  }
}
```

In `src/runtime/sim/step.ts`, add `import { updateEntities } from "./entities/enemies";` and add `updateEntities(sim);` on the line after `updateSlots(sim);`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add walking, flying, jumping and dropping enemies"
```

---

### Task 3: Turrets, shielded enemies and enemy shots

**Files:**
- Create: `src/runtime/sim/entities/enemyShots.ts`
- Modify: `src/runtime/sim/entities/motion.ts` (add `fireAt`), `src/runtime/sim/entities/enemies.ts` (add `turret` and `shielded`), `src/runtime/sim/step.ts`
- Test: `tests/runtime/shooters.test.ts`

**Interfaces:**
- Consumes: `patrol`, `fall`, `towardPlayer` (Task 2); `EnemyShot`, `num` (Task 1); `ENEMY_SHOT_SIZE` (Task 1); `cameraFor`, `firstTile`, `isSolid`, `SCREEN_W`, `SCREEN_H` (plan 2)
- Produces:
  - `fireAt(sim: Sim, e: Entity, vx: number, vy: number, damage: number): void` (adds an enemy shot from the entity's centre)
  - `updateEnemyShots(sim: Sim): void` (moves enemy shots; removes those hitting a solid tile or leaving the screen)

| Behaviour | What it does |
|---|---|
| turret | Stays put, facing the player. Every `interval` (90) steps, if the player is within `range` (160) pixels sideways, fires a shot aimed at the player's centre at `shotSpeed` (2), doing `shotDamage` (2). |
| shielded | Patrols at `speed` (0.4) with its shield up. Every `interval` (120) steps it stops, turns to the player, opens for `openSteps` (30) steps and fires one straight shot at `shotSpeed` (2), doing `shotDamage` (2). Task 4 makes the shield block shots. |

- [ ] **Step 1: Write the failing test**

`tests/runtime/shooters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { flatArt, rowWith, thing } from "./helpers";
import { entity, makeSim, run } from "./simHelpers";

describe("turret", () => {
  it("fires a shot aimed at a player in range", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("turret", 8, 12)] }]);
    run(sim, {}, 89);
    expect(sim.enemyShots).toEqual([]);
    run(sim, {}, 1);
    expect(sim.enemyShots).toHaveLength(1);
    const shot = sim.enemyShots[0];
    expect(shot.vx).toBeLessThan(-1.9);
    expect(Math.hypot(shot.vx, shot.vy)).toBeCloseTo(2);
    expect(shot.damage).toBe(2);
    expect(entity(sim, "turret")?.x).toBe(129);
  });

  it("holds fire while the player is out of range", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("turret", 15, 12)] }]);
    run(sim, {}, 300);
    expect(sim.enemyShots).toEqual([]);
  });

  it("uses the thing's own settings", () => {
    const sim = makeSim([
      { art: flatArt(), things: [thing("turret", 8, 12, { interval: 10, shotSpeed: 3 })] },
    ]);
    run(sim, {}, 10);
    expect(Math.hypot(sim.enemyShots[0].vx, sim.enemyShots[0].vy)).toBeCloseTo(3);
  });
});

describe("enemy shots", () => {
  it("stop at walls", () => {
    const wall = flatArt({ 11: rowWith({ 3: "#" }), 12: rowWith({ 3: "#" }) });
    const sim = makeSim([{ art: wall, things: [thing("turret", 8, 12)] }]);
    run(sim, {}, 90);
    expect(sim.enemyShots).toHaveLength(1);
    run(sim, {}, 60);
    expect(sim.enemyShots).toEqual([]);
  });

  it("leave the screen and do not pile up over a long session", () => {
    const sim = makeSim([
      { art: flatArt({}, 3), things: [thing("turret", 12, 12, { interval: 5 })] },
    ]);
    // Hold the player in the air, in range, so the turret keeps firing upward past them.
    const hold = () => {
      sim.player.x = 250;
      sim.player.y = 40;
      sim.player.vy = 0;
      sim.player.invuln = 1_000_000;
    };
    hold();
    let most = 0;
    for (let i = 0; i < 3000; i++) {
      run(sim, {}, 1);
      hold();
      most = Math.max(most, sim.enemyShots.length);
    }
    expect(sim.slots[0].entity).not.toBeNull();
    expect(most).toBeLessThan(60);
  });
});

describe("shielded", () => {
  it("opens and fires a straight shot at the player after its interval", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("shielded", 10, 12)] }]);
    run(sim, {}, 119);
    expect(entity(sim, "shielded")?.mode).toBe("walk");
    run(sim, {}, 1);
    expect(entity(sim, "shielded")).toMatchObject({ mode: "open", facing: -1 });
    expect(sim.enemyShots).toHaveLength(1);
    expect(sim.enemyShots[0]).toMatchObject({ vx: -2, vy: 0 });
  });

  it("closes again and walks on", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("shielded", 10, 12)] }]);
    run(sim, {}, 120);
    const x = entity(sim, "shielded")?.x;
    run(sim, {}, 29);
    expect(entity(sim, "shielded")).toMatchObject({ mode: "open", x });
    run(sim, {}, 1);
    expect(entity(sim, "shielded")?.mode).toBe("walk");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/runtime/shooters.test.ts`
Expected: FAIL. No enemy shots appear.

- [ ] **Step 3: Implement firing, the two shooters and enemy shots**

Append to `src/runtime/sim/entities/motion.ts` (and add `ENEMY_SHOT_SIZE` to its constants import):

```ts
// Fires an enemy shot from the entity's centre.
export function fireAt(sim: Sim, e: Entity, vx: number, vy: number, damage: number): void {
  sim.enemyShots.push({
    x: e.x + e.w / 2 - ENEMY_SHOT_SIZE / 2,
    y: e.y + e.h / 2 - ENEMY_SHOT_SIZE / 2,
    vx,
    vy,
    damage,
  });
}
```

In `src/runtime/sim/entities/enemies.ts`, change the motion import to `import { fall, fireAt, patrol, towardPlayer } from "./motion";`, add these two behaviours above `BEHAVIOURS`:

```ts
const turret: Update = (sim, e) => {
  const p = sim.player;
  const dx = p.x + p.w / 2 - (e.x + e.w / 2);
  const dy = p.y + p.h / 2 - (e.y + e.h / 2);
  e.facing = dx < 0 ? -1 : 1;
  e.timer++;
  if (e.timer < num(e.settings, "interval", 90)) return;
  e.timer = 0;
  if (Math.abs(dx) > num(e.settings, "range", 160)) return;
  const speed = num(e.settings, "shotSpeed", 2);
  const distance = Math.hypot(dx, dy) || 1;
  fireAt(sim, e, (dx / distance) * speed, (dy / distance) * speed, num(e.settings, "shotDamage", 2));
};

const shielded: Update = (sim, e) => {
  e.timer++;
  if (e.mode === "open") {
    fall(sim.map, e);
    if (e.timer >= num(e.settings, "openSteps", 30)) {
      e.mode = "walk";
      e.timer = 0;
    }
    return;
  }
  patrol(sim, e, num(e.settings, "speed", 0.4));
  if (e.timer >= num(e.settings, "interval", 120)) {
    e.mode = "open";
    e.timer = 0;
    e.facing = towardPlayer(sim, e);
    const speed = num(e.settings, "shotSpeed", 2);
    fireAt(sim, e, e.facing * speed, 0, num(e.settings, "shotDamage", 2));
  }
};
```

and change the table to:

```ts
const BEHAVIOURS: Partial<Record<ThingBehaviour, Update>> = {
  walker,
  flyer,
  turret,
  jumper,
  shielded,
  dropper,
};
```

`src/runtime/sim/entities/enemyShots.ts`:

```ts
import { ENEMY_SHOT_SIZE, SCREEN_H, SCREEN_W } from "../constants";
import type { Sim } from "../state";
import { firstTile, isSolid } from "../tilemap";
import { cameraFor } from "../view";

// Moves enemy shots, removing any that hit a solid tile or leave the screen.
export function updateEnemyShots(sim: Sim): void {
  const camera = cameraFor(sim);
  const size = ENEMY_SHOT_SIZE;
  sim.enemyShots = sim.enemyShots.filter((shot) => {
    shot.x += shot.vx;
    shot.y += shot.vy;
    const cx = shot.x + size / 2;
    const cy = shot.y + size / 2;
    if (isSolid(sim.map.behaviourAt(firstTile(cx), firstTile(cy)))) return false;
    return (
      shot.x + size > camera.x &&
      shot.x < camera.x + SCREEN_W &&
      shot.y + size > camera.y &&
      shot.y < camera.y + SCREEN_H
    );
  });
}
```

In `src/runtime/sim/step.ts`, add `import { updateEnemyShots } from "./entities/enemyShots";` and add `updateEnemyShots(sim);` on the line after `updateEntities(sim);`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add turrets, shielded enemies and enemy shots"
```

---

### Task 4: Combat and pickups

**Files:**
- Create: `src/runtime/sim/combat.ts`
- Modify: `src/runtime/sim/player.ts` (knockback), `src/runtime/sim/step.ts` (replace the file)
- Test: `tests/runtime/combat.test.ts`

**Interfaces:**
- Consumes: `Slot`, `Entity`, `ENEMY_BEHAVIOURS`, `num`, `overlaps`, `pickupKey` (Task 1); `kill` (plan 2); constants (Task 1); `SHOT_W`, `SHOT_H` (plan 2)
- Produces:
  - `hurtPlayer(sim: Sim, amount: number, fromX: number): void` (does nothing outside the play phase or while invulnerable; kills at zero health; otherwise starts knockback away from `fromX` and invulnerability, and lets go of any ladder)
  - `hitEntities(sim: Sim): void` (player shots against enemies and the boss; sets `phase` to `"won"` when the boss's health reaches zero)
  - `touchEntities(sim: Sim): void` (contact damage, enemy-shot damage, pickups)
  - `step` in the shape it keeps for the rest of this plan, apart from Task 5's platform line

Rules:

- A player shot that touches an enemy or the boss is used up. A shielded enemy that is walking blocks shots coming at the side it faces. The boss ignores shots during its intro and for `BOSS_FLASH_STEPS` after each hit. Otherwise the target loses 1 health and flashes; at 0 it is removed.
- Touching an enemy does its `damage` (2) to the player; touching the boss does its `damage` (4), except during the boss's intro. An enemy shot does its own damage and is used up.
- A hurt player is pushed away from the source at `KNOCKBACK_SPEED` for `HURT_STEPS` steps, ignoring input but still falling, and cannot be hurt again until `INVULN_STEPS` steps have passed.
- Touching a health pickup restores its `amount` (4) up to the maximum, and it is gone for the rest of the session.

- [ ] **Step 1: Write the failing test**

`tests/runtime/combat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { HURT_STEPS, INVULN_STEPS, RESPAWN_STEPS } from "@/runtime/sim/constants";
import { kill } from "@/runtime/sim/hazards";
import { flatArt, rowWith, thing } from "./helpers";
import { entity, makeSim, run, standOn } from "./simHelpers";

function shootOnce(sim: ReturnType<typeof makeSim>) {
  run(sim, { shoot: true }, 1);
  run(sim, {}, 1);
}

describe("player shots", () => {
  it("destroy a one-hit enemy", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 8, 12)] }]);
    run(sim, {}, 1);
    shootOnce(sim);
    run(sim, {}, 30);
    expect(entity(sim, "walker")).toBeNull();
    expect(sim.shots).toEqual([]);
  });

  it("take three hits to destroy a turret", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("turret", 10, 12, { interval: 1000 })] }]);
    run(sim, {}, 1);
    shootOnce(sim);
    run(sim, {}, 40);
    expect(entity(sim, "turret")?.health).toBe(2);
    shootOnce(sim);
    run(sim, {}, 40);
    expect(entity(sim, "turret")?.health).toBe(1);
    shootOnce(sim);
    run(sim, {}, 40);
    expect(entity(sim, "turret")).toBeNull();
  });

  it("are blocked by a walking shielded enemy's shield", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("shielded", 8, 12)] }]);
    run(sim, {}, 1);
    shootOnce(sim);
    run(sim, {}, 40);
    expect(entity(sim, "shielded")?.health).toBe(2);
    expect(sim.shots).toEqual([]);
  });

  it("hit a shielded enemy from behind", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("shielded", 8, 12)] }]);
    run(sim, {}, 1);
    const shielded = entity(sim, "shielded");
    if (!shielded) throw new Error("no shielded enemy");
    shielded.facing = 1;
    shootOnce(sim);
    run(sim, {}, 40);
    expect(shielded.health).toBe(1);
  });

  it("hit a shielded enemy from the front while it is open", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("shielded", 4, 12)] }]);
    run(sim, {}, 1);
    const shielded = entity(sim, "shielded");
    if (!shielded) throw new Error("no shielded enemy");
    shielded.mode = "open";
    shielded.timer = 0;
    shootOnce(sim);
    run(sim, {}, 15);
    expect(shielded.health).toBe(1);
  });

  it("pass by pickups", () => {
    const sim = makeSim([
      { art: flatArt(), things: [thing("health", 6, 12), thing("walker", 12, 12)] },
    ]);
    sim.player.health = 28;
    run(sim, {}, 1);
    shootOnce(sim);
    run(sim, {}, 40);
    expect(entity(sim, "health")).not.toBeNull();
    expect(entity(sim, "walker")).toBeNull();
  });
});

describe("contact damage", () => {
  // A walker one tile to the right of the start, which reaches the player on the second step.
  const nearWalker = () => makeSim([{ art: flatArt(), things: [thing("walker", 1, 12)] }]);

  it("hurts the player and pushes them away", () => {
    const sim = nearWalker();
    run(sim, {}, 2);
    expect(sim.player.health).toBe(26);
    expect(sim.player.hurt).toBeGreaterThan(0);
    expect(sim.player.invuln).toBe(INVULN_STEPS - 1);
    expect(sim.player.knockback).toBe(-1);
  });

  it("ignores input while the player is knocked back", () => {
    const sim = nearWalker();
    run(sim, {}, 2);
    run(sim, { right: true, jump: true }, 1);
    expect(sim.player.vx).toBe(-0.75);
    expect(sim.player.vy).toBeGreaterThanOrEqual(0);
  });

  it("gives control back after the knockback", () => {
    const sim = nearWalker();
    run(sim, {}, 2);
    run(sim, {}, HURT_STEPS);
    run(sim, { right: true }, 1);
    expect(sim.player.vx).toBe(1.375);
  });

  it("does not hurt again while invulnerable", () => {
    const sim = nearWalker();
    run(sim, {}, 2);
    run(sim, {}, INVULN_STEPS - 5);
    expect(sim.player.health).toBe(26);
  });

  it("can kill", () => {
    const sim = nearWalker();
    sim.player.health = 2;
    run(sim, {}, 2);
    expect(sim.phase).toBe("dead");
  });

  it("knocks the player off a ladder", () => {
    const overrides: Record<number, string> = {};
    for (let y = 5; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
    const sim = makeSim([
      { art: flatArt(overrides), things: [thing("flyer", 7, 8, { speed: 0, amplitude: 0 })] },
    ]);
    standOn(sim, 4, 13);
    run(sim, { up: true }, 30);
    expect(sim.player.onLadder).toBe(true);
    const flyer = entity(sim, "flyer");
    if (!flyer) throw new Error("no flyer");
    flyer.x = sim.player.x + 4;
    flyer.homeY = sim.player.y;
    run(sim, { up: true }, 1);
    expect(sim.player.onLadder).toBe(false);
    expect(sim.player.hurt).toBeGreaterThan(0);
  });

  it("can knock the player into spikes, which kill as usual", () => {
    // a spike sticking out at body height to the player's left
    const sim = makeSim([
      { art: flatArt({ 12: rowWith({ 4: "^" }) }), things: [thing("walker", 6, 12, { speed: 0 })] },
    ]);
    standOn(sim, 5, 13);
    sim.player.x = 85;
    run(sim, {}, 40);
    expect(sim.phase).toBe("dead");
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.phase).toBe("play");
  });
});

describe("enemy shots", () => {
  it("hurt the player and are used up", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("turret", 8, 12)] }]);
    run(sim, {}, 90);
    expect(sim.enemyShots).toHaveLength(1);
    run(sim, {}, 70);
    expect(sim.player.health).toBe(26);
    expect(sim.enemyShots).toEqual([]);
  });
});

describe("health pickups", () => {
  it("restore health and disappear", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("health", 5, 12)] }]);
    sim.player.health = 20;
    run(sim, { right: true }, 70);
    expect(sim.player.health).toBe(24);
    expect(entity(sim, "health")).toBeNull();
    expect(sim.collected.has("z1:health-5-12")).toBe(true);
  });

  it("do not heal past the maximum", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("health", 5, 12)] }]);
    sim.player.health = 27;
    run(sim, { right: true }, 70);
    expect(sim.player.health).toBe(28);
  });

  it("stay collected after the player respawns", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("health", 5, 12)] }]);
    run(sim, { right: true }, 70);
    kill(sim);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.phase).toBe("play");
    expect(entity(sim, "health")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/runtime/combat.test.ts`
Expected: FAIL. Shots pass through enemies and the player's health never changes.

- [ ] **Step 3: Implement combat**

`src/runtime/sim/combat.ts`:

```ts
import {
  BOSS_FLASH_STEPS,
  ENEMY_FLASH_STEPS,
  ENEMY_SHOT_SIZE,
  HURT_STEPS,
  INVULN_STEPS,
  SHOT_H,
  SHOT_W,
} from "./constants";
import { pickupKey } from "./entities/slots";
import { ENEMY_BEHAVIOURS, num, overlaps, type Entity } from "./entities/types";
import { kill } from "./hazards";
import type { Sim } from "./state";

export function hurtPlayer(sim: Sim, amount: number, fromX: number): void {
  const p = sim.player;
  if (sim.phase !== "play" || p.invuln > 0) return;
  p.health -= amount;
  if (p.health <= 0) {
    kill(sim);
    return;
  }
  p.hurt = HURT_STEPS;
  p.invuln = INVULN_STEPS;
  p.knockback = fromX > p.x + p.w / 2 ? -1 : 1;
  p.onLadder = false;
}

const isTarget = (e: Entity) => ENEMY_BEHAVIOURS.has(e.behaviour) || e.behaviour === "boss";

// A walking shielded enemy blocks shots coming at the side it faces.
const shieldBlocks = (e: Entity, shotVx: number) =>
  e.behaviour === "shielded" && e.mode === "walk" && shotVx * e.facing < 0;

// Player shots against enemies and the boss.
export function hitEntities(sim: Sim): void {
  sim.shots = sim.shots.filter((shot) => {
    const box = { x: shot.x, y: shot.y, w: SHOT_W, h: SHOT_H };
    for (const slot of sim.slots) {
      const e = slot.entity;
      if (!e || !isTarget(e) || !overlaps(box, e)) continue;
      if (shieldBlocks(e, shot.vx)) return false;
      if (e.behaviour === "boss" && (e.mode === "intro" || e.flash > 0)) return false;
      e.health -= 1;
      e.flash = e.behaviour === "boss" ? BOSS_FLASH_STEPS : ENEMY_FLASH_STEPS;
      if (e.health <= 0) {
        slot.entity = null;
        if (e.behaviour === "boss") sim.phase = "won";
      }
      return false;
    }
    return true;
  });
}

// Contact damage, enemy-shot damage and pickups.
export function touchEntities(sim: Sim): void {
  const p = sim.player;
  for (const slot of sim.slots) {
    const e = slot.entity;
    if (!e || e.behaviour === "platform" || !overlaps(p, e)) continue;
    if (e.behaviour === "health") {
      p.health = Math.min(sim.settings.maxHealth, p.health + num(e.settings, "amount", 4));
      sim.collected.add(pickupKey(sim, e.id));
      slot.entity = null;
      continue;
    }
    if (e.behaviour === "boss" && e.mode === "intro") continue;
    hurtPlayer(sim, num(e.settings, "damage", e.behaviour === "boss" ? 4 : 2), e.x + e.w / 2);
  }
  sim.enemyShots = sim.enemyShots.filter((shot) => {
    const box = { x: shot.x, y: shot.y, w: ENEMY_SHOT_SIZE, h: ENEMY_SHOT_SIZE };
    if (!overlaps(p, box)) return true;
    hurtPlayer(sim, shot.damage, shot.x + ENEMY_SHOT_SIZE / 2);
    return false;
  });
}
```

- [ ] **Step 4: Add knockback to the player**

In `src/runtime/sim/player.ts`, add `KNOCKBACK_SPEED` to the constants import, then replace everything from the start of the `export function updatePlayer` line to the end of the file with:

```ts
// Gravity and movement for a player who is not on a ladder.
function physics(sim: Sim): void {
  const { map, player: p, settings } = sim;
  p.vy = Math.min(p.vy + settings.gravity, settings.maxFallSpeed);
  p.onGround = false;
  p.onIce = false;
  moveX(map, p, p.vx);
  moveY(map, p, p.vy, false);
}

export function updatePlayer(sim: Sim, input: Input): void {
  const { map, player: p, settings, prev } = sim;

  if (p.hurt > 0) {
    // Knocked back: no control, but still falling.
    p.hurt--;
    p.vx = p.knockback * KNOCKBACK_SPEED;
    if (p.vy < 0) p.vy = 0;
    physics(sim);
    return;
  }

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

  physics(sim);
}
```

- [ ] **Step 5: Wire combat into the step**

Replace `src/runtime/sim/step.ts` with:

```ts
import { hitEntities, touchEntities } from "./combat";
import { checkEdges } from "./edges";
import { updateEntities } from "./entities/enemies";
import { updateEnemyShots } from "./entities/enemyShots";
import { updateSlots } from "./entities/slots";
import { insideSolid, kill, respawn, touchCheckpoints, touchingSpike } from "./hazards";
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
  } else if (sim.phase === "play") {
    playStep(sim, input);
  }
  sim.prev = input;
}

function playStep(sim: Sim, input: Input): void {
  updatePlayer(sim, input);
  if (input.shoot && !sim.prev.shoot) shoot(sim);
  updateShots(sim);
  hitEntities(sim);
  if (sim.phase !== "play") return; // the boss was defeated
  updateSlots(sim);
  updateEntities(sim);
  updateEnemyShots(sim);
  touchEntities(sim);
  if (sim.phase !== "play") return; // damage killed the player
  touchCheckpoints(sim);
  if (touchingSpike(sim) || insideSolid(sim)) kill(sim);
  else checkEdges(sim);
  if (sim.player.invuln > 0) sim.player.invuln--;
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add combat, knockback, invulnerability and health pickups"
```

---

### Task 5: Moving platforms

**Files:**
- Create: `src/runtime/sim/entities/platforms.ts`
- Modify: `src/runtime/sim/player.ts` (`physics` lands on platforms), `src/runtime/sim/step.ts`
- Test: `tests/runtime/platforms.test.ts`

**Interfaces:**
- Consumes: `entitiesOf` (Task 1); `moveX` (Task 1); `num` (Task 1); `physics` in `player.ts` (Task 4)
- Produces:
  - `updatePlatforms(sim: Sim): void` (moves every platform; carries the rider)
  - `landOnPlatforms(sim: Sim, prevBottom: number): void` (lands a falling player on a platform they came down onto from above)

A platform moves back and forth along `axis` (`"x"`, or `"y"` for up and down) over `distance` tiles (4) at `speed` (0.5) pixels per step, starting at its spawn position. It is one-way: the player lands on it from above and passes through it from below and the sides. A player standing on it moves with it.

- [ ] **Step 1: Write the failing test**

`tests/runtime/platforms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { flatArt, thing } from "./helpers";
import { entity, makeSim, run, standOn } from "./simHelpers";

const sideways = (speed = 0.5) => thing("platform", 4, 9, { axis: "x", distance: 4, speed });

function onPlatform(sim: ReturnType<typeof makeSim>) {
  const platform = entity(sim, "platform");
  if (!platform) throw new Error("no platform");
  sim.player.x = platform.x + 6;
  sim.player.y = platform.y - 22;
  sim.player.vy = 0;
  run(sim, {}, 1);
  return platform;
}

describe("moving platforms", () => {
  it("move back and forth over their distance", () => {
    const sim = makeSim([{ art: flatArt(), things: [sideways()] }]);
    run(sim, {}, 64);
    expect(entity(sim, "platform")).toMatchObject({ x: 96, y: 144 });
    run(sim, {}, 64);
    expect(entity(sim, "platform")?.x).toBe(128);
    run(sim, {}, 64);
    expect(entity(sim, "platform")?.x).toBe(96);
    run(sim, {}, 64);
    expect(entity(sim, "platform")?.x).toBe(64);
  });

  it("can move up and down", () => {
    const sim = makeSim([
      { art: flatArt(), things: [thing("platform", 4, 5, { axis: "y", distance: 2, speed: 1 })] },
    ]);
    run(sim, {}, 16);
    expect(entity(sim, "platform")).toMatchObject({ x: 64, y: 96 });
    run(sim, {}, 32);
    expect(entity(sim, "platform")?.y).toBe(96);
  });

  it("carry a player standing on them", () => {
    const sim = makeSim([{ art: flatArt(), things: [sideways()] }]);
    const platform = onPlatform(sim);
    expect(sim.player.ridingId).toBe(platform.id);
    const x = sim.player.x;
    run(sim, {}, 20);
    expect(sim.player.x).toBeCloseTo(x + 10);
    expect(sim.player.y + 22).toBe(platform.y);
    expect(sim.player.onGround).toBe(true);
  });

  it("carry a rider down without them falling behind", () => {
    const sim = makeSim([
      { art: flatArt(), things: [thing("platform", 4, 5, { axis: "y", distance: 3, speed: 1 })] },
    ]);
    const platform = onPlatform(sim);
    for (let i = 0; i < 40; i++) {
      run(sim, {}, 1);
      expect(sim.player.y + 22).toBe(platform.y);
    }
  });

  it("let a rider jump off", () => {
    const sim = makeSim([{ art: flatArt(), things: [sideways()] }]);
    onPlatform(sim);
    run(sim, { jump: true }, 1);
    expect(sim.player.vy).toBeLessThan(0);
    expect(sim.player.ridingId).toBeNull();
  });

  it("are landed on from above and passed through from below", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("platform", 4, 11, { speed: 0 })] }]);
    standOn(sim, 4, 13);
    run(sim, { jump: true }, 60);
    expect(sim.player.y).toBe(11 * 16 - 22);
    expect(sim.player.onGround).toBe(true);
  });

  it("drop a rider who walks off the end", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("platform", 4, 9, { speed: 0 })] }]);
    onPlatform(sim);
    run(sim, { right: true }, 60);
    expect(sim.player.ridingId).toBeNull();
    expect(sim.player.y).toBe(13 * 16 - 22);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/runtime/platforms.test.ts`
Expected: FAIL. Platforms do not move and the player falls through them.

- [ ] **Step 3: Implement platforms**

`src/runtime/sim/entities/platforms.ts`:

```ts
import { TILE_SIZE } from "@/model/geometry";
import { moveX } from "../body";
import type { Sim } from "../state";
import { entitiesOf } from "./slots";
import { num } from "./types";

// Moves every platform along its back-and-forth path, carrying anyone riding it.
export function updatePlatforms(sim: Sim): void {
  const p = sim.player;
  for (const e of entitiesOf(sim, "platform")) {
    const travel = num(e.settings, "distance", 4) * TILE_SIZE;
    const speed = num(e.settings, "speed", 0.5);
    e.timer++;
    const along = travel > 0 ? (e.timer * speed) % (2 * travel) : 0;
    const offset = along <= travel ? along : 2 * travel - along;
    const vertical = e.settings.axis === "y";
    const x = vertical ? e.homeX : e.homeX + offset;
    const y = vertical ? e.homeY + offset : e.homeY;
    e.dx = x - e.x;
    e.dy = y - e.y;
    e.x = x;
    e.y = y;
    if (p.ridingId === e.id) {
      moveX(sim.map, p, e.dx);
      p.y = e.y - p.h;
    }
  }
}

// Lands a falling player on a platform they came down onto from above.
export function landOnPlatforms(sim: Sim, prevBottom: number): void {
  const p = sim.player;
  if (p.vy < 0) return;
  for (const e of entitiesOf(sim, "platform")) {
    const across = p.x < e.x + e.w && p.x + p.w > e.x;
    // A platform that moved up this step can meet the feet from below; one that moved down
    // can drop away from feet that were on it.
    const rise = Math.max(0, -e.dy);
    const drop = Math.max(0, e.dy);
    if (!across || prevBottom > e.y + rise + 0.001 || p.y + p.h < e.y - drop) continue;
    p.y = e.y - p.h;
    p.vy = 0;
    p.onGround = true;
    p.onIce = false;
    p.ridingId = e.id;
    return;
  }
}
```

In `src/runtime/sim/player.ts`, add `import { landOnPlatforms } from "./entities/platforms";` and replace the `physics` function with:

```ts
// Gravity and movement for a player who is not on a ladder.
function physics(sim: Sim): void {
  const { map, player: p, settings } = sim;
  const prevBottom = p.y + p.h;
  p.vy = Math.min(p.vy + settings.gravity, settings.maxFallSpeed);
  p.onGround = false;
  p.onIce = false;
  p.ridingId = null;
  moveX(map, p, p.vx);
  moveY(map, p, p.vy, false);
  if (!p.onGround) landOnPlatforms(sim, prevBottom);
}
```

In the `climb` function in the same file, add `p.ridingId = null;` after `p.vy = 0;`.

In `src/runtime/sim/step.ts`, add `import { updatePlatforms } from "./entities/platforms";` and make `updatePlatforms(sim);` the first line of `playStep`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add moving platforms"
```

---

### Task 6: The boss

**Files:**
- Create: `src/runtime/sim/entities/boss.ts`
- Modify: `src/runtime/sim/entities/enemies.ts` (register the boss)
- Test: `tests/runtime/boss.test.ts`

**Interfaces:**
- Consumes: `fall`, `towardPlayer`, `fireAt` (Tasks 2 and 3); `moveX` (Task 1); `num` (Task 1); `BOSS_IDLE_STEPS` (Task 1); `hitEntities` sets `"won"` (Task 4)
- Produces: `updateBoss(sim: Sim, e: Entity): void`

Blizzard Bot's routine: an intro of `BOSS_INTRO_STEPS` during which it neither hurts nor can be hurt, then a cycle of idle (`BOSS_IDLE_STEPS`) followed by the next attack in the order jump, shot, dash, repeating. Each attack starts by turning to the player.

| Attack | What it does | Ends when |
|---|---|---|
| jump | leaps with vertical speed `jumpSpeed` (5.5) and sideways speed `jumpDrift` (1.75) | it lands |
| shot | fires three shots at `shotSpeed` (2), angled up, level and down (vertical speeds -0.5, 0, 0.5), doing `shotDamage` (3) | 40 steps have passed |
| dash | slides along the floor at `dashSpeed` (3) | it hits a wall |

Defeating it sets the phase to `"won"`, after which `step` changes nothing.

- [ ] **Step 1: Write the failing test**

`tests/runtime/boss.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOSS_FLASH_STEPS, BOSS_INTRO_STEPS } from "@/runtime/sim/constants";
import type { Entity } from "@/runtime/sim/entities/types";
import { flatArt, thing } from "./helpers";
import { entity, makeSim, run } from "./simHelpers";

function arena() {
  const sim = makeSim([{ art: flatArt(), things: [thing("boss", 12, 12)] }]);
  const boss = entity(sim, "boss");
  if (!boss) throw new Error("no boss");
  return { sim, boss };
}

// Puts a player shot right on the boss.
function hit(sim: ReturnType<typeof makeSim>, boss: Entity) {
  sim.shots.push({ x: boss.x + 4, y: boss.y + 8, vx: 0 });
  run(sim, {}, 1);
}

describe("the boss", () => {
  it("waits through its intro, then goes idle", () => {
    const { sim, boss } = arena();
    run(sim, {}, BOSS_INTRO_STEPS - 1);
    expect(boss.mode).toBe("intro");
    run(sim, {}, 1);
    expect(boss.mode).toBe("idle");
  });

  it("does no damage and takes none during its intro", () => {
    const { sim, boss } = arena();
    sim.player.x = boss.x;
    run(sim, {}, 10);
    expect(sim.player.health).toBe(28);
    hit(sim, boss);
    expect(boss.health).toBe(28);
  });

  it("attacks in the order jump, shot, dash, then repeats", () => {
    const { sim, boss } = arena();
    sim.player.invuln = 1_000_000;
    const attacks: string[] = [];
    for (let i = 0; i < 1500 && attacks.length < 4; i++) {
      const before = boss.mode;
      run(sim, {}, 1);
      if (boss.mode !== before && boss.mode !== "idle") attacks.push(boss.mode);
    }
    expect(attacks).toEqual(["jump", "shot", "dash", "jump"]);
  });

  it("fires three spreading shots in its shot attack", () => {
    const { sim, boss } = arena();
    sim.player.invuln = 1_000_000;
    for (let i = 0; i < 1500 && boss.mode !== "shot"; i++) run(sim, {}, 1);
    expect(sim.enemyShots.map((s) => s.vy).sort((a, b) => a - b)).toEqual([-0.5, 0, 0.5]);
    expect(sim.enemyShots.every((s) => s.vx === -2 && s.damage === 3)).toBe(true);
  });

  it("loses health when hit, then ignores hits while it flashes", () => {
    const { sim, boss } = arena();
    run(sim, {}, BOSS_INTRO_STEPS);
    boss.timer = 10_000; // stay idle
    hit(sim, boss);
    expect(boss.health).toBe(27);
    expect(boss.flash).toBe(BOSS_FLASH_STEPS - 1);
    hit(sim, boss);
    expect(boss.health).toBe(27);
    run(sim, {}, BOSS_FLASH_STEPS);
    hit(sim, boss);
    expect(boss.health).toBe(26);
  });

  it("wins the stage when defeated, and the game then stands still", () => {
    const { sim, boss } = arena();
    run(sim, {}, BOSS_INTRO_STEPS);
    boss.timer = 10_000;
    boss.health = 1;
    hit(sim, boss);
    expect(sim.phase).toBe("won");
    expect(entity(sim, "boss")).toBeNull();
    const { x } = sim.player;
    run(sim, { right: true }, 30);
    expect(sim.player.x).toBe(x);
  });

  it("wins the stage even if the boss's touch would have killed the player on the same step", () => {
    const { sim, boss } = arena();
    run(sim, {}, BOSS_INTRO_STEPS);
    boss.timer = 10_000;
    boss.health = 1;
    sim.player.health = 1;
    sim.player.x = boss.x;
    hit(sim, boss);
    expect(sim.phase).toBe("won");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/runtime/boss.test.ts`
Expected: FAIL. The boss stays in `"intro"`.

- [ ] **Step 3: Implement the boss**

`src/runtime/sim/entities/boss.ts`:

```ts
import { moveX } from "../body";
import { BOSS_IDLE_STEPS } from "../constants";
import type { Sim } from "../state";
import { fall, fireAt, towardPlayer } from "./motion";
import { num, type Entity } from "./types";

const ATTACKS = ["jump", "shot", "dash"] as const;

function toIdle(e: Entity): void {
  e.mode = "idle";
  e.timer = BOSS_IDLE_STEPS;
  e.vx = 0;
}

function startAttack(sim: Sim, e: Entity): void {
  const attack = ATTACKS[e.attack % ATTACKS.length];
  e.attack++;
  e.facing = towardPlayer(sim, e);
  e.mode = attack;
  const s = e.settings;
  if (attack === "jump") {
    e.vy = -num(s, "jumpSpeed", 5.5);
    e.vx = e.facing * num(s, "jumpDrift", 1.75);
  } else if (attack === "shot") {
    const speed = num(s, "shotSpeed", 2);
    const damage = num(s, "shotDamage", 3);
    for (const vy of [-0.5, 0, 0.5]) fireAt(sim, e, e.facing * speed, vy, damage);
    e.timer = 40;
  } else {
    e.vx = e.facing * num(s, "dashSpeed", 3);
  }
}

// Blizzard Bot: an intro, then idle and an attack in turn, forever.
export function updateBoss(sim: Sim, e: Entity): void {
  if (e.flash > 0) e.flash--;
  if (e.mode === "intro" || e.mode === "idle" || e.mode === "shot") {
    e.timer--;
    if (e.timer <= 0) {
      if (e.mode === "idle") startAttack(sim, e);
      else toIdle(e);
    }
  }
  moveX(sim.map, e, e.vx);
  fall(sim.map, e);
  if (e.mode === "jump" && e.onGround) toIdle(e);
  if (e.mode === "dash" && e.vx === 0) toIdle(e); // hit a wall
}
```

In `src/runtime/sim/entities/enemies.ts`, add `import { updateBoss } from "./boss";` and add `boss: updateBoss,` to the `BEHAVIOURS` table.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

If "attacks in the order" sees `"jump"` end immediately, check that the jump's first `fall` leaves `onGround` false: `startAttack` sets `vy` negative, and `fall` only sets `onGround` when landing. Fix the boss, not the test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add the Blizzard Bot boss"
```

---

### Task 7: Drawing things

**Files:**
- Modify: `src/runtime/render/draw.ts`, `tests/runtime/render.test.ts`

**Interfaces:**
- Consumes: `Sim.slots`, `Sim.enemyShots`, `Player.invuln`, `Phase "won"`, `num`, `ENEMY_SHOT_SIZE` (Tasks 1 to 6)
- Produces:
  - `type Ctx2D = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect" | "font" | "textAlign" | "fillText">`
  - `ENTITY_COLOURS: Record<ThingBehaviour, string>`, `ENEMY_SHOT_COLOUR`, `BOSS_BAR_COLOUR`

Drawing additions: every live entity as a rectangle in its behaviour's colour, white on alternate pairs of steps while it flashes; enemy shots; the player hidden on alternate groups of four steps while invulnerable; the boss's health bar on the right while the boss exists; and a "STAGE CLEAR" banner when the phase is `"won"`.

- [ ] **Step 1: Write the failing test**

In `tests/runtime/render.test.ts`, change the draw import to:

```ts
import {
  BACKGROUNDS,
  BOSS_BAR_COLOUR,
  draw,
  ENEMY_SHOT_COLOUR,
  ENTITY_COLOURS,
  PLAYER_COLOUR,
  SHOT_COLOUR,
} from "@/runtime/render/draw";
```

change the helpers import to `import { flatArt, thing } from "./helpers";`, and replace `fakeContext` with:

```ts
function fakeContext() {
  const calls: Call[] = [];
  const texts: string[] = [];
  return {
    calls,
    texts,
    fillStyle: "" as string,
    font: "",
    textAlign: "start" as CanvasTextAlign,
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ colour: this.fillStyle, x, y, w, h });
    },
    fillText(text: string) {
      texts.push(text);
    },
  };
}
```

Add this block after the existing `describe("draw", ...)` block:

```ts
describe("drawing things", () => {
  it("draws enemies in their colour", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 10, 12)] }]);
    run(sim, {}, 1);
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls.filter((c) => c.colour === ENTITY_COLOURS.walker)).toHaveLength(1);
  });

  it("draws enemy shots", () => {
    const sim = makeSim([{ art: flatArt() }]);
    sim.enemyShots.push({ x: 100, y: 100, vx: -2, vy: 0, damage: 2 });
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls).toContainEqual({ colour: ENEMY_SHOT_COLOUR, x: 100, y: 100, w: 6, h: 6 });
  });

  it("blinks the player while invulnerable", () => {
    const sim = makeSim([{ art: flatArt() }]);
    const playerDrawn = () => {
      const ctx = fakeContext();
      draw(ctx, sim);
      return ctx.calls.some((c) => c.colour === PLAYER_COLOUR);
    };
    sim.player.invuln = 4;
    expect(playerDrawn()).toBe(false);
    sim.player.invuln = 8;
    expect(playerDrawn()).toBe(true);
  });

  it("shows the boss's health bar", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("boss", 12, 12)] }]);
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls.filter((c) => c.colour === BOSS_BAR_COLOUR)).toHaveLength(28);
  });

  it("announces a won stage", () => {
    const sim = makeSim([{ art: flatArt() }]);
    sim.phase = "won";
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.texts).toEqual(["STAGE CLEAR"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/runtime/render.test.ts`
Expected: FAIL, `ENTITY_COLOURS` and the other new exports are missing.

- [ ] **Step 3: Implement the drawing**

In `src/runtime/render/draw.ts`:

Change the content pack import to `import type { ContentPack, ThingBehaviour, TileBehaviour } from "@/model/contentPack";`, change the constants import to `import { ENEMY_SHOT_SIZE, SCREEN_H, SCREEN_W, SHOT_H, SHOT_W } from "@/runtime/sim/constants";`, and add `import { num } from "@/runtime/sim/entities/types";`.

Change the `Ctx2D` type to:

```ts
export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  "fillStyle" | "fillRect" | "font" | "textAlign" | "fillText"
>;
```

Add after `SHOT_COLOUR`:

```ts
export const ENEMY_SHOT_COLOUR = "#f72585";
export const BOSS_BAR_COLOUR = "#ff9e9e";
export const ENTITY_COLOURS: Record<ThingBehaviour, string> = {
  walker: "#ff8c42",
  flyer: "#c77dff",
  turret: "#8d99ae",
  jumper: "#80ed99",
  shielded: "#ffd166",
  dropper: "#ef476f",
  platform: "#adb5bd",
  health: "#ff006e",
  boss: "#00b4d8",
};

// A vertical bar of one-pixel ticks, filled from the bottom.
function healthBar(ctx: Ctx2D, x: number, value: number, max: number, colour: string): void {
  rect(ctx, "#000000", x - 1, 15, 8, max * 2 + 1);
  for (let i = 0; i < value; i++) rect(ctx, colour, x, 14 + (max - i) * 2, 6, 1);
}
```

Replace everything in `draw` after the `const p = sim.player;` line with:

```ts
  for (const slot of sim.slots) {
    const e = slot.entity;
    if (!e) continue;
    const flashing = e.flash > 0 && e.flash % 4 < 2;
    rect(
      ctx,
      flashing ? "#ffffff" : ENTITY_COLOURS[e.behaviour],
      Math.round(e.x) + originX,
      Math.round(e.y) + originY,
      e.w,
      e.h,
    );
  }

  const blinkedOut = p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 1;
  if (sim.phase !== "dead" && !blinkedOut) {
    const px = Math.round(p.x) + originX;
    const py = Math.round(p.y) + originY;
    rect(ctx, PLAYER_COLOUR, px, py, p.w, p.h);
    rect(ctx, "#ffffff", p.facing > 0 ? px + p.w - 4 : px + 1, py + 4, 3, 3);
  }
  for (const shot of sim.shots) {
    rect(ctx, SHOT_COLOUR, Math.round(shot.x) + originX, Math.round(shot.y) + originY, SHOT_W, SHOT_H);
  }
  for (const shot of sim.enemyShots) {
    const size = ENEMY_SHOT_SIZE;
    rect(ctx, ENEMY_SHOT_COLOUR, Math.round(shot.x) + originX, Math.round(shot.y) + originY, size, size);
  }

  healthBar(ctx, 16, p.health, sim.settings.maxHealth, "#ffe08a");
  const boss = sim.slots.find((s) => s.entity?.behaviour === "boss")?.entity;
  if (boss) healthBar(ctx, 234, boss.health, num(boss.settings, "health", 28), BOSS_BAR_COLOUR);

  if (sim.phase === "won") {
    rect(ctx, "#000000", 0, 100, SCREEN_W, 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("STAGE CLEAR", SCREEN_W / 2, 126);
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS, including the existing draw tests (the player's health bar still has 28 ticks of 6 by 1); typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/render/draw.ts tests/runtime/render.test.ts
git commit -m "feat: draw enemies, shots, platforms, pickups and the boss"
```

---

### Task 8: Populate the demo level

**Files:**
- Modify: `src/content/demo.ts`, `tests/runtime/demo.test.ts`

**Interfaces:**
- Consumes: `ThingDef` with `behaviour` (Task 1); `placeThing` command (plan 1); everything above
- Produces: `demoPack.things` with ten thing types; the demo level with enemies, pickups, a platform and the boss

The demo's thing types: `walker` "Snow Crawler", `flyer` "Frost Bat", `turret` "Icicle Cannon", `jumper` "Hopper", `shielded` "Shield Guard", `dropper` "Icicle Dropper", `platform` "Moving Platform", `small-health` and `large-health` (both behaviour `health`, amounts 2 and 10), and `boss` "Blizzard Bot".

The bot from plan 2 cannot fight, so the "can be finished" test now runs on the demo level with its things removed: it proves the terrain, as before. A new test runs the full demo with the bot to prove nothing crashes with every behaviour active.

- [ ] **Step 1: Write the failing test**

In `tests/runtime/demo.test.ts`, add `import type { Project } from "@/model/schema";` and `import { entity } from "./simHelpers";` to the imports, add this helper above the `describe`:

```ts
// The demo with every thing removed, for the bot, which cannot fight.
function terrainOnly(project: Project): Project {
  return {
    ...project,
    levels: project.levels.map((level) => ({
      ...level,
      zones: level.zones.map((zone) => ({ ...zone, things: [] })),
    })),
  };
}
```

change `createSim(createDemoProject(), DEMO_LEVEL_ID, demoPack)` to `createSim(terrainOnly(createDemoProject()), DEMO_LEVEL_ID, demoPack)` in the two existing bot tests, and add these tests inside the `describe`:

```ts
  it("has enemies, pickups, a platform and the boss", () => {
    const zones = createDemoProject().levels[0].zones;
    const types = zones.flatMap((z) => z.things.map((t) => t.type));
    for (const type of ["walker", "flyer", "turret", "jumper", "shielded", "dropper", "platform", "small-health", "large-health"]) {
      expect(types).toContain(type);
    }
    expect(zones[zones.length - 1].things.map((t) => t.type)).toEqual(["boss"]);
  });

  it("runs with every thing active without crashing", () => {
    const sim = createSim(createDemoProject(), DEMO_LEVEL_ID, demoPack);
    for (let i = 0; i < 3000; i++) step(sim, botInput(sim));
    expect(sim.steps).toBe(3000);
    expect(Number.isFinite(sim.player.x)).toBe(true);
    expect(Number.isFinite(sim.player.y)).toBe(true);
  });

  it("starts the boss fight in the boss room", () => {
    const sim = createSim(createDemoProject(), DEMO_LEVEL_ID, demoPack, { startZoneId: "boss" });
    expect(entity(sim, "boss")).toMatchObject({ mode: "intro", health: 28 });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/runtime/demo.test.ts`
Expected: FAIL. The demo has no things, so "has enemies..." and "starts the boss fight" fail.

- [ ] **Step 3: Add the things to the demo**

In `src/content/demo.ts`, replace `things: [],` in `demoPack` with:

```ts
  things: [
    { type: "walker", name: "Snow Crawler", category: "enemy", behaviour: "walker", description: "Patrols back and forth.", defaults: { speed: 0.5 } },
    { type: "flyer", name: "Frost Bat", category: "enemy", behaviour: "flyer", description: "Swoops toward you.", defaults: {} },
    { type: "turret", name: "Icicle Cannon", category: "enemy", behaviour: "turret", description: "Fires icicles at you.", defaults: {} },
    { type: "jumper", name: "Hopper", category: "enemy", behaviour: "jumper", description: "Hops toward you.", defaults: {} },
    { type: "shielded", name: "Shield Guard", category: "enemy", behaviour: "shielded", description: "Blocks shots until it opens up.", defaults: {} },
    { type: "dropper", name: "Icicle Dropper", category: "enemy", behaviour: "dropper", description: "Drops when you pass underneath.", defaults: {} },
    { type: "platform", name: "Moving Platform", category: "platform", behaviour: "platform", description: "Slides back and forth.", defaults: { axis: "x", distance: 4, speed: 0.5 } },
    { type: "small-health", name: "Small Health", category: "pickup", behaviour: "health", description: "Restores a little health.", defaults: { amount: 2 } },
    { type: "large-health", name: "Large Health", category: "pickup", behaviour: "health", description: "Restores a lot of health.", defaults: { amount: 10 } },
    { type: "boss", name: "Blizzard Bot", category: "boss", behaviour: "boss", description: "The stage boss.", defaults: { health: 28 } },
  ],
```

Add this helper below `fill`:

```ts
const place = (zoneId: string, thingId: string, type: string, x: number, y: number): Command => ({
  name: "placeThing",
  args: { levelId: L, zoneId, thingId, type, x, y },
});
```

Append these commands to the end of `COMMANDS`:

```ts
  // Things.
  place("path", "crawler", "walker", 14, 12),
  place("path", "health", "small-health", 22, 12),
  place("path", "lift", "platform", 26, 8),
  place("path", "bat", "flyer", 30, 6),
  place("path", "hopper", "jumper", 44, 12),
  place("cave", "health", "large-health", 5, 12),
  place("cave", "cannon", "turret", 15, 9),
  place("cave", "guard", "shielded", 20, 12),
  place("cave", "dropper", "dropper", 24, 4),
  place("shaft", "bat", "flyer", 10, 15),
  place("corridor", "health", "small-health", 8, 12),
  place("boss", "boss", "boss", 12, 12),
```

- [ ] **Step 4: Run every check**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: every test file PASSES; typecheck and lint report nothing; the build completes and lists `/` and `/play`.

- [ ] **Step 5: Commit**

```bash
git add src/content/demo.ts tests/runtime/demo.test.ts
git commit -m "feat: add enemies, pickups, a platform and the boss to the demo"
```

---

## Done when

- `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all succeed.
- The demo terrain is still finishable by the bot, and the full demo runs 3000 bot steps without errors.
- `src/runtime/sim/` contains no React, Next.js, DOM or random-value code.
- A person has played `/play` through to the boss and confirmed the fight is winnable and the enemies feel fair. This is the check the automated tests cannot make.

Plan 4 (snow pack, pieces, checker) builds on `ThingDef.behaviour`, the thing settings each behaviour reads, `spawnBox`, and the player physics from plan 2.
