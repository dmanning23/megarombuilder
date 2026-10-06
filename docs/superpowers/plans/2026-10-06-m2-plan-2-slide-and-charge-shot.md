# Slide and Charge Shot Implementation Plan (Milestone 2, Plan 2 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hero's two new moves real: slide (down and jump: low and fast along the ground, through one-tile gaps) and charge shot (hold shoot, release a big shot that does 3 damage and carries on through what it destroys), in the game, the checker and the level pieces.

**Architecture:** The hero's computed physics (`PlayerSettings`) gain `slide` and `chargeShot` flags from the abilities. The simulation gets a slide module (a low 14×14 body, a timer, standing up only where there is room) and charge handling in the shots module. The renderer draws the slide pose, charged shots and a charging flash. The checker gains "slide left/right" moves and a reason for gaps too low to walk through. A new crawl-space piece is marked as needing slide; the pieces palette and the assistant's catalogue say so.

**Tech Stack:** as plan 1. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-milestone-2-your-own-hero-design.md` (section 5, and sections 9 and 10 where they cover slide and charge shot; build order item 2)

**Plan series for milestone 2:**

1. Hero data and abilities (done)
2. Slide and charge shot (this plan)
3. The hero screen
4. Picture import
5. The assistant

## Global Constraints

- Model, commands, the simulation and the checker stay plain TypeScript: no React, no DOM, no randomness.
- The standing body stays 14×22; the sliding body is 14×14 (spec section 3).
- The checker plays moves in the real simulation; it never models physics separately.
- A hero without slide or charge shot plays exactly as before.
- Interface text is short, plain and in sentence case.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **Slide numbers:** 26 steps at 2.5 px/step, about 4 tiles; faster than the fastest run (1.875).
- **Starting a slide:** down held and jump pressed, standing on the ground, not on a ladder, not knocked back. A ladder below takes priority (down grabs it, as now). Without slide, down and jump is an ordinary jump, as now.
- **During a slide:** pressing the other direction turns the slide round (so a slide that ends against a wall under a low ceiling is never stuck). No shooting. The slide ends when its time is up, when it hits a wall, when the hero leaves the ground, or when jump is pressed, but only where a standing body fits; otherwise it carries on.
- **Jumping out of a slide** stands up and jumps in the same step, when there is room.
- **Leaving a zone or respawning** always ends a slide; a checkpoint touched while sliding saves a standing position.
- **Charge shot:** pressing shoot fires a normal shot at once, as now. Holding shoot for 60 steps (one second) charges; releasing then fires a charged shot. Releasing earlier fires nothing more. Charging carries on while sliding, but a release mid-slide is lost (no shooting while sliding).
- **The charged shot** is 12×10, as fast as a normal shot, does 3 damage, and always fires: it is not held back by the shots-on-screen limit. When it destroys what it hits, it carries on; otherwise it is used up. Shields and a flashing or arriving boss stop it, as they stop normal shots.
- **The charging flash:** once fully charged, the hero blinks white every 4 steps (a white-silhouette version of the hero, drawn by the game).
- **A slide is not counted as a jump** by the checker, so it does not make a zone look harder.
- **The crawl-space piece:** a tunnel one tile high, 2 to 8 tiles long (default 4), with two tiles of floor before and after, under solid ground filling rows 0–11. `PieceDef` gains `needs?: "slide"`. The checker tests give the hero slide for pieces that need it.
- **The palette greys out pieces that need slide** when the hero can't slide, with the note "Needs slide". The assistant's catalogue adds "Needs slide." to the piece. Teaching the assistant when to use it is plan 5.

## Review Focus

1. **Sliding into a low tunnel that ends at a wall** (a dead end): the hero can turn round and slide back out, never stuck for good. Tested in Task 1.
2. **Sliding off the right exit or through a checkpoint**: the next zone and the respawn point have a standing hero, not one buried in the floor or floating. Tested in Task 1.
3. **Holding shoot with the shots-on-screen limit full**: the charged shot still fires on release. Tested in Task 2.
4. **A charged shot that destroys one enemy with another just behind it**: both are hit; a charged shot that doesn't destroy its target stops there. Tested in Task 2.
5. **A crawl space with no slide**: the checker says plainly why the zone fails and what to do. Tested in Task 3.

## File Structure

```
src/model/hero.ts                   heroPhysics gives slide and chargeShot
src/model/schema.ts                 PlayerSettings gains slide and chargeShot; DEFAULT_PLAYER too
src/model/contentPack.ts            PieceDef gains needs?: "slide"
src/runtime/sim/constants.ts        slide and charge numbers
src/runtime/sim/state.ts            Player gains slide and charge; Shot gains charged
src/runtime/sim/slide.ts            sliding, roomToStand, startSlide, standUp
src/runtime/sim/player.ts           starting and stepping a slide
src/runtime/sim/shots.ts            shotSize; no shooting while sliding; charging and the charged shot
src/runtime/sim/combat.ts           charged damage and carrying on
src/runtime/sim/step.ts             charging each step
src/runtime/sim/edges.ts, hazards.ts   leaving a zone, respawning and checkpoints end a slide
src/runtime/render/art.ts           the slide pose
src/runtime/render/heroArt.ts       a white flash palette
src/runtime/render/draw.ts          charged shots and the charging flash
src/runtime/render/PlayCanvas.tsx   the flash image maker
src/checker/moves.ts                slide moves
src/checker/passage.ts              a slide is not a jump
src/checker/reasons.ts              gaps too low to walk through
src/content/snow/pieces.ts          the crawl-space piece
src/ai/describe.ts                  "Needs slide." in the catalogue
src/editor/components/Palette.tsx   greys out pieces the hero can't use
src/editor/Editor.tsx               tells the palette whether the hero can slide
tests/...                           named in each task
```

---

### Task 1: Sliding

**Files:**
- Modify: `src/model/hero.ts`, `src/model/schema.ts`, `src/runtime/sim/constants.ts`, `src/runtime/sim/state.ts`, `src/runtime/sim/player.ts`, `src/runtime/sim/shots.ts`, `src/runtime/sim/edges.ts`, `src/runtime/sim/hazards.ts`, `src/runtime/render/art.ts`
- Create: `src/runtime/sim/slide.ts`
- Modify tests: `tests/model/factory.test.ts`, `tests/runtime/art.test.ts`
- Test: `tests/runtime/slide.test.ts`

**Interfaces:**
- Consumes: `heroPhysics`, `Abilities` (plan 1); `moveX`/`moveY` physics, `TileMap`, `isSolid`, `firstTile`, `lastTile` (milestone 1)
- Produces:
  - `PlayerSettings` gains `slide: boolean; chargeShot: boolean` (from the abilities; `DEFAULT_PLAYER` has both `false`)
  - constants `SLIDE_H = 14`, `SLIDE_STEPS = 26`, `SLIDE_SPEED = 2.5`
  - `Player` gains `slide: number` (steps left of a slide's own length) and `charge: number` (used in Task 2; 0 here)
  - `src/runtime/sim/slide.ts`: `sliding(p: Player): boolean` (the body is low), `roomToStand(map: TileMap, p: Player): boolean`, `startSlide(p: Player): void`, `standUp(p: Player): void`
  - `playerPose` returns `"slide"` while sliding

- [ ] **Step 1: Write the failing tests**

`tests/runtime/slide.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Abilities } from "@/model/hero";
import type { Checkpoint } from "@/model/schema";
import { playerPose } from "@/runtime/render/art";
import { PLAYER_H, SLIDE_H } from "@/runtime/sim/constants";
import { createSim, type Sim } from "@/runtime/sim/state";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith, type ZoneArt } from "./helpers";
import { run, runUntil } from "./simHelpers";

function sim(zones: ZoneArt[], changes: Partial<Abilities> = { slide: true }, checkpoints: Checkpoint[] = []): Sim {
  const project = projectFromArt(zones, checkpoints);
  const hero = { ...project.hero, abilities: { ...project.hero.abilities, ...changes } };
  const s = createSim({ ...project, hero }, "L1", testPack);
  run(s, {}, 5); // land on the floor
  return s;
}

// Solid ground in rows 0 to 11 of columns `from` to `to`: a tunnel one tile high over the floor.
function tunnel(from: number, to: number): Record<number, string> {
  const cells: Record<number, string> = {};
  for (let c = from; c <= to; c++) cells[c] = "#";
  return Object.fromEntries(Array.from({ length: 12 }, (_, y) => [y, rowWith(cells)]));
}

const slideRight = (s: Sim) => {
  run(s, { right: true, down: true }, 1);
  run(s, { down: true, jump: true }, 1);
};
const standing = (s: Sim) => s.player.h === PLAYER_H && s.player.onGround && Math.abs(s.player.vx) < 0.01;

describe("sliding", () => {
  it("is an ordinary jump without the ability", () => {
    const s = sim([{ art: flatArt() }], {});
    run(s, { down: true, jump: true }, 1);
    expect(s.player.h).toBe(PLAYER_H);
    expect(s.player.vy).toBeLessThan(0);
  });

  it("goes low and fast, about four tiles, then stands up", () => {
    const s = sim([{ art: flatArt() }]);
    const start = s.player.x;
    slideRight(s);
    expect(s.player.h).toBe(SLIDE_H);
    expect(s.player.vx).toBeGreaterThan(1.875);
    expect(playerPose(s.player, s.steps).pose).toBe("slide");
    runUntil(s, {}, standing);
    expect(s.player.x - start).toBeGreaterThan(56);
    expect(s.player.x - start).toBeLessThan(76);
    expect(s.player.onGround).toBe(true);
  });

  it("fits through a one-tile gap that stops a walking hero", () => {
    const walker = sim([{ art: flatArt(tunnel(3, 4)) }]);
    run(walker, { right: true }, 60);
    expect(walker.player.x).toBe(3 * 16 - 14);

    const slider = sim([{ art: flatArt(tunnel(3, 4)) }]);
    slideRight(slider);
    runUntil(slider, {}, standing);
    expect(slider.player.x).toBeGreaterThanOrEqual(5 * 16);
  });

  it("keeps sliding under a long low ceiling until there is room to stand", () => {
    const s = sim([{ art: flatArt(tunnel(2, 9)) }]);
    slideRight(s);
    runUntil(s, {}, standing);
    expect(s.player.x).toBeGreaterThanOrEqual(10 * 16);
  });

  it("can turn round in a dead end and slide back out", () => {
    const dead = flatArt({ ...tunnel(2, 9), 12: rowWith({ 8: "#" }) }); // a wall at column 8 inside the tunnel
    const s = sim([{ art: dead }]);
    slideRight(s);
    run(s, {}, 60);
    expect(s.player.h).toBe(SLIDE_H); // stuck against the wall, no room to stand
    runUntil(s, { left: true }, (x) => x.player.h === PLAYER_H);
    expect(s.player.x).toBeLessThan(2 * 16);
  });

  it("stands up and falls when it slides off a ledge", () => {
    const ledge = flatArt({ 13: "###............." }); // shorter than one slide
    const s = sim([{ art: ledge }]);
    slideRight(s);
    runUntil(s, {}, standing);
    expect(s.player.h).toBe(PLAYER_H);
    expect(s.player.y).toBe(14 * 16 - PLAYER_H);
  });

  it("jumps out with room to stand", () => {
    const s = sim([{ art: flatArt() }]);
    slideRight(s);
    run(s, {}, 2);
    run(s, { jump: true }, 1);
    expect(s.player.h).toBe(PLAYER_H);
    expect(s.player.vy).toBeLessThan(0);
  });

  it("cannot start in the air", () => {
    const s = sim([{ art: flatArt() }]);
    run(s, { jump: true }, 5);
    run(s, { jump: false }, 1);
    run(s, { down: true, jump: true }, 1);
    expect(s.player.h).toBe(PLAYER_H);
  });

  it("cannot shoot while sliding", () => {
    const s = sim([{ art: flatArt() }]);
    slideRight(s);
    run(s, { shoot: true }, 1);
    expect(s.shots).toEqual([]);
  });

  it("saves a standing respawn point when it slides through a checkpoint", () => {
    const s = sim([{ art: flatArt() }], { slide: true }, [{ zoneId: "z1", x: 3, y: 12 }]);
    slideRight(s);
    runUntil(s, {}, standing);
    expect(s.respawn.y).toBe(13 * 16 - PLAYER_H);
  });

  it("stands up when it slides out of the zone", () => {
    const s = sim([{ art: flatArt() }, { art: flatArt() }]);
    runUntil(s, { right: true }, (x) => x.player.x > 190);
    run(s, { right: true, down: true }, 1);
    run(s, { down: true, jump: true }, 1);
    runUntil(s, {}, (x) => x.zoneIndex === 1);
    expect(s.player.h).toBe(PLAYER_H);
    expect(s.player.y + s.player.h).toBeLessThanOrEqual(13 * 16);
  });
});
```

In `tests/runtime/art.test.ts`, add `slide: 0,` and `charge: 0,` to the `player()` helper's object (after `shotTimer: 0,`), and add to the `playerPose` tests:

```ts
  it("slides while the body is low", () => {
    expect(playerPose(player({ h: 14, vx: 2.5 }), 0)).toEqual({ pose: "slide", flip: false });
  });
```

In `tests/model/factory.test.ts`, the test "uses the spec's default player numbers" expects `DEFAULT_PLAYER` exactly; add `slide: false,` and `chargeShot: false,` to its expected object.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime/slide.test.ts tests/runtime/art.test.ts tests/model`
Expected: FAIL: `SLIDE_H` is not exported, and nothing slides.

- [ ] **Step 3: Carry the move flags in the physics**

In `src/model/schema.ts`, add to `PlayerSettings`:

```ts
  slide: boolean;
  chargeShot: boolean;
```

and to `DEFAULT_PLAYER`:

```ts
  slide: false,
  chargeShot: false,
```

In `src/model/hero.ts`, add to the object `heroPhysics` returns:

```ts
    slide: abilities.slide,
    chargeShot: abilities.chargeShot,
```

- [ ] **Step 4: The slide itself**

In `src/runtime/sim/constants.ts`, after `PLAYER_H`:

```ts
// Sliding: a low body that fits through one-tile gaps, for about four tiles at more than running speed.
export const SLIDE_H = 14;
export const SLIDE_STEPS = 26;
export const SLIDE_SPEED = 2.5;
```

In `src/runtime/sim/state.ts`, add to `Player` after `shotTimer`:

```ts
  slide: number; // steps left of a slide's own length (it carries on past this under a low ceiling)
  charge: number; // steps shoot has been held, for a charged shot
```

and `slide: 0,` and `charge: 0,` where the player is created in `createSim`.

`src/runtime/sim/slide.ts`:

```ts
import { PLAYER_H, SLIDE_H, SLIDE_STEPS } from "./constants";
import type { Player } from "./state";
import { firstTile, isSolid, lastTile, type TileMap } from "./tilemap";

// Sliding makes the body low. Standing up keeps the feet where they are.
export const sliding = (p: Player): boolean => p.h < PLAYER_H;

// Whether a standing body would fit where the player is, clear of solid tiles.
export function roomToStand(map: TileMap, p: Player): boolean {
  const top = p.y + p.h - PLAYER_H;
  for (let ty = firstTile(top); ty <= lastTile(p.y + p.h); ty++) {
    for (let tx = firstTile(p.x); tx <= lastTile(p.x + p.w); tx++) {
      if (isSolid(map.behaviourAt(tx, ty))) return false;
    }
  }
  return true;
}

export function startSlide(p: Player): void {
  p.y += PLAYER_H - SLIDE_H;
  p.h = SLIDE_H;
  p.slide = SLIDE_STEPS;
}

export function standUp(p: Player): void {
  p.y -= PLAYER_H - p.h;
  p.h = PLAYER_H;
  p.slide = 0;
}
```

In `src/runtime/sim/player.ts`, import `SLIDE_SPEED` from `"./constants"` and `roomToStand, sliding, standUp, startSlide` from `"./slide"`, then add this function above `updatePlayer`:

```ts
// One step of a slide: low and fast in the direction the player faces (pressing the other way turns
// it round). It ends when its time is up, when it hits a wall, when the player leaves the ground or
// presses jump, but only where there is room to stand; until then it carries on.
function slideStep(sim: Sim, dir: number, jumpPressed: boolean): void {
  const { map, player: p, settings } = sim;
  if (p.slide > 0) p.slide--;
  const ending = p.slide === 0 || !p.onGround || jumpPressed;
  if (ending && roomToStand(map, p)) {
    standUp(p);
    p.vx = dir * settings.runSpeed;
    if (jumpPressed && p.onGround) p.vy = -settings.jumpVelocity;
    physics(sim);
    return;
  }
  p.vx = p.facing * SLIDE_SPEED;
  physics(sim);
  if (p.vx === 0) p.slide = 0; // hit a wall: stand up as soon as there is room
}
```

and change `updatePlayer`: at the start of the knocked-back branch,

```ts
  if (p.hurt > 0) {
    if (sliding(p) && roomToStand(map, p)) standUp(p);
```

then, straight after `if (dir !== 0) p.facing = dir > 0 ? 1 : -1;`:

```ts
  if (sliding(p)) {
    slideStep(sim, dir, jumpPressed);
    return;
  }
```

and, straight after the `if (p.onLadder) { climb(…); return; }` block:

```ts
  if (settings.slide && p.onGround && input.down && jumpPressed) {
    startSlide(p);
    slideStep(sim, dir, false);
    return;
  }
```

In `src/runtime/sim/shots.ts`, import `sliding` from `"./slide"` and make the first line of `shoot`:

```ts
  if (sliding(p)) return; // no shooting while sliding
```

(after `const p = sim.player;`).

In `src/runtime/sim/edges.ts`, import `PLAYER_H` from `"./constants"` and, in `leave`, after `const p = sim.player;`:

```ts
  // A slide ends at the edge of a zone: the player arrives standing.
  p.h = PLAYER_H;
  p.slide = 0;
```

In `src/runtime/sim/hazards.ts`, import `PLAYER_H` from `"./constants"`; in `respawn`, add `p.h = PLAYER_H;`, `p.slide = 0;` and `p.charge = 0;` with the other resets; and in `touchCheckpoints` make the saved position standing: `y: top + TILE_SIZE - PLAYER_H,`.

In `src/runtime/render/art.ts`, import `PLAYER_H` from `"@/runtime/sim/constants"` and make the first line of `playerPose` after `const flip = …`:

```ts
  if (p.h < PLAYER_H) return { pose: "slide", flip };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/runtime tests/model && npm run typecheck`
Expected: PASS; typecheck clean. (If typecheck finds another place that builds a `Player` object, add `slide: 0, charge: 0` there.)

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: let a hero with slide slide under one-tile gaps"
```

---
### Task 2: Charge shot

**Files:**
- Modify: `src/runtime/sim/constants.ts`, `src/runtime/sim/state.ts`, `src/runtime/sim/shots.ts`, `src/runtime/sim/combat.ts`, `src/runtime/sim/step.ts`, `src/runtime/render/heroArt.ts`, `src/runtime/render/draw.ts`, `src/runtime/render/PlayCanvas.tsx`
- Modify tests: `tests/runtime/heroArt.test.ts`
- Test: `tests/runtime/charge.test.ts`

**Interfaces:**
- Consumes: `PlayerSettings.chargeShot`, `Player.charge`, `sliding` (Task 1); `HeroArt`, `HeroSkin` (plan 1)
- Produces:
  - constants `CHARGE_STEPS = 60`, `CHARGED_W = 12`, `CHARGED_H = 10`, `CHARGED_DAMAGE = 3`
  - `Shot` gains `charged?: boolean`
  - `shotSize(shot: Shot): { w: number; h: number }` and `chargeShot(sim: Sim, input: Input): void` in `src/runtime/sim/shots.ts`
  - `HeroArt` gains `flashPalette: Record<string, string>`; `HeroSkin` gains `flashImage?: (s: Sprite, flip: boolean) => CanvasImageSource`

- [ ] **Step 1: Write the failing tests**

`tests/runtime/charge.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDemoProject, DEMO_LEVEL_ID } from "@/content/demo";
import { snowArt } from "@/content/snow/art";
import { snowPack } from "@/content/snow/pack";
import type { Abilities } from "@/model/hero";
import type { Sprite } from "@/runtime/render/art";
import { draw } from "@/runtime/render/draw";
import { heroArt } from "@/runtime/render/heroArt";
import { CHARGE_STEPS, CHARGED_H, CHARGED_W } from "@/runtime/sim/constants";
import { createSim, NO_INPUT, type Sim } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import type { Thing } from "@/model/schema";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, thing } from "./helpers";
import { entity, run } from "./simHelpers";

function sim(things: Thing[] = [], changes: Partial<Abilities> = { chargeShot: true }): Sim {
  const project = projectFromArt([{ art: flatArt(), things }]);
  const hero = { ...project.hero, abilities: { ...project.hero.abilities, ...changes } };
  const s = createSim({ ...project, hero }, "L1", testPack);
  run(s, {}, 5);
  return s;
}

// Holds shoot for `steps` steps, then lets go.
function hold(s: Sim, steps: number) {
  run(s, { shoot: true }, steps);
  run(s, {}, 1);
}

const charged = (s: Sim) => s.shots.filter((shot) => shot.charged);

describe("the charge shot", () => {
  it("fires a normal shot on a tap", () => {
    const s = sim();
    hold(s, 1);
    expect(s.shots).toHaveLength(1);
    expect(charged(s)).toEqual([]);
  });

  it("fires a charged shot when shoot is held for a second and let go", () => {
    const s = sim();
    hold(s, CHARGE_STEPS);
    expect(charged(s)).toHaveLength(1);
    expect(s.player.charge).toBe(0);
  });

  it("fires nothing more when let go too soon", () => {
    const s = sim();
    hold(s, CHARGE_STEPS - 10);
    expect(charged(s)).toEqual([]);
  });

  it("does not charge without the ability", () => {
    const s = sim([], {});
    hold(s, CHARGE_STEPS + 20);
    expect(charged(s)).toEqual([]);
    expect(s.player.charge).toBe(0);
  });

  it("fires even when the shots-on-screen limit is full", () => {
    const s = sim([], { chargeShot: true, shots: 1 });
    run(s, { shoot: true }, CHARGE_STEPS);
    s.shots = [{ x: 100, y: 100, vx: 0 }]; // the one allowed shot is on screen
    run(s, {}, 1);
    expect(charged(s)).toHaveLength(1);
  });

  it("does 3 damage, and carries on through an enemy it destroys", () => {
    const s = sim([thing("turret", 8, 12, { interval: 1000 }), thing("turret", 11, 12, { interval: 1000 })]);
    run(s, { shoot: true }, CHARGE_STEPS); // the tap's normal shot hits the first turret: 3 → 2
    run(s, {}, 1);
    run(s, {}, 60);
    expect(s.slots.map((slot) => slot.entity)).toEqual([null, null]);
  });

  it("stops at an enemy it does not destroy", () => {
    const s = sim([thing("turret", 8, 12, { interval: 1000, health: 6 }), thing("turret", 11, 12, { interval: 1000 })]);
    run(s, { shoot: true }, CHARGE_STEPS);
    run(s, {}, 1);
    run(s, {}, 60);
    expect(s.slots[0].entity?.health).toBe(2); // 6 - 1 - 3
    expect(s.slots[1].entity?.health).toBe(3);
    expect(s.shots).toEqual([]);
  });

  it("is stopped by a shield", () => {
    const s = sim([thing("shielded", 8, 12)]);
    run(s, { shoot: true }, CHARGE_STEPS);
    run(s, {}, 1);
    run(s, {}, 40);
    expect(entity(s, "shielded")?.health).toBe(2);
  });

  it("is a 12 by 10 shot", () => {
    const s = sim();
    hold(s, CHARGE_STEPS);
    const shot = charged(s)[0];
    expect(shot.x).toBe(s.player.x + s.player.w + shot.vx); // in front of the hero, one step on
    expect([CHARGED_W, CHARGED_H]).toEqual([12, 10]);
  });
});

describe("drawing the charge", () => {
  const hero = heroArt(createDemoProject().hero.look);
  type Drawn = { sprite: Sprite; flip: boolean; flash?: boolean };

  function drawn(prepare: (s: Sim) => void): Drawn[] {
    const project = createDemoProject();
    const hero2 = { ...project.hero, abilities: { ...project.hero.abilities, chargeShot: true } };
    const s = createSim({ ...project, hero: hero2 }, DEMO_LEVEL_ID, snowPack);
    step(s, NO_INPUT);
    prepare(s);
    const images: Drawn[] = [];
    const ctx = {
      fillStyle: "",
      font: "",
      textAlign: "start" as CanvasTextAlign,
      fillRect: () => {},
      fillText: () => {},
      drawImage: (image: CanvasImageSource) => images.push(image as unknown as Drawn),
    };
    const image = (sprite: Sprite, flip: boolean) => ({ sprite, flip }) as unknown as CanvasImageSource;
    const flashImage = (sprite: Sprite, flip: boolean) => ({ sprite, flip, flash: true }) as unknown as CanvasImageSource;
    draw(ctx, s, { set: snowArt, image, hero: { art: hero, image, flashImage } });
    return images;
  }

  it("blinks the hero white once fully charged", () => {
    const flashing = drawn((s) => {
      s.player.charge = CHARGE_STEPS;
      s.steps = 0;
    });
    expect(flashing).toContainEqual({ sprite: hero.poses.stand, flip: false, flash: true });
    const between = drawn((s) => {
      s.player.charge = CHARGE_STEPS;
      s.steps = 4;
    });
    expect(between).toContainEqual({ sprite: hero.poses.stand, flip: false });
  });

  it("draws charged shots with the charged-shot picture", () => {
    const images = drawn((s) => s.shots.push({ x: 60, y: 180, vx: 4, charged: true }));
    expect(images).toContainEqual({ sprite: hero.chargedShot, flip: false });
  });
});
```

Add to `tests/runtime/heroArt.test.ts`:

```ts
  it("has a white flash palette for every colour", () => {
    expect(Object.keys(art.flashPalette)).toEqual(Object.keys(art.palette));
    expect(new Set(Object.values(art.flashPalette))).toEqual(new Set(["#fcfcfc"]));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime/charge.test.ts tests/runtime/heroArt.test.ts`
Expected: FAIL (`CHARGE_STEPS` is not exported; no charged shots).

- [ ] **Step 3: Charging and the charged shot**

In `src/runtime/sim/constants.ts`, after `SHOT_POSE_STEPS`:

```ts
// Holding shoot for a second charges a big shot: 12 by 10, 3 damage.
export const CHARGE_STEPS = 60;
export const CHARGED_W = 12;
export const CHARGED_H = 10;
export const CHARGED_DAMAGE = 3;
```

In `src/runtime/sim/state.ts`, change `Shot` to:

```ts
export type Shot = { x: number; y: number; vx: number; charged?: boolean };
```

In `src/runtime/sim/shots.ts`, import `CHARGE_STEPS, CHARGED_H, CHARGED_W` from `"./constants"` and `type Input, type Shot` from `"./state"`, and add:

```ts
export const shotSize = (shot: Shot): { w: number; h: number } =>
  shot.charged ? { w: CHARGED_W, h: CHARGED_H } : { w: SHOT_W, h: SHOT_H };

// Holding shoot charges; letting go once fully charged fires a charged shot. It always fires: the
// shots-on-screen limit is for normal shots. A release mid-slide is lost (no shooting while sliding).
export function chargeShot(sim: Sim, input: Input): void {
  const p = sim.player;
  if (!sim.settings.chargeShot) return;
  if (input.shoot) {
    p.charge++; // every step shoot is down, the press included
    return;
  }
  if (!input.shoot && sim.prev.shoot && p.charge >= CHARGE_STEPS && !sliding(p)) {
    sim.shots.push({
      x: p.facing > 0 ? p.x + p.w : p.x - CHARGED_W,
      y: p.y + 5,
      vx: p.facing * SHOT_SPEED,
      charged: true,
    });
    p.shotTimer = SHOT_POSE_STEPS;
  }
  if (!input.shoot) p.charge = 0;
}
```

and make `updateShots` measure each shot by its size:

```ts
export function updateShots(sim: Sim): void {
  const camera = cameraFor(sim);
  sim.shots = sim.shots.filter((shot) => {
    const { w, h } = shotSize(shot);
    shot.x += shot.vx;
    const cx = shot.x + w / 2;
    const cy = shot.y + h / 2;
    if (isSolid(sim.map.behaviourAt(firstTile(cx), firstTile(cy)))) return false;
    return shot.x + w > camera.x && shot.x < camera.x + SCREEN_W;
  });
}
```

In `src/runtime/sim/step.ts`, import `chargeShot` from `"./shots"` and call it straight after the press:

```ts
  if (input.shoot && !sim.prev.shoot) shoot(sim);
  chargeShot(sim, input);
```

In `src/runtime/sim/combat.ts`, import `CHARGED_DAMAGE` from `"./constants"` and `shotSize` from `"./shots"`, and replace `hitEntities` with:

```ts
// Player shots against enemies and the boss. A charged shot does more damage and carries on through
// anything it destroys; any other hit uses the shot up.
export function hitEntities(sim: Sim): void {
  sim.shots = sim.shots.filter((shot) => {
    const box = { x: shot.x, y: shot.y, ...shotSize(shot) };
    for (const slot of sim.slots) {
      const e = slot.entity;
      if (!e || !isTarget(e) || !overlaps(box, e)) continue;
      if (shieldBlocks(e, shot.vx)) return false;
      if (e.behaviour === "boss" && (e.mode === "intro" || e.flash > 0)) return false;
      e.health -= shot.charged ? CHARGED_DAMAGE : 1;
      e.flash = e.behaviour === "boss" ? BOSS_FLASH_STEPS : ENEMY_FLASH_STEPS;
      if (e.health > 0) return false;
      slot.entity = null;
      if (e.behaviour === "boss") sim.phase = "won";
      if (!shot.charged) return false;
    }
    return true;
  });
}
```

(`SHOT_W` and `SHOT_H` may now be unused in `combat.ts`; remove them from its import if so.)

- [ ] **Step 4: Drawing the charge**

In `src/runtime/render/heroArt.ts`, add `flashPalette: Record<string, string>;` to `HeroArt`, and in `heroArt`:

```ts
    flashPalette: Object.fromEntries(look.colours.map((_, i) => [String(i + 1), FLASH_WHITE])),
```

with, above the function:

```ts
// A fully charged hero blinks as a white silhouette.
const FLASH_WHITE = "#fcfcfc";
```

In `src/runtime/render/draw.ts`, import `CHARGE_STEPS` from `"@/runtime/sim/constants"` and `shotSize` from `"@/runtime/sim/shots"`, give `HeroSkin` an optional flash image maker:

```ts
export type HeroSkin = {
  art: HeroArt;
  image: (s: Sprite, flip: boolean) => CanvasImageSource;
  flashImage?: (s: Sprite, flip: boolean) => CanvasImageSource; // the white silhouette, for a full charge
};
```

draw the hero with it every other 4 steps once fully charged:

```ts
    if (skin?.hero) {
      const { pose, flip } = playerPose(p, sim.steps);
      const blink = p.charge >= CHARGE_STEPS && Math.floor(sim.steps / 4) % 2 === 0;
      const image = blink && skin.hero.flashImage ? skin.hero.flashImage : skin.hero.image;
      onBox(ctx, image, skin.hero.art.poses[pose], flip, p, originX, originY);
    } else {
```

and draw each shot at its own size and picture:

```ts
  for (const shot of sim.shots) {
    const x = Math.round(shot.x) + originX;
    const y = Math.round(shot.y) + originY;
    if (skin?.hero) {
      const picture = shot.charged ? skin.hero.art.chargedShot : skin.hero.art.shot;
      ctx.drawImage(skin.hero.image(picture, shot.vx < 0), x, y);
    } else {
      const { w, h } = shotSize(shot);
      rect(ctx, SHOT_COLOUR, x, y, w, h);
    }
  }
```

(`SHOT_W` and `SHOT_H` may now be unused in `draw.ts`; remove them from its import if so.)

In `src/runtime/render/PlayCanvas.tsx`, add the flash image maker to the hero skin:

```ts
          hero: {
            art: hero,
            image: createSpriteCache(hero.palette, browserCanvas),
            flashImage: createSpriteCache(hero.flashPalette, browserCanvas),
          },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: let a hero with charge shot hold fire for a big shot that carries on through what it destroys"
```

---

### Task 3: The checker learns to slide

**Files:**
- Modify: `src/checker/moves.ts`, `src/checker/passage.ts`, `src/checker/reasons.ts`
- Test: `tests/checker/slide.test.ts`

**Interfaces:**
- Consumes: `PlayerSettings.slide`, `PLAYER_H` (Task 1); `findPassage`, `createProbe`, `reset`, `leftZone`, `stuckReason` (milestone 1)
- Produces:
  - moves `slide left` and `slide right` (only when the hero can slide and is on the ground), not counted as jumps
  - `stuckReason` names a gap too low to walk through, and suggests slide when the hero lacks it

- [ ] **Step 1: Write the failing test**

`tests/checker/slide.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findPassage, type Passage } from "@/checker/passage";
import { createProbe, leftZone, reset } from "@/checker/probe";
import { stuckReason } from "@/checker/reasons";
import { DEFAULT_PLAYER, type PlayerSettings, type Zone } from "@/model/schema";
import { step } from "@/runtime/sim/step";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith } from "../runtime/helpers";

// A floor with a tunnel one tile high under solid ground in columns 6 to 9.
const cells = Object.fromEntries([6, 7, 8, 9].map((c) => [c, "#"]));
const art = flatArt(Object.fromEntries(Array.from({ length: 12 }, (_, y) => [y, rowWith(cells)])));
const zone: Zone = projectFromArt([{ art }]).levels[0].zones[0];
const withSlide: PlayerSettings = { ...DEFAULT_PLAYER, slide: true };

function replays(found: Passage, settings: PlayerSettings): boolean {
  const probe = createProbe(zone, testPack, settings);
  if (!found.start) return false;
  reset(probe, found.start);
  for (const input of found.route) {
    step(probe.sim, input);
    if (leftZone(probe.sim)) return true;
  }
  return false;
}

describe("the checker and slide", () => {
  it("finds a way through a crawl space only when the hero can slide", () => {
    expect(findPassage(zone, testPack, DEFAULT_PLAYER).passable).toBe(false);
    const found = findPassage(zone, testPack, withSlide);
    expect(found.passable).toBe(true);
    expect(found.moves.some((m) => m.startsWith("slide"))).toBe(true);
  });

  it("does not count a slide as a jump", () => {
    expect(findPassage(zone, testPack, withSlide).jumps).toBe(0);
  });

  it("finds a route that replays in the game", () => {
    const found = findPassage(zone, testPack, withSlide);
    expect(replays(found, withSlide)).toBe(true);
  });

  it("says why a hero without slide is stuck, and what to do", () => {
    const found = findPassage(zone, testPack, DEFAULT_PLAYER);
    const reason = stuckReason(createProbe(zone, testPack, DEFAULT_PLAYER), found.furthest!, DEFAULT_PLAYER);
    expect(reason).toBe(
      "Cannot get past column 5: the gap at column 6 is too low to walk through. Give your hero slide, or make the gap taller.",
    );
  });

  it("does not suggest slide to a hero who has it", () => {
    const blocked = flatArt({
      ...Object.fromEntries(Array.from({ length: 12 }, (_, y) => [y, rowWith(cells)])),
      12: rowWith({ 8: "#" }), // the tunnel is blocked inside
    });
    const shut: Zone = projectFromArt([{ art: blocked }]).levels[0].zones[0];
    const found = findPassage(shut, testPack, withSlide);
    expect(found.passable).toBe(false);
    const reason = stuckReason(createProbe(shut, testPack, withSlide), found.furthest!, withSlide);
    expect(reason).not.toMatch(/Give your hero slide/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/checker/slide.test.ts`
Expected: FAIL: no route with slide, and the reason talks about a wall.

- [ ] **Step 3: Slide moves**

In `src/checker/moves.ts`, import `PLAYER_H` from `"@/runtime/sim/constants"` and add:

```ts
// Slides from where the player stands, then waits until they are standing again.
const slide = (d: -1 | 1): Move => ({
  name: `slide ${side(d)}`,
  jump: false,
  when: (sim) => sim.settings.slide && sim.player.onGround,
  start: () => (sim, t) => {
    if (t === 0) return keys({ ...toward(d), down: true }); // face that way
    if (t === 1) return keys({ down: true, jump: true });
    if (sim.player.h < PLAYER_H && t < 600) return NO_INPUT;
    return null;
  },
});
```

and add `slide(1), slide(-1),` to `MOVES` after `walk(-1),`.

In `src/checker/passage.ts`, count a move as a jump only if it is a jumping move and jump was pressed (a slide presses jump too):

```ts
        const jumped = move.jump && out.inputs.some((i) => i.jump);
```

- [ ] **Step 4: The reason for a low gap**

In `src/checker/reasons.ts`, inside `stuckReason`'s loop over columns, before the wall check:

```ts
    if (!isSolid(map.behaviourAt(c, surface - 1)) && isSolid(map.behaviourAt(c, surface - 2))) {
      const advice = settings.slide ? "" : " Give your hero slide, or make the gap taller.";
      return `Cannot get past column ${col}: the gap at column ${c} is too low to walk through.${advice}`;
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/checker && npm run typecheck`
Expected: PASS, including every existing checker test (no zone without low gaps changes verdict).

- [ ] **Step 6: Commit**

```bash
git add src/checker tests/checker/slide.test.ts
git commit -m "feat: teach the checker to slide, and to explain gaps too low to walk through"
```

---

### Task 4: The crawl-space piece

**Files:**
- Modify: `src/model/contentPack.ts`, `src/content/snow/pieces.ts`, `src/ai/describe.ts`, `src/editor/components/Palette.tsx`, `src/editor/Editor.tsx`
- Modify tests: `tests/checker/pieceHarness.ts`, `tests/checker/pieces.test.ts`, `tests/ai/describe.test.ts`
- Test: `tests/editor/palettePieces.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 and 3; `zoneWithPiece`, `settingCombos` (milestone 1 test harness)
- Produces:
  - `PieceDef.needs?: "slide"`
  - the `crawl-space` piece (setting `length` 2 to 8, default 4)
  - `Palette` gains the prop `canSlide?: boolean` (default `false`)

- [ ] **Step 1: Write the failing tests**

In `tests/checker/pieceHarness.ts`, give the hero slide when the piece needs it: replace the last line of `zoneWithPiece`, `  return project;`, with

```ts
  // A piece that needs a move is checked with a hero that has it.
  if (piece.needs !== "slide") return project;
  return { ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, slide: true } } };
```

In `tests/checker/pieces.test.ts`: add `"crawl-space"` to `EXPECTED`; change the test "has twelve pieces with different ids" to thirteen (`toHaveLength(13)` and `.size).toBe(13)`), renaming it "has thirteen pieces with different ids"; and add:

```ts
  it("say which need slide, and a crawl space cannot be crossed without it", () => {
    const crawl = snowPieces.find((p) => p.id === "crawl-space")!;
    expect(crawl.needs).toBe("slide");
    expect(snowPieces.filter((p) => p.needs).map((p) => p.id)).toEqual(["crawl-space"]);
    const project = zoneWithPiece(crawl, { length: 4 });
    const noSlide = { ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, slide: false } } };
    const result = checkZone(noSlide, "L", "z", snowPack);
    expect(result.passable).toBe(false);
    expect(result.reason).toMatch(/too low to walk through\. Give your hero slide/);
  });

  it("build a crawl space one tile high under solid ground, with floor before and after", () => {
    const built = snowPieces.find((p) => p.id === "crawl-space")!.build({ length: 3 });
    expect(built.width).toBe(7);
    const at = (x: number, y: number) => built.tiles[y * built.width + x];
    expect([at(0, 12), at(1, 12), at(5, 12), at(6, 12)]).toEqual([0, 0, 0, 0]); // room to stand before and after
    for (let x = 2; x <= 4; x++) {
      expect(at(x, 12), `tunnel at ${x}`).toBe(0);
      expect(at(x, 11), `ceiling at ${x}`).not.toBe(0);
      expect(at(x, 0), `ceiling top at ${x}`).not.toBe(0);
    }
    for (let x = 0; x < 7; x++) expect(at(x, 13)).not.toBe(0);
  });
```

In `tests/ai/describe.test.ts`, in "lists every tile, thing and piece…", add:

```ts
    expect(text).toMatch(/- crawl-space: Crawl space\. .* Needs slide\./);
```

`tests/editor/palettePieces.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowPack } from "@/content/snow/pack";
import { Palette } from "@/editor/components/Palette";

afterEach(cleanup);

async function pieces(canSlide: boolean) {
  const onTool = vi.fn();
  render(<Palette pack={snowPack} tool={{ kind: "erase" }} onTool={onTool} canSlide={canSlide} />);
  await userEvent.click(screen.getByRole("tab", { name: "Pieces" }));
  return onTool;
}

describe("pieces that need slide", () => {
  it("are greyed out, with a note, when the hero can't slide", async () => {
    const onTool = await pieces(false);
    const crawl = screen.getByRole("button", { name: /Crawl space/ });
    expect(crawl).toHaveProperty("disabled", true);
    expect(crawl.textContent).toContain("Needs slide");
    await userEvent.click(crawl);
    expect(onTool).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Gap/ })).toHaveProperty("disabled", false);
  });

  it("can be used when the hero can slide", async () => {
    const onTool = await pieces(true);
    await userEvent.click(screen.getByRole("button", { name: /Crawl space/ }));
    expect(onTool).toHaveBeenCalledWith({ kind: "piece", pieceId: "crawl-space", settings: { length: 4 } });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/checker/pieces.test.ts tests/ai/describe.test.ts tests/editor/palettePieces.test.tsx`
Expected: FAIL (no crawl-space piece; `needs` does not exist).

- [ ] **Step 3: The piece**

In `src/model/contentPack.ts`, add to `PieceDef` after `settings`:

```ts
  needs?: "slide"; // a move the hero must have to get through it
```

In `src/content/snow/pieces.ts`, add to `snowPieces` (after `rest-area`):

```ts
  {
    id: "crawl-space",
    name: "Crawl space",
    description: "A tunnel one tile high that the hero has to slide through.",
    settings: [setting("length", "How many tiles long the tunnel is", 2, 8, 4)],
    needs: "slide",
    build: ({ length }) => {
      const g = new Grid(length + 4);
      g.ground(0, length + 3, FLOOR);
      g.fill(2, 0, length, FLOOR - 1, GROUND); // solid down to the row above the tunnel
      return g.done();
    },
  },
```

- [ ] **Step 4: Say so in the catalogue and the palette**

In `src/ai/describe.ts`, in `pieceLine`, end the line with the need:

```ts
  const needs = piece.needs === "slide" ? " Needs slide." : "";
  return `- ${piece.id}: ${piece.name}. ${piece.description} ${built.width} tiles wide at its default settings.${settings}${needs}`;
```

In `src/editor/components/Palette.tsx`, add `canSlide?: boolean` to `Props`, take `canSlide = false`, and render piece buttons as:

```tsx
        {tab === "pieces" &&
          pack.pieces.map((p) => {
            const locked = p.needs === "slide" && !canSlide;
            return (
              <button
                key={p.id}
                type="button"
                className={styles.swatch}
                disabled={locked}
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
                {locked && <span className={styles.needs}>Needs slide</span>}
              </button>
            );
          })}
```

In `src/editor/editor.module.css`, add:

```css
.swatch:disabled {
  opacity: 0.5;
  cursor: default;
}
.needs {
  display: block;
  font-size: 13px;
  font-weight: 400;
}
```

In `src/editor/Editor.tsx`, pass the hero's slide to the palette:

```tsx
          <Palette
            pack={pack}
            art={art}
            tool={state.tool}
            canSlide={project.hero.abilities.slide}
            onTool={(tool) => dispatch({ type: "tool", tool })}
          />
```

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass (8 browser tests).

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: add the crawl-space piece, marked as needing slide in the palette and the catalogue"
```

---

## Self-review

- **Spec coverage (section 5):** slide control, movement, low ceilings, jumping and falling, no shooting, checker moves and reason → Tasks 1 and 3; crawl-space piece, catalogue and palette marks → Task 4; charge shot control, damage, carrying on, shields, the glow → Task 2; "checker and difficulty unchanged" for charge → no checker change in Task 2. Section 10's slide, charge and crawl-space tests → Tasks 1–4.
- **Types:** `PlayerSettings.slide`/`chargeShot`, `Player.slide`/`charge`, `Shot.charged`, `HeroArt.flashPalette`, `HeroSkin.flashImage`, `PieceDef.needs` are defined once and used with the same names.
- **Known limits, accepted:** a crawl space placed right at a zone's way in kills a hero arriving under it (the checker reports the zone as failing at its entry); the slide is 26 steps on any ground, ice included.
