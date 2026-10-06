# The Assistant and the Hero Implementation Plan (Milestone 2, Plan 5 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chat assistant knows the hero: it sees its abilities in words, builds levels that use them (crawl spaces only for a hero who can slide, tougher enemies for a charge shot), changes abilities when asked ("make my hero jump higher") with a new `set_hero_abilities` tool, and then checks the whole level.

**Architecture:** `describeHero(project)` turns the hero's abilities into a sentence, which goes into the catalogue, the level overview tool and what the editor attaches to each message. `set_hero_abilities` is generated from the `setHeroAbilities` command like every other tool; the tool generator learns that some commands take no level. An ability change marks every zone as changed, so the turn loop's check rule (check every changed zone before finishing) covers it. The system prompt gains the rules for building around the hero.

**Tech Stack:** as plan 4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-milestone-2-your-own-hero-design.md` (section 8; the assistant rows of sections 9 and 10; build order item 5)

**Plan series for milestone 2:**

1. Hero data and abilities (done)
2. Slide and charge shot (done)
3. The hero screen (done)
4. Picture import (done)
5. The assistant (this plan)

## Global Constraints

- The assistant changes the hero only through `setHeroAbilities`; it never draws or recolours the hero.
- Tool definitions stay generated from the command schemas.
- The assistant changes abilities only when the user asks.
- Interface and prompt language stays short, plain and friendly for young users.
- Import alias `@/` maps to `src/`.

## Decisions this plan makes

- **The hero in words**, from the measured ability table: "Your hero runs at normal speed, jumps onto ledges up to 2 tiles high, has 28 health and can have 3 shots on screen. It can slide under gaps one tile high. It has a charge shot." Speed reads "normal speed", "fast" or "very fast"; jump reads 2, 2, 3 or 4 tiles; a hero without a move says "It can't slide." / "It has no charge shot."
- **Where it appears:** at the top of the catalogue (replacing the old "The player can jump…" line, which it covers), in `get_level_overview`'s result, and in the editor's attachment to each message.
- **`set_hero_abilities`** is a plan tool. Its activity line reads "Changing your hero…". Its result says what the hero can do now.
- **Tools that don't take a level** (only `set_hero_abilities` so far) are generated without one; the tool generator records whether a command has a `levelId`.
- **An ability change marks every zone of the level as changed**, so if Claude doesn't check them, the browser's forced check round does.

## Review Focus

1. **Claude sends an ability step that doesn't exist, or a level id, or nothing**: a readable error goes back and the hero is unchanged. Tested in Task 2.
2. **Claude lowers the jump and stops without checking**: the forced check round reports every zone, including ones that now fail. Tested in Task 2.
3. **A user asks for sliding with a hero that can't slide**: the turn can give the hero slide and build a crawl space, and every zone passes. Tested in Task 2 (scripted).
4. **The hero sentence for every combination of steps**: it is grammatical and matches the ability table. Tested in Task 1.

## File Structure

```
src/ai/describe.ts     describeHero; the catalogue starts with it
src/ai/execute.ts      get_level_overview adds the hero; commands without a level; ability changes touch every zone; "Changing your hero…"
src/ai/turn.ts         the editor's attachment includes the hero
src/ai/tools.ts        set_hero_abilities; levelArg
src/ai/prompt.ts       building around the hero
docs/superpowers/ai-prompts.md, docs/superpowers/status.md
tests/ai/describe.test.ts, tests/ai/tools.test.ts, tests/ai/execute.test.ts, tests/ai/turn.test.ts, tests/ai/prompt.test.ts
```

---

### Task 1: The hero in words

**Files:**
- Modify: `src/ai/describe.ts`, `src/ai/execute.ts`, `src/ai/turn.ts`
- Modify tests: `tests/ai/describe.test.ts`, `tests/ai/execute.test.ts`, `tests/ai/turn.test.ts`

**Interfaces:**
- Consumes: `Abilities`, `DEFAULT_ABILITIES`, `SPEEDS`, `JUMPS`, `HEALTHS`, `SHOT_COUNTS`, `heroPhysics` (plan 1)
- Produces: `describeHero(project: Project): string`

- [ ] **Step 1: Write the failing tests**

Add to `tests/ai/describe.test.ts` (importing `describeHero`, and `DEFAULT_ABILITIES, HEALTHS, JUMPS, SHOT_COUNTS, SPEEDS, type Abilities` from `@/model/hero`):

```ts
describe("describeHero", () => {
  const withAbilities = (changes: Partial<Abilities>) => {
    const project = game();
    return { ...project, hero: { ...project.hero, abilities: { ...DEFAULT_ABILITIES, ...changes } } };
  };

  it("says what a new hero can do", () => {
    expect(describeHero(game())).toBe(
      "Your hero runs at normal speed, jumps onto ledges up to 2 tiles high, has 28 health and can have 3 shots on screen. It can't slide. It has no charge shot.",
    );
  });

  it("says what a hero with every move can do", () => {
    expect(describeHero(withAbilities({ speed: "veryFast", jump: "veryHigh", health: "tough", shots: 1, slide: true, chargeShot: true }))).toBe(
      "Your hero runs very fast, jumps onto ledges up to 4 tiles high, has 40 health and can have 1 shot on screen. It can slide under gaps one tile high. It has a charge shot.",
    );
  });

  it("reads well for every step", () => {
    for (const speed of SPEEDS)
      for (const jump of JUMPS)
        for (const health of HEALTHS)
          for (const shots of SHOT_COUNTS) {
            const text = describeHero(withAbilities({ speed, jump, health, shots }));
            expect(text).toMatch(/^Your hero runs (at normal speed|fast|very fast), jumps onto ledges up to [234] tiles high, has (20|28|40) health and can have [1235] shots? on screen\./);
            expect(text).not.toMatch(/1 shots/);
          }
  });

  it("opens the catalogue", () => {
    expect(describeCatalogue(game(), pack)).toMatch(/^Your hero runs at normal speed/);
  });
});
```

and change the catalogue test's jump line expectation from `"The player can jump up 2 tiles and across gaps up to 3 tiles wide."` to:

```ts
    expect(text).toContain("It can jump across gaps up to 3 tiles wide.");
```

Add to `tests/ai/execute.test.ts`, in "executeTool":

```ts
  it("includes the hero in the level overview", () => {
    expect(executeTool(startTurn(game(), "L1"), "get_level_overview", {}, context()).content).toContain("Your hero runs at normal speed");
  });
```

Add to `tests/ai/turn.test.ts`, in the test "sends earlier chat, the new message, and what the editor shows":

```ts
    expect(blocks[1].text).toContain("Your hero runs at normal speed");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ai`
Expected: FAIL (`describeHero` is not exported).

- [ ] **Step 3: Write the implementation**

In `src/ai/describe.ts`, import `type Abilities` from `"@/model/hero"` (with `heroPhysics`), and add:

```ts
const SPEED_TEXT: Record<Abilities["speed"], string> = { normal: "at normal speed", fast: "fast", veryFast: "very fast" };
// The highest ledge each jump lands on, measured with the checker (plan 1 of milestone 2).
const JUMP_TILES: Record<Abilities["jump"], number> = { low: 2, normal: 2, high: 3, veryHigh: 4 };

// What the hero can do, in words.
export function describeHero(project: Project): string {
  const a = project.hero.abilities;
  const physics = heroPhysics(a);
  return [
    `Your hero runs ${SPEED_TEXT[a.speed]}, jumps onto ledges up to ${JUMP_TILES[a.jump]} tiles high, has ${physics.maxHealth} health and can have ${a.shots} shot${a.shots === 1 ? "" : "s"} on screen.`,
    a.slide ? "It can slide under gaps one tile high." : "It can't slide.",
    a.chargeShot ? "It has a charge shot." : "It has no charge shot.",
  ].join(" ");
}
```

and in `describeCatalogue`, replace the line

```ts
    `The player can jump up ${Math.floor(reach.height / TILE_SIZE)} tiles and across gaps up to ${clearableGap(project.player)} tiles wide.`,
```

(as it now reads, using `physics`) with

```ts
    describeHero(project),
    `It can jump across gaps up to ${clearableGap(physics)} tiles wide.`,
```

moved to be the first two entries of the array (before the content pack line), and remove the `reach` variable and any imports left unused (`jumpReach`, `TILE_SIZE` if nothing else uses them).

In `src/ai/execute.ts`, import `describeHero` and make the overview:

```ts
    case "get_level_overview":
      return ok(`${describeLevel(level, ctx.checks.level(project, levelId, ctx.pack))}\n\n${describeHero(project)}`);
```

In `src/ai/turn.ts`, import `describeHero` and add it to `editorContext` after the level:

```ts
    describeLevel(level, checks.level(request.project, request.levelId, pack)),
    "",
    describeHero(request.project),
    "",
    "The zone the user has selected:",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/ai && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai tests/ai
git commit -m "feat: describe the hero's abilities to the assistant"
```

---

### Task 2: The set_hero_abilities tool

**Files:**
- Modify: `src/ai/tools.ts`, `src/ai/execute.ts`
- Modify tests: `tests/ai/tools.test.ts`, `tests/ai/execute.test.ts`, `tests/ai/turn.test.ts`

**Interfaces:**
- Consumes: `setHeroAbilities` (plan 1); `describeHero` (Task 1); the AI test helpers `game`, `pack`, `counter`, `scriptedModel`, `say`, `useTools`
- Produces:
  - tool `set_hero_abilities` (kind `plan`), input: any of `speed`, `jump`, `health`, `shots`, `slide`, `chargeShot`
  - `AiTool.command` gains `levelArg: boolean`

- [ ] **Step 1: Write the failing tests**

In `tests/ai/tools.test.ts`, add `"set_hero_abilities"` to the expected list after `"set_zone_openings"`, and add:

```ts
  it("lets the assistant change the hero's abilities, and nothing else about the hero", () => {
    expect(properties("set_hero_abilities")).toEqual(["speed", "jump", "health", "shots", "slide", "chargeShot"]);
    expect(tool("set_hero_abilities").command).toMatchObject({ name: "setHeroAbilities", levelArg: false });
    expect(tool("fill_rect").command).toMatchObject({ levelArg: true });
    expect(AI_TOOLS.some((t) => /hero_(colours|pose|look)/.test(t.name))).toBe(false);
  });
```

Add to `tests/ai/execute.test.ts`, in "executeTool":

```ts
  it("changes the hero's abilities, says what it can do now, and counts every zone as changed", () => {
    const out = executeTool(startTurn(game(), "L1"), "set_hero_abilities", { slide: true, jump: "high" }, context());
    expect(out).toMatchObject({ isError: false, activity: "Changing your hero…" });
    expect(out.command).toEqual({ name: "setHeroAbilities", args: { slide: true, jump: "high" } });
    expect(out.content).toBe("Done. Your hero runs at normal speed, jumps onto ledges up to 3 tiles high, has 28 health and can have 3 shots on screen. It can slide under gaps one tile high. It has no charge shot.");
    expect(out.state.project.hero.abilities).toMatchObject({ slide: true, jump: "high" });
    expect(uncheckedZones(out.state)).toEqual(["z1", "corridor", "boss"]);
  });

  it("refuses ability steps that don't exist, a level id, and nothing at all", () => {
    const state = startTurn(game(), "L1");
    for (const input of [{ jump: "huge" }, { shots: 4 }, { slide: true, levelId: "L1" }]) {
      const out = executeTool(state, "set_hero_abilities", input, context());
      expect(out.isError, JSON.stringify(input)).toBe(true);
      expect(out.state).toBe(state);
    }
    expect(executeTool(state, "set_hero_abilities", {}, context()).content).toBe("Give at least one ability to change.");
  });
```

Add to `tests/ai/turn.test.ts`:

```ts
describe("the assistant and the hero", () => {
  it("gives the hero slide and builds a crawl space it can get through", async () => {
    const { turn, commands } = setup([
      useTools(["set_hero_abilities", { slide: true }]),
      useTools(["insert_piece", { zone: "Zone 1", pieceId: "crawl-space", x: 5, y: 0, settings: { length: 4 } }]),
      useTools(["check_level", {}]),
      say("Your hero can slide now, and Zone 1 has a crawl space."),
    ]);
    const result = await turn();
    expect(result).toMatchObject({ ok: true, reply: "Your hero can slide now, and Zone 1 has a crawl space." });
    if (!result.ok) throw new Error("unreachable");
    expect(result.project.hero.abilities.slide).toBe(true);
    expect(commands.map((c) => c.name)).toEqual(["setHeroAbilities", "insertPiece"]);
  });

  it("checks every zone when Claude changes the hero and doesn't check", async () => {
    const { turn, requests } = setup([useTools(["set_hero_abilities", { jump: "low" }]), say("Done."), say("All zones still pass.")]);
    expect(await turn()).toMatchObject({ ok: true, reply: "All zones still pass." });
    const forced = requests[2][requests[2].length - 1].content as string;
    for (const name of ['"Zone 1"', '"Boss Corridor"', '"Boss Room"']) expect(forced).toContain(name);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ai`
Expected: FAIL (no `set_hero_abilities` tool).

- [ ] **Step 3: The tool**

In `src/ai/tools.ts`:
- change the `command` type in `AiTool` to `{ name: string; generated: Generated | null; zoneArg: boolean; levelArg: boolean } | null`;
- add to `COMMAND_TOOLS`, after `set_zone_openings`:

```ts
  { tool: "set_hero_abilities", command: "setHeroAbilities", kind: "plan" },
```

- add a hint:

```ts
  set_hero_abilities:
    " Only when the user asks for a change to their hero. Changing abilities can make zones easier or harder, so check the level afterwards.",
```

- in `commandTool`, record whether the command takes a level, and pass it on:

```ts
  const levelArgUsed = "levelId" in shape;
```

```ts
    command: { name: spec.command, generated: spec.generated ?? null, zoneArg: zoneArgUsed, levelArg: levelArgUsed },
```

In `src/ai/execute.ts`:
- import `describeHero`;
- in `activityFor`, give the hero its own line:

```ts
    case "plan":
      return tool.name === "set_hero_abilities" ? "Changing your hero…" : "Planning the level…";
```

- give a command its level only if it takes one:

```ts
  const commandArgs: Record<string, unknown> = spec.levelArg ? { levelId } : {};
```

- after the command is applied, count every zone as changed when the hero's abilities changed, and tell Claude what the hero can do now:

```ts
  const after = { ...state, project: result.project };
  const heroChanged = result.project.hero.abilities !== project.hero.abilities;
  const target = spec.generated === "zoneId" ? newId : (zone?.id ?? null);
  const changed = new Map(state.changed);
  const touched = heroChanged ? levelOf(after).zones.map((z) => z.id) : touchedZones(level, levelOf(after), target);
  for (const id of touched) changed.set(id, false);
  for (const id of changed.keys()) if (!levelOf(after).zones.some((z) => z.id === id)) changed.delete(id);
  const content = heroChanged ? `Done. ${describeHero(result.project)}` : doneText(spec.generated, newId);
  return ok(content, { ...after, changed }, command);
```

(replacing the lines from `const after = …` to the `return ok(doneText(…), …)`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. (`tests/boundaries.test.ts` is unchanged: no command was added.)

- [ ] **Step 5: Commit**

```bash
git add src/ai tests/ai
git commit -m "feat: let the assistant change the hero's abilities when asked, then check the level"
```

---

### Task 3: Building around the hero

**Files:**
- Modify: `src/ai/prompt.ts`, `docs/superpowers/ai-prompts.md`, `docs/superpowers/status.md`
- Modify tests: `tests/ai/prompt.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2.

- [ ] **Step 1: Write the failing test**

Add to `tests/ai/prompt.test.ts`:

```ts
  it("tells the assistant how to build around the hero", () => {
    expect(SYSTEM_PROMPT).toContain("Only build crawl spaces for a hero that can slide");
    expect(SYSTEM_PROMPT).toContain("Never change the hero's abilities unless the user asks");
    expect(SYSTEM_PROMPT).toContain("You can't draw or recolour the hero");
    expect(SYSTEM_PROMPT).toMatch(/charge shot/);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ai/prompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the prompt section**

In `src/ai/prompt.ts`, add this section before "Good level design":

```
The hero
- The user designed their own hero. Each message tells you what it can do: how fast it runs, how high it jumps, its health and shots, and whether it can slide or has a charge shot. Build levels it can finish and that make the most of it.
- Only build crawl spaces for a hero that can slide (the crawl-space piece needs slide). If the user asks for sliding and the hero can't slide, give it slide with set_hero_abilities first and say so.
- A hero with a charge shot can take on tougher enemies; a fragile hero needs more health pickups and fewer hazards.
- Never change the hero's abilities unless the user asks. After you change them, check the level: a lower jump or slower run can make zones impossible.
- You can't draw or recolour the hero. If the user asks, tell them they can do it themselves with the Hero button.
```

- [ ] **Step 4: Prompts to try by hand**

Add to `docs/superpowers/ai-prompts.md`:

```
10. "Make my hero jump higher." (should change jump one step and check the level)
11. "Build me a level where I have to slide under things." (with a hero that can't slide: should give it slide, say so, and build crawl spaces)
12. "Make my hero red." (should say it can't, and point to the Hero button)
13. (With a charge shot hero) "Make Zone 2 harder." (should use tougher enemies)
```

- [ ] **Step 5: Run everything and update the status**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass.

In `docs/superpowers/status.md`: mark this plan implemented, reviewed and merged; mark milestone 2 complete; say the assistant knows the hero, builds for it and changes its abilities when asked; update the test counts; add this plan's deferred review findings; replace the open item about trying the assistant with "Try the assistant with a real API key using `docs/superpowers/ai-prompts.md` (prompts 1–13), and play what it builds."

- [ ] **Step 6: Commit**

```bash
git add src/ai/prompt.ts tests/ai/prompt.test.ts docs/superpowers/ai-prompts.md docs/superpowers/status.md
git commit -m "feat: teach the assistant to build around the hero"
```

---

## Self-review

- **Spec coverage (section 8):** the hero in words in the overview and catalogue → Task 1; `set_hero_abilities` as a plan tool with "Changing your hero…" → Task 2; ability changes counting as changing every zone → Task 2; prompt rules (crawl spaces only with slide, give slide first when asked, charge shot and tougher enemies, never change abilities unless asked) → Task 3; the assistant does not draw → Task 3 (prompt) and Task 2 (no look tools). Section 10's assistant tests and hand-run prompts → Tasks 2 and 3.
- **Types:** `describeHero`, `levelArg` are defined once and used with the same names.
- **Known limits, accepted:** the assistant can't explain the hero's look, since it never sees it; the hero sentence uses the measured jump heights, so changing the ability table later means changing `JUMP_TILES` too.
