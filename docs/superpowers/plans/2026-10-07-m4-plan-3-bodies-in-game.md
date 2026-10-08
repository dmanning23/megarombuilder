# Sizes, Hitboxes and Shot Points in the Game Implementation Plan (Milestone 4, Plan 3 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The hero, the kid's enemies and the kid's boss move, collide and are hit with the hitboxes in their looks, shoot from their looks' shot points, and are drawn lined up on those hitboxes; the checker plays with the kid's real hero; the assistant knows the hero's size; and today's games still play and look exactly as now.

**Architecture:** The player gets its standing height, sliding height and shot point from the hero's look when the game starts (`Player.standH`, `slideH`, `shotY`), and every place that used the fixed `PLAYER_W`, `PLAYER_H` and `SLIDE_H` reads the player instead. The game pack gives the kid's thing types a `body` size and `shotY` from their looks; spawning uses them, and the content pack's own things keep today's sizes. Drawing places each picture so its hitbox lands on the character's box. The checker's probe is built with the kid's hero look, and its cache keys on it.

**Tech Stack:** as plan 1. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-07-milestone-4-characters-that-fit-design.md` (section 3, "Bodies and shot points"; section 5; section 7; section 9, "Bodies and shots"; build order item 3)

**Plan series for milestone 4:**

1. The shared look, format 4, the upgrade, the look commands (done)
2. Animations in the game (done)
3. Sizes, hitboxes and shot points in the game (this plan)
4. The editor: animations, frames, play, onion skin, 16 colours
5. The editor: size, hitbox, shot marker

## Global Constraints

- Today's games play and look exactly as now: today's looks give today's sizes (hero 14 × 22, sliding 14 high; the behaviour sizes; boss 24 × 28) and today's shot heights.
- A hero always fits the level pieces: standing at most 30 tall, sliding at most 14, and (new in this plan) at most 16 wide.
- The simulation stays deterministic; model, commands, the simulation and the checker have no React, no DOM and no randomness.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **The hero's width is at most 16** (one tile), standing and sliding. A ladder centres the hero on its tile, and the ladder pieces put a wall right beside the ladder, so a wider hero would be pushed into the wall. `lookProblems` refuses a wider hitbox: "The hero's hitbox is 18 wide; at most 16, so it fits on a ladder beside a wall."
- **Sliding keeps the standing width.** The sliding hitbox's height is used; the hero keeps its standing width while sliding, so a slide can't push it sideways into a wall. The slide picture is lined up on the sliding hitbox's bottom middle. (Plan 5's handles adjust the sliding hitbox's height only.)
- **Shot heights:** a normal shot starts `shotY` pixels below the top of the hero's hitbox (8 today); a charged shot is centred on the same line (`shotY + 2 − 5`, which is today's 5). An enemy's or boss's shot starts at its `shotY` (today the middle: 4 for a turret, 5 for a shield guard, 11 for the boss). The content pack's own things keep the middle.
- **Drawing:** a picture is placed so its hitbox's bottom middle lands on the character's bottom middle (mirrored pictures mirror the hitbox too). For today's centred hitboxes this is exactly today's placement.
- **The checker plays the kid's hero.** Its probe was always built with the content pack's hero; it now uses the project's hero look, so a tall or narrow hero is checked as it plays. The cache's key adds the hero's look.
- **The assistant's hero sentence** adds: "Your hero is 26 pixels tall and 14 wide, so it fits through 2-tile gaps." (Sliding is already described; its limit keeps crawl spaces working.)

## Review Focus

1. **A 30-tall hero on every level piece, at every setting:** the checker passes it, and the crawl space with slide. Tested in Task 4.
2. **A tall hero arriving through a zone's entry, respawning at a checkpoint, and standing up from a slide under a low ceiling:** it never starts inside a wall. Tested in Task 2.
3. **A hand-edited file with a hero 18 wide:** refused with the plain message. Tested in Task 1.
4. **A kid's turret with a shot point near its feet:** its shots come out there; a snow turret's still come out of its middle. Tested in Task 3.
5. **A hero with an off-centre hitbox, facing left and right:** the picture lines up on the hitbox both ways. Tested in Task 5.

## File Structure

```
src/model/look.ts                       HERO_BODY_MAX_W
src/model/contentPack.ts                ThingDef.body, ThingDef.shotY
src/model/gamePack.ts                   the kid's types carry body and shotY
src/runtime/sim/state.ts                Player.standH, slideH, shotY; entryPosition takes the body
src/runtime/sim/slide.ts, edges.ts, hazards.ts, shots.ts, player.ts   read the player's sizes
src/runtime/sim/entities/spawn.ts       spawnBox and createEntity read def.body; Entity.shotY
src/runtime/sim/entities/types.ts       Entity.shotY
src/runtime/sim/entities/motion.ts      fireAt uses shotY
src/runtime/render/animate.ts           sliding from standH
src/runtime/render/heroArt.ts, lookArt.ts, draw.ts   bodies for placing pictures
src/checker/probe.ts, passage.ts, check.ts, moves.ts, cache.ts   the kid's hero
src/editor/tools.ts, src/editor/zoneView.ts   spawnBox with the def
src/ai/describe.ts                      the hero's size
```

---

### Task 1: The model

**Files:**
- Modify: `src/model/look.ts`, `src/model/contentPack.ts`, `src/model/gamePack.ts`
- Test: additions to `tests/model/look.test.ts`, `tests/model/gamePack.test.ts`

**Interfaces:**
- Produces: `HERO_BODY_MAX_W = 16`; `ThingDef.body?: { w: number; h: number }`, `ThingDef.shotY?: number` (set for the kid's own types)

- [ ] **Step 1: Write the failing tests**

Add to `tests/model/look.test.ts` (importing `heroLookFrom` from `@/model/lookUpgrade`, `testOldHero` from `../fixtures/testPack`, and `KINDS` from `@/model/look`):

```ts
describe("the hero's width", () => {
  it("is at most one tile, standing and sliding", () => {
    const hero = heroLookFrom(testOldHero);
    expect(lookProblems("hero", { ...hero, body: { x: 0, y: 2, w: 16, h: 22 } }, "The hero")).toEqual([]);
    const widened = (rows: string[]) => rows.map((row) => `${row}..`);
    const wide = {
      ...hero,
      canvases: { ...hero.canvases, main: { w: 18, h: 24 } },
      animations: Object.fromEntries(
        Object.entries(hero.animations).map(([name, a]) => [name, KINDS.hero.animations[name] === "main" ? { ...a, frames: a.frames.map(widened) } : a]),
      ),
      body: { x: 0, y: 2, w: 18, h: 22 },
    };
    expect(lookProblems("hero", wide, "The hero")).toContain("The hero's hitbox is 18 wide; at most 16, so it fits on a ladder beside a wall.");
    expect(lookProblems("hero", { ...hero, slideBody: { x: 3, y: 2, w: 18, h: 14 } }, "The hero")).toContain(
      "The hero's sliding hitbox is 18 wide; at most 16, so it fits on a ladder beside a wall.",
    );
  });
});
```

Add to `tests/model/gamePack.test.ts`:

```ts
describe("the kid's types carry their hitbox and shot point", () => {
  it("from their looks", () => {
    let project = run(baseProject(), "addEnemy", { enemyId: "e1", name: "Ice Eye", behaviour: "turret" });
    project = run(project, "resizeCanvas", { target: { enemy: "e1" }, canvas: "main", w: 24, h: 24 });
    project = run(project, "setBody", { target: { enemy: "e1" }, body: { x: 2, y: 4, w: 20, h: 20 } });
    project = run(project, "setShotY", { target: { enemy: "e1" }, y: 14 });
    const def = gamePack(project, testPack).things.find((d) => d.type === "own-e1")!;
    expect(def.body).toEqual({ w: 20, h: 20 });
    expect(def.shotY).toBe(14);
    expect(testPack.things.find((d) => d.type === "turret")!.body).toBeUndefined();
  });
});
```

(Use the file's helpers if it has them; otherwise import `baseProject`, `run` from `../commands/helpers`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/model/look.test.ts tests/model/gamePack.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`src/model/look.ts`: `export const HERO_BODY_MAX_W = 16; // centred on a ladder's tile, beside the ladder pieces' wall`, and in `lookProblems`, for the hero, after the height checks:

```ts
    if (look.body.w > HERO_BODY_MAX_W) {
      problems.push(`${possessive} hitbox is ${look.body.w} wide; at most ${HERO_BODY_MAX_W}, so it fits on a ladder beside a wall.`);
    }
```

and the same for `slideBody` ("sliding hitbox").

`src/model/contentPack.ts`: add to `ThingDef`:

```ts
  body?: { w: number; h: number }; // the kid's own types: the hitbox from their look (others use the behaviour's size)
  shotY?: number; // the kid's own types: where shots come out, below the hitbox's top
```

`src/model/gamePack.ts`: each own enemy's def gets `body: { w: enemy.look.body.w, h: enemy.look.body.h }` and, when the look has one, `shotY: enemy.look.shotY`; the kid's boss the same from `project.boss.look`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: keep heroes one tile wide, and give the kid's thing types their hitboxes and shot points"
```

---

### Task 2: The hero's body in the game

**Files:**
- Modify: `src/runtime/sim/state.ts`, `src/runtime/sim/slide.ts`, `src/runtime/sim/edges.ts`, `src/runtime/sim/hazards.ts`, `src/runtime/sim/shots.ts`, `src/runtime/render/animate.ts`, `src/checker/moves.ts`; test helpers that build `Player` literals
- Test: `tests/runtime/heroBody.test.ts`

**Interfaces:**
- Consumes: Task 1
- Produces: `Player.standH: number`, `Player.slideH: number`, `Player.shotY: number`; `entryPosition(map, carry, body: { w: number; h: number })`; `sliding(p)` compares with `p.standH`; `roomToStand(map, p, standH)`

- [ ] **Step 1: Write the failing tests**

`tests/runtime/heroBody.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyCommand } from "@/commands";
import { snowPack } from "@/content/snow/pack";
import { createSim, NO_INPUT } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { kill } from "@/runtime/sim/hazards";
import { game } from "../ai/helpers";

// The snow game with a hero 14 wide and 30 tall (its canvas grown to 16 by 32), sliding 12 high, shooting from 20.
function tallGame() {
  let project = game();
  const commands: [string, unknown][] = [
    ["setHeroAbilities", { slide: true, chargeShot: true }],
    ["resizeCanvas", { target: "hero", canvas: "main", w: 16, h: 32 }],
    ["setBody", { target: "hero", body: { x: 1, y: 2, w: 14, h: 30 } }],
    ["setBody", { target: "hero", which: "slide", body: { x: 5, y: 4, w: 14, h: 12 } }],
    ["setShotY", { target: "hero", y: 20 }],
  ];
  for (const [name, args] of commands) {
    const result = applyCommand(project, { name, args }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
  }
  return project;
}
const press = (keys: Partial<typeof NO_INPUT>) => ({ ...NO_INPUT, ...keys });

describe("the hero's own size", () => {
  it("stands, slides and stands up at its own heights", () => {
    const sim = createSim(tallGame(), "L1", snowPack);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    const feet = sim.player.y + sim.player.h;
    expect([sim.player.w, sim.player.h]).toEqual([14, 30]);
    step(sim, press({ down: true, right: true }));
    step(sim, press({ down: true, jump: true }));
    expect(sim.player.h).toBe(12);
    expect(sim.player.y + sim.player.h).toBe(feet);
    for (let i = 0; i < 120 && sim.player.h !== 30; i++) step(sim, NO_INPUT);
    expect(sim.player.h).toBe(30);
    expect(sim.player.y + sim.player.h).toBe(feet);
  });

  it("shoots from its shot point, and centres a charged shot on the same line", () => {
    const sim = createSim(tallGame(), "L1", snowPack);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    step(sim, press({ shoot: true }));
    expect(sim.shots[0].y).toBe(sim.player.y + 20);
    sim.shots = [];
    for (let i = 0; i < 80; i++) step(sim, press({ shoot: true }));
    step(sim, NO_INPUT);
    const charged = sim.shots.find((s) => s.charged)!;
    expect(charged.y).toBe(sim.player.y + 20 + 2 - 5);
  });

  it("arrives, respawns and changes zone standing on its feet, never inside a wall", () => {
    const sim = createSim(tallGame(), "L1", snowPack);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    expect(sim.player.h).toBe(30);
    kill(sim);
    for (let i = 0; i < 300 && sim.phase !== "play"; i++) step(sim, NO_INPUT);
    expect(sim.player.h).toBe(30);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    expect(sim.player.onGround).toBe(true);
  });

  it("plays today's hero at today's sizes", () => {
    const sim = createSim(game(), "L1", snowPack);
    expect([sim.player.w, sim.player.h, sim.player.standH, sim.player.slideH, sim.player.shotY]).toEqual([14, 22, 22, 14, 8]);
  });
});
```

(`game()` in `tests/ai/helpers` is the snow game with one level "L1". If the hero falls through no floor at the start of "Zone 1", place the checks after it lands, as above.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime/heroBody.test.ts`
Expected: FAIL (the player is always 14 × 22).

- [ ] **Step 3: Write the implementation**

`src/runtime/sim/state.ts`:
- `Player` gains `standH: number; // the standing hitbox's height, from the hero's look`, `slideH: number; // the sliding hitbox's height`, `shotY: number; // where shots come out, below the hitbox's top`.
- `entryPosition(map, carry, body: { w: number; h: number })`: replace `PLAYER_H` with `body.h` and `PLAYER_W` with `body.w`.
- `createSim`: read the hero's look:

```ts
  const look = project.hero.look;
  const body = { w: look.body.w, h: look.body.h };
  const start = entryPosition(map, null, body);
  // ...
    w: body.w,
    h: body.h,
    standH: body.h,
    slideH: look.slideBody?.h ?? SLIDE_H,
    shotY: look.shotY ?? 8,
```

`src/runtime/sim/slide.ts`:

```ts
export const sliding = (p: Player): boolean => p.h < p.standH;

export function roomToStand(map: TileMap, p: { x: number; y: number; w: number; h: number }, standH: number): boolean {
  const top = p.y + p.h - standH;
  // ...as now
}

export function startSlide(p: Player): void {
  p.y += p.standH - p.slideH;
  p.h = p.slideH;
  p.slide = SLIDE_STEPS;
}

export function standUp(p: Player): void {
  p.y -= p.standH - p.h;
  p.h = p.standH;
  p.slide = 0;
}
```

(Update `roomToStand`'s callers, in `player.ts` and `hazards.ts`, to pass `p.standH`.)

`src/runtime/sim/edges.ts`: `p.h = p.standH;` and `entryPosition(sim.map, carry, p)`.

`src/runtime/sim/hazards.ts`: in `respawn`, `p.h = p.standH;`; in `touchCheckpoints`, the standing spot uses `p.standH`.

`src/runtime/sim/shots.ts`: normal shots `y: p.y + p.shotY`; charged shots `y: p.y + p.shotY + SHOT_H / 2 - CHARGED_H / 2` (today: 8 + 2 − 5 = 5).

`src/runtime/render/animate.ts`: `if (p.h < p.standH) return loop("slide");` (drop the `PLAYER_H` import).

`src/checker/moves.ts`: `if (sim.player.h < sim.player.standH && t < 600) return NO_INPUT;`.

Test helpers that build a `Player` literal (for example `tests/runtime/animate.test.ts`) get `standH: 22, slideH: 14, shotY: 8`.

After this, `PLAYER_W`, `PLAYER_H` and `SLIDE_H` are used only as the defaults above and by the editor's outline (`src/editor/hero/pixels.ts`, plan 5). Leave them in `constants.ts`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: give the hero the standing, sliding and shooting heights of its look"
```

---

### Task 3: Enemies' and the boss's bodies and shot points

**Files:**
- Modify: `src/runtime/sim/entities/spawn.ts`, `src/runtime/sim/entities/types.ts`, `src/runtime/sim/entities/motion.ts`, `src/runtime/sim/entities/slots.ts`, `src/checker/check.ts`, `src/editor/tools.ts`, `src/editor/zoneView.ts`; test helpers that build `Entity` literals
- Test: additions to `tests/runtime/ownEnemies.test.ts`

**Interfaces:**
- Consumes: Task 1's `ThingDef.body`, `ThingDef.shotY`
- Produces: `spawnBox(thing: Thing, def: Pick<ThingDef, "behaviour" | "body">): Box`; `Entity.shotY: number`

- [ ] **Step 1: Write the failing tests**

Add to `tests/runtime/ownEnemies.test.ts`:

```ts
describe("the kid's enemies' own hitboxes and shot points", () => {
  function bigTurret(shotY: number) {
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "Ice Eye", behaviour: "turret" });
    const target = { enemy: "e1" };
    project = run(project, "resizeCanvas", { target, canvas: "main", w: 24, h: 24 });
    project = run(project, "setBody", { target, body: { x: 2, y: 4, w: 20, h: 20 } });
    project = run(project, "setShotY", { target, y: shotY });
    return run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 8, y: 12 });
  }

  it("stand on their tile at their own size", () => {
    const sim = createSim(bigTurret(2), "L1", pack);
    step(sim, NO_INPUT);
    const turret = sim.slots.find((s) => s.thing.type === "own-e1")!.entity!;
    expect([turret.w, turret.h]).toEqual([20, 20]);
    expect(turret.y + turret.h).toBe(13 * 16); // feet on the bottom of its tile
    expect(turret.x + turret.w / 2).toBe(8 * 16 + 8); // centred on its tile
  });

  it("shoot from their shot point, while the snow turret still shoots from its middle", () => {
    const sim = createSim(bigTurret(12), "L1", pack);
    sim.player.invuln = 1_000_000;
    for (let i = 0; i < 400 && sim.enemyShots.length === 0; i++) step(sim, NO_INPUT);
    const turret = sim.slots.find((s) => s.thing.type === "own-e1")!.entity!;
    expect(sim.enemyShots[0].y).toBe(turret.y + 12);
  });
});
```

(Add a snow-turret line to the second test if the zone has room: place a `turret` at x 4 and check its first shot's y is `turret.y + 4`. Keep it if it fits the file's helpers; the existing shooter tests already pin the snow turret's shot height.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime/ownEnemies.test.ts`
Expected: FAIL (the kid's turret is 14 × 14 and shoots from its middle).

- [ ] **Step 3: Write the implementation**

`src/runtime/sim/entities/spawn.ts`:

```ts
// A thing's hitbox size: the kid's own types carry theirs; the content pack's use the behaviour's.
export function bodySizeOf(def: Pick<ThingDef, "behaviour" | "body">): { w: number; h: number } {
  return def.body ?? bodySize(def.behaviour);
}

export function spawnBox(thing: Thing, def: Pick<ThingDef, "behaviour" | "body">): Box {
  const { w, h } = bodySizeOf(def);
  const behaviour = def.behaviour;
  // ...as now, with w and h
}
```

`createEntity(thing, def, ...)` uses `spawnBox(thing, def)` and sets `shotY: def.shotY ?? Math.round(h / 2 - ENEMY_SHOT_SIZE / 2)` (today's middle).

`src/runtime/sim/entities/types.ts`: `Entity.shotY: number; // where its shots come out, below its top`.

`src/runtime/sim/entities/motion.ts`, `fireAt`: `y: e.y + e.shotY,`.

Callers of `spawnBox` pass the def: `slots.ts` (`slot.def`), `check.ts` (the thing's def; for the boss box at line 112, find the boss's def in the game pack the same way), `editor/tools.ts`, `editor/zoneView.ts`.

Test helpers that build an `Entity` literal get `shotY: 4`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass (the shooter and boss tests pin today's shot heights for the content pack's things).

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: give the kid's enemies and boss the hitboxes and shot points of their looks"
```

---

### Task 4: The checker plays the kid's hero; the assistant knows its size

**Files:**
- Modify: `src/checker/probe.ts`, `src/checker/passage.ts`, `src/checker/check.ts`, `src/checker/cache.ts`, `src/ai/describe.ts`
- Test: additions to `tests/checker/pieces.test.ts`, `tests/checker/cache.test.ts`, `tests/ai/describe.test.ts`

**Interfaces:**
- Consumes: Task 2
- Produces: `createProbe(zone, pack, settings, look: Look = pack.hero)`; `findPassage(zone, pack, settings, look: Look = pack.hero)`

- [ ] **Step 1: Write the failing tests**

Add to `tests/checker/pieces.test.ts` (importing `applyCommand` from `@/commands`):

```ts
  it("can all be crossed by a tall hero (30 high), and the crawl space by it sliding", () => {
    for (const piece of snowPieces) {
      for (const settings of settingCombos(piece)) {
        let project = zoneWithPiece(piece, settings);
        for (const [name, args] of [
          ["resizeCanvas", { target: "hero", canvas: "main", w: 16, h: 32 }],
          ["setBody", { target: "hero", body: { x: 1, y: 2, w: 14, h: 30 } }],
        ] as const) {
          const result = applyCommand(project, { name, args }, { pack: snowPack });
          if (!result.ok) throw new Error(result.error);
          project = result.project;
        }
        const result = checkZone(project, "L", "z", snowPack);
        expect(result.passable, `${piece.id} ${JSON.stringify(settings)}: ${result.reason}`).toBe(true);
      }
    }
  }, 120_000);
```

And this one, which fails while the probe uses the pack's hero:

```ts
  it("are checked with the kid's hero, not the pack's", () => {
    const flat = snowPieces.find((p) => p.id === "flat-run")!;
    let project = zoneWithPiece(flat, { width: 6 });
    const commands: [string, unknown][] = [
      ["resizeCanvas", { target: "hero", canvas: "main", w: 16, h: 32 }],
      ["setBody", { target: "hero", body: { x: 1, y: 2, w: 14, h: 30 } }],
    ];
    for (const [name, args] of commands) {
      const result = applyCommand(project, { name, args }, { pack: snowPack });
      if (!result.ok) throw new Error(result.error);
      project = result.project;
    }
    const zone = project.levels[0].zones[0];
    expect(createProbe(zone, snowPack, heroPhysics(project.hero.abilities), project.hero.look).sim.player.h).toBe(30);
    expect(createProbe(zone, snowPack, heroPhysics(project.hero.abilities)).sim.player.h).toBe(22);
  });
```

(importing `createProbe` from `@/checker/probe` and `heroPhysics` from `@/model/hero`.)

Add to `tests/checker/cache.test.ts`, in `describe("createCheckCache")`:

```ts
  it("checks a zone again after the hero's look changes", () => {
    const cache = createCheckCache();
    const project = game();
    const first = cache.zone(project, "L1", "z1", pack);
    const narrow = run(project, { name: "setBody", args: { target: "hero", body: { x: 2, y: 2, w: 12, h: 22 } } });
    expect(cache.zone(narrow, "L1", "z1", pack)).not.toBe(first);
  });
```

Add to `tests/ai/describe.test.ts`, in `describe("describeHero")`:

```ts
  it("says how big the hero is", () => {
    expect(describeHero(game())).toContain("Your hero is 22 pixels tall and 14 wide, so it fits through 2-tile gaps.");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/checker/pieces.test.ts tests/checker/cache.test.ts tests/ai/describe.test.ts`
Expected: FAIL (`createProbe` ignores a look; the cache doesn't key on the look; no size sentence). The tall-hero piece test may already pass once Task 2 is in: the checker plays the pack's hero until this task, so it only fails here if the probe ignores the look. Confirm it fails by checking the probe height test.

- [ ] **Step 3: Write the implementation**

`src/checker/probe.ts`: `createProbe(zone, pack, settings, look: Look = pack.hero)`, building the project with `hero: { abilities: { ...DEFAULT_ABILITIES }, look }`.

`src/checker/passage.ts`: `findPassage(zone, pack, settings, look: Look = pack.hero)` passes `look` to `createProbe`.

`src/checker/check.ts`: `checkZone` passes `project.hero.look` to both `findPassage` and `createProbe`.

`src/checker/cache.ts`: the cached entry keeps `look: project.hero.look`, and a hit needs `hit.look === project.hero.look`; update the comment on what a zone's check depends on.

`src/ai/describe.ts`, `describeHero`: add the sentence

```ts
    `Your hero is ${look.body.h} pixels tall and ${look.body.w} wide, so it fits through 2-tile gaps.`,
```

(with `const look = project.hero.look;`), after the first sentence.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. The AI's describe tests that compare whole hero sentences get the new sentence.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: check levels with the kid's own hero, and tell the assistant how big it is"
```

---

### Task 5: Pictures lined up on their hitboxes

**Files:**
- Modify: `src/runtime/render/heroArt.ts`, `src/runtime/render/lookArt.ts`, `src/runtime/render/draw.ts`
- Test: additions to `tests/runtime/render.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3
- Produces: `HeroArt.body`, `HeroArt.slideBody` (`LookBox`), `HeroArt.canvases`; `OwnSkin.body` and `OwnSkin.canvas`; `placeOn(box: Box, body: LookBox, canvasW: number, flip: boolean): { x: number; y: number }` in `draw.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/runtime/render.test.ts`, in `describe("animations in the game")` (or a new `describe`):

```ts
  it("lines the hero's picture up on its hitbox, facing either way", () => {
    let project = game();
    const result = applyCommand(project, { name: "setBody", args: { target: "hero", body: { x: 0, y: 2, w: 12, h: 22 } } }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
    const art = heroArt(project.hero.look);
    const sim = createSim(project, "L1", snowPack);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    const at = (facing: 1 | -1) => {
      sim.player.facing = facing;
      const ctx = fakeContext();
      draw(ctx, sim, { set: snowArt, image: fakeImage, hero: { art, image: fakeImage } });
      return ctx.images.find((img) => img.sprite === art.poses.stand)!;
    };
    const right = at(1);
    const left = at(-1);
    // Facing right the hitbox is the picture's left 12 columns; mirrored, its right 12: 4 pixels along.
    expect(right.x - left.x).toBe(4);
  });
```

(`applyCommand` from `@/commands`. Facing right, the picture starts at the hitbox's left; mirrored, the hitbox is the picture's right 12 columns, so the picture starts 4 pixels further left.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/runtime/render.test.ts`
Expected: FAIL (both ways the picture is centred on the hitbox, so the difference is 0).

- [ ] **Step 3: Write the implementation**

`heroArt`: add `body: look.body`, `slideBody: look.slideBody ?? look.body`, `canvases: look.canvases`. `ownSkins`: each skin gets `body: look.body` and `canvas: look.canvases.main`.

`draw.ts`:

```ts
// Where to draw a picture so its hitbox's bottom middle lands on the box's bottom middle. A mirrored
// picture's hitbox is mirrored too.
function placeOn(box: Box, body: LookBox, canvasW: number, flip: boolean): { x: number; y: number } {
  const bodyMiddle = flip ? canvasW - (body.x + body.w / 2) : body.x + body.w / 2;
  return { x: Math.round(box.x + box.w / 2 - bodyMiddle), y: Math.round(box.y + box.h - body.y - body.h) };
}
```

The hero is drawn at `placeOn(p, sliding ? art.slideBody : art.body, sliding ? art.canvases.slide.w : art.canvases.main.w, shown.flip)` (sliding is `shown.animation === "slide"`); the kid's own things at `placeOn(e, own.body, own.canvas.w, shown.flip)`. The content pack's things keep `onBox`.

For today's looks (hitbox centred, feet on the picture's bottom) `placeOn` gives exactly `onBox`'s place, so the existing render tests pin "looks the same".

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass.

- [ ] **Step 5: Update the status and commit**

In `docs/superpowers/STATUS.md`: mark this plan implemented, reviewed and merged; say characters now move, collide, shoot and are drawn by their looks' hitboxes and shot points, the checker checks with the kid's own hero, and the assistant knows the hero's size; note the new one-tile width limit for heroes; update the test counts; add this plan's deferred review findings.

```bash
git add -A src tests docs/superpowers/STATUS.md
git commit -m "feat: draw every character lined up on its own hitbox"
```

---

## Self-review

- **Spec coverage:** section 3's bodies and shot points (the hero's standing and sliding bodies, enemies' and the boss's bodies from their looks, shotY below the body's top, running and jumping shots on the same line) → Tasks 1 to 3; section 5's "bodies come from looks; the boss's attacks measure from its body; shots start at shotY; the checker reads the hero's real body" → Tasks 2 to 4 (the big shot already measures from the boss's feet, so it needs no change); section 7's hero size sentence → Task 4; section 9's "a tall hero still crosses every level piece; a sliding hero still clears crawl spaces; shots come out at shotY; hitboxes follow looks; the checker matches play for resized heroes" → Tasks 2 to 4. Drawing lined up on bodies → Task 5. The editor's controls are plans 4 and 5.
- **Placeholder scan:** none; every behaviour change has its test written out.
- **Types:** `HERO_BODY_MAX_W`, `ThingDef.body`, `ThingDef.shotY`, `Player.standH`, `slideH`, `shotY`, `Entity.shotY`, `spawnBox(thing, def)`, `bodySizeOf`, `createProbe(..., look)`, `findPassage(..., look)`, `placeOn` are defined once and used with the same names.
