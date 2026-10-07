# Animations in the Game Implementation Plan (Milestone 4, Plan 2 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The hero, the kid's enemies and the kid's boss play their looks' animations in the game and in every preview: any number of frames from 1 to 8, at slow, normal or fast, looping or played once and held, with the climb stepping by distance, and today's games looking exactly as they do now.

**Architecture:** The simulation gains two counters the drawing needs: the hero's steps in the air, and each entity's steps in its current mode. A new pure module, `src/runtime/render/animate.ts`, picks which animation and frame a character shows (`heroShown`, `entityShown`) from those counters and the step count. The hero's art and the kid's skins carry every animation's sprites; `draw` shows what `heroShown` and `entityShown` pick. Until the editor can draw "Run and shoot" (plan 4), the hero screen keeps it in step with Run.

**Tech Stack:** as plan 1. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-07-milestone-4-characters-that-fit-design.md` (section 3, "Animation playback"; section 5; section 9, "Animation"; build order item 2)

**Plan series for milestone 4:**

1. The shared look, format 4, the upgrade, the look commands (done)
2. Animations in the game (this plan)
3. Sizes, bodies and shot points in the game
4. The editor: animations, frames, play, onion skin, 16 colours
5. The editor: size, hitbox, shot marker

## Global Constraints

- Today's games look and play exactly as they do now: an upgraded look shows the same picture at every step as before.
- The simulation stays deterministic; frames are picked from step counts and positions only.
- Model, commands, the simulation and the checker have no React, no DOM and no randomness.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **Frame timing:** a frame lasts `round(base × factor)` steps, where base is 6 for the hero's run and run-and-shoot and 8 for everything else, and factor is 1.5 (slow), 1 (normal) or ⅔ (fast): run 9 / 6 / 4 steps, others 12 / 8 / 5 (the spec's numbers).
- **What each character shows:**

  | Character | Shows (in order of priority) |
  |---|---|
  | Hero | slide while the body is low; hurt while knocked back; climb on a ladder; jump or jumpShoot in the air; run or runShoot while moving; stand or standShoot |
  | Walker / flyer / turret | walk / fly / idle |
  | Hopper | ground on the ground, air in the air |
  | Shield guard | open while open, otherwise closed |
  | Dropper | hang while hanging, otherwise fall |
  | Boss | jump while jumping; attack while spreading, aiming, raining or firing big; otherwise stand |
  | Hero's shots | shot, chargedShot |

  The shooting versions show while the hero's shot timer runs, as today.
- **Looping or once:** jump, jumpShoot, hurt, and the boss's jump and attack play once from their first frame and hold the last; the rest loop. A once-through animation counts from when its pose started: the hero's steps in the air (`airSteps`), the knockback so far (`HURT_STEPS − hurt`), the boss's steps in its mode (`modeSteps`). Loops count the game's steps, as today, so a loop's frames line up with today's exactly.
- **Climbing** steps one frame every 8 pixels climbed. A one-frame climb mirrors every 8 pixels, as today; with more frames there is no mirroring.
- **The content pack's own characters** (the snow enemies and the Blizzard Bot that a kid places from the palette) keep drawing from the pack's art set, as now. The spec asks for one drawing path through looks, but a look's colours are snapped to the 8-bit palette, so drawing the snow enemies from looks would shift their colours: a visible change. They aren't editable, so animations don't matter for them.
- **Run and shoot follows Run** until the hero screen can show it (plan 4): drawing on Run 1 or Run 2 writes the same frame of runShoot in the same undo step. (This settles plan 1's deferred item about runShoot going stale.)

## Review Focus

1. **A hero who lands and jumps again at once:** the jump animation starts from its first frame on the new jump. Tested in Task 1.
2. **A boss that goes from one attack straight into another of the same kind (aimed, aimed):** the attack animation starts again from its first frame. Tested in Task 1.
3. **A one-frame animation at any speed and any step:** always frame 0 (no division by zero, no out-of-range index). Tested in Task 2.
4. **A character climbing up and then down a ladder:** the frame follows its height, so going back down plays the frames backwards. Tested in Task 2.
5. **A kid's enemy blinking after a hit:** it blinks as today, whatever animation it's in. Tested in Task 3.

## File Structure

```
src/runtime/sim/state.ts                Player.airSteps
src/runtime/sim/step.ts                 counts airSteps
src/runtime/sim/entities/types.ts       Entity.modeSteps
src/runtime/sim/entities/enemies.ts     counts modeSteps
src/runtime/sim/entities/spawn.ts       modeSteps starts at 0
src/runtime/render/animate.ts           frameSteps, pickFrame, heroShown, entityShown
src/runtime/render/heroArt.ts           HeroArt.animations
src/runtime/render/lookArt.ts           lookSprites; OwnSkin.animations and kind
src/runtime/render/draw.ts              draws what heroShown and entityShown pick
src/runtime/render/art.ts               playerPose removed (thingFrame stays for the pack's things)
src/editor/components/HeroScreen.tsx    Run strokes also write runShoot
tests/runtime/animate.test.ts, tests/runtime/render.test.ts, tests/runtime/art.test.ts, tests/runtime/slide.test.ts, tests/runtime/counters.test.ts, tests/editor/heroScreen.test.tsx
```

---

### Task 1: The counters the drawing needs

**Files:**
- Modify: `src/runtime/sim/state.ts`, `src/runtime/sim/step.ts`, `src/runtime/sim/entities/types.ts`, `src/runtime/sim/entities/enemies.ts`, `src/runtime/sim/entities/spawn.ts`
- Test: `tests/runtime/counters.test.ts`; test helpers that build `Player` or `Entity` literals (`tests/runtime/art.test.ts` and any others `npm run typecheck` names)

**Interfaces:**
- Produces: `Player.airSteps: number` (steps since leaving the ground; 0 on the ground); `Entity.modeSteps: number` (steps in the current mode; 0 on the step the mode changes)

- [ ] **Step 1: Write the failing tests**

`tests/runtime/counters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { flatArt, thing } from "./helpers";
import { entity, makeSim, run, standOn } from "./simHelpers";

describe("the hero's steps in the air", () => {
  it("count up in the air, and start again from zero on each jump", () => {
    const sim = makeSim([{ art: flatArt() }]);
    standOn(sim, 3, 13);
    run(sim, {}, 2);
    expect(sim.player.airSteps).toBe(0);
    run(sim, { jump: true }, 5);
    expect(sim.player.airSteps).toBe(5);
    for (let i = 0; i < 200 && !sim.player.onGround; i++) run(sim, {}, 1);
    expect(sim.player.airSteps).toBe(0);
    run(sim, { jump: true }, 1);
    expect(sim.player.airSteps).toBe(1);
  });
});

describe("an entity's steps in its mode", () => {
  it("count up, and start from zero when the mode changes, even to the same attack again", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("boss", 12, 12, { attacks: "aimed,aimed" })] }]);
    const boss = entity(sim, "boss")!;
    sim.player.invuln = 1_000_000;
    for (let i = 0; i < 300 && boss.mode !== "aimed"; i++) run(sim, {}, 1);
    expect(boss.modeSteps).toBe(0);
    run(sim, {}, 10);
    expect(boss.modeSteps).toBe(10);
    for (let i = 0; i < 300 && boss.mode === "aimed"; i++) run(sim, {}, 1);
    for (let i = 0; i < 300 && boss.mode !== "aimed"; i++) run(sim, {}, 1);
    expect(boss.modeSteps).toBe(0); // a second aimed shot starts its own count
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime/counters.test.ts`
Expected: FAIL (`airSteps` and `modeSteps` are undefined).

- [ ] **Step 3: Write the implementation**

- `src/runtime/sim/state.ts`: add `airSteps: number; // steps since leaving the ground, for the jump animation` to `Player`, and `airSteps: 0,` where the player is made.
- `src/runtime/sim/step.ts`, in `playStep` right after `updatePlayer(sim, input);`:

```ts
  sim.player.airSteps = sim.player.onGround ? 0 : sim.player.airSteps + 1;
```

  (On the step the hero leaves the ground this makes 1. The jump animation counts from this number, so its first frame lasts one step less than the others: invisible at 60 steps a second.)
- `src/runtime/sim/entities/types.ts`: add `modeSteps: number; // steps in the current mode, for once-through animations` to `Entity`.
- `src/runtime/sim/entities/spawn.ts`: `modeSteps: 0,` in `createEntity`.
- `src/runtime/sim/entities/enemies.ts`, `updateEntities`:

```ts
export function updateEntities(sim: Sim): void {
  for (const slot of sim.slots) {
    const e = slot.entity;
    if (!e) continue;
    if (e.flash > 0 && e.behaviour !== "boss") e.flash--;
    const before = e.mode;
    const round = e.attack; // a boss starting the same attack again changes its count, not its mode
    BEHAVIOURS[e.behaviour]?.(sim, e);
    e.modeSteps = e.mode !== before || e.attack !== round ? 0 : e.modeSteps + 1;
  }
}
```

- Test helpers that build a `Player` or `Entity` literal get `airSteps: 0` / `modeSteps: 0`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: count the hero's steps in the air and each enemy's steps in its mode, for animations"
```

---

### Task 2: Choosing the animation and frame

**Files:**
- Create: `src/runtime/render/animate.ts`
- Test: `tests/runtime/animate.test.ts`

**Interfaces:**
- Consumes: Task 1's counters; `type AnimationSpeed` from `@/model/look`; `HURT_STEPS`, `PLAYER_H` from `@/runtime/sim/constants`
- Produces:
  - `type Timing = { frames: number; speed: AnimationSpeed }` (a frame count and a speed)
  - `frameSteps(base: number, speed: AnimationSpeed): number`
  - `pickFrame(timing: Timing, base: number, elapsed: number, loop: boolean): number`
  - `type Shown = { animation: string; frame: number; flip: boolean }`
  - `heroShown(p: Player, steps: number, timings: Record<string, Timing>): Shown`
  - `entityShown(e: Entity, steps: number, timings: Record<string, Timing>): Shown`

- [ ] **Step 1: Write the failing tests**

`tests/runtime/animate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { entityShown, frameSteps, heroShown, pickFrame, type Timing } from "@/runtime/render/animate";
import type { Entity } from "@/runtime/sim/entities/types";
import type { Player } from "@/runtime/sim/state";

const player = (o: Partial<Player> = {}): Player => ({
  x: 0, y: 0, vx: 0, vy: 0, w: 14, h: 22, facing: 1, onGround: true, onIce: false, onLadder: false,
  health: 28, hurt: 0, invuln: 0, knockback: 1, ridingId: null, shotTimer: 0, slide: 0, charge: 0, airSteps: 0,
  ...o,
});
const entity = (o: Partial<Entity> = {}): Entity => ({
  x: 0, y: 0, w: 14, h: 14, vx: 0, vy: 0, onGround: true, onIce: false,
  id: "t", type: "own-e1", behaviour: "walker", facing: 1, health: 1, mode: "walk",
  timer: 0, attack: 0, homeX: 0, homeY: 0, dx: 0, dy: 0, flash: 0, modeSteps: 0, settings: {},
  ...o,
});
const t = (frames: number, speed: Timing["speed"] = "normal"): Timing => ({ frames, speed });
const heroTimings = (frames = 1): Record<string, Timing> =>
  Object.fromEntries(
    ["stand", "standShoot", "run", "runShoot", "jump", "jumpShoot", "climb", "hurt", "slide"].map((a) => [a, t(a === "run" || a === "runShoot" ? 2 : frames)]),
  );

describe("frame timing", () => {
  it("uses the spec's steps per frame", () => {
    expect([frameSteps(6, "slow"), frameSteps(6, "normal"), frameSteps(6, "fast")]).toEqual([9, 6, 4]);
    expect([frameSteps(8, "slow"), frameSteps(8, "normal"), frameSteps(8, "fast")]).toEqual([12, 8, 5]);
  });

  it("loops, or plays once and holds the last frame", () => {
    expect([0, 7, 8, 23, 24].map((e) => pickFrame(t(3), 8, e, true))).toEqual([0, 0, 1, 2, 0]);
    expect([0, 8, 16, 100].map((e) => pickFrame(t(3), 8, e, false))).toEqual([0, 1, 2, 2]);
  });

  it("always shows frame 0 of a one-frame animation", () => {
    for (const speed of ["slow", "normal", "fast"] as const) {
      for (const e of [0, 1, 5, 99, 12345]) {
        expect(pickFrame(t(1, speed), 8, e, true)).toBe(0);
        expect(pickFrame(t(1, speed), 8, e, false)).toBe(0);
      }
    }
  });
});

describe("heroShown", () => {
  it("picks today's poses, in today's order", () => {
    const timings = heroTimings();
    expect(heroShown(player({ h: 14, vx: 2.5 }), 0, timings)).toEqual({ animation: "slide", frame: 0, flip: false });
    expect(heroShown(player({ hurt: 3, onLadder: true, shotTimer: 4 }), 0, timings).animation).toBe("hurt");
    expect(heroShown(player({ facing: -1 }), 0, timings)).toEqual({ animation: "stand", frame: 0, flip: true });
    expect(heroShown(player({ shotTimer: 5 }), 0, timings).animation).toBe("standShoot");
    expect(heroShown(player({ shotTimer: 5, onGround: false }), 0, timings).animation).toBe("jumpShoot");
    expect(heroShown(player({ onGround: false }), 0, timings).animation).toBe("jump");
    expect(heroShown(player({ vx: 1.375, shotTimer: 3 }), 0, timings).animation).toBe("runShoot");
  });

  it("runs through its two frames every 6 steps, as today", () => {
    const shown = [0, 6, 12].map((steps) => heroShown(player({ vx: 1.375 }), steps, heroTimings()));
    expect(shown.map((s) => [s.animation, s.frame])).toEqual([["run", 0], ["run", 1], ["run", 0]]);
  });

  it("plays the jump once from take-off and holds its last frame", () => {
    const timings = { ...heroTimings(), jump: t(3) };
    const frames = [1, 8, 16, 200].map((airSteps) => heroShown(player({ onGround: false, airSteps }), 999, timings).frame);
    expect(frames).toEqual([0, 1, 2, 2]);
  });

  it("plays hurt once from the knock", () => {
    const timings = { ...heroTimings(), hurt: t(2) };
    expect(heroShown(player({ hurt: 16 }), 0, timings).frame).toBe(0); // HURT_STEPS: just hit
    expect(heroShown(player({ hurt: 1 }), 0, timings).frame).toBe(1);
  });

  it("climbs by distance: a one-frame climb mirrors every 8 pixels, more frames step through and back", () => {
    expect(heroShown(player({ onLadder: true, y: 0, facing: -1 }), 0, heroTimings())).toEqual({ animation: "climb", frame: 0, flip: false });
    expect(heroShown(player({ onLadder: true, y: 8 }), 0, heroTimings())).toEqual({ animation: "climb", frame: 0, flip: true });
    const timings = { ...heroTimings(), climb: t(3) };
    const up = [48, 40, 32, 24].map((y) => heroShown(player({ onLadder: true, y }), 0, timings));
    expect(up.map((s) => s.frame)).toEqual([0, 2, 1, 0]);
    expect(up.every((s) => !s.flip)).toBe(true);
    const down = [24, 32, 40].map((y) => heroShown(player({ onLadder: true, y }), 0, timings).frame);
    expect(down).toEqual([0, 1, 2]); // back down: the same frames the other way
  });
});

describe("entityShown", () => {
  it("picks each behaviour's animation from its state", () => {
    expect(entityShown(entity({ behaviour: "walker" }), 8, { walk: t(2) })).toEqual({ animation: "walk", frame: 1, flip: false });
    expect(entityShown(entity({ behaviour: "flyer", facing: -1 }), 0, { fly: t(2) })).toEqual({ animation: "fly", frame: 0, flip: true });
    expect(entityShown(entity({ behaviour: "turret" }), 0, { idle: t(1) }).animation).toBe("idle");
    expect(entityShown(entity({ behaviour: "jumper", onGround: false }), 0, { ground: t(1), air: t(1) }).animation).toBe("air");
    expect(entityShown(entity({ behaviour: "shielded", mode: "open" }), 0, { closed: t(1), open: t(1) }).animation).toBe("open");
    expect(entityShown(entity({ behaviour: "dropper", mode: "fall" }), 0, { hang: t(1), fall: t(1) }).animation).toBe("fall");
  });

  it("plays the boss's jump and attack once from when they start, and loops its stand", () => {
    const timings = { stand: t(2), jump: t(3), attack: t(3) };
    const boss = (mode: string, modeSteps: number) => entityShown(entity({ behaviour: "boss", type: "own-boss", mode, modeSteps }), 8, timings);
    expect(boss("idle", 0)).toMatchObject({ animation: "stand", frame: 1 });
    expect(boss("dash", 0).animation).toBe("stand");
    expect([0, 8, 16, 99].map((s) => boss("jump", s).frame)).toEqual([0, 1, 2, 2]);
    for (const mode of ["spread", "aimed", "rain", "big"]) expect(boss(mode, 8)).toMatchObject({ animation: "attack", frame: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime/animate.test.ts`
Expected: FAIL (no `@/runtime/render/animate`).

- [ ] **Step 3: Write the module**

`src/runtime/render/animate.ts`:

```ts
import type { AnimationSpeed } from "@/model/look";
import { HURT_STEPS, PLAYER_H } from "../sim/constants";
import type { Entity } from "../sim/entities/types";
import type { Player } from "../sim/state";

// Which animation a character shows, and which of its frames, from the game's state alone.

export type Timing = { frames: number; speed: AnimationSpeed };
export type Shown = { animation: string; frame: number; flip: boolean };

const FACTOR: Record<AnimationSpeed, number> = { slow: 1.5, normal: 1, fast: 2 / 3 };
const RUN_BASE = 6; // the hero's run changes frame every 6 steps at normal speed
const BASE = 8; // everything else every 8
const CLIMB_PIXELS = 8; // a climb steps one frame every 8 pixels

export const frameSteps = (base: number, speed: AnimationSpeed): number => Math.round(base * FACTOR[speed]);

export function pickFrame(timing: Timing, base: number, elapsed: number, loop: boolean): number {
  const n = Math.max(1, timing.frames);
  const i = Math.floor(Math.max(0, elapsed) / frameSteps(base, timing.speed));
  return loop ? i % n : Math.min(i, n - 1);
}

const ONE: Timing = { frames: 1, speed: "normal" };
const timingOf = (timings: Record<string, Timing>, animation: string) => timings[animation] ?? ONE;

export function heroShown(p: Player, steps: number, timings: Record<string, Timing>): Shown {
  const flip = p.facing < 0;
  const loop = (animation: string, base = BASE): Shown => ({ animation, frame: pickFrame(timingOf(timings, animation), base, steps, true), flip });
  const once = (animation: string, elapsed: number): Shown => ({ animation, frame: pickFrame(timingOf(timings, animation), BASE, elapsed, false), flip });

  if (p.h < PLAYER_H) return loop("slide");
  if (p.hurt > 0) return once("hurt", HURT_STEPS - p.hurt);
  if (p.onLadder) {
    const n = timingOf(timings, "climb").frames;
    const rung = Math.floor(p.y / CLIMB_PIXELS);
    if (n <= 1) return { animation: "climb", frame: 0, flip: rung % 2 === 1 }; // mirrors, as it always has
    return { animation: "climb", frame: ((rung % n) + n) % n, flip: false };
  }
  const shooting = p.shotTimer > 0;
  if (!p.onGround) return once(shooting ? "jumpShoot" : "jump", p.airSteps);
  if (p.vx !== 0) return loop(shooting ? "runShoot" : "run", RUN_BASE);
  return loop(shooting ? "standShoot" : "stand");
}

const BOSS_ATTACKS = new Set(["spread", "aimed", "rain", "big"]);

export function entityShown(e: Entity, steps: number, timings: Record<string, Timing>): Shown {
  const flip = e.facing < 0;
  const loop = (animation: string): Shown => ({ animation, frame: pickFrame(timingOf(timings, animation), BASE, steps, true), flip });
  const once = (animation: string): Shown => ({ animation, frame: pickFrame(timingOf(timings, animation), BASE, e.modeSteps, false), flip });
  switch (e.behaviour) {
    case "walker":
      return loop("walk");
    case "flyer":
      return loop("fly");
    case "turret":
      return loop("idle");
    case "jumper":
      return loop(e.onGround ? "ground" : "air");
    case "shielded":
      return loop(e.mode === "open" ? "open" : "closed");
    case "dropper":
      return loop(e.mode === "hang" ? "hang" : "fall");
    case "boss":
      if (e.mode === "jump") return once("jump");
      if (BOSS_ATTACKS.has(e.mode)) return once("attack");
      return loop("stand");
    default:
      return loop("walk");
  }
}
```

Check the climb test against this: frames 3, y 48 → rung 6 → 0; y 40 → 5 → 2; y 32 → 4 → 1; y 24 → 3 → 0. Climbing up (y falling) gives 0, 2, 1, 0 and down gives 0, 1, 2: the same frames the other way. The jump test: `airSteps` 1, 8, 16 and 200 give frames 0, 1, 2 and 2.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/runtime/animate.test.ts && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/render/animate.ts tests/runtime/animate.test.ts
git commit -m "feat: choose each character's animation and frame from the game's state"
```

---

### Task 3: Drawing animations

**Files:**
- Modify: `src/runtime/render/heroArt.ts`, `src/runtime/render/lookArt.ts`, `src/runtime/render/draw.ts`, `src/runtime/render/art.ts`
- Modify tests: `tests/runtime/art.test.ts` (the `playerPose` tests move to `animate.test.ts`, which already covers them), `tests/runtime/slide.test.ts`
- Test: additions to `tests/runtime/render.test.ts`

**Interfaces:**
- Consumes: Task 2's `heroShown`, `entityShown`, `Timing`
- Produces: `type AnimSprites = { frames: Sprite[]; speed: AnimationSpeed }`; `HeroArt.animations: Record<string, AnimSprites>`; `lookSprites(look: Look): Record<string, AnimSprites>`; `OwnSkin = { art: LookArt; animations: Record<string, AnimSprites>; image }`; `timingsOf(animations: Record<string, AnimSprites>): Record<string, Timing>`

- [ ] **Step 1: Write the failing tests**

Add to `tests/runtime/render.test.ts`. Use the file's own `recorder()` and fake image (the existing hero tests record `{ sprite, flip, x, y }` for each `drawImage`); build the project with the helpers already used there (`game()` and `run()` from `tests/ai/helpers` if the file uses them, otherwise `projectFromArt` with the snow pack), and the skin the existing hero tests build, with `own: ownSkins(...)`.

```ts
describe("animations in the game", () => {
  // A walker of the kid's whose walk has four frames, each a different solid colour slot.
  function fourFrameWalker() {
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    const target = { enemy: "e1" };
    const solid = (ch: string) => Array.from({ length: 16 }, () => ch.repeat(16));
    project = run(project, "setLookColours", { target, colours: [1, 2, 3, 4] });
    for (const [frame, ch] of [[0, "1"], [1, "2"]] as const) project = run(project, "setFrame", { target, animation: "walk", frame, rows: solid(ch) });
    project = run(project, "addFrame", { target, animation: "walk", after: 1 });
    project = run(project, "setFrame", { target, animation: "walk", frame: 2, rows: solid("3") });
    project = run(project, "addFrame", { target, animation: "walk", after: 2 });
    project = run(project, "setFrame", { target, animation: "walk", frame: 3, rows: solid("4") });
    project = run(project, "setAnimationSpeed", { target, animation: "walk", speed: "fast" });
    return run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 8, y: 12 });
  }

  it("cycles a kid's enemy through all its frames at its speed", () => {
    const project = fourFrameWalker();
    const own = ownSkins(project.enemies, () => fake);
    const walk = own["own-e1"].animations.walk.frames;
    const sim = createSim(project, "L1", pack);
    sim.player.invuln = 1_000_000;
    const seen: unknown[] = [];
    for (let i = 0; i < 20; i++) {
      step(sim, NO_INPUT);
      const ctx = recorder();
      draw(ctx, sim, { set: snowArt, image: fake, own });
      seen.push(ctx.images.find((img) => walk.includes(img.sprite))?.sprite);
    }
    // Fast: 5 steps a frame, so 20 steps show each of the four frames.
    expect(new Set(seen).size).toBe(4);
  });

  it("still blinks a kid's enemy after a hit", () => {
    const project = fourFrameWalker();
    const own = ownSkins(project.enemies, () => fake);
    const sim = createSim(project, "L1", pack);
    step(sim, NO_INPUT);
    const fang = sim.slots.find((s) => s.thing.type === "own-e1")!.entity!;
    fang.flash = 4; // a hit's blink: drawn hidden on this step
    const ctx = recorder();
    draw(ctx, sim, { set: snowArt, image: fake, own });
    const walk = own["own-e1"].animations.walk.frames;
    expect(ctx.images.some((img) => walk.includes(img.sprite))).toBe(false);
  });

  it("draws an upgraded hero exactly as before at every step of a run", () => {
    const project = game();
    const art = heroArt(project.hero.look);
    const sim = createSim(project, "L1", pack);
    for (let i = 0; i < 24; i++) {
      step(sim, { ...NO_INPUT, right: true });
      const ctx = recorder();
      draw(ctx, sim, { set: snowArt, image: fake, hero: { art, image: fake } });
      const expected = sim.player.vx === 0 ? art.poses.stand : Math.floor(sim.steps / 6) % 2 === 0 ? art.poses.run1 : art.poses.run2;
      if (sim.player.onGround) expect(ctx.images.map((img) => img.sprite)).toContain(expected);
    }
  });
});
```

(`fake`, `recorder`, `heroArt`, `ownSkins`, `snowArt`, `createSim`, `step`, `NO_INPUT`, `draw`, `game`, `run`, `pack` come from the file's imports or `tests/ai/helpers`; add whichever it lacks. If the file's recorder stores images differently, compare the same way its existing hero tests do.)

In `tests/runtime/art.test.ts`, delete the `describe("playerPose")` block (Task 2's `heroShown` tests cover each case) and its import. In `tests/runtime/slide.test.ts`, replace `playerPose(s.player, s.steps).pose` with `heroShown(s.player, s.steps, {}).animation` (importing `heroShown` from `@/runtime/render/animate`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime/render.test.ts`
Expected: FAIL (`own["own-e1"].animations` is undefined).

- [ ] **Step 3: Sprites for every animation**

`src/runtime/render/lookArt.ts` (importing `type Look`, `type AnimationSpeed` from `@/model/look`, `type Timing` from `./animate`):

```ts
export type AnimSprites = { frames: Sprite[]; speed: AnimationSpeed };

// Every animation of a look as sprites.
export function lookSprites(look: Look): Record<string, AnimSprites> {
  return Object.fromEntries(
    Object.entries(look.animations).map(([name, anim]) => [name, { frames: anim.frames.map((rows) => sprite(rows)), speed: anim.speed }]),
  );
}

export const timingsOf = (animations: Record<string, AnimSprites>): Record<string, Timing> =>
  Object.fromEntries(Object.entries(animations).map(([name, a]) => [name, { frames: a.frames.length, speed: a.speed }]));

export type OwnSkin = { art: LookArt; animations: Record<string, AnimSprites>; image: (s: Sprite, flip: boolean) => CanvasImageSource };
```

and `ownSkins` builds each skin from the design's look: `{ art: lookArt(designLook(kind, look)), animations: lookSprites(look), image: imageFor(palette) }` (the palette is the same one `lookArt` makes). `art` stays for the palette swatches and the zone view, which show the first frame.

`src/runtime/render/heroArt.ts`: add `animations: Record<string, AnimSprites>` to `HeroArt`, filled with `lookSprites(look)`. `poses`, `shot` and `chargedShot` stay for the hero screen's picture buttons until plan 4.

- [ ] **Step 4: Draw what is shown**

In `src/runtime/render/draw.ts` (importing `entityShown`, `heroShown` from `./animate` and `timingsOf` from `./lookArt`):

- `drawEntity`: for the kid's own (`own`), pick with `entityShown`:

```ts
  const own = skin?.own?.[e.type];
  if (skin && own) {
    if (flashing) return; // blink
    const shown = entityShown(e, sim.steps, timingsOf(own.animations));
    const frames = own.animations[shown.animation]?.frames ?? own.art.frames;
    onBox(ctx, own.image, frames[Math.min(shown.frame, frames.length - 1)], shown.flip, e, ox, oy);
    return;
  }
  const frames = skin?.set.things[e.type];
  if (skin && frames && frames.length > 0) {
    if (flashing) return; // blink
    onBox(ctx, skin.image, frames[thingFrame(e, sim.steps, frames.length)], e.facing < 0, e, ox, oy);
    return;
  }
```

- The hero: replace `playerPose` with

```ts
      const shown = heroShown(p, sim.steps, timingsOf(skin.hero.art.animations));
      const sprite = skin.hero.art.animations[shown.animation].frames[shown.frame];
      onBox(ctx, image, sprite, shown.flip, p, originX, originY);
```

- Hero shots: `const anim = skin.hero.art.animations[shot.charged ? "chargedShot" : "shot"]; const picture = anim.frames[pickFrame({ frames: anim.frames.length, speed: anim.speed }, 8, sim.steps, true)];`

In `src/runtime/render/art.ts`, delete `playerPose` (and its now-unused imports). `thingFrame` stays for the content pack's own things.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass. The existing render, charge and slide tests compare today's sprites (`art.poses.stand` and so on); an upgraded hero's animations hold the same sprite objects' rows, so compare by rows if a test compares by identity and fails: `heroArt` makes `poses` and `animations` separately, so make `poses` read from `animations` (`poses[p] = animations[slot.animation].frames[slot.frame]` via `heroPictureSlot`) so they are the very same sprites.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: play the hero's, enemies' and boss's animations in the game and previews"
```

---

### Task 4: Run and shoot follows Run

**Files:**
- Modify: `src/editor/components/HeroScreen.tsx`, `docs/superpowers/STATUS.md`
- Test: addition to `tests/editor/heroScreen.test.tsx`

**Interfaces:**
- Consumes: `heroPictureSlot`, the `setFrame` command

- [ ] **Step 1: Write the failing test**

Add to `tests/editor/heroScreen.test.tsx`, in `describe("the hero screen")`:

```tsx
  it("keeps Run and shoot in step with Run, in one undo step", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose(/^Run 2/);
    press(0, 0);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await choose(/^Run 1/);
    press(1, 0);
    const look = saved().hero.look;
    expect(look.animations.runShoot.frames).toEqual(look.animations.run.frames);
    expect(look.animations.run.frames[0][0][1]).toBe("1");
    expect(look.animations.run.frames[1][0][0]).toBe("."); // the undone stroke, gone from both
  });
```

(The snow hero's Run 2 top-left pixel is clear and its Run 1 pixel (1, 0) is clear: check both in `snowHero` before relying on them, and pick other clear pixels if not.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/editor/heroScreen.test.tsx`
Expected: FAIL (runShoot keeps the old run).

- [ ] **Step 3: Write the implementation**

In `HeroScreen.tsx`, where a picture is saved (strokes and imports), send the same rows to runShoot for Run 1 and Run 2:

```tsx
  // Until the screen can show "Run and shoot" (milestone 4, plan 4), it is kept the same as Run.
  const save = (rows: string[]) => {
    const slot = heroPictureSlot(look, picture);
    onCommand({ name: "setFrame", args: { target: "hero", ...slot, rows } });
    if (slot.animation === "run" && look.animations.runShoot.frames.length > slot.frame) {
      onCommand({ name: "setFrame", args: { target: "hero", animation: "runShoot", frame: slot.frame, rows } });
    }
  };
```

and use `save(next)` in `onRows` and `save(result.rows)` in `onImport` (after the colours, as now). Both commands run inside the stroke's or import's open command group, so they are one undo step.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass.

- [ ] **Step 5: Update the status and commit**

In `docs/superpowers/STATUS.md`: mark this plan implemented, reviewed and merged; say characters now play their animations in the game (frames, speeds, looping and once-through) with nothing visible changed for existing games; note that the content pack's own snow characters keep their art set; remove plan 1's deferred item about runShoot going stale; update the test counts; add this plan's deferred review findings.

```bash
git add -A src tests docs/superpowers/STATUS.md
git commit -m "feat: keep the hero's run-and-shoot animation in step with its run until it can be drawn"
```

---

## Self-review

- **Spec coverage:** section 3's playback rules (normal keeps today's timing, slow and fast numbers, looping list, once-through list from the pose's start, climb by distance with a one-frame climb mirroring, step-count determinism) → Tasks 1 and 2; section 5's "each character draws the current frame of its current animation" → Task 3; section 9's animation tests (timing at each speed, looping and once-through, climbing by distance) → Task 2, and "old games play the same" for drawing → Task 3's upgraded-hero test plus the existing render tests. The snow characters as looks is not done, with the reason in Decisions. Bodies and shot points are plan 3.
- **Placeholder scan:** none; every behaviour change has its test written out.
- **Types:** `Timing`, `Shown`, `frameSteps`, `pickFrame`, `heroShown`, `entityShown`, `AnimSprites`, `lookSprites`, `timingsOf`, `OwnSkin.animations`, `HeroArt.animations`, `airSteps`, `modeSteps` are defined once and used with the same names.
