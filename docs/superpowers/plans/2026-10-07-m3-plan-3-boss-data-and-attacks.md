# Boss Data and Boss Attacks Implementation Plan (Milestone 3, Plan 3 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A game can have its own boss (name, fight length, 2–3 attacks in order, three frames), placed in the boss room in place of the Blizzard Bot; bosses fight with any of six attacks in the order given, and get quicker when hurt.

**Architecture:** Boss commands sit beside plan 1's enemy commands; the game pack adds the kid's boss as the thing type `own-boss`, whose settings carry its health and its attack list (`"jump,rain"`). The runtime boss reads its attack list from its settings (the Blizzard Bot, with none, keeps jump, spread, dash) and gains three attacks: aimed (one quick shot at the hero), rain (four falling shots with safe gaps), and big (one large, slow shot at chest height). Enemy shots gain an optional size for the big shot. The renderer draws the kid's boss from its look.

**Tech Stack:** as plan 2. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-milestone-3-your-own-enemies-and-boss-design.md` (sections 3 (boss), 4 (boss commands), 5, 8 and 9; build order item 3)

**Plan series for milestone 3:**

1. Enemy data, the game pack, and drawing own enemies (done)
2. The Characters screen and the Enemies tab (done)
3. Boss data and the new boss attacks (this plan)
4. The Boss tab
5. The assistant

## Global Constraints

- The simulation stays deterministic: no randomness in attacks.
- The checker is unchanged: a boss room counts as passable once the hero reaches it.
- The Blizzard Bot fights exactly as before (its attack named "shot" becomes "spread").
- Every change is a command; commands validate and return readable errors.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **Fight length:** short 20, normal 28, long 40 health (`bossSettings(boss)` in `designs.ts`).
- **A new boss** starts from the Blizzard Bot: its drawing (the pack's `bossLook`, colours snapped to the 8-bit palette: eight of them) and its attacks, jump, spread, dash; fight "normal".
- **Attack list setting:** `attacks` is a comma-separated string (`"jump,rain,big"`), since thing settings hold numbers, strings and booleans. Unknown names are skipped; an empty list means jump, spread, dash.
- **The attacks:**

  | Attack | Shots | Numbers |
  |---|---|---|
  | aimed | one shot straight at the hero's middle | speed 3, the boss's `shotDamage` (3) |
  | rain | four shots falling from the top of the screen at the hero's x −83, −43, −3 and +37 pixels (40 apart, so every gap is 34 pixels, over two tiles) | speed 2.5 down; the pattern shifts 20 pixels left on every other rain (counting rains only, so it moves whatever the attack list) |
  | big | one 16×16 shot from the boss's feet minus 30 pixels, so its bottom is 14 pixels above the floor (a standing hero is hit; a sliding hero, 14 high, passes under; a normal jump clears it) | speed 1.25, damage 4 |

  Shooting attacks (spread, aimed, rain, big) hold the boss still for 40 steps, as spread does now.
- **Quicker when hurt:** below half its health, the boss's pause between attacks is 24 steps instead of 40.
- **Frames:** the boss's three frames are stand, jump and attack; jump uses frame 2 and every shooting attack frame 3 (as "shot" did).
- **useBoss** swaps every placed boss to the chosen one, keeping its id and position. The kid's boss stores no settings (its design is live); the Blizzard Bot gets its pack defaults back. It is refused when nothing is placed to swap, and "yours" is refused with no boss design.
- **removeBoss** is refused while the kid's boss is placed: "Volt Viper is in Boss Room. Put the Blizzard Bot back first."

## Review Focus

1. **The Blizzard Bot in an old game** (placed with `{ health: 28 }` and no attack list): fights jump, spread, dash exactly as before. Tested in Task 2.
2. **A rain while the hero stands at the edge of the room**: shots outside the screen are simply gone; every gap between shots is over two tiles. Tested in Task 2.
3. **The big shot against a sliding hero, a jumping hero, a standing hero**: passes under the slide, under the jump, and hits the stander. Tested in Task 2.
4. **Swapping bosses back and forth, then undo**: positions and ids kept; one undo per swap. Tested in Task 1.
5. **An attack list with an unknown name** (a hand-edited file): the unknown one is skipped, never a crash. Tested in Task 2.

## File Structure

```
src/model/designs.ts                    FIGHT_HEALTH, bossSettings
src/model/contentPack.ts                ContentPack.bossLook
src/model/gamePack.ts                   OWN_BOSS ("own-boss"); the kid's boss as a thing type
src/content/snow/enemies.ts             snowBossLook
src/content/snow/pack.ts                bossLook
src/commands/boss.ts                    createBoss, setBoss, setBossColours, setBossFrame, useBoss, removeBoss
src/commands/registry.ts                boss commands
src/runtime/sim/constants.ts            boss attack numbers
src/runtime/sim/entities/types.ts       EnemyShot.size
src/runtime/sim/entities/boss.ts        attack list, six attacks, quicker when hurt
src/runtime/sim/entities/enemyShots.ts, src/runtime/sim/combat.ts   shots of any size
src/runtime/render/art.ts               boss frames by attack
src/runtime/render/draw.ts              big shots drawn big
src/runtime/render/lookArt.ts           ownSkins includes the kid's boss
src/runtime/render/PlayCanvas.tsx, src/editor/Editor.tsx, src/editor/components/GamePreview.tsx   pass the boss to ownSkins
tests/fixtures/testPack.ts              bossLook
tests/...                               named in each task
```

---

### Task 1: The kid's boss in the game file

**Files:**
- Modify: `src/model/designs.ts`, `src/model/contentPack.ts`, `src/model/gamePack.ts`, `src/content/snow/enemies.ts`, `src/content/snow/pack.ts`, `src/commands/registry.ts`, `tests/fixtures/testPack.ts`, `tests/boundaries.test.ts`
- Create: `src/commands/boss.ts`
- Test: `tests/commands/boss.test.ts`, additions to `tests/model/gamePack.test.ts`, `tests/content/snowEnemies.test.ts`

**Interfaces:**
- Consumes: plan 1's designs, `framesProblems`, `listNames`, `gamePack`
- Produces:
  - `FIGHT_HEALTH: Record<BossDesign["fight"], number>`; `bossSettings(boss: BossDesign): { health: number; attacks: string }`
  - `ContentPack.bossLook: BossDesign["look"]`; `snowBossLook`; `testBossLook`
  - `OWN_BOSS = "own-boss"`; `gamePack` adds the kid's boss as `OWN_BOSS` (category "boss", behaviour "boss", description "Yours", `own: true`)
  - commands `createBoss { name }`, `setBoss { name?, fight?, attacks? }`, `setBossColours { colours }`, `setBossFrame { frame: 0|1|2, rows }`, `useBoss { boss: "snow" | "yours" }`, `removeBoss {}`

- [ ] **Step 1: Write the failing tests**

`tests/commands/boss.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createHistory, runCommand, undo } from "@/commands/history";
import { testBossLook } from "../fixtures/testPack";
import { baseProject, ctx, run, runError } from "./helpers";

const frame = (ch: string) => Array.from({ length: 28 }, () => ch.repeat(24));

// The base project's boss room ("boss") with the test pack's boss in it.
function withSnowBoss() {
  return run(baseProject(), "placeThing", { levelId: "L1", zoneId: "boss", thingId: "b1", type: "boss", x: 10, y: 12 });
}
const bossThing = (project: ReturnType<typeof baseProject>) => project.levels[0].zones[2].things[0];

describe("createBoss", () => {
  it("makes a boss starting from the pack's boss drawing and the Blizzard Bot's attacks", () => {
    const project = run(baseProject(), "createBoss", { name: "  Volt   Viper " });
    expect(project.boss).toEqual({ name: "Volt Viper", fight: "normal", attacks: ["jump", "spread", "dash"], look: testBossLook });
    expect(runError(project, "createBoss", { name: "Another" })).toBe("Your game already has a boss of its own.");
  });
});

describe("changing the boss", () => {
  it("renames it, sets its fight and its attacks", () => {
    let project = run(baseProject(), "createBoss", { name: "Volt Viper" });
    project = run(project, "setBoss", { fight: "long", attacks: ["rain", "big"], name: "Volt King" });
    expect(project.boss).toMatchObject({ name: "Volt King", fight: "long", attacks: ["rain", "big"] });
    expect(runError(project, "setBoss", { attacks: ["rain"] })).toMatch(/attacks/);
    expect(runError(project, "setBoss", { attacks: ["rain", "big", "jump", "dash"] })).toMatch(/attacks/);
    expect(runError(project, "setBoss", {})).toBe("Give something about the boss to change.");
    expect(runError(baseProject(), "setBoss", { fight: "short" })).toBe("Your game has no boss of its own yet.");
  });

  it("draws frames and recolours, refusing to drop a used colour", () => {
    let project = run(baseProject(), "createBoss", { name: "Volt Viper" });
    project = run(project, "setBossColours", { colours: [13, 20] });
    project = run(project, "setBossFrame", { frame: 2, rows: frame("2") });
    expect(project.boss?.look.frames[2]).toEqual(frame("2"));
    expect(runError(project, "setBossColours", { colours: [13] })).toBe("Colour 2 is still used in Volt Viper's frame 3.");
    expect(runError(project, "setBossFrame", { frame: 0, rows: ["1"] })).toBe("Volt Viper frame 1 is not 24 by 28 pixels.");
  });
});

describe("using the kid's boss in the boss room", () => {
  it("swaps the boss both ways, keeping its id and place", () => {
    let project = run(withSnowBoss(), "createBoss", { name: "Volt Viper" });
    project = run(project, "useBoss", { boss: "yours" });
    expect(bossThing(project)).toEqual({ id: "b1", type: "own-boss", x: 10, y: 12, settings: {} });
    project = run(project, "useBoss", { boss: "snow" });
    expect(bossThing(project)).toMatchObject({ id: "b1", type: "boss", x: 10, y: 12 });
  });

  it("is one undo step", () => {
    const start = run(withSnowBoss(), "createBoss", { name: "Volt Viper" });
    const history = createHistory(start);
    const { history: swapped } = runCommand(history, { name: "useBoss", args: { boss: "yours" } }, ctx);
    expect(undo(swapped).project).toBe(start);
  });

  it("refuses with no boss of its own, or nothing placed to swap", () => {
    expect(runError(withSnowBoss(), "useBoss", { boss: "yours" })).toBe("Your game has no boss of its own yet.");
    expect(runError(run(baseProject(), "createBoss", { name: "V" }), "useBoss", { boss: "yours" })).toBe(
      "There is no boss in a boss room to swap. Put one there first.",
    );
  });
});

describe("removeBoss", () => {
  it("removes the kid's boss when it isn't in use", () => {
    expect(run(run(baseProject(), "createBoss", { name: "V" }), "removeBoss", {}).boss).toBeNull();
  });

  it("refuses while it is in the boss room", () => {
    let project = run(withSnowBoss(), "createBoss", { name: "Volt Viper" });
    project = run(project, "useBoss", { boss: "yours" });
    expect(runError(project, "removeBoss", {})).toBe("Volt Viper is in Boss Room. Put the Boss back first.");
  });
});
```

Add to `tests/model/gamePack.test.ts`:

```ts
describe("the kid's boss in the game pack", () => {
  it("is a boss thing type with its health and attack list", () => {
    const frame = Array.from({ length: 28 }, () => "1".repeat(24));
    const project = {
      ...game([]),
      boss: { name: "Volt Viper", fight: "long" as const, attacks: ["rain" as const, "big" as const], look: { colours: [13], frames: [frame, frame, frame] as [string[], string[], string[]] } },
    };
    expect(gamePack(project, testPack).things[0]).toEqual({
      type: "own-boss",
      name: "Volt Viper",
      category: "boss",
      behaviour: "boss",
      description: "Yours",
      defaults: { health: 40, attacks: "rain,big" },
      own: true,
    });
  });
});
```

Add to `tests/content/snowEnemies.test.ts`:

```ts
describe("the Blizzard Bot as a starting look", () => {
  it("has three good 24 by 28 frames in at most eight colours", () => {
    expect(framesProblems("boss", snowBossLook, BOSS_FRAME)).toEqual([]);
    expect(snowBossLook.frames).toHaveLength(3);
    expect(snowBossLook.colours.length).toBeLessThanOrEqual(8);
    expect(snowPack.bossLook).toBe(snowBossLook);
  });
});
```

(importing `snowBossLook` and `BOSS_FRAME`.)

In `tests/boundaries.test.ts`, add the six boss commands to the expected list:

```ts
        "createBoss", "setBoss", "setBossColours", "setBossFrame", "useBoss", "removeBoss",
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/commands/boss.test.ts tests/model tests/content tests/boundaries.test.ts`
Expected: FAIL (no boss commands; no `bossLook`).

- [ ] **Step 3: Boss data, looks and the game pack**

In `src/model/designs.ts`, after `bossDesignSchema`:

```ts
export const FIGHT_HEALTH: Record<BossDesign["fight"], number> = { short: 20, normal: 28, long: 40 };

// The thing settings for the kid's boss: its health and its attacks in order.
export function bossSettings(boss: BossDesign): { health: number; attacks: string } {
  return { health: FIGHT_HEALTH[boss.fight], attacks: boss.attacks.join(",") };
}
```

In `src/model/contentPack.ts`, import `type BossDesign` and add to `ContentPack`: `bossLook: BossDesign["look"]; // the drawing a new boss starts from`.

In `src/content/snow/enemies.ts`, add:

```ts
// The Blizzard Bot as the drawing a kid's new boss starts from.
export const snowBossLook = lettersToLook(
  snowArt.things.boss.map((sprite) => sprite.rows),
  SNOW_PALETTE,
) as BossDesign["look"];
```

(importing `type BossDesign`), and in `src/content/snow/pack.ts` add `bossLook: snowBossLook,`.

In `tests/fixtures/testPack.ts`, add `export const testBossLook = { colours: [13], frames: [bossFrame, bossFrame, bossFrame] } as BossDesign["look"];` with `const bossFrame = Array.from({ length: 28 }, () => "1".repeat(24));`, and `bossLook: testBossLook,` in `testPack`.

In `src/model/gamePack.ts`:

```ts
export const OWN_BOSS = "own-boss";
```

and, in `gamePack`, include the boss: return `pack` unchanged only when there are no enemies, no boss and no own types to drop; after the enemies, add

```ts
  if (project.boss) {
    own.push({
      type: OWN_BOSS,
      name: project.boss.name,
      category: "boss",
      behaviour: "boss",
      description: "Yours",
      defaults: bossSettings(project.boss),
      own: true,
    });
  }
```

(importing `bossSettings`; `own` becomes a `ThingDef[]` declared with `const` and pushed to). The order is the kid's enemies, then the kid's boss, then the pack's things.

- [ ] **Step 4: Boss commands**

`src/commands/boss.ts`:

```ts
import { z } from "zod";
import { BOSS_ATTACKS, BOSS_FIGHTS, BOSS_FRAME, framesProblems, type BossDesign } from "@/model/designs";
import { OWN_BOSS } from "@/model/gamePack";
import { MAX_COLOURS } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import { tidyName, type Project } from "@/model/schema";
import { listNames } from "./helpers";
import { defineCommand, fail, nameArg, ok, type CommandResult } from "./types";

const NO_BOSS = "Your game has no boss of its own yet.";

function editBoss(project: Project, change: (boss: BossDesign) => BossDesign | string): CommandResult {
  if (!project.boss) return fail(NO_BOSS);
  const next = change(project.boss);
  return typeof next === "string" ? fail(next) : ok({ ...project, boss: next });
}

const createBossCommand = defineCommand({
  name: "createBoss",
  description: "Give the game a boss of its own, starting from the content pack's boss drawing and attacks.",
  args: z.strictObject({ name: nameArg }),
  apply(project, args, ctx) {
    if (project.boss) return fail("Your game already has a boss of its own.");
    return ok({ ...project, boss: { name: args.name, fight: "normal", attacks: ["jump", "spread", "dash"], look: ctx.pack.bossLook } });
  },
});

const setBossCommand = defineCommand({
  name: "setBoss",
  description: "Change the kid's boss: its name, its fight length (short, normal, long), its 2 or 3 attacks in order.",
  args: z.strictObject({
    name: nameArg.optional(),
    fight: z.enum(BOSS_FIGHTS).optional(),
    attacks: z.array(z.enum(BOSS_ATTACKS)).min(2).max(3).optional(),
  }),
  apply(project, args) {
    const given = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
    if (Object.keys(given).length === 0) return fail("Give something about the boss to change.");
    return editBoss(project, (boss) => ({ ...boss, ...given }));
  },
});

const setBossColoursCommand = defineCommand({
  name: "setBossColours",
  description: `Set the boss's colour slots: 1 to ${MAX_COLOURS} colours from the 8-bit palette.`,
  args: z.strictObject({
    colours: z.array(z.number().int().min(0).max(PALETTE_8BIT.length - 1)).min(1).max(MAX_COLOURS),
  }),
  apply(project, args) {
    return editBoss(project, (boss) => {
      for (let slot = args.colours.length + 1; slot <= boss.look.colours.length; slot++) {
        const frames = boss.look.frames.flatMap((rows, i) => (rows.some((row) => row.includes(String(slot))) ? [`frame ${i + 1}`] : []));
        if (frames.length > 0) return `Colour ${slot} is still used in ${tidyName(boss.name)}'s ${listNames(frames)}.`;
      }
      return { ...boss, look: { ...boss.look, colours: args.colours } };
    });
  },
});

const setBossFrameCommand = defineCommand({
  name: "setBossFrame",
  description: 'Replace one of the boss\'s three frames (0 stand, 1 jump, 2 attack) with rows of pixels.',
  args: z.strictObject({
    frame: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    rows: z.array(z.string()).min(1).max(64),
  }),
  apply(project, args) {
    return editBoss(project, (boss) => {
      const problem = framesProblems(tidyName(boss.name), { colours: boss.look.colours, frames: [args.rows] }, BOSS_FRAME)[0];
      if (problem) return problem.replace(" frame 1 ", ` frame ${args.frame + 1} `);
      const frames = boss.look.frames.map((rows, i) => (i === args.frame ? args.rows : rows)) as BossDesign["look"]["frames"];
      return { ...boss, look: { ...boss.look, frames } };
    });
  },
});

const useBossCommand = defineCommand({
  name: "useBoss",
  description: 'Put the content pack\'s boss ("snow") or the kid\'s own ("yours") in the boss room, in the same place.',
  args: z.strictObject({ boss: z.enum(["snow", "yours"]) }),
  apply(project, args, ctx) {
    if (args.boss === "yours" && !project.boss) return fail(NO_BOSS);
    const snow = ctx.pack.things.find((d) => d.behaviour === "boss" && !d.own);
    if (args.boss === "snow" && !snow) return fail("This content pack has no boss.");
    const isBoss = (type: string) => ctx.pack.things.find((d) => d.type === type)?.behaviour === "boss";
    let swapped = 0;
    const levels = project.levels.map((level) => ({
      ...level,
      zones: level.zones.map((zone) => {
        if (!zone.things.some((t) => isBoss(t.type))) return zone;
        return {
          ...zone,
          things: zone.things.map((t) => {
            if (!isBoss(t.type)) return t;
            swapped++;
            return args.boss === "yours"
              ? { ...t, type: OWN_BOSS, settings: {} }
              : { ...t, type: snow!.type, settings: { ...snow!.defaults } };
          }),
        };
      }),
    }));
    if (swapped === 0) return fail("There is no boss in a boss room to swap. Put one there first.");
    return ok({ ...project, levels });
  },
});

const removeBossCommand = defineCommand({
  name: "removeBoss",
  description: "Remove the kid's own boss. Refused while it is in the boss room.",
  args: z.strictObject({}),
  apply(project, _args, ctx) {
    if (!project.boss) return fail(NO_BOSS);
    const zones = project.levels.flatMap((level) => level.zones.filter((z) => z.things.some((t) => t.type === OWN_BOSS)).map((z) => z.name));
    if (zones.length > 0) {
      const snow = ctx.pack.things.find((d) => d.behaviour === "boss" && !d.own);
      return fail(`${tidyName(project.boss.name)} is in ${listNames(zones)}. Put the ${snow?.name ?? "other boss"} back first.`);
    }
    return ok({ ...project, boss: null });
  },
});

export const bossCommands = [
  createBossCommand,
  setBossCommand,
  setBossColoursCommand,
  setBossFrameCommand,
  useBossCommand,
  removeBossCommand,
];
```

Register `...bossCommands,` in `src/commands/registry.ts`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. (The test pack's boss is called "Boss", hence "Put the Boss back first." in the test; the snow pack's reads "Put the Blizzard Bot back first.")

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: give games a boss of their own: make it, set its attacks, draw it, and put it in the boss room"
```

---

### Task 2: The six boss attacks

**Files:**
- Modify: `src/runtime/sim/constants.ts`, `src/runtime/sim/entities/types.ts`, `src/runtime/sim/entities/boss.ts`, `src/runtime/sim/entities/enemyShots.ts`, `src/runtime/sim/combat.ts`, `src/runtime/render/art.ts`, `src/runtime/render/draw.ts`
- Modify tests: `tests/runtime/boss.test.ts`, `tests/runtime/art.test.ts`
- Test: `tests/runtime/bossAttacks.test.ts`

**Interfaces:**
- Consumes: `BOSS_ATTACKS`, `type BossAttack` (plan 1)
- Produces:
  - constants `BOSS_HURRIED_IDLE_STEPS = 24`, `AIMED_SHOT_SPEED = 3`, `RAIN_SPEED = 2.5`, `RAIN_SPACING = 40`, `BIG_SHOT_SIZE = 16`, `BIG_SHOT_SPEED = 1.25`, `BIG_SHOT_DAMAGE = 4`, `BIG_SHOT_HEIGHT = 30`
  - `EnemyShot.size?: number` (6 when absent)
  - `attacksOf(e: Entity): BossAttack[]`; boss modes `"jump" | "dash" | "spread" | "aimed" | "rain" | "big"` (plus `"intro"`, `"idle"`)

- [ ] **Step 1: Write the failing tests**

In `tests/runtime/boss.test.ts`, the shot attack is now called "spread": change `["jump", "shot", "dash", "jump"]` to `["jump", "spread", "dash", "jump"]`, the test name "attacks in the order jump, shot, dash, then repeats" to "attacks in the order jump, spread, dash, then repeats", and `boss.mode !== "shot"` to `boss.mode !== "spread"` (and any other `"shot"` mode in that file). In `tests/runtime/art.test.ts`, any `mode: "shot"` for a boss becomes `mode: "spread"`.

`tests/runtime/bossAttacks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BIG_SHOT_SIZE, BOSS_IDLE_STEPS, BOSS_HURRIED_IDLE_STEPS, PLAYER_H } from "@/runtime/sim/constants";
import { attacksOf } from "@/runtime/sim/entities/boss";
import type { Entity } from "@/runtime/sim/entities/types";
import type { Sim } from "@/runtime/sim/state";
import { flatArt, thing } from "./helpers";
import { entity, makeSim, run } from "./simHelpers";

function arena(attacks?: string, x = 12) {
  const settings = attacks === undefined ? {} : { attacks };
  const sim = makeSim([{ art: flatArt(), things: [thing("boss", x, 12, settings)] }]);
  const boss = entity(sim, "boss");
  if (!boss) throw new Error("no boss");
  sim.player.invuln = 1_000_000;
  return { sim, boss };
}

// Runs until the boss starts the given attack (or gives up).
function until(sim: Sim, boss: Entity, mode: string) {
  for (let i = 0; i < 2000 && boss.mode !== mode; i++) run(sim, {}, 1);
  expect(boss.mode).toBe(mode);
}

function order(sim: Sim, boss: Entity, count: number): string[] {
  const seen: string[] = [];
  for (let i = 0; i < 4000 && seen.length < count; i++) {
    const before = boss.mode;
    run(sim, {}, 1);
    if (boss.mode !== before && boss.mode !== "idle") seen.push(boss.mode);
  }
  return seen;
}

describe("boss attack lists", () => {
  it("default to jump, spread, dash", () => {
    const { boss } = arena();
    expect(attacksOf(boss)).toEqual(["jump", "spread", "dash"]);
  });

  it("follow the order given, round and round, skipping unknown names", () => {
    const { sim, boss } = arena("rain, fireworks,big");
    expect(attacksOf(boss)).toEqual(["rain", "big"]);
    expect(order(sim, boss, 4)).toEqual(["rain", "big", "rain", "big"]);
  });

  it("pause for less time between attacks below half health", () => {
    const { sim, boss } = arena("aimed,aimed");
    until(sim, boss, "aimed");
    for (let i = 0; i < 200 && boss.mode !== "idle"; i++) run(sim, {}, 1);
    expect(boss.timer).toBe(BOSS_IDLE_STEPS);
    boss.health = 13;
    until(sim, boss, "aimed");
    for (let i = 0; i < 200 && boss.mode !== "idle"; i++) run(sim, {}, 1);
    expect(boss.timer).toBe(BOSS_HURRIED_IDLE_STEPS);
  });
});

describe("the new attacks", () => {
  it("aimed: one quick shot straight at the hero", () => {
    const { sim, boss } = arena("aimed,aimed");
    until(sim, boss, "aimed");
    expect(sim.enemyShots).toHaveLength(1);
    const shot = sim.enemyShots[0];
    expect(Math.hypot(shot.vx, shot.vy)).toBeCloseTo(3);
    expect(shot.vx).toBeLessThan(0); // the hero is to the left
  });

  it("rain: four falling shots with gaps over two tiles wide", () => {
    const { sim, boss } = arena("rain,rain");
    until(sim, boss, "rain");
    const xs = sim.enemyShots.map((s) => s.x).sort((a, b) => a - b);
    expect(sim.enemyShots.every((s) => s.vx === 0 && s.vy > 0)).toBe(true);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1] - 6).toBeGreaterThan(32);
    expect(xs.length).toBeGreaterThan(0);
    expect(xs.length).toBeLessThanOrEqual(4);
  });

  it("rain: the pattern moves every other rain, even between other attacks", () => {
    const { sim, boss } = arena("jump,rain");
    until(sim, boss, "rain");
    const first = sim.enemyShots.map((s) => s.x - sim.player.x).sort((a, b) => a - b);
    for (let i = 0; i < 200 && boss.mode !== "idle"; i++) run(sim, {}, 1);
    sim.enemyShots = [];
    until(sim, boss, "rain");
    const second = sim.enemyShots.map((s) => s.x - sim.player.x).sort((a, b) => a - b);
    expect(second).not.toEqual(first);
  });

  it("big: one large, slow shot that a sliding hero passes under and a standing hero doesn't", () => {
    const { sim, boss } = arena("big,big");
    until(sim, boss, "big");
    const shot = sim.enemyShots[0];
    expect(sim.enemyShots).toHaveLength(1);
    expect(shot.size).toBe(BIG_SHOT_SIZE);
    expect(shot.damage).toBe(4);
    const floor = boss.y + boss.h;
    const bottom = shot.y + BIG_SHOT_SIZE;
    expect(floor - bottom).toBe(14); // a 14-high sliding body fits under
    expect(bottom).toBeGreaterThan(floor - PLAYER_H); // a standing body doesn't
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime/bossAttacks.test.ts tests/runtime/boss.test.ts`
Expected: FAIL (`attacksOf` doesn't exist; the boss's attack is still called "shot").

- [ ] **Step 3: Constants and shot sizes**

In `src/runtime/sim/constants.ts`, after the boss constants:

```ts
// A hurt boss (below half health) pauses less between attacks.
export const BOSS_HURRIED_IDLE_STEPS = 24;
// The boss's new attacks.
export const AIMED_SHOT_SPEED = 3;
export const RAIN_SPEED = 2.5;
export const RAIN_SPACING = 40; // pixels between falling shots: every gap is over two tiles
export const BIG_SHOT_SIZE = 16;
export const BIG_SHOT_SPEED = 1.25;
export const BIG_SHOT_DAMAGE = 4;
export const BIG_SHOT_HEIGHT = 30; // its top above the boss's feet: a 14-high slide passes under
```

In `src/runtime/sim/entities/types.ts`: `export type EnemyShot = { x: number; y: number; vx: number; vy: number; damage: number; size?: number };`

In `src/runtime/sim/entities/enemyShots.ts`, use each shot's size: `const size = shot.size ?? ENEMY_SHOT_SIZE;` inside the filter (replacing the constant before it).

In `src/runtime/sim/combat.ts`, the enemy-shot box and knockback use `const size = shot.size ?? ENEMY_SHOT_SIZE;`.

- [ ] **Step 4: The attacks**

Replace the top of `src/runtime/sim/entities/boss.ts` (up to `updateBoss`) with:

```ts
import { BOSS_ATTACKS, type BossAttack } from "@/model/designs";
import { moveX } from "../body";
import {
  AIMED_SHOT_SPEED,
  BIG_SHOT_DAMAGE,
  BIG_SHOT_HEIGHT,
  BIG_SHOT_SIZE,
  BIG_SHOT_SPEED,
  BOSS_HURRIED_IDLE_STEPS,
  BOSS_IDLE_STEPS,
  ENEMY_SHOT_SIZE,
  RAIN_SPACING,
  RAIN_SPEED,
} from "../constants";
import type { Sim } from "../state";
import { cameraFor } from "../view";
import { fall, fireAt, towardPlayer } from "./motion";
import { num, type Entity } from "./types";

const DEFAULT_ATTACKS: BossAttack[] = ["jump", "spread", "dash"]; // the Blizzard Bot's
const SHOOTING: ReadonlySet<string> = new Set(["spread", "aimed", "rain", "big"]);

// The boss's attacks, in order, from its settings ("jump,rain"); unknown names are skipped.
export function attacksOf(e: Entity): BossAttack[] {
  const list = e.settings.attacks;
  if (typeof list !== "string") return DEFAULT_ATTACKS;
  const attacks = list
    .split(",")
    .map((name) => name.trim())
    .filter((name): name is BossAttack => (BOSS_ATTACKS as readonly string[]).includes(name));
  return attacks.length > 0 ? attacks : DEFAULT_ATTACKS;
}

function toIdle(e: Entity): void {
  e.mode = "idle";
  const hurt = e.health < num(e.settings, "health", 28) / 2;
  e.timer = hurt ? BOSS_HURRIED_IDLE_STEPS : BOSS_IDLE_STEPS;
  e.vx = 0;
}

function startAttack(sim: Sim, e: Entity): void {
  const attacks = attacksOf(e);
  const attack = attacks[e.attack % attacks.length];
  // How many rains came before this one, so the rain's gap moves every other rain whatever the list.
  const cycles = Math.floor(e.attack / attacks.length);
  const rainsBefore =
    cycles * attacks.filter((a) => a === "rain").length +
    attacks.slice(0, e.attack % attacks.length).filter((a) => a === "rain").length;
  e.attack++;
  e.facing = towardPlayer(sim, e);
  e.mode = attack;
  const s = e.settings;
  const damage = num(s, "shotDamage", 3);
  if (attack === "jump") {
    e.vy = -num(s, "jumpSpeed", 5.5);
    e.vx = e.facing * num(s, "jumpDrift", 1.75);
  } else if (attack === "dash") {
    e.vx = e.facing * num(s, "dashSpeed", 3);
  } else if (attack === "spread") {
    const speed = num(s, "shotSpeed", 2);
    for (const vy of [-0.5, 0, 0.5]) fireAt(sim, e, e.facing * speed, vy, damage);
    e.timer = 40;
  } else if (attack === "aimed") {
    const p = sim.player;
    const dx = p.x + p.w / 2 - (e.x + e.w / 2);
    const dy = p.y + p.h / 2 - (e.y + e.h / 2);
    const distance = Math.hypot(dx, dy) || 1;
    fireAt(sim, e, (dx / distance) * AIMED_SHOT_SPEED, (dy / distance) * AIMED_SHOT_SPEED, damage);
    e.timer = 40;
  } else if (attack === "rain") {
    // Four shots from the top of the screen, around the hero, with gaps over two tiles wide. Every
    // other rain the pattern shifts, so standing still isn't always safe.
    const p = sim.player;
    const top = cameraFor(sim).y;
    const shift = rainsBefore % 2 === 0 ? 0 : -RAIN_SPACING / 2;
    const centre = p.x + p.w / 2 - ENEMY_SHOT_SIZE / 2 + shift;
    for (const k of [-2, -1, 0, 1]) {
      sim.enemyShots.push({ x: centre + k * RAIN_SPACING, y: top, vx: 0, vy: RAIN_SPEED, damage });
    }
    e.timer = 40;
  } else {
    // big: one large, slow shot at chest height, low enough to jump, high enough to slide under.
    sim.enemyShots.push({
      x: e.facing > 0 ? e.x + e.w : e.x - BIG_SHOT_SIZE,
      y: e.y + e.h - BIG_SHOT_HEIGHT,
      vx: e.facing * BIG_SHOT_SPEED,
      vy: 0,
      damage: BIG_SHOT_DAMAGE,
      size: BIG_SHOT_SIZE,
    });
    e.timer = 40;
  }
}
```

and in `updateBoss`, change the timed modes: `if (e.mode === "intro" || e.mode === "idle" || SHOOTING.has(e.mode)) {`, and update its comment to "A boss: an intro, then idle and an attack in turn, forever."

(`BIG_SHOT_HEIGHT` is 30 and the shot 16 high, so its bottom is 14 above the floor.)

In `src/runtime/render/art.ts`, `thingFrame` for the boss uses the attack frame for every shooting attack:

```ts
    case "boss":
      return pick(e.mode === "jump" ? 1 : ["spread", "aimed", "rain", "big"].includes(e.mode) ? 2 : 0);
```

In `src/runtime/render/draw.ts`, draw each enemy shot at its size:

```ts
  for (const shot of sim.enemyShots) {
    const x = Math.round(shot.x) + originX;
    const y = Math.round(shot.y) + originY;
    const size = shot.size ?? ENEMY_SHOT_SIZE;
    if (skin) ctx.drawImage(skin.image(skin.set.enemyShot, shot.vx < 0), x, y, size, size);
    else rect(ctx, ENEMY_SHOT_COLOUR, x, y, size, size);
  }
```

(`Ctx2D`'s `drawImage` already allows the sized form. If a render test compares `drawImage` calls exactly, it now also sees the size arguments; the existing fake context only reads the first three, so it is unaffected.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass, including every existing boss test (with "spread").

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: give bosses six attacks in any order: jump, dash, spread, aimed, rain and big, quicker when hurt"
```

---

### Task 3: Drawing the kid's boss

**Files:**
- Modify: `src/runtime/render/lookArt.ts`, `src/runtime/render/PlayCanvas.tsx`, `src/editor/Editor.tsx`, `src/editor/components/GamePreview.tsx`, `src/editor/components/EnemiesScreen.tsx`, `src/editor/components/HeroScreen.tsx`, `docs/superpowers/status.md`
- Test: additions to `tests/runtime/lookArt.test.ts`, `tests/runtime/ownEnemies.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2
- Produces: `ownSkins(enemies: EnemyDesign[], imageFor, boss?: BossDesign | null)` includes `OWN_BOSS` when there is a boss; `GamePreview` gains `boss?: BossDesign | null`

- [ ] **Step 1: Write the failing tests**

Add to `tests/runtime/lookArt.test.ts`:

```ts
  it("includes the kid's boss when there is one", () => {
    let project = run(game(), "createBoss", { name: "Volt Viper" });
    project = run(project, "useBoss", { boss: "yours" });
    const skins = ownSkins(project.enemies, () => fake, project.boss);
    expect(skins["own-boss"].art.frames).toHaveLength(3);
    // Start the game in the boss room so the boss is on screen.
    const sim = createSim(project, "L1", pack, { startZoneId: "boss" });
    step(sim, NO_INPUT);
    const ctx = recorder();
    draw(ctx, sim, { set: snowArt, image: fake, own: skins });
    expect(ctx.images.some((i) => skins["own-boss"].art.frames.includes(i.sprite))).toBe(true);
  });
```

(in the `describe("lookArt")` block; `game()` from `tests/ai/helpers` already places the Blizzard Bot in the boss room.)

Add to `tests/runtime/ownEnemies.test.ts`:

```ts
describe("the kid's boss in the game", () => {
  it("fights with its own attacks and health", () => {
    let project = run(game(), "createBoss", { name: "Volt Viper" });
    project = run(project, "setBoss", { fight: "long", attacks: ["rain", "big"] });
    project = run(project, "useBoss", { boss: "yours" });
    const sim = createSim(project, "L1", pack, { startZoneId: "boss" });
    step(sim, NO_INPUT);
    const boss = sim.slots.find((s) => s.def.behaviour === "boss")!.entity!;
    expect(boss.health).toBe(40);
    expect(boss.settings.attacks).toBe("rain,big");
  });

  it("leaves the checker's verdict on the boss room unchanged", () => {
    let project = run(game(), "createBoss", { name: "Volt Viper" });
    const before = checkZone(project, "L1", "boss", pack).passable;
    project = run(project, "useBoss", { boss: "yours" });
    expect(checkZone(project, "L1", "boss", pack).passable).toBe(before);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/runtime/lookArt.test.ts tests/runtime/ownEnemies.test.ts`
Expected: FAIL (`ownSkins` has no boss).

- [ ] **Step 3: Write the implementation**

In `src/runtime/render/lookArt.ts`, import `type BossDesign` and `OWN_BOSS`, and add the boss:

```ts
export function ownSkins(
  enemies: EnemyDesign[],
  imageFor: (palette: Record<string, string>) => (s: Sprite, flip: boolean) => CanvasImageSource,
  boss: BossDesign | null = null,
): Record<string, OwnSkin> {
  const skin = (look: DesignLook): OwnSkin => {
    const art = lookArt(look);
    return { art, image: imageFor(art.palette) };
  };
  const skins: Record<string, OwnSkin> = Object.fromEntries(enemies.map((enemy) => [ownType(enemy.id), skin(enemy.look)]));
  if (boss) skins[OWN_BOSS] = skin(boss.look);
  return skins;
}
```

Pass the boss wherever own skins are built:
- `src/runtime/render/PlayCanvas.tsx`: `own: ownSkins(project.enemies, (palette) => createSpriteCache(palette, browserCanvas), project.boss),`
- `src/editor/Editor.tsx`: the skin's `useMemo` adds `const boss = project.boss;` beside `enemies`, passes it as the third argument, and depends on `[art, enemies, boss]`;
- `src/editor/components/GamePreview.tsx`: add `boss?: BossDesign | null` to `Props`, pass it to `ownSkins`, and add it to the effect's dependencies; `HeroScreen` and `EnemiesScreen` pass nothing (their previews have no boss).

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass.

- [ ] **Step 5: Update the status and commit**

In `docs/superpowers/status.md`: mark this plan implemented, reviewed and merged; say games can have a boss of their own with six possible attacks (made through commands for now; the Boss tab is next); update the test counts; add this plan's deferred review findings.

```bash
git add -A src tests docs/superpowers/STATUS.md
git commit -m "feat: draw the kid's own boss from its own drawing"
```

---

## Self-review

- **Spec coverage:** section 3's boss design and the game pack's `own-boss` → Task 1; section 4's boss commands (createBoss, setBoss, setBossColours, setBossFrame, useBoss, removeBoss) → Task 1; section 5's six attacks, the order, quicker when hurt, rain's moving safe gap, the big shot's slide-under height, the unchanged checker → Tasks 2 and 3; section 8's rows for the boss → Task 1; section 9's boss tests → Tasks 2 and 3. The Boss tab is plan 4; the assistant plan 5.
- **Types:** `BossAttack`, `bossSettings`, `FIGHT_HEALTH`, `OWN_BOSS`, `attacksOf`, `EnemyShot.size`, `ownSkins`'s boss argument are defined once and used with the same names.
- **Known limits, accepted:** rain shots that start off the screen are removed at once (fewer than four can fall at the room's edges); the big shot uses the ordinary enemy-shot picture, drawn bigger.
