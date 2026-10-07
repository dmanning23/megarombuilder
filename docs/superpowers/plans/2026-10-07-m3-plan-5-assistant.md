# The Assistant and the Kid's Designs Implementation Plan (Milestone 3, Plan 5 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The assistant knows the kid's own enemies and boss: it sees them in every message and in the catalogue, places the enemies with `place_thing`, makes the one the user names the star of a level, builds the boss room around the boss's attacks, and never changes the designs.

**Architecture:** One new describer, `describeDesigns(project, pack)`, goes into the editor context of every message, the level overview and the catalogue. Zone descriptions name placed own enemies, since the describers are given the game pack. The rule that a kid's design owns its settings moves into the commands: `placeThing` and `setThingSettings` refuse settings on own types, which settles the override question deferred since plan 1. The system prompt and tool hints gain the rules. No new tools.

**Tech Stack:** as plan 2. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-milestone-3-your-own-enemies-and-boss-design.md` (sections 1 (success criterion 5), 7, 9 (assistant); build order item 5)

**Plan series for milestone 3:**

1. Enemy data, the game pack, and drawing own enemies (done)
2. The Characters screen and the Enemies tab (done)
3. Boss data and the new boss attacks (done)
4. The Boss tab (done)
5. The assistant (this plan)

## Global Constraints

- No new tools. The assistant never designs, draws, tunes, renames or deletes enemies or bosses, and doesn't swap the boss.
- The API key stays on the server (the boundary test stands).
- The system prompt and tool list stay the same on every request, so they stay cached; anything about this game goes in the message.
- Replies stay short, friendly and plain for young users.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **A design owns its settings.** Placing an own enemy (or the kid's boss) with settings, or changing a placed one's settings, is refused: "Frost Fang's settings come from its design. The user can change it on the Characters screen." Placing with no settings or `{}` is fine. This closes two deferred items: the plan 1 one (placed settings override the design's tuning) and the plan 3 one (an own boss's attacks or health set past the design's rules). Old files that already hold such settings still open; the settings still apply.
- **How the assistant sees the designs** (`describeDesigns`):

  ```
  Their own enemies (place them with place_thing using the type; their settings come from their designs):
  - own-e1: Frost Fang, a walker that patrols back and forth: fast, 3 hits, high damage.
  - own-e2: Ice Eye, a turret that fires at the hero: 3 hits, normal damage, shoots often.
  Their own boss: Volt Viper, a long fight (40 health). Attacks in order: shots falling from above, a big slow shot at chest height, a dash along the floor. It is in the boss room.
  ```

  Only the tuning a behaviour uses is listed (speed for walkers, flyers, hoppers and shield guards; shooting for turrets and shield guards). When the boss isn't placed: "The Blizzard Bot is in the boss room instead; the user can swap theirs in on the Boss tab." With no designs: "They haven't made any enemies or a boss of their own yet."
- **Where it appears:** in every message's editor context (after the hero), in `get_level_overview`, and in `get_catalogue` (after the things, which stay the content pack's own).
- **Zone descriptions** name placed own enemies: `- t1: Frost Fang, yours (own-e1) at (6, 12)`.
- **The prompt** points to the Characters screen, not the old Hero button, and says:
  - When the user mentions one of their own enemies, make it the star of the level: introduce it alone somewhere safe, then use it more as the level goes on.
  - Build the boss room for the boss's attacks: a flat open floor for dashes and jumps, headroom for jumps and rain, no pits or spikes in the arena.
  - Never change, rename or delete their enemies or boss. If asked, point them to the Characters screen.

## Review Focus

1. **The assistant tries `set_thing_settings` or `place_thing` with settings on an own enemy**: the error goes back to Claude as a tool error, it carries on, and nothing changes. Tested in Task 3.
2. **A game with no designs**: the context says so in one line, and nothing else changes. Tested in Task 2.
3. **An enemy whose name contains quotes or odd spacing** ("  Frost   Fang "): it is described by its tidied name. Tested in Task 2.
4. **The kid's boss made but not placed, and placed**: the boss line says which boss is in the room. Tested in Task 2.
5. **The cached prompt**: the system prompt and tools are the same whatever the game holds. True by construction (`SYSTEM_PROMPT` is a constant and `toolDefinitions()` takes no game); Task 3's scripted turn checks the designs arrive in the message's editor-context block.

## File Structure

```
src/commands/things.ts                  own types refuse settings
src/ai/describe.ts                      describeDesigns; the catalogue and zones know the kid's designs
src/ai/execute.ts, src/ai/turn.ts       describe with the game pack; designs in the overview and context
src/ai/prompt.ts, src/ai/tools.ts       the rules and hints
docs/superpowers/ai-prompts.md          prompts 14 to 17
tests/commands/things.test.ts, tests/ai/describe.test.ts, tests/ai/turn.test.ts, tests/ai/prompt.test.ts, tests/ai/execute.test.ts
```

---

### Task 1: A design owns its settings

**Files:**
- Modify: `src/commands/things.ts`
- Test: additions to `tests/commands/things.test.ts`

**Interfaces:**
- Consumes: `ThingDef.own`, `gamePack` (plan 1)
- Produces: `placeThing` and `setThingSettings` refuse settings on own types with `"<name>'s settings come from its design. The user can change it on the Characters screen."`

- [ ] **Step 1: Write the failing tests**

Add to `tests/commands/things.test.ts` (using the file's `baseProject`, `run`, `runError` helpers from `./helpers`):

```ts
describe("the kid's own designs own their settings", () => {
  const withFang = () => run(baseProject(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
  const place = (settings?: Record<string, number>) => ({
    levelId: "L1",
    zoneId: "z1",
    thingId: "t1",
    type: "own-e1",
    x: 6,
    y: 12,
    ...(settings ? { settings } : {}),
  });
  const message = "Frost Fang's settings come from its design. The user can change it on the Characters screen.";

  it("places an own enemy with no settings, or empty ones", () => {
    expect(run(withFang(), "placeThing", place()).levels[0].zones[0].things[0].settings).toEqual({});
    expect(run(withFang(), "placeThing", place({})).levels[0].zones[0].things[0].settings).toEqual({});
  });

  it("refuses settings for an own enemy, placed or being placed", () => {
    expect(runError(withFang(), "placeThing", place({ speed: 2 }))).toBe(message);
    const placed = run(withFang(), "placeThing", place());
    expect(runError(placed, "setThingSettings", { levelId: "L1", zoneId: "z1", thingId: "t1", settings: { health: 9 } })).toBe(message);
  });

  it("refuses settings for the kid's boss", () => {
    let project = run(baseProject(), "placeThing", { levelId: "L1", zoneId: "boss", thingId: "b1", type: "boss", x: 10, y: 12 });
    project = run(project, "createBoss", { name: "Volt Viper" });
    project = run(project, "useBoss", { boss: "yours" });
    expect(runError(project, "setThingSettings", { levelId: "L1", zoneId: "boss", thingId: "b1", settings: { attacks: "rain" } })).toBe(
      "Volt Viper's settings come from its design. The user can change it on the Characters screen.",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/commands/things.test.ts`
Expected: FAIL (the settings are stored).

- [ ] **Step 3: Write the implementation**

In `src/commands/things.ts`, import `type ThingDef` from `@/model/contentPack` and `tidyName` from `@/model/schema`, and add:

```ts
// The kid's own enemies and boss take their settings from their designs, so placed copies always
// follow the Characters screen.
const ownSettingsProblem = (def: ThingDef) =>
  `${tidyName(def.name)}'s settings come from its design. The user can change it on the Characters screen.`;
```

In `placeThing`, after the unknown-type check: `if (def.own && Object.keys(args.settings).length > 0) return ownSettingsProblem(def);`, and store `settings: def.own ? {} : { ...def.defaults, ...args.settings }` (updating the comment above it to "An own enemy's or boss's settings come from its design at play time.").

`setThingSettings` takes `ctx` and refuses own types:

```ts
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const thing = zone.things.find((t) => t.id === args.thingId);
      const def = thing && ctx.pack.things.find((d) => d.type === thing.type);
      if (def?.own) return ownSettingsProblem(def);
      return editThing(zone, args.thingId, (t) => ({ ...t, settings: { ...t.settings, ...args.settings } }));
    });
  },
```

(`applyCommand` already gives commands the game pack, so own types are in `ctx.pack`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: let the kid's enemy and boss designs own their settings, wherever they are placed"
```

---

### Task 2: Describing the kid's designs

**Files:**
- Modify: `src/ai/describe.ts`, `src/ai/execute.ts`, `src/ai/turn.ts`
- Test: additions to `tests/ai/describe.test.ts`, `tests/ai/execute.test.ts`

**Interfaces:**
- Consumes: `TUNING_USED`, `FIGHT_HEALTH`, `ownType`, `OWN_BOSS`, `gamePack`, `tidyName`
- Produces: `describeDesigns(project: Project, pack: ContentPack): string`; `describeZone` names own things when given the game pack

- [ ] **Step 1: Write the failing tests**

Add to `tests/ai/describe.test.ts` (importing `describeDesigns` and `gamePack` from `@/model/gamePack`):

```ts
describe("describeDesigns", () => {
  function designed(): Project {
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "  Frost   Fang ", behaviour: "walker" });
    project = run(project, "setEnemyTuning", { enemyId: "e1", speed: "fast", health: 3, damage: "high" });
    project = run(project, "addEnemy", { enemyId: "e2", name: "Ice Eye", behaviour: "turret" });
    project = run(project, "setEnemyTuning", { enemyId: "e2", shoots: "often" });
    project = run(project, "createBoss", { name: "Volt Viper" });
    return run(project, "setBoss", { fight: "long", attacks: ["rain", "big", "dash"] });
  }

  it("lists each enemy by type, with only the tuning its behaviour uses", () => {
    const text = describeDesigns(designed(), pack);
    expect(text).toContain("Their own enemies (place them with place_thing using the type; their settings come from their designs):");
    expect(text).toContain("- own-e1: Frost Fang, a walker that patrols back and forth: fast, 3 hits, high damage.");
    expect(text).toContain("- own-e2: Ice Eye, a turret that fires at the hero: 3 hits, normal damage, shoots often.");
  });

  it("describes the boss's fight and attacks in order, and which boss is in the boss room", () => {
    const project = designed();
    const line =
      "Their own boss: Volt Viper, a long fight (40 health). Attacks in order: shots falling from above, a big slow shot at chest height, a dash along the floor.";
    expect(describeDesigns(project, pack)).toContain(`${line} The Blizzard Bot is in the boss room instead; the user can swap theirs in on the Boss tab.`);
    expect(describeDesigns(run(project, "useBoss", { boss: "yours" }), pack)).toContain(`${line} It is in the boss room.`);
  });

  it("says so in one line when there are no designs", () => {
    expect(describeDesigns(game(), pack)).toBe("They haven't made any enemies or a boss of their own yet.");
  });

  it("is in the catalogue, after the things", () => {
    const text = describeCatalogue(designed(), pack);
    expect(text.indexOf("- own-e1: Frost Fang")).toBeGreaterThan(text.indexOf("- boss: Blizzard Bot"));
  });
});

describe("describeZone with the kid's enemies", () => {
  it("names a placed own enemy and marks it as theirs", () => {
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 6, y: 12 });
    const text = describeZone(level(project), zone(project, "z1"), gamePack(project, pack));
    expect(text).toContain("- t1: Frost Fang, yours (own-e1) at (6, 12)");
  });
});
```

Add to `tests/ai/execute.test.ts`, in `describe("executeTool")` (importing `run` from `./helpers`):

```ts
  it("names the kid's enemies in a zone, and lists their designs in the level overview", () => {
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 6, y: 12 });
    const state = startTurn(project, "L1");
    const ctx = context();
    expect(executeTool(state, "get_zone", { zone: "Zone 1" }, ctx).content).toContain("- t1: Frost Fang, yours (own-e1) at (6, 12)");
    expect(executeTool(state, "get_level_overview", {}, ctx).content).toContain("- own-e1: Frost Fang, a walker");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ai/describe.test.ts tests/ai/execute.test.ts`
Expected: FAIL (`describeDesigns` doesn't exist; own things are named by type).

- [ ] **Step 3: Write the implementation**

In `src/ai/describe.ts`, import `FIGHT_HEALTH`, `TUNING_USED`, `type BossAttack`, `type EnemyBehaviour`, `type EnemyDesign` from `@/model/designs`, `OWN_BOSS` and `ownType` from `@/model/gamePack`, and `tidyName` from `@/model/schema`, then add:

```ts
const BEHAVIOUR_WORDS: Record<EnemyBehaviour, string> = {
  walker: "a walker that patrols back and forth",
  flyer: "a flyer that swoops toward the hero",
  turret: "a turret that fires at the hero",
  jumper: "a hopper that hops toward the hero",
  shielded: "a shield guard that blocks shots until it opens up",
  dropper: "a dropper that drops when the hero passes underneath",
};

const ATTACK_WORDS: Record<BossAttack, string> = {
  jump: "a jump at the hero",
  dash: "a dash along the floor",
  spread: "three spreading shots",
  aimed: "a quick shot aimed at the hero",
  rain: "shots falling from above",
  big: "a big slow shot at chest height",
};

function tuningWords(enemy: EnemyDesign): string {
  const t = enemy.tuning;
  const used = TUNING_USED[enemy.behaviour];
  return [
    used.includes("speed") ? t.speed : null,
    `${t.health} hit${t.health === 1 ? "" : "s"}`,
    `${t.damage} damage`,
    used.includes("shoots") ? `shoots ${t.shoots}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
}

// The kid's own enemies and boss, as the assistant needs them: what to place, and what it does.
export function describeDesigns(project: Project, pack: ContentPack): string {
  const { enemies, boss } = project;
  if (enemies.length === 0 && !boss) return "They haven't made any enemies or a boss of their own yet.";
  const lines: string[] = [];
  if (enemies.length > 0) {
    lines.push("Their own enemies (place them with place_thing using the type; their settings come from their designs):");
    for (const enemy of enemies) {
      lines.push(`- ${ownType(enemy.id)}: ${tidyName(enemy.name)}, ${BEHAVIOUR_WORDS[enemy.behaviour]}: ${tuningWords(enemy)}.`);
    }
  } else {
    lines.push("They haven't made any enemies of their own yet.");
  }
  if (boss) {
    const placed = project.levels.some((l) => l.zones.some((z) => z.things.some((t) => t.type === OWN_BOSS)));
    const other = pack.things.find((d) => d.behaviour === "boss" && !d.own)?.name ?? "content pack's boss";
    lines.push(
      `Their own boss: ${tidyName(boss.name)}, a ${boss.fight} fight (${FIGHT_HEALTH[boss.fight]} health). ` +
        `Attacks in order: ${boss.attacks.map((a) => ATTACK_WORDS[a]).join(", ")}. ` +
        (placed ? "It is in the boss room." : `The ${other} is in the boss room instead; the user can swap theirs in on the Boss tab.`),
    );
  } else {
    lines.push("They haven't made a boss of their own yet.");
  }
  return lines.join("\n");
}
```

(`TUNING_USED[behaviour]` is the array of tuning keys a behaviour uses. With the snow pack, `other` is "Blizzard Bot", so the line reads "The Blizzard Bot is in the boss room instead".)

In `describeCatalogue`, after the things list (before the pieces), add `"", describeDesigns(project, pack),`. The things list stays `pack.things` (the content pack's; callers pass the content pack).

In `describeZone`, name own things: replace the thing line with

```ts
    const def = pack.things.find((d) => d.type === thing.type);
    const settings = Object.keys(thing.settings).length > 0 ? `, settings ${JSON.stringify(thing.settings)}` : "";
    const name = def ? (def.own ? `${tidyName(def.name)}, yours` : def.name) : thing.type;
    lines.push(`- ${thing.id}: ${name} (${thing.type}) at (${thing.x}, ${thing.y})${settings}`);
```

In `src/ai/execute.ts` (importing `gamePack` and `describeDesigns`):
- `get_level_overview` returns `${describeLevel(...)}\n\n${describeHero(project)}\n\n${describeDesigns(project, ctx.pack)}`;
- `get_zone` returns `describeZone(level, zone!, gamePack(project, ctx.pack))`.

In `src/ai/turn.ts`'s `editorContext` (importing the same): after `describeHero(request.project)`, add `"", describeDesigns(request.project, pack),`, and describe the selected zone with `gamePack(request.project, pack)`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. (If an existing test compares the whole catalogue or overview text exactly, add the designs line to its expectation.)

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: show the assistant the kid's own enemies and boss in every message and in the catalogue"
```

---

### Task 3: The rules, a scripted turn, and prompts to try

**Files:**
- Modify: `src/ai/prompt.ts`, `src/ai/tools.ts`, `docs/superpowers/ai-prompts.md`, `docs/superpowers/STATUS.md`
- Test: additions to `tests/ai/prompt.test.ts`, `tests/ai/turn.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2

- [ ] **Step 1: Write the failing tests**

Add to `tests/ai/prompt.test.ts`:

```ts
  it("tells the assistant to build around the kid's own enemies and boss, and leave them alone", () => {
    expect(SYSTEM_PROMPT).toContain("make it the star of the level");
    expect(SYSTEM_PROMPT).toContain("Build the boss room for the boss's attacks");
    expect(SYSTEM_PROMPT).toContain("Never change, rename or delete their enemies or boss");
    expect(SYSTEM_PROMPT).toContain("Characters screen");
    expect(SYSTEM_PROMPT).not.toContain("Hero button");
  });
```

Add to `tests/ai/turn.test.ts`:

```ts
describe("the assistant and the kid's own enemies", () => {
  function withFang() {
    return run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
  }

  it("sees them in the message, and places one by its type", async () => {
    const { turn, requests, commands } = setup(
      [
        useTools(["place_thing", { zone: "Zone 1", type: "own-e1", x: 8, y: 12 }]),
        useTools(["check_zone", { zone: "Zone 1" }]),
        say("Frost Fang now guards Zone 1."),
      ],
      { project: withFang(), text: "Build a level for my Frost Fang" },
    );
    expect(await turn()).toMatchObject({ ok: true, reply: "Frost Fang now guards Zone 1." });
    const context = (requests[0][0].content as Anthropic.TextBlockParam[])[1].text;
    expect(context).toContain("- own-e1: Frost Fang, a walker");
    expect(commands).toEqual([
      expect.objectContaining({ name: "placeThing", args: expect.objectContaining({ type: "own-e1", x: 8, y: 12 }) }),
    ]);
  });

  it("gets an error back, and changes nothing, when it tries to change an own enemy's settings", async () => {
    let project = withFang();
    project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 8, y: 12 });
    const { turn, requests, commands } = setup(
      [
        useTools(["set_thing_settings", { zone: "Zone 1", thingId: "t1", settings: { speed: 3 } }]),
        say("Frost Fang's speed is set on the Characters screen."),
      ],
      { project },
    );
    expect(await turn()).toMatchObject({ ok: true });
    const result = toolResults(lastUser(requests[1]))[0];
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("settings come from its design");
    expect(commands).toEqual([]);
  });

});
```

(`run` comes from `./helpers`; add it to the import.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ai/prompt.test.ts tests/ai/turn.test.ts`
Expected: FAIL on the prompt test (no rules yet). The turn tests may already pass after Tasks 1 and 2: they pin the behaviour end to end. Confirm each fails without its part by temporarily removing `describeDesigns` from the context (the first) and the refusal in `setThingSettings` (the second), then put them back.

- [ ] **Step 3: The rules and hints**

In `src/ai/prompt.ts`, in "The hero", change the last line to:

```
- You can't draw or recolour the hero. If the user asks, tell them they can do it themselves on the Characters screen.
```

and add, after "The hero" section:

```
Their own enemies and boss
- The user may have designed their own enemies and boss. Each message lists them: what each enemy does, how tough it is, and its type to use with place_thing; the boss's attacks in order, and which boss is in the boss room.
- When the user mentions one of their own enemies, make it the star of the level: introduce it alone somewhere safe, then use it more as the level goes on, mixed with other enemies and hazards.
- Place their enemies without settings: each one's settings come from its design.
- Build the boss room for the boss's attacks: a flat, open floor for dashes and jumps, headroom for jumps and falling shots, and no pits or spikes in the arena.
- Never change, rename or delete their enemies or boss, and don't swap which boss is in the boss room. If they ask, tell them they can do it themselves on the Characters screen.
```

Update the last "Good level design" line to: `- Match the theme the user describes, for example their own enemies, their boss or their setting.`

In `src/ai/tools.ts`, extend the `place_thing` hint with ` The user's own enemies have types starting with "own-"; place them without settings.` and add `set_thing_settings: " Not for the user's own enemies or boss: their settings come from their designs.",` to `HINTS`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass.

- [ ] **Step 5: Prompts to try, and the status**

Append to `docs/superpowers/ai-prompts.md`, and change prompt 12's "point to the Hero button" to "point to the Characters screen":

```
14. (Make a walker called Frost Fang on the Enemies tab first) "Build me a level for my Frost Fang." (Frost Fang should be the star: met alone first, then more often; every zone passes)
15. (Make a boss with rain and dash, and use it) "Make the boss room good for my boss." (a flat, open arena with headroom; no pits or spikes)
16. (With Frost Fang) "Make Frost Fang faster." (should say it can't, and point to the Characters screen)
17. (With Frost Fang placed) "Add more of my enemies to Zone 1." (places Frost Fang, not snow enemies; the zone still passes)
```

In `docs/superpowers/STATUS.md`: mark this plan implemented, reviewed and merged, and milestone 3 complete; say the assistant knows the kid's own enemies and boss and builds around them; remove the two deferred items this plan settles (M3 plan 1's placed settings overriding the design, M3 plan 3's setThingSettings on an own boss); point "Try the assistant" at prompts 1 to 17; update the test counts; add this plan's deferred review findings.

- [ ] **Step 6: Commit**

```bash
git add -A src tests docs/superpowers/ai-prompts.md docs/superpowers/STATUS.md
git commit -m "feat: teach the assistant to build around the kid's own enemies and boss"
```

---

## Self-review

- **Spec coverage:** section 7: the catalogue lists the kid's enemies by name, behaviour and strength and the boss with its attacks in order → Task 2; places them with `place_thing` using `own-…` types → Tasks 2 and 3; the system prompt's star rule, boss-room rule, never-change rule and pointing to the Characters screen → Task 3; no new tools → Global Constraints. Section 1's criterion 5 (the star of the level, every zone passes) → Task 3's scripted turn and prompt 14. Section 9's assistant tests (catalogue text, a scripted turn placing the kid's enemy, hand-run prompts) → Tasks 2 and 3. The override question deferred since plan 1 → Task 1.
- **Types:** `describeDesigns`, `ownSettingsProblem`, `BEHAVIOUR_WORDS`, `ATTACK_WORDS` are defined once and used with the same names.
- **Known limits, accepted:** the assistant can't swap in the kid's boss (the spec gives it no tool); old files with settings stored on own things keep them.
