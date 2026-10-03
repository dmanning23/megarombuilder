# Editor Core Implementation Plan (Milestone 1, Plan 6 of 8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give people a place to build: a home page listing their games (saved in the browser), and an editor where they pick a zone, paint tiles with the real pixel art, undo and redo, and playtest from the start or from any zone.

**Architecture:** Projects are saved whole in IndexedDB (through the `idb` package), autosaved shortly after each change. The editor is a React client component holding an `EditorState` (the plan 1 command `History` plus the selected zone, the current tool and whether we are playtesting) in a reducer. Every change goes through plan 1 commands, so undo, validation and (later) the AI all work the same way. The zone is drawn on a canvas at full size and the browser scrolls it; painting turns pointer positions into `setTiles` commands, one undo step per stroke.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, `idb`, Vitest with jsdom and Testing Library for components, `fake-indexeddb` for storage tests, Playwright for the end-to-end test.

**Spec:** `docs/superpowers/specs/2026-10-02-playable-core-ai-level-builder-design.md` (section 8 "Editor UI", section 9 "Error handling", section 2 "Storage")

**Plan series for milestone 1** (the editor is two plans, so there are now eight):

1. Project model and commands (done)
2. Runtime core (done)
3. Runtime things (done)
4. Snow pack and pixel art (done)
5. Level pieces and the checker (done)
6. Editor core: projects, zone list, tile painting, undo, playtest (this plan)
7. Editor tools: things and pieces palettes, checker overlay and badges, zone menu, export and import
8. AI assistant

## Global Constraints

- Every change to a project goes through `applyCommand` (via the history). Components never edit project data directly.
- Words in the interface are short, plain and in sentence case, written for a young player: "Make a new game", "Play from this zone", "Couldn't save".
- Errors say what happened and what to do; they never apologise.
- The editor must work with a mouse, a pen or a finger (pointer events), and with the keyboard (visible focus, every control reachable).
- `src/model`, `src/commands`, `src/runtime/sim` and `src/checker` stay free of React and the DOM.
- Randomness (new ids) is allowed in `src/editor` only, through `crypto.randomUUID()`.
- Import alias `@/` maps to `src/`.

## Design

The editor is a workbench for building a robot-boss stage, used by kids who already know these games.

- **Colour:** paper `#e9eef5` (the cool snow white around the canvas), ink `#10213a` (text), panel `#24324a` and panel-2 `#33476a` (the side and top bars), signal `#ffcc33` (the selected zone, the selected tool, the main button), ok `#2ec4b6` (the hero's teal, for good news), warn `#ef476f` (the spike red, for problems).
- **Type:** Fredoka (Google Fonts, through `next/font`) for everything: rounded and chunky, easy for young readers. Sizes 15, 17, 22 and 30 pixels; weights 400, 600 and 700.
- **Layout:**

  ```
  +--------------------------------------------------------------------+
  | Snow Fortress   Saved              Undo  Redo   Play from here  Play |
  +-------------+------------------------------------------------------+
  | Zones       |  [ the zone, drawn at twice size, scrolls sideways ] |
  |  1 Zone 1 ● |                                                      |
  |  :          |                                                      |
  |  2 Boss Cor |                                                      |
  |  :          +------------------------------------------------------+
  |  3 Boss Rm  |  [ground] [ice] [ladder] [spike] [ledge]   [erase]   |
  |  Add a zone |                                                      |
  +-------------+------------------------------------------------------+
  ```

  Left aligned throughout. The canvas area is the biggest thing on screen.
- **The one memorable element:** the zone list is drawn as the level's actual chain of rooms: numbered cartridge-shaped tiles joined by a dotted track, the selected one in signal yellow. Numbering is right here because zones are a sequence. Everything else stays quiet.
- **Palette swatches are the real tiles**, painted from the pixel art, so what you pick is what you paint.

## Review Focus

1. **Typing in a text box while the game is running** (renaming a zone, then pressing Play, or the reverse): letters and arrows must go to the text box, not the hero, and Cmd/Ctrl shortcuts must still work. Tested in Task 2.
2. **Undo that removes the selected zone** (add a zone, select it, undo): the editor must fall back to a zone that exists, never crash or show nothing. Tested in Task 4.
3. **A saved game that cannot be read** (damaged, or from a newer version): the editor says so plainly and offers the way back home, never a blank page. Tested in Task 7.
4. **Saving failing** (storage full or blocked): a visible message, and the editor keeps working. Tested in Task 7.
5. **A paint stroke that drags outside the zone or is interrupted**: one undo step, nothing painted outside, no stroke left half-open. Tested in Tasks 4 and 8.

## File Structure

```
src/content/packs.ts                    getPack, getArt, DEFAULT_PACK
src/storage/projects.ts                 listProjects, loadProject, saveProject, deleteProject (IndexedDB)
src/editor/newProject.ts                newProject, copyOfDemo
src/editor/state.ts                     EditorState, editorReducer, currentLevel, currentZone, nextZoneName
src/editor/zoneView.ts                  zonePixels, drawZoneView, tileFromPointer
src/editor/components/ZoneCanvas.tsx    the zone, with pointer painting
src/editor/components/Palette.tsx       tile swatches and erase
src/editor/components/ZoneList.tsx      the chain of zones: select, rename, add
src/editor/components/Toolbar.tsx       name, save status, undo, redo, play
src/editor/Editor.tsx                   the editor for a loaded project
src/editor/EditorPage.tsx               loads a project by id, shows the editor or what went wrong
src/editor/ProjectsHome.tsx             the home page: list, make, open, delete
src/editor/editor.module.css            editor styles
src/app/page.tsx                        home
src/app/edit/[id]/page.tsx              the editor route
src/app/layout.tsx, src/app/globals.css fonts and colour tokens
src/runtime/render/draw.ts              drawZone exported, with a size
src/runtime/render/keyboard.ts          ignores text boxes and Cmd/Ctrl/Alt
src/runtime/sim/state.ts                a fresh start in a top or bottom opening prefers a ladder
playwright.config.ts, e2e/*.spec.ts     end-to-end tests
tests/editor/*.test.ts(x), tests/storage/*.test.ts
```

---

### Task 1: Test tooling

**Files:**
- Modify: `package.json` (dependencies and the `e2e` script), `vitest.config.ts`
- Create: `playwright.config.ts`, `e2e/play.spec.ts`, `tests/setup/dom.ts`
- Test: `tests/editor/tooling.test.tsx`

**Interfaces:**
- Produces: component tests can render React in jsdom (start the file with `// @vitest-environment jsdom`); `tests/setup/dom.ts` stubs canvas contexts (jsdom has none); `npm run e2e` runs Playwright against a dev server on port 3100.

- [ ] **Step 1: Install**

Run:

```bash
npm install idb
npm install -D jsdom @testing-library/react @testing-library/user-event fake-indexeddb @playwright/test
npx playwright install chromium
```

Expected: all three commands succeed.

- [ ] **Step 2: Configure Vitest and Playwright**

Replace `vitest.config.ts` with:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup/dom.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

`tests/setup/dom.ts`:

```ts
// jsdom has no canvas. Components check for a missing context, so tests see null, quietly.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3100" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

Add `"e2e": "playwright test"` to `"scripts"` in `package.json`. Add these lines to `.gitignore`:

```
/test-results
/playwright-report
```

- [ ] **Step 3: Write the tests**

`tests/editor/tooling.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("component tests", () => {
  it("render React in jsdom", () => {
    render(<button>Make a new game</button>);
    expect(screen.getByRole("button", { name: "Make a new game" })).toBeTruthy();
  });

  it("see no canvas context", () => {
    expect(document.createElement("canvas").getContext("2d")).toBeNull();
  });
});
```

`e2e/play.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("the demo stage page shows the game", async ({ page }) => {
  await page.goto("/play");
  await expect(page.locator("canvas")).toHaveAttribute("width", "256");
});
```

- [ ] **Step 4: Run them**

Run: `npm test -- tests/editor/tooling.test.tsx && npm run e2e`
Expected: both Vitest tests PASS; the Playwright test PASSES (the first run starts the dev server, which takes a little while).

- [ ] **Step 5: Run every check and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: everything passes.

```bash
git add -A
git commit -m "chore: add component, storage and end-to-end test tooling"
```

---

### Task 2: Keyboard and start-position fixes the editor needs

**Files:**
- Modify: `src/runtime/render/keyboard.ts`, `src/runtime/sim/state.ts`
- Modify: `tests/runtime/render.test.ts`, `tests/runtime/movement.test.ts`

**Interfaces:**
- Consumes: `createKeyboard`, `entryPosition` (plan 2)
- Produces: `createKeyboard` ignores key presses aimed at text boxes or made with Cmd, Ctrl or Alt held (it still honours key releases, so nothing sticks); `entryPosition(map, null)` for a top or bottom opening stands the player in the first column of the opening that has a ladder at that edge, otherwise in the opening's first column.

These are two deferred findings from earlier reviews that matter now: the editor has text boxes on the same page as the game, and "Play from this zone" starts in the middle of a level.

- [ ] **Step 1: Write the failing tests**

In `tests/runtime/render.test.ts`, inside `describe("createKeyboard", ...)`, add:

```ts
  it("ignores keys typed into a text box", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    const typed = key("keydown", "KeyZ");
    Object.defineProperty(typed, "target", { value: { tagName: "INPUT" } });
    target.dispatchEvent(typed);
    expect(keyboard.read()).toEqual(NO_INPUT);
    expect(typed.defaultPrevented).toBe(false);
  });

  it("ignores shortcuts made with Cmd, Ctrl or Alt", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    for (const modifier of ["metaKey", "ctrlKey", "altKey"]) {
      const event = Object.assign(key("keydown", "KeyZ"), { [modifier]: true });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(keyboard.read()).toEqual(NO_INPUT);
  });

  it("still releases a key whose release happens in a text box", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    target.dispatchEvent(key("keydown", "ArrowRight"));
    const release = key("keyup", "ArrowRight");
    Object.defineProperty(release, "target", { value: { tagName: "TEXTAREA" } });
    target.dispatchEvent(release);
    expect(keyboard.read()).toEqual(NO_INPUT);
  });
```

In `tests/runtime/movement.test.ts`, replace the test `"centres the player in a bottom entry and grabs a ladder there"` with:

```ts
  it("starts on the ladder in a bottom opening, whichever column it is in", () => {
    for (const col of [7, 8]) {
      const art = Array.from({ length: 30 }, () => rowWith({ [col]: "H" }));
      const sim = makeSim([{ art, entry: { edge: "bottom", from: 7, to: 8 } }]);
      expect(sim.player.x, `ladder in column ${col}`).toBe(col * 16 + 1);
      expect(sim.player.y).toBe(480 - 22);
      expect(sim.player.onLadder).toBe(true);
    }
  });

  it("starts in the first column of a bottom opening with no ladder", () => {
    const art = Array.from({ length: 30 }, () => rowWith({}));
    const sim = makeSim([{ art, entry: { edge: "bottom", from: 7, to: 8 } }]);
    expect(sim.player.x).toBe(7 * 16 + 1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/runtime/render.test.ts tests/runtime/movement.test.ts`
Expected: FAIL. The keyboard records the typed key; the ladder in column 7 is missed.

- [ ] **Step 3: Fix the keyboard**

In `src/runtime/render/keyboard.ts`, add above `createKeyboard`:

```ts
// Key presses meant for something else: typing in a text box, or a shortcut with Cmd, Ctrl or Alt.
function meantForSomethingElse(event: Event): boolean {
  const e = event as KeyboardEvent;
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  const target = e.target as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable === true;
}
```

and in the `set` handler, add as its first line:

```ts
    if (down && meantForSomethingElse(event)) return;
```

- [ ] **Step 4: Fix the start position**

In `src/runtime/sim/state.ts`, in `entryPosition`, replace

```ts
  const half = PLAYER_W / 2;
  const centre = carry === null ? (start + end) / 2 : clamp(start + carry, start + half, end - half);
  return { x: centre - half, y: entry.edge === "bottom" ? map.heightPx - PLAYER_H : 0 };
```

with

```ts
  const y = entry.edge === "bottom" ? map.heightPx - PLAYER_H : 0;
  if (carry === null) {
    // A fresh start: stand in the first column with a ladder at this edge, or the first column.
    const row = entry.edge === "bottom" ? map.height - 1 : 0;
    let col = entry.from;
    for (let c = entry.from; c <= entry.to; c++) {
      if (map.behaviourAt(c, row) === "ladder") {
        col = c;
        break;
      }
    }
    return { x: col * TILE_SIZE + (TILE_SIZE - PLAYER_W) / 2, y };
  }
  const half = PLAYER_W / 2;
  const centre = clamp(start + carry, start + half, end - half);
  return { x: centre - half, y };
```

- [ ] **Step 5: Run every test and commit**

Run: `npm test && npm run typecheck`
Expected: all tests PASS, including the checker's (it sets its own start columns).

```bash
git add -A
git commit -m "fix: keep game keys out of text boxes and start on a ladder in a bottom opening"
```

---

### Task 3: Packs and saving games in the browser

**Files:**
- Create: `src/content/packs.ts`, `src/storage/projects.ts`, `src/editor/newProject.ts`
- Test: `tests/storage/projects.test.ts`, `tests/editor/newProject.test.ts`

**Interfaces:**
- Consumes: `snowPack`, `snowArt`, `createDemoProject` (plans 2 and 4); `parseProject`, `ParseResult` (plan 1); `applyCommand` (plan 1); `checkLevel` (plan 5)
- Produces:
  - `getPack(id: string): ContentPack | undefined`, `getArt(id: string): ArtSet | undefined`, `DEFAULT_PACK: ContentPack`
  - `type ProjectSummary = { id: string; name: string; updatedAt: number }`
  - `listProjects(): Promise<ProjectSummary[]>` (newest first), `saveProject(project: Project, now?: number): Promise<void>`, `loadProject(id: string, getPack): Promise<ParseResult | null>` (`null` when there is no such game), `deleteProject(id: string): Promise<void>`
  - `newProject(name: string, makeId: () => string): Project` (one level, its three starting zones, and Blizzard Bot in the boss room)
  - `copyOfDemo(makeId: () => string): Project`

- [ ] **Step 1: Write the failing tests**

`tests/storage/projects.test.ts`:

```ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { getPack } from "@/content/packs";
import { newProject } from "@/editor/newProject";
import { deleteProject, listProjects, loadProject, saveProject } from "@/storage/projects";

let n = 0;
const makeId = () => `id-${++n}`;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("project storage", () => {
  it("starts empty", async () => {
    expect(await listProjects()).toEqual([]);
  });

  it("saves and loads a game", async () => {
    const project = newProject("Snow Fortress", makeId);
    await saveProject(project, 1000);
    expect(await loadProject(project.id, getPack)).toEqual({ ok: true, project });
  });

  it("lists games newest first", async () => {
    const a = newProject("Older", makeId);
    const b = newProject("Newer", makeId);
    await saveProject(a, 1000);
    await saveProject(b, 2000);
    expect(await listProjects()).toEqual([
      { id: b.id, name: "Newer", updatedAt: 2000 },
      { id: a.id, name: "Older", updatedAt: 1000 },
    ]);
  });

  it("replaces a game when it is saved again", async () => {
    const project = newProject("First name", makeId);
    await saveProject(project, 1000);
    await saveProject({ ...project, name: "Second name" }, 2000);
    expect(await listProjects()).toEqual([{ id: project.id, name: "Second name", updatedAt: 2000 }]);
  });

  it("reports a game that does not exist", async () => {
    expect(await loadProject("nope", getPack)).toBeNull();
  });

  it("reports a stored game that is damaged", async () => {
    const project = newProject("Broken", makeId);
    await saveProject({ ...project, formatVersion: 99 } as unknown as typeof project, 1000);
    const result = await loadProject(project.id, getPack);
    expect(result?.ok).toBe(false);
  });

  it("deletes a game", async () => {
    const project = newProject("Gone", makeId);
    await saveProject(project, 1000);
    await deleteProject(project.id);
    expect(await listProjects()).toEqual([]);
  });
});
```

`tests/editor/newProject.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkLevel } from "@/checker/check";
import { DEFAULT_PACK, getArt, getPack } from "@/content/packs";
import { snowArt } from "@/content/snow/art";
import { snowPack } from "@/content/snow/pack";
import { copyOfDemo, newProject } from "@/editor/newProject";
import { structureProblems } from "@/model/validate";

let n = 0;
const makeId = () => `id-${++n}`;

describe("packs", () => {
  it("find the snow pack and its art by id", () => {
    expect(getPack("snow")).toBe(snowPack);
    expect(getArt("snow")).toBe(snowArt);
    expect(getPack("lava")).toBeUndefined();
    expect(DEFAULT_PACK).toBe(snowPack);
  });
});

describe("newProject", () => {
  it("makes a valid game with one level ready to build and win", () => {
    const project = newProject("  Snow Fortress ", makeId);
    expect(project.name).toBe("Snow Fortress");
    expect(structureProblems(project, snowPack)).toEqual([]);
    expect(project.levels).toHaveLength(1);
    const level = project.levels[0];
    expect(level.zones.map((z) => z.name)).toEqual(["Zone 1", "Boss Corridor", "Boss Room"]);
    const check = checkLevel(project, level.id, snowPack);
    expect(check.problems).toEqual([]);
    expect(check.zones.every((z) => z.passable)).toBe(true);
  });

  it("names an unnamed game", () => {
    expect(newProject("   ", makeId).name).toBe("My game");
  });

  it("uses fresh ids", () => {
    expect(newProject("A", makeId).id).not.toBe(newProject("B", makeId).id);
  });
});

describe("copyOfDemo", () => {
  it("is the demo stage under a new id", () => {
    const project = copyOfDemo(makeId);
    expect(project.name).toBe("Demo Stage");
    expect(project.id).toMatch(/^id-/);
    expect(project.levels[0].zones[0].name).toBe("Snowy Path");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/storage tests/editor/newProject.test.ts`
Expected: FAIL, cannot resolve `@/content/packs`.

- [ ] **Step 3: Implement packs, storage and new projects**

`src/content/packs.ts`:

```ts
import type { ContentPack } from "@/model/contentPack";
import type { ArtSet } from "@/runtime/render/art";
import { snowArt } from "./snow/art";
import { snowPack } from "./snow/pack";

const PACKS: Record<string, { pack: ContentPack; art: ArtSet }> = {
  [snowPack.id]: { pack: snowPack, art: snowArt },
};

export const getPack = (id: string): ContentPack | undefined => PACKS[id]?.pack;
export const getArt = (id: string): ArtSet | undefined => PACKS[id]?.art;
export const DEFAULT_PACK = snowPack;
```

`src/storage/projects.ts`:

```ts
import { openDB } from "idb";
import type { ContentPack } from "@/model/contentPack";
import { parseProject, type ParseResult } from "@/model/parse";
import type { Project } from "@/model/schema";

const DB_NAME = "megarombuilder";
const STORE = "projects";

type Row = { id: string; name: string; updatedAt: number; project: Project };
export type ProjectSummary = { id: string; name: string; updatedAt: number };

const open = () =>
  openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: "id" });
    },
  });

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await open();
  try {
    const rows = (await db.getAll(STORE)) as Row[];
    return rows
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    db.close();
  }
}

export async function saveProject(project: Project, now = Date.now()): Promise<void> {
  const db = await open();
  try {
    const row: Row = { id: project.id, name: project.name, updatedAt: now, project };
    await db.put(STORE, row);
  } finally {
    db.close();
  }
}

// null when there is no such game; otherwise the result of checking what was stored.
export async function loadProject(
  id: string,
  getPack: (id: string) => ContentPack | undefined,
): Promise<ParseResult | null> {
  const db = await open();
  try {
    const row = (await db.get(STORE, id)) as Row | undefined;
    return row ? parseProject(row.project, getPack) : null;
  } finally {
    db.close();
  }
}

export async function deleteProject(id: string): Promise<void> {
  const db = await open();
  try {
    await db.delete(STORE, id);
  } finally {
    db.close();
  }
}
```

`src/editor/newProject.ts`:

```ts
import { applyCommand, type Command } from "@/commands";
import { createDemoProject } from "@/content/demo";
import { DEFAULT_PACK } from "@/content/packs";
import { createProject } from "@/model/factory";
import type { Project } from "@/model/schema";

// A new game: one level with its starting zone, boss corridor and boss room, and the boss waiting.
export function newProject(name: string, makeId: () => string): Project {
  const pack = DEFAULT_PACK;
  let project = createProject({ id: makeId(), name: name.trim() || "My game" }, pack);
  const run = (command: Command) => {
    const result = applyCommand(project, command, { pack });
    if (!result.ok) throw new Error(`New game: ${command.name} failed: ${result.error}`);
    project = result.project;
  };
  const levelId = makeId();
  run({ name: "createLevel", args: { levelId, name: "Level 1", zoneIds: [makeId(), makeId(), makeId()] } });
  const bossRoom = project.levels[0].zones[2].id;
  run({ name: "placeThing", args: { levelId, zoneId: bossRoom, thingId: makeId(), type: "boss", x: 12, y: 12 } });
  return project;
}

export function copyOfDemo(makeId: () => string): Project {
  return { ...createDemoProject(), id: makeId(), name: "Demo Stage" };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: save games in the browser and make new ones"
```

---

### Task 4: Editor state

**Files:**
- Create: `src/editor/state.ts`
- Test: `tests/editor/state.test.ts`

**Interfaces:**
- Consumes: `History`, `createHistory`, `runCommand`, `beginGroup`, `commitGroup`, `rollbackGroup`, `undo`, `redo`, `canUndo`, `canRedo` (plan 1); `Command`, `CommandContext` (plan 1); `newProject` (Task 3)
- Produces:
  - `type Tool = { kind: "tile"; tile: number } | { kind: "erase" }`
  - `type EditorState = { history: History; levelId: string; zoneId: string; tool: Tool; error: string | null; playing: { fromZoneId: string | null } | null }`
  - `type EditorAction = { type: "run"; command: Command } | { type: "begin"; label: string } | { type: "commit" } | { type: "rollback" } | { type: "undo" } | { type: "redo" } | { type: "selectZone"; zoneId: string } | { type: "tool"; tool: Tool } | { type: "play"; fromZoneId: string | null } | { type: "stopPlaying" } | { type: "dismissError" }`
  - `initialEditor(project: Project, tile: number): EditorState` (first level, first zone, painting with `tile`)
  - `editorReducer(ctx: CommandContext): (state: EditorState, action: EditorAction) => EditorState`
  - `currentLevel(state): Level`, `currentZone(state): Zone`
  - `nextZoneName(level: Level): string` ("Zone N" with the smallest N not already used)

Rules: a failed command leaves the history alone and puts its message in `error`; a successful one clears `error`. After any change to the history the selection is checked: if the selected zone no longer exists, the first zone is selected. Undo and redo do nothing while a stroke (group) is open. Playtesting cannot start while a stroke is open.

- [ ] **Step 1: Write the failing test**

`tests/editor/state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { snowPack } from "@/content/snow/pack";
import { GROUND, SPIKE } from "@/content/snow/tiles";
import { newProject } from "@/editor/newProject";
import {
  currentZone,
  editorReducer,
  initialEditor,
  nextZoneName,
  type EditorAction,
  type EditorState,
} from "@/editor/state";

let n = 0;
const makeId = () => `id-${++n}`;
const reduce = editorReducer({ pack: snowPack });
const apply = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(reduce, state);

function start() {
  const state = initialEditor(newProject("Test", makeId), GROUND);
  const level = state.history.project.levels[0];
  const paint = (x: number, y: number, tile = SPIKE): EditorAction => ({
    type: "run",
    command: { name: "setTiles", args: { levelId: level.id, zoneId: state.zoneId, cells: [{ x, y, tile }] } },
  });
  return { state, level, paint };
}

describe("initialEditor", () => {
  it("selects the first zone of the first level and the given tile", () => {
    const { state, level } = start();
    expect(state.levelId).toBe(level.id);
    expect(state.zoneId).toBe(level.zones[0].id);
    expect(state.tool).toEqual({ kind: "tile", tile: GROUND });
    expect(state.error).toBeNull();
    expect(state.playing).toBeNull();
  });
});

describe("editorReducer", () => {
  it("runs commands and undoes them", () => {
    const { state, paint } = start();
    const painted = apply(state, paint(3, 5));
    expect(currentZone(painted).tiles[5 * 16 + 3]).toBe(SPIKE);
    const undone = apply(painted, { type: "undo" });
    expect(currentZone(undone).tiles[5 * 16 + 3]).toBe(0);
    expect(currentZone(apply(undone, { type: "redo" })).tiles[5 * 16 + 3]).toBe(SPIKE);
  });

  it("keeps a failed command's message and leaves the game alone", () => {
    const { state, paint } = start();
    const failed = apply(state, paint(99, 0));
    expect(failed.error).toMatch(/outside "Zone 1"/);
    expect(failed.history).toBe(state.history);
    expect(apply(failed, paint(1, 1)).error).toBeNull();
    expect(apply(failed, { type: "dismissError" }).error).toBeNull();
  });

  it("turns a paint stroke into one undo step", () => {
    const { state, paint } = start();
    const stroke = apply(state, { type: "begin", label: "Paint" }, paint(1, 5), paint(2, 5), paint(3, 5), { type: "commit" });
    expect(stroke.history.undoStack).toHaveLength(1);
    expect(currentZone(apply(stroke, { type: "undo" })).tiles.slice(5 * 16, 5 * 16 + 4)).toEqual([0, 0, 0, 0]);
  });

  it("does not undo, redo or start playing in the middle of a stroke", () => {
    const { state, paint } = start();
    const mid = apply(state, paint(1, 1), { type: "begin", label: "Paint" }, paint(2, 2));
    expect(apply(mid, { type: "undo" })).toBe(mid);
    expect(apply(mid, { type: "play", fromZoneId: null }).playing).toBeNull();
  });

  it("rolls back an interrupted stroke", () => {
    const { state, paint } = start();
    const rolled = apply(state, { type: "begin", label: "Paint" }, paint(2, 2), { type: "rollback" });
    expect(rolled.history.project).toBe(state.history.project);
    expect(rolled.history.open).toBeNull();
  });

  it("ignores commit and rollback when no stroke is open", () => {
    const { state } = start();
    expect(apply(state, { type: "commit" })).toBe(state);
    expect(apply(state, { type: "rollback" })).toBe(state);
  });

  it("selects zones that exist and ignores ones that do not", () => {
    const { state, level } = start();
    expect(apply(state, { type: "selectZone", zoneId: level.zones[2].id }).zoneId).toBe(level.zones[2].id);
    expect(apply(state, { type: "selectZone", zoneId: "nope" })).toBe(state);
  });

  it("falls back to the first zone when undo removes the selected one", () => {
    const { state, level } = start();
    const added = apply(
      state,
      { type: "run", command: { name: "addZone", args: { levelId: level.id, zoneId: "new", name: "Zone 2" } } },
      { type: "selectZone", zoneId: "new" },
    );
    expect(added.zoneId).toBe("new");
    const undone = apply(added, { type: "undo" });
    expect(undone.zoneId).toBe(level.zones[0].id);
    expect(currentZone(undone).id).toBe(level.zones[0].id);
  });

  it("starts and stops playing", () => {
    const { state, level } = start();
    const playing = apply(state, { type: "play", fromZoneId: level.zones[1].id });
    expect(playing.playing).toEqual({ fromZoneId: level.zones[1].id });
    expect(apply(playing, { type: "stopPlaying" }).playing).toBeNull();
  });

  it("changes the tool", () => {
    const { state } = start();
    expect(apply(state, { type: "tool", tool: { kind: "erase" } }).tool).toEqual({ kind: "erase" });
  });
});

describe("nextZoneName", () => {
  it("uses the smallest free number", () => {
    const { level } = start();
    expect(nextZoneName(level)).toBe("Zone 2");
    const renamed = { ...level, zones: level.zones.map((z, i) => (i === 0 ? { ...z, name: "Zone 2" } : z)) };
    expect(nextZoneName(renamed)).toBe("Zone 1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/editor/state.test.ts`
Expected: FAIL, cannot resolve `@/editor/state`.

- [ ] **Step 3: Implement the editor state**

`src/editor/state.ts`:

```ts
import {
  beginGroup,
  canRedo,
  canUndo,
  commitGroup,
  createHistory,
  redo,
  rollbackGroup,
  runCommand,
  undo,
  type History,
} from "@/commands/history";
import type { Command, CommandContext } from "@/commands/types";
import { tidyName, type Level, type Project, type Zone } from "@/model/schema";

export type Tool = { kind: "tile"; tile: number } | { kind: "erase" };

export type EditorState = {
  history: History;
  levelId: string;
  zoneId: string;
  tool: Tool;
  error: string | null;
  playing: { fromZoneId: string | null } | null;
};

export type EditorAction =
  | { type: "run"; command: Command }
  | { type: "begin"; label: string }
  | { type: "commit" }
  | { type: "rollback" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "selectZone"; zoneId: string }
  | { type: "tool"; tool: Tool }
  | { type: "play"; fromZoneId: string | null }
  | { type: "stopPlaying" }
  | { type: "dismissError" };

export function initialEditor(project: Project, tile: number): EditorState {
  const level = project.levels[0];
  if (!level) throw new Error("This game has no levels.");
  return {
    history: createHistory(project),
    levelId: level.id,
    zoneId: level.zones[0].id,
    tool: { kind: "tile", tile },
    error: null,
    playing: null,
  };
}

export function currentLevel(state: EditorState): Level {
  const levels = state.history.project.levels;
  return levels.find((l) => l.id === state.levelId) ?? levels[0];
}

export function currentZone(state: EditorState): Zone {
  const level = currentLevel(state);
  return level.zones.find((z) => z.id === state.zoneId) ?? level.zones[0];
}

// "Zone N" with the smallest N that no zone in the level is called.
export function nextZoneName(level: Level): string {
  const taken = new Set(level.zones.map((z) => tidyName(z.name).toLowerCase()));
  for (let n = 1; ; n++) if (!taken.has(`zone ${n}`)) return `Zone ${n}`;
}

// Keeps the selection on a zone that exists, after undo, redo or a command removed it.
function settle(state: EditorState): EditorState {
  const zone = currentZone(state);
  return zone.id === state.zoneId ? state : { ...state, zoneId: zone.id };
}

export function editorReducer(ctx: CommandContext) {
  return (state: EditorState, action: EditorAction): EditorState => {
    switch (action.type) {
      case "run": {
        const { history, result } = runCommand(state.history, action.command, ctx);
        if (!result.ok) return { ...state, error: result.error };
        return settle({ ...state, history, error: null });
      }
      case "begin":
        return state.history.open ? state : { ...state, history: beginGroup(state.history, action.label) };
      case "commit":
        return state.history.open ? settle({ ...state, history: commitGroup(state.history) }) : state;
      case "rollback":
        return state.history.open ? settle({ ...state, history: rollbackGroup(state.history) }) : state;
      case "undo":
        return canUndo(state.history) ? settle({ ...state, history: undo(state.history), error: null }) : state;
      case "redo":
        return canRedo(state.history) ? settle({ ...state, history: redo(state.history), error: null }) : state;
      case "selectZone":
        return currentLevel(state).zones.some((z) => z.id === action.zoneId)
          ? { ...state, zoneId: action.zoneId }
          : state;
      case "tool":
        return { ...state, tool: action.tool };
      case "play":
        return state.history.open ? state : { ...state, playing: { fromZoneId: action.fromZoneId } };
      case "stopPlaying":
        return { ...state, playing: null };
      case "dismissError":
        return { ...state, error: null };
    }
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/editor/state.ts tests/editor/state.test.ts
git commit -m "feat: add the editor's state and actions"
```

---

### Task 5: Drawing a zone for editing

**Files:**
- Modify: `src/runtime/render/draw.ts` (export `drawZone` with a drawing size)
- Create: `src/editor/zoneView.ts`
- Test: `tests/editor/zoneView.test.ts`

**Interfaces:**
- Consumes: `Ctx2D`, `Skin`, `ENTITY_COLOURS` (plans 3 and 4); `spawnBox` (plan 3); `zoneSize`, `TILE_SIZE`
- Produces:
  - `drawZone(ctx, zone, pack, camera, dx, dy, skin, width = SCREEN_W, height = SCREEN_H)` exported from `draw.ts`
  - `zonePixels(zone: Zone): { width: number; height: number }`
  - `drawZoneView(ctx: Ctx2D, zone: Zone, pack: ContentPack, skin: Skin | undefined, checkpoints: Checkpoint[]): void`
  - `tileFromPointer(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, zone: Zone): { x: number; y: number } | null`
  - Colours: `GRID_COLOUR`, `SCREEN_LINE_COLOUR`, `ENTRY_COLOUR`, `EXIT_COLOUR`, `CHECKPOINT_COLOUR`

What the editor draws, in order: the zone's background and every tile (as in the game, with the art); every placed thing at its spawn position (its first art frame, or its coloured rectangle); a faint one-pixel line between tiles and a stronger one between screens; a 3-pixel bar along the entry opening (teal) and exit opening (yellow); a 4-by-10 flag for each checkpoint in the zone (blue).

`tileFromPointer` works whatever size the canvas is shown at, and returns `null` outside it.

- [ ] **Step 1: Write the failing test**

`tests/editor/zoneView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { snowPack } from "@/content/snow/pack";
import { newProject } from "@/editor/newProject";
import {
  CHECKPOINT_COLOUR,
  drawZoneView,
  ENTRY_COLOUR,
  EXIT_COLOUR,
  GRID_COLOUR,
  SCREEN_LINE_COLOUR,
  tileFromPointer,
  zonePixels,
} from "@/editor/zoneView";
import type { Sprite } from "@/runtime/render/art";
import { ENTITY_COLOURS, type Skin } from "@/runtime/render/draw";

let n = 0;
const makeId = () => `id-${++n}`;

function fakeContext() {
  const calls: { colour: string; x: number; y: number; w: number; h: number }[] = [];
  const images: { sprite: Sprite; x: number; y: number }[] = [];
  return {
    calls,
    images,
    fillStyle: "" as string,
    font: "",
    textAlign: "start" as CanvasTextAlign,
    fillText() {},
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ colour: this.fillStyle, x, y, w, h });
    },
    drawImage(image: CanvasImageSource, x: number, y: number) {
      images.push({ sprite: (image as unknown as { sprite: Sprite }).sprite, x, y });
    },
  };
}

const skin: Skin = { set: snowArt, image: (sprite) => ({ sprite }) as unknown as CanvasImageSource };
const project = newProject("View", makeId);
const level = project.levels[0];
const [first, , bossRoom] = level.zones;

describe("zonePixels", () => {
  it("measures a zone in pixels", () => {
    expect(zonePixels(first)).toEqual({ width: 256, height: 240 });
    expect(zonePixels({ ...first, screens: 3 })).toEqual({ width: 768, height: 240 });
  });
});

describe("drawZoneView", () => {
  it("draws the background over the whole zone and the floor with the art", () => {
    const ctx = fakeContext();
    drawZoneView(ctx, { ...first, screens: 2, tiles: [...first.tiles, ...first.tiles] }, snowPack, skin, []);
    expect(ctx.calls[0]).toEqual({ colour: snowArt.backgrounds.outdoor, x: 0, y: 0, w: 512, h: 240 });
    expect(ctx.images.filter((i) => i.y === 208)).toHaveLength(32);
  });

  it("draws a faint line between tiles and a stronger one between screens", () => {
    const ctx = fakeContext();
    drawZoneView(ctx, { ...first, screens: 2, tiles: [...first.tiles, ...first.tiles] }, snowPack, skin, []);
    const vertical = ctx.calls.filter((c) => c.w === 1 && c.h === 240);
    expect(vertical.filter((c) => c.colour === GRID_COLOUR)).toHaveLength(30);
    expect(vertical.filter((c) => c.colour === SCREEN_LINE_COLOUR).map((c) => c.x)).toEqual([256]);
  });

  it("marks the entry and the exit", () => {
    const ctx = fakeContext();
    drawZoneView(ctx, first, snowPack, skin, []);
    expect(ctx.calls).toContainEqual({ colour: ENTRY_COLOUR, x: 0, y: 144, w: 3, h: 64 });
    expect(ctx.calls).toContainEqual({ colour: EXIT_COLOUR, x: 253, y: 144, w: 3, h: 64 });
  });

  it("marks checkpoints in this zone only", () => {
    const ctx = fakeContext();
    drawZoneView(ctx, first, snowPack, skin, [
      { zoneId: first.id, x: 5, y: 12 },
      { zoneId: "elsewhere", x: 6, y: 12 },
    ]);
    expect(ctx.calls.filter((c) => c.colour === CHECKPOINT_COLOUR)).toEqual([
      { colour: CHECKPOINT_COLOUR, x: 86, y: 198, w: 4, h: 10 },
    ]);
  });

  it("draws things with their first frame, or as rectangles without art", () => {
    const withArt = fakeContext();
    drawZoneView(withArt, bossRoom, snowPack, skin, []);
    expect(withArt.images.some((i) => i.sprite === snowArt.things.boss[0])).toBe(true);
    const without = fakeContext();
    drawZoneView(without, bossRoom, snowPack, undefined, []);
    expect(without.calls.some((c) => c.colour === ENTITY_COLOURS.boss)).toBe(true);
  });
});

describe("tileFromPointer", () => {
  const rect = { left: 100, top: 50, width: 512, height: 480 }; // a one-screen zone shown at twice size

  it("finds the tile under the pointer at any display size", () => {
    expect(tileFromPointer(100, 50, rect, first)).toEqual({ x: 0, y: 0 });
    expect(tileFromPointer(100 + 5 * 32 + 10, 50 + 10 * 32 + 31, rect, first)).toEqual({ x: 5, y: 10 });
    expect(tileFromPointer(611, 529, rect, first)).toEqual({ x: 15, y: 14 });
  });

  it("returns null outside the zone or for an unmeasured canvas", () => {
    expect(tileFromPointer(99, 60, rect, first)).toBeNull();
    expect(tileFromPointer(612, 60, rect, first)).toBeNull();
    expect(tileFromPointer(200, 530, rect, first)).toBeNull();
    expect(tileFromPointer(0, 0, { left: 0, top: 0, width: 0, height: 0 }, first)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/editor/zoneView.test.ts`
Expected: FAIL, cannot resolve `@/editor/zoneView`.

- [ ] **Step 3: Let drawZone draw any size**

In `src/runtime/render/draw.ts`, change `function drawZone(` to `export function drawZone(`, add two parameters after `skin: Skin | undefined,`:

```ts
  width = SCREEN_W,
  height = SCREEN_H,
```

and inside it replace `SCREEN_W` and `SCREEN_H` with `width` and `height` (three places: the background `rect`, and the `x1` and `y1` lines).

- [ ] **Step 4: Implement the zone view**

`src/editor/zoneView.ts`:

```ts
import type { ContentPack } from "@/model/contentPack";
import { TILE_SIZE, zoneSize, type Opening } from "@/model/geometry";
import type { Checkpoint, Zone } from "@/model/schema";
import { drawZone, ENTITY_COLOURS, type Ctx2D, type Skin } from "@/runtime/render/draw";
import { spawnBox } from "@/runtime/sim/entities/spawn";

export const GRID_COLOUR = "rgba(16, 33, 58, 0.14)";
export const SCREEN_LINE_COLOUR = "rgba(16, 33, 58, 0.45)";
export const ENTRY_COLOUR = "#2ec4b6";
export const EXIT_COLOUR = "#ffcc33";
export const CHECKPOINT_COLOUR = "#3a86ff";

export function zonePixels(zone: Zone): { width: number; height: number } {
  const size = zoneSize(zone.scroll, zone.screens);
  return { width: size.width * TILE_SIZE, height: size.height * TILE_SIZE };
}

function rect(ctx: Ctx2D, colour: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

function markOpening(ctx: Ctx2D, opening: Opening, width: number, height: number, colour: string): void {
  const start = opening.from * TILE_SIZE;
  const length = (opening.to - opening.from + 1) * TILE_SIZE;
  if (opening.edge === "left") rect(ctx, colour, 0, start, 3, length);
  else if (opening.edge === "right") rect(ctx, colour, width - 3, start, 3, length);
  else if (opening.edge === "top") rect(ctx, colour, start, 0, length, 3);
  else rect(ctx, colour, start, height - 3, length, 3);
}

// The whole zone at full size, with a grid, its things, its openings and its checkpoints.
export function drawZoneView(
  ctx: Ctx2D,
  zone: Zone,
  pack: ContentPack,
  skin: Skin | undefined,
  checkpoints: Checkpoint[],
): void {
  const { width, height } = zonePixels(zone);
  drawZone(ctx, zone, pack, { x: 0, y: 0 }, 0, 0, skin, width, height);

  for (const thing of zone.things) {
    const def = pack.things.find((d) => d.type === thing.type);
    if (!def) continue;
    const box = spawnBox(thing, def.behaviour);
    const frame = skin?.set.things[thing.type]?.[0];
    if (skin && frame) {
      ctx.drawImage(
        skin.image(frame, false),
        Math.round(box.x + box.w / 2 - frame.w / 2),
        Math.round(box.y + box.h - frame.h),
      );
    } else {
      rect(ctx, ENTITY_COLOURS[def.behaviour], box.x, box.y, box.w, box.h);
    }
  }

  for (let x = 1; x < width / TILE_SIZE; x++) {
    rect(ctx, x % 16 === 0 ? SCREEN_LINE_COLOUR : GRID_COLOUR, x * TILE_SIZE, 0, 1, height);
  }
  for (let y = 1; y < height / TILE_SIZE; y++) {
    rect(ctx, y % 15 === 0 ? SCREEN_LINE_COLOUR : GRID_COLOUR, 0, y * TILE_SIZE, width, 1);
  }

  markOpening(ctx, zone.entry, width, height, ENTRY_COLOUR);
  if (zone.exit) markOpening(ctx, zone.exit, width, height, EXIT_COLOUR);

  for (const c of checkpoints) {
    if (c.zoneId !== zone.id) continue;
    rect(ctx, CHECKPOINT_COLOUR, c.x * TILE_SIZE + 6, c.y * TILE_SIZE + 6, 4, 10);
  }
}

// The tile under a pointer, whatever size the canvas is displayed at; null outside the zone.
export function tileFromPointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  zone: Zone,
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const size = zoneSize(zone.scroll, zone.screens);
  const x = Math.floor(((clientX - rect.left) / rect.width) * size.width);
  const y = Math.floor(((clientY - rect.top) / rect.height) * size.height);
  if (x < 0 || y < 0 || x >= size.width || y >= size.height) return null;
  return { x, y };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS, including every earlier render test; typecheck prints nothing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: draw a zone for editing, with grid, openings, things and checkpoints"
```

---

### Task 6: Editor pieces: canvas, palette, zone list and toolbar

**Files:**
- Create: `src/editor/components/ZoneCanvas.tsx`, `src/editor/components/Palette.tsx`, `src/editor/components/ZoneList.tsx`, `src/editor/components/Toolbar.tsx`, `src/editor/editor.module.css`
- Test: `tests/editor/components.test.tsx`

**Interfaces:**
- Consumes: `drawZoneView`, `zonePixels`, `tileFromPointer` (Task 5); `Tool` (Task 4); `Skin` (plan 4); `ArtSet`, `Sprite` (plan 4)
- Produces:
  - `ZoneCanvas(props: { zone: Zone; pack: ContentPack; skin?: Skin; checkpoints: Checkpoint[]; zoom: number; onStrokeStart(): void; onPaint(x: number, y: number): void; onStrokeEnd(): void })`
  - `Palette(props: { pack: ContentPack; art?: ArtSet; tool: Tool; onTool(tool: Tool): void })`
  - `ZoneList(props: { level: Level; selectedId: string; onSelect(id: string): void; onRename(id: string, name: string): void; onAdd(): void })`
  - `Toolbar(props: { title: string; saveState: "saved" | "saving" | "error"; canUndo: boolean; canRedo: boolean; onUndo(): void; onRedo(): void; onPlay(): void; onPlayFromZone(): void })`

Behaviour:
- **ZoneCanvas** draws with `drawZoneView` whenever its inputs change. A stroke starts on pointer down (capturing the pointer), paints each new tile the pointer passes over, and ends on pointer up or cancel. The same tile is not painted twice in a row. Its accessible name is the zone's name and length ("Zone 1, 1 screen").
- **Palette** shows one button per tile in the pack (named like "Ground", with its sprite painted in a small canvas) and an "Erase" button. The selected one is `aria-pressed="true"`.
- **ZoneList** is an ordered list named "Zones". Each zone is a button with its number and name; the selected one has `aria-current="true"`. Double-clicking a zone, or pressing F2 on it, swaps in a text box named "Zone name": Enter or leaving the box renames, Escape cancels. "Add a zone" adds one.
- **Toolbar** shows the game's name, the save state ("Saved", "Saving…", or "Couldn't save. Keep this tab open."), and Undo, Redo, "Play from this zone" and "Play" buttons. Undo and Redo are disabled when there is nothing to undo or redo.

- [ ] **Step 1: Write the failing test**

`tests/editor/components.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowArt } from "@/content/snow/art";
import { snowPack } from "@/content/snow/pack";
import { GROUND, SPIKE } from "@/content/snow/tiles";
import { Palette } from "@/editor/components/Palette";
import { Toolbar } from "@/editor/components/Toolbar";
import { ZoneCanvas } from "@/editor/components/ZoneCanvas";
import { ZoneList } from "@/editor/components/ZoneList";
import { newProject } from "@/editor/newProject";

afterEach(cleanup);

let n = 0;
const makeId = () => `id-${++n}`;
const level = newProject("Parts", makeId).levels[0];

describe("Palette", () => {
  it("offers every tile and erase, showing which is chosen", async () => {
    const onTool = vi.fn();
    render(<Palette pack={snowPack} art={snowArt} tool={{ kind: "tile", tile: GROUND }} onTool={onTool} />);
    for (const name of ["Ground", "Ice", "Ladder", "Spike", "Ledge", "Erase"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Ground" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Spike" }).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(screen.getByRole("button", { name: "Spike" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "tile", tile: SPIKE });
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "erase" });
  });
});

describe("ZoneList", () => {
  const props = () => ({
    level,
    selectedId: level.zones[0].id,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onAdd: vi.fn(),
  });

  it("lists the zones in order, numbered, marking the selected one", () => {
    render(<ZoneList {...props()} />);
    const list = screen.getByRole("list", { name: "Zones" });
    const buttons = list.querySelectorAll("button");
    expect([...buttons].map((b) => b.textContent)).toEqual([
      expect.stringContaining("1Zone 1"),
      expect.stringContaining("2Boss Corridor"),
      expect.stringContaining("3Boss Room"),
    ]);
    expect(buttons[0].getAttribute("aria-current")).toBe("true");
    expect(buttons[1].getAttribute("aria-current")).toBeNull();
  });

  it("selects a zone", async () => {
    const p = props();
    render(<ZoneList {...p} />);
    await userEvent.click(screen.getByRole("button", { name: /Boss Room/ }));
    expect(p.onSelect).toHaveBeenCalledWith(level.zones[2].id);
  });

  it("renames on Enter and cancels on Escape", async () => {
    const p = props();
    render(<ZoneList {...p} />);
    await userEvent.dblClick(screen.getByRole("button", { name: /Zone 1/ }));
    const box = screen.getByRole("textbox", { name: "Zone name" });
    await userEvent.clear(box);
    await userEvent.type(box, "Snowy Path{Enter}");
    expect(p.onRename).toHaveBeenCalledWith(level.zones[0].id, "Snowy Path");
    expect(screen.queryByRole("textbox", { name: "Zone name" })).toBeNull();

    await userEvent.dblClick(screen.getByRole("button", { name: /Zone 1/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "Zone name" }), "x{Escape}");
    expect(p.onRename).toHaveBeenCalledTimes(1);
  });

  it("renames from the keyboard with F2", async () => {
    render(<ZoneList {...props()} />);
    screen.getByRole("button", { name: /Zone 1/ }).focus();
    await userEvent.keyboard("{F2}");
    expect(screen.getByRole("textbox", { name: "Zone name" })).toBeTruthy();
  });

  it("adds a zone", async () => {
    const p = props();
    render(<ZoneList {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(p.onAdd).toHaveBeenCalled();
  });
});

describe("Toolbar", () => {
  const props = () => ({
    title: "Snow Fortress",
    saveState: "saved" as const,
    canUndo: false,
    canRedo: true,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onPlay: vi.fn(),
    onPlayFromZone: vi.fn(),
  });

  it("shows the name and save state, and disables what cannot happen", () => {
    render(<Toolbar {...props()} />);
    expect(screen.getByRole("heading", { name: "Snow Fortress" })).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("explains a failed save", () => {
    render(<Toolbar {...props()} saveState="error" />);
    expect(screen.getByText("Couldn't save. Keep this tab open.")).toBeTruthy();
  });

  it("starts playing from the start or from this zone", async () => {
    const p = props();
    render(<Toolbar {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    await userEvent.click(screen.getByRole("button", { name: "Play from this zone" }));
    expect(p.onPlay).toHaveBeenCalled();
    expect(p.onPlayFromZone).toHaveBeenCalled();
  });
});

describe("ZoneCanvas", () => {
  it("is named after the zone and sized to it at the zoom", () => {
    render(
      <ZoneCanvas
        zone={level.zones[0]}
        pack={snowPack}
        checkpoints={[]}
        zoom={2}
        onStrokeStart={vi.fn()}
        onPaint={vi.fn()}
        onStrokeEnd={vi.fn()}
      />,
    );
    const canvas = screen.getByLabelText("Zone 1, 1 screen") as HTMLCanvasElement;
    expect(canvas.width).toBe(256);
    expect(canvas.style.width).toBe("512px");
  });

  it("starts and ends a stroke even when the pointer is somewhere it cannot paint", () => {
    const onStrokeStart = vi.fn();
    const onPaint = vi.fn();
    const onStrokeEnd = vi.fn();
    render(
      <ZoneCanvas
        zone={level.zones[0]}
        pack={snowPack}
        checkpoints={[]}
        zoom={2}
        onStrokeStart={onStrokeStart}
        onPaint={onPaint}
        onStrokeEnd={onStrokeEnd}
      />,
    );
    const canvas = screen.getByTestId("zone-canvas");
    fireEvent.pointerDown(canvas);
    fireEvent.pointerUp(canvas);
    expect(onStrokeStart).toHaveBeenCalledTimes(1);
    expect(onPaint).not.toHaveBeenCalled(); // jsdom gives the canvas no size
    expect(onStrokeEnd).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/editor/components.test.tsx`
Expected: FAIL, cannot resolve `@/editor/components/Palette`.

- [ ] **Step 3: Write the styles**

`src/editor/editor.module.css`:

```css
.app {
  display: grid;
  grid-template-columns: 15rem 1fr;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
}

/* Toolbar */
.toolbar {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--panel);
  color: var(--paper);
}
.title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.saveState {
  font-size: 15px;
  opacity: 0.8;
  margin-right: auto;
}
.saveError {
  color: var(--signal);
  opacity: 1;
}
.button,
.primary {
  font: inherit;
  font-weight: 600;
  font-size: 17px;
  padding: 0.45rem 0.9rem;
  border-radius: 10px;
  border: 2px solid var(--panel-2);
  background: var(--panel-2);
  color: var(--paper);
  cursor: pointer;
}
.button:disabled {
  opacity: 0.4;
  cursor: default;
}
.primary {
  background: var(--signal);
  border-color: var(--signal);
  color: var(--ink);
}
.button:focus-visible,
.primary:focus-visible,
.zone:focus-visible,
.swatch:focus-visible {
  outline: 3px solid var(--signal);
  outline-offset: 2px;
}

/* Zone list: the level's chain of rooms */
.side {
  padding: 1rem 0.75rem;
  background: var(--panel);
  color: var(--paper);
}
.sideTitle {
  margin: 0 0 0.75rem 0.25rem;
  font-size: 17px;
  font-weight: 600;
  opacity: 0.8;
}
.chain {
  list-style: none;
  margin: 0;
  padding: 0;
}
.chain li + li {
  margin-top: 0.85rem;
  position: relative;
}
.chain li + li::before {
  content: "";
  position: absolute;
  left: 1.35rem;
  top: -0.85rem;
  height: 0.85rem;
  border-left: 3px dotted var(--panel-2);
}
.zone {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  font: inherit;
  font-size: 17px;
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-radius: 12px 12px 6px 6px;
  border: 2px solid var(--panel-2);
  background: var(--panel-2);
  color: var(--paper);
  cursor: pointer;
}
.zone[aria-current="true"] {
  background: var(--signal);
  border-color: var(--signal);
  color: var(--ink);
}
.number {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: var(--panel);
  color: var(--paper);
  font-weight: 700;
  font-size: 15px;
}
.zoneName {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rename {
  width: 100%;
  font: inherit;
  font-size: 17px;
  padding: 0.45rem 0.6rem;
  border-radius: 12px 12px 6px 6px;
  border: 2px solid var(--signal);
}
.add {
  margin-top: 1rem;
  width: 100%;
}

/* Canvas and palette */
.work {
  display: grid;
  grid-template-rows: 1fr auto;
  min-width: 0;
}
.stage {
  overflow: auto;
  padding: 1.25rem;
}
.zoneCanvas {
  display: block;
  image-rendering: pixelated;
  touch-action: none;
  cursor: crosshair;
  box-shadow: 0 0 0 3px var(--ink);
}
.palette {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 3px solid var(--ink);
  background: #dde4ee;
}
.swatch {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  padding: 0.35rem 0.7rem 0.35rem 0.35rem;
  border-radius: 10px;
  border: 2px solid transparent;
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
}
.swatch[aria-pressed="true"] {
  border-color: var(--ink);
  background: var(--signal);
}
.swatchArt {
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  background: var(--panel);
  border-radius: 4px;
}
.erase {
  margin-left: auto;
}

/* Messages */
.alert {
  margin: 0 1.25rem;
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  background: var(--warn);
  color: #fff;
  font-weight: 600;
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.alert button {
  font: inherit;
  background: none;
  border: 2px solid #fff;
  color: #fff;
  border-radius: 8px;
  padding: 0.1rem 0.5rem;
  cursor: pointer;
}
.playing {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 1.25rem;
}

@media (max-width: 760px) {
  .app {
    grid-template-columns: 1fr;
  }
  .side {
    order: 3;
  }
}
```

- [ ] **Step 4: Write the components**

`src/editor/components/ZoneCanvas.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { Checkpoint, Zone } from "@/model/schema";
import type { Skin } from "@/runtime/render/draw";
import styles from "../editor.module.css";
import { drawZoneView, tileFromPointer, zonePixels } from "../zoneView";

type Props = {
  zone: Zone;
  pack: ContentPack;
  skin?: Skin;
  checkpoints: Checkpoint[];
  zoom: number;
  onStrokeStart(): void;
  onPaint(x: number, y: number): void;
  onStrokeEnd(): void;
};

export function ZoneCanvas({ zone, pack, skin, checkpoints, zoom, onStrokeStart, onPaint, onStrokeEnd }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const lastTile = useRef<string | null>(null);
  const { width, height } = zonePixels(zone);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawZoneView(ctx, zone, pack, skin, checkpoints);
  }, [zone, pack, skin, checkpoints]);

  const paintAt = (clientX: number, clientY: number) => {
    const canvas = ref.current;
    if (!canvas) return;
    const tile = tileFromPointer(clientX, clientY, canvas.getBoundingClientRect(), zone);
    if (!tile) return;
    const key = `${tile.x},${tile.y}`;
    if (key === lastTile.current) return;
    lastTile.current = key;
    onPaint(tile.x, tile.y);
  };

  const end = () => {
    if (!painting.current) return;
    painting.current = false;
    lastTile.current = null;
    onStrokeEnd();
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
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        painting.current = true;
        lastTile.current = null;
        onStrokeStart();
        paintAt(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (painting.current) paintAt(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    />
  );
}
```

`src/editor/components/Palette.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { ArtSet, Sprite } from "@/runtime/render/art";
import styles from "../editor.module.css";
import type { Tool } from "../state";

const label = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

// A sprite painted pixel by pixel into a small canvas.
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
  return <canvas ref={ref} width={16} height={16} className={styles.swatchArt} aria-hidden="true" />;
}

type Props = { pack: ContentPack; art?: ArtSet; tool: Tool; onTool(tool: Tool): void };

export function Palette({ pack, art, tool, onTool }: Props) {
  const variant = pack.variants[0];
  return (
    <div className={styles.palette} role="toolbar" aria-label="Tiles">
      {pack.tiles.map((tile) => {
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
      <button
        type="button"
        className={`${styles.swatch} ${styles.erase}`}
        aria-pressed={tool.kind === "erase"}
        onClick={() => onTool({ kind: "erase" })}
      >
        Erase
      </button>
    </div>
  );
}
```

`src/editor/components/ZoneList.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import type { Level } from "@/model/schema";
import styles from "../editor.module.css";

type Props = {
  level: Level;
  selectedId: string;
  onSelect(id: string): void;
  onRename(id: string, name: string): void;
  onAdd(): void;
};

export function ZoneList({ level, selectedId, onSelect, onRename, onAdd }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  // Enter and Escape both leave the box; leaving it is the one place a rename is decided.
  const cancelled = useRef(false);

  return (
    <nav className={styles.side} aria-labelledby="zones-title">
      <h2 id="zones-title" className={styles.sideTitle}>
        Zones
      </h2>
      <ol className={styles.chain} aria-label="Zones">
        {level.zones.map((zone, i) => (
          <li key={zone.id}>
            {editing === zone.id ? (
              <input
                className={styles.rename}
                aria-label="Zone name"
                defaultValue={zone.name}
                maxLength={40}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelled.current = true;
                  if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  const save = !cancelled.current;
                  cancelled.current = false;
                  setEditing(null);
                  if (save) onRename(zone.id, e.currentTarget.value);
                }}
              />
            ) : (
              <button
                type="button"
                className={styles.zone}
                aria-current={zone.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(zone.id)}
                onDoubleClick={() => setEditing(zone.id)}
                onKeyDown={(e) => {
                  if (e.key === "F2") setEditing(zone.id);
                }}
              >
                <span className={styles.number}>{i + 1}</span>
                <span className={styles.zoneName}>{zone.name}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className={`${styles.button} ${styles.add}`} onClick={onAdd}>
        Add a zone
      </button>
    </nav>
  );
}
```

`src/editor/components/Toolbar.tsx`:

```tsx
"use client";

import styles from "../editor.module.css";

type Props = {
  title: string;
  saveState: "saved" | "saving" | "error";
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  onPlay(): void;
  onPlayFromZone(): void;
};

const SAVE_TEXT = { saved: "Saved", saving: "Saving…", error: "Couldn't save. Keep this tab open." };

export function Toolbar({ title, saveState, canUndo, canRedo, onUndo, onRedo, onPlay, onPlayFromZone }: Props) {
  return (
    <header className={styles.toolbar}>
      <h1 className={styles.title}>{title}</h1>
      <span
        className={`${styles.saveState} ${saveState === "error" ? styles.saveError : ""}`}
        role="status"
      >
        {SAVE_TEXT[saveState]}
      </span>
      <button type="button" className={styles.button} disabled={!canUndo} onClick={onUndo}>
        Undo
      </button>
      <button type="button" className={styles.button} disabled={!canRedo} onClick={onRedo}>
        Redo
      </button>
      <button type="button" className={styles.button} onClick={onPlayFromZone}>
        Play from this zone
      </button>
      <button type="button" className={styles.primary} onClick={onPlay}>
        Play
      </button>
    </header>
  );
}
```

- [ ] **Step 5: Run tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all tests PASS; typecheck and lint report nothing.

If `fireEvent.pointerDown` does not reach the handler in jsdom, check that `PointerEvent` exists on `window` in the jsdom version installed; if it does not, add a minimal polyfill to `tests/setup/dom.ts` (`class PointerEvent extends MouseEvent { pointerId = 1 }` assigned to `window.PointerEvent`). Do not remove the test.

- [ ] **Step 6: Commit**

```bash
git add src/editor tests/editor
git commit -m "feat: add the zone canvas, tile palette, zone list and toolbar"
```

---

### Task 7: The editor and the home page

**Files:**
- Create: `src/editor/Editor.tsx`, `src/editor/EditorPage.tsx`, `src/editor/ProjectsHome.tsx`, `src/editor/home.module.css`
- Create: `src/app/edit/[id]/page.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
- Test: `tests/editor/editor.test.tsx`, `tests/editor/home.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3 to 6; `PlayCanvas` (plan 4); `createSpriteCache`, `browserCanvas` (plan 4); `getPack`, `getArt` (Task 3)
- Produces:
  - `type ProjectStore = { load(id: string): Promise<ParseResult | null>; save(project: Project): Promise<void> }`
  - `Editor(props: { initial: Project; store: Pick<ProjectStore, "save">; makeId?: () => string; saveDelay?: number })`
  - `EditorPage(props: { projectId: string; store?: ProjectStore; home?: string })`
  - `ProjectsHome(props: { navigate(href: string): void; store?: { list(): Promise<ProjectSummary[]>; save(p: Project): Promise<void>; remove(id: string): Promise<void> }; makeId?: () => string; confirm?: (message: string) => boolean })`

The editor:
- **Painting** with the selected tile or erase sends `setTiles` for each tile, inside one group per stroke.
- **Zones:** selecting, renaming (`renameZone`) and adding (`addZone`, named with `nextZoneName`, given a new id, and selected) all go through the reducer. A failed command shows its message in an alert with a "Dismiss" button.
- **Saving** happens `saveDelay` milliseconds (default 600) after the project last changed, never in the middle of a stroke. The toolbar shows "Saving…" until it finishes, then "Saved", or "Couldn't save. Keep this tab open." if it failed.
- **Keyboard:** Cmd/Ctrl+Z undoes, and Cmd/Ctrl+Shift+Z or Ctrl+Y redoes, except while typing in a text box.
- **Playing** replaces the canvas and palette with the game (`PlayCanvas` with the pack's art) and a "Stop playing" button; Escape also stops.

`EditorPage` shows "Opening your game…" while loading. If there is no such game: "This game isn't saved in this browser." If it cannot be read: "This game can't be opened: " followed by the reason. Both of those have a "Back to your games" link.

`ProjectsHome` lists saved games newest first (name, when it was last changed, an "Open" link to `/edit/<id>`, and a "Delete" button that asks first). With none saved it says "No games yet. Make one to start building." A text box named "Game name" with a "Make a new game" button saves a new game and opens it; "Start from the demo stage" does the same with a copy of the demo. A link plays the demo stage at `/play`.

- [ ] **Step 1: Write the failing tests**

`tests/editor/editor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@/editor/Editor";
import { EditorPage, type ProjectStore } from "@/editor/EditorPage";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let n = 0;
const makeId = () => `id-${++n}`;

describe("Editor", () => {
  it("shows the game, its zones and the palette", () => {
    render(<Editor initial={newProject("Snow Fortress", makeId)} store={{ save: vi.fn() }} />);
    expect(screen.getByRole("heading", { name: "Snow Fortress" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Zones" })).toBeTruthy();
    expect(screen.getByRole("toolbar", { name: "Tiles" })).toBeTruthy();
    expect(screen.getByLabelText("Zone 1, 1 screen")).toBeTruthy();
  });

  it("selects a zone and shows it", async () => {
    render(<Editor initial={newProject("Game", makeId)} store={{ save: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: /Boss Room/ }));
    expect(screen.getByLabelText("Boss Room, 1 screen")).toBeTruthy();
  });

  it("adds a zone, selects it, and can undo it", async () => {
    render(<Editor initial={newProject("Game", makeId)} store={{ save: vi.fn() }} makeId={makeId} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(screen.getByLabelText("Zone 2, 1 screen")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.queryByRole("button", { name: /Zone 2/ })).toBeNull();
    expect(screen.getByLabelText("Zone 1, 1 screen")).toBeTruthy();
  });

  it("renames a zone, and explains a name that is taken", async () => {
    render(<Editor initial={newProject("Game", makeId)} store={{ save: vi.fn() }} />);
    await userEvent.dblClick(screen.getByRole("button", { name: /Zone 1/ }));
    const box = screen.getByRole("textbox", { name: "Zone name" });
    await userEvent.clear(box);
    await userEvent.type(box, "Boss Room{Enter}");
    expect(screen.getByRole("alert").textContent).toMatch(/already a zone called "Boss Room"/);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("undoes and redoes with the keyboard, but not while typing", async () => {
    render(<Editor initial={newProject("Game", makeId)} store={{ save: vi.fn() }} makeId={makeId} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(screen.queryByRole("button", { name: /Zone 2/ })).toBeNull();
    await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(screen.getByRole("button", { name: /Zone 2/ })).toBeTruthy();

    await userEvent.dblClick(screen.getByRole("button", { name: /Zone 1/ }));
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(screen.getByRole("button", { name: /Zone 2/ })).toBeTruthy();
  });

  it("saves a little while after a change, and says so", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const save = vi.fn(async (_p: Project) => {});
    render(<Editor initial={newProject("Game", makeId)} store={{ save }} makeId={makeId} saveDelay={500} />);
    expect(screen.getByText("Saved")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(screen.getByText("Saving…")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].levels[0].zones).toHaveLength(4);
  });

  it("keeps working and says so when saving fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const save = vi.fn(async () => {
      throw new Error("QuotaExceededError");
    });
    render(<Editor initial={newProject("Game", makeId)} store={{ save }} makeId={makeId} saveDelay={500} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await waitFor(() => expect(screen.getByText("Couldn't save. Keep this tab open.")).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(screen.getByRole("button", { name: /Zone 3/ })).toBeTruthy();
  });

  it("plays and stops with the button or Escape", async () => {
    render(<Editor initial={newProject("Game", makeId)} store={{ save: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Stop playing" })).toBeTruthy();
    expect(screen.queryByTestId("zone-canvas")).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("zone-canvas")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Play from this zone" }));
    await userEvent.click(screen.getByRole("button", { name: "Stop playing" }));
    expect(screen.getByTestId("zone-canvas")).toBeTruthy();
  });
});

describe("EditorPage", () => {
  const store = (result: Awaited<ReturnType<ProjectStore["load"]>>): ProjectStore => ({
    load: vi.fn(async () => result),
    save: vi.fn(async () => {}),
  });

  it("opens a saved game", async () => {
    const project = newProject("Saved Game", makeId);
    render(<EditorPage projectId={project.id} store={store({ ok: true, project })} />);
    expect(screen.getByText("Opening your game…")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Saved Game" })).toBeTruthy();
  });

  it("explains a game that is not saved here", async () => {
    render(<EditorPage projectId="nope" store={store(null)} />);
    expect(await screen.findByText("This game isn't saved in this browser.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to your games" }).getAttribute("href")).toBe("/");
  });

  it("explains a game that cannot be read", async () => {
    render(<EditorPage projectId="bad" store={store({ ok: false, error: "This project file is damaged." })} />);
    expect(await screen.findByText("This game can't be opened: This project file is damaged.")).toBeTruthy();
  });
});
```

`tests/editor/home.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectsHome } from "@/editor/ProjectsHome";
import type { Project } from "@/model/schema";

afterEach(cleanup);

function setup(games: { id: string; name: string; updatedAt: number }[] = []) {
  const store = {
    list: vi.fn(async () => games),
    save: vi.fn(async (_p: Project) => {}),
    remove: vi.fn(async (_id: string) => {}),
  };
  const navigate = vi.fn();
  let n = 0;
  const makeId = () => `id-${++n}`;
  return { store, navigate, makeId };
}

describe("ProjectsHome", () => {
  it("invites you to make a game when there are none", async () => {
    const { store, navigate, makeId } = setup();
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} />);
    expect(await screen.findByText("No games yet. Make one to start building.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Play the demo stage" }).getAttribute("href")).toBe("/play");
  });

  it("lists saved games with links to open them", async () => {
    const { store, navigate, makeId } = setup([{ id: "a", name: "Snow Fortress", updatedAt: Date.now() }]);
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} />);
    expect(await screen.findByText("Snow Fortress")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Snow Fortress" }).getAttribute("href")).toBe("/edit/a");
  });

  it("makes a new game, saves it and opens it", async () => {
    const { store, navigate, makeId } = setup();
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Game name" }), "Ice Palace");
    await userEvent.click(screen.getByRole("button", { name: "Make a new game" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/edit/id-1"));
    expect(store.save.mock.calls[0][0].name).toBe("Ice Palace");
  });

  it("starts from a copy of the demo", async () => {
    const { store, navigate, makeId } = setup();
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} />);
    await userEvent.click(screen.getByRole("button", { name: "Start from the demo stage" }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(store.save.mock.calls[0][0].name).toBe("Demo Stage");
  });

  it("deletes a game only after asking", async () => {
    const { store, navigate, makeId } = setup([{ id: "a", name: "Snow Fortress", updatedAt: 1 }]);
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} confirm={confirm} />);
    const remove = await screen.findByRole("button", { name: "Delete Snow Fortress" });
    await userEvent.click(remove);
    expect(store.remove).not.toHaveBeenCalled();
    await userEvent.click(remove);
    expect(confirm).toHaveBeenLastCalledWith('Delete "Snow Fortress"? This can\'t be undone.');
    await waitFor(() => expect(store.remove).toHaveBeenCalledWith("a"));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/editor/editor.test.tsx tests/editor/home.test.tsx`
Expected: FAIL, cannot resolve `@/editor/Editor`.

- [ ] **Step 3: Write the editor**

`src/editor/Editor.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { canRedo, canUndo } from "@/commands/history";
import { getArt, getPack } from "@/content/packs";
import type { Project } from "@/model/schema";
import type { Skin } from "@/runtime/render/draw";
import { PlayCanvas } from "@/runtime/render/PlayCanvas";
import { browserCanvas, createSpriteCache } from "@/runtime/render/sprites";
import { Palette } from "./components/Palette";
import { Toolbar } from "./components/Toolbar";
import { ZoneCanvas } from "./components/ZoneCanvas";
import { ZoneList } from "./components/ZoneList";
import styles from "./editor.module.css";
import { currentLevel, currentZone, editorReducer, initialEditor, nextZoneName } from "./state";

type Props = {
  initial: Project;
  store: { save(project: Project): Promise<void> };
  makeId?: () => string;
  saveDelay?: number;
};

const typing = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable === true;
};

export function Editor({ initial, store, makeId = () => crypto.randomUUID(), saveDelay = 600 }: Props) {
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

  // Save a little while after the project last changed, never in the middle of a stroke.
  const firstProject = useRef(project);
  useEffect(() => {
    if (project === firstProject.current || strokeOpen) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      store.save(project).then(
        () => setSaveState("saved"),
        () => setSaveState("error"),
      );
    }, saveDelay);
    return () => clearTimeout(timer);
  }, [project, strokeOpen, store, saveDelay]);

  // Keyboard: undo and redo, and Escape to stop playing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.playing) {
        if (e.key === "Escape") dispatch({ type: "stopPlaying" });
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

  const paint = useCallback(
    (x: number, y: number) => {
      const tile = state.tool.kind === "tile" ? state.tool.tile : 0;
      dispatch({
        type: "run",
        command: { name: "setTiles", args: { levelId: level.id, zoneId: zone.id, cells: [{ x, y, tile }] } },
      });
    },
    [state.tool, level.id, zone.id],
  );

  const addZone = () => {
    const zoneId = makeId();
    dispatch({
      type: "run",
      command: { name: "addZone", args: { levelId: level.id, zoneId, name: nextZoneName(level) } },
    });
    dispatch({ type: "selectZone", zoneId });
  };

  return (
    <div className={styles.app}>
      <Toolbar
        title={project.name}
        saveState={saveState}
        canUndo={canUndo(state.history)}
        canRedo={canRedo(state.history)}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onPlay={() => dispatch({ type: "play", fromZoneId: null })}
        onPlayFromZone={() => dispatch({ type: "play", fromZoneId: zone.id })}
      />
      <ZoneList
        level={level}
        selectedId={zone.id}
        onSelect={(zoneId) => dispatch({ type: "selectZone", zoneId })}
        onRename={(zoneId, name) =>
          dispatch({ type: "run", command: { name: "renameZone", args: { levelId: level.id, zoneId, name } } })
        }
        onAdd={addZone}
      />
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
              onStrokeStart={() => dispatch({ type: "begin", label: "Paint" })}
              onPaint={paint}
              onStrokeEnd={() => dispatch({ type: "commit" })}
            />
          </div>
          <Palette pack={pack} art={art} tool={state.tool} onTool={(tool) => dispatch({ type: "tool", tool })} />
        </main>
      )}
    </div>
  );
}
```

`src/editor/EditorPage.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPack } from "@/content/packs";
import type { ParseResult } from "@/model/parse";
import type { Project } from "@/model/schema";
import { loadProject, saveProject } from "@/storage/projects";
import { Editor } from "./Editor";
import styles from "./home.module.css";

export type ProjectStore = {
  load(id: string): Promise<ParseResult | null>;
  save(project: Project): Promise<void>;
};

const browserStore: ProjectStore = {
  load: (id) => loadProject(id, getPack),
  save: (project) => saveProject(project),
};

type Loaded = { kind: "loading" } | { kind: "missing" } | { kind: "broken"; error: string } | { kind: "ready"; project: Project };

export function EditorPage({ projectId, store = browserStore, home = "/" }: { projectId: string; store?: ProjectStore; home?: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    store.load(projectId).then(
      (result) => {
        if (!live) return;
        if (!result) setLoaded({ kind: "missing" });
        else if (!result.ok) setLoaded({ kind: "broken", error: result.error });
        else setLoaded({ kind: "ready", project: result.project });
      },
      (error: unknown) => live && setLoaded({ kind: "broken", error: String(error) }),
    );
    return () => {
      live = false;
    };
  }, [projectId, store]);

  if (loaded.kind === "ready") return <Editor initial={loaded.project} store={store} />;
  const message =
    loaded.kind === "loading"
      ? "Opening your game…"
      : loaded.kind === "missing"
        ? "This game isn't saved in this browser."
        : `This game can't be opened: ${loaded.error}`;
  return (
    <main className={styles.page}>
      <p className={styles.message}>{message}</p>
      {loaded.kind !== "loading" && (
        <Link className={styles.link} href={home}>
          Back to your games
        </Link>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Write the home page**

`src/editor/home.module.css`:

```css
.page {
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  padding: 3rem 1.5rem;
  max-width: 44rem;
  margin: 0 auto;
}
.heading {
  font-size: 30px;
  font-weight: 700;
  margin: 0 0 1.5rem;
}
.make {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  padding: 1rem;
  border-radius: 14px;
  background: var(--panel);
  color: var(--paper);
}
.make label {
  font-weight: 600;
  font-size: 17px;
}
.make input {
  flex: 1 1 12rem;
  font: inherit;
  font-size: 17px;
  padding: 0.5rem 0.7rem;
  border-radius: 10px;
  border: 2px solid var(--panel-2);
}
.primary,
.secondary {
  font: inherit;
  font-weight: 600;
  font-size: 17px;
  padding: 0.5rem 0.9rem;
  border-radius: 10px;
  cursor: pointer;
}
.primary {
  background: var(--signal);
  border: 2px solid var(--signal);
  color: var(--ink);
}
.secondary {
  background: var(--panel-2);
  border: 2px solid var(--panel-2);
  color: var(--paper);
}
.games {
  list-style: none;
  margin: 2rem 0;
  padding: 0;
}
.game {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 2px solid rgba(16, 33, 58, 0.12);
}
.gameName {
  font-weight: 700;
  font-size: 22px;
}
.when {
  font-size: 15px;
  opacity: 0.7;
  margin-right: auto;
}
.link {
  color: var(--ink);
  font-weight: 600;
}
.message {
  font-size: 22px;
}
.primary:focus-visible,
.secondary:focus-visible,
.link:focus-visible,
.make input:focus-visible {
  outline: 3px solid var(--signal);
  outline-offset: 2px;
}
```

`src/editor/ProjectsHome.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "@/model/schema";
import { deleteProject, listProjects, saveProject, type ProjectSummary } from "@/storage/projects";
import styles from "./home.module.css";
import { copyOfDemo, newProject } from "./newProject";

type Store = {
  list(): Promise<ProjectSummary[]>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
};

const browserStore: Store = { list: listProjects, save: (p) => saveProject(p), remove: deleteProject };

const when = (time: number) =>
  new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

type Props = {
  navigate(href: string): void;
  store?: Store;
  makeId?: () => string;
  confirm?: (message: string) => boolean;
};

export function ProjectsHome({
  navigate,
  store = browserStore,
  makeId = () => crypto.randomUUID(),
  confirm = (message) => window.confirm(message),
}: Props) {
  const [games, setGames] = useState<ProjectSummary[] | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    store.list().then(setGames, () => setGames([]));
  }, [store]);

  const open = async (project: Project) => {
    await store.save(project);
    navigate(`/edit/${project.id}`);
  };

  const remove = async (game: ProjectSummary) => {
    if (!confirm(`Delete "${game.name}"? This can't be undone.`)) return;
    await store.remove(game.id);
    setGames((list) => list?.filter((g) => g.id !== game.id) ?? null);
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Your games</h1>
      <form
        className={styles.make}
        onSubmit={(e) => {
          e.preventDefault();
          void open(newProject(name, makeId));
        }}
      >
        <label htmlFor="game-name">Game name</label>
        <input id="game-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className={styles.primary}>
          Make a new game
        </button>
        <button type="button" className={styles.secondary} onClick={() => void open(copyOfDemo(makeId))}>
          Start from the demo stage
        </button>
      </form>

      {games && games.length === 0 && <p>No games yet. Make one to start building.</p>}
      {games && games.length > 0 && (
        <ul className={styles.games}>
          {games.map((game) => (
            <li key={game.id} className={styles.game}>
              <span className={styles.gameName}>{game.name}</span>
              <span className={styles.when}>Changed {when(game.updatedAt)}</span>
              <Link className={styles.link} href={`/edit/${game.id}`} aria-label={`Open ${game.name}`}>
                Open
              </Link>
              <button
                type="button"
                className={styles.secondary}
                aria-label={`Delete ${game.name}`}
                onClick={() => void remove(game)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <p>
        <Link className={styles.link} href="/play">
          Play the demo stage
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Add the routes, fonts and colours**

Replace `src/app/page.tsx` with:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { ProjectsHome } from "@/editor/ProjectsHome";

export default function HomePage() {
  const router = useRouter();
  return <ProjectsHome navigate={(href) => router.push(href)} />;
}
```

`src/app/edit/[id]/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { EditorPage } from "@/editor/EditorPage";

export default function EditRoute() {
  const params = useParams<{ id: string }>();
  return <EditorPage projectId={params.id} />;
}
```

In `src/app/layout.tsx`, replace the two Geist font imports and constants with:

```tsx
import { Fredoka } from "next/font/google";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });
```

and change the `<html>` element's `className` to `{fredoka.variable}`.

Replace `src/app/globals.css` with:

```css
:root {
  --paper: #e9eef5;
  --ink: #10213a;
  --panel: #24324a;
  --panel-2: #33476a;
  --signal: #ffcc33;
  --ok: #2ec4b6;
  --warn: #ef476f;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-fredoka), system-ui, sans-serif;
  font-size: 17px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 6: Run tests, typecheck, lint and build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all tests PASS; typecheck and lint report nothing; the build lists `/`, `/play` and `/edit/[id]`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add the editor and the home page"
```

---

### Task 8: End to end

**Files:**
- Create: `e2e/editor.spec.ts`

**Interfaces:**
- Consumes: the running app.
- Produces: a browser test of the whole first-time flow, and screenshots for a look at the design.

- [ ] **Step 1: Write the test**

`e2e/editor.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

// The tiles of the first zone of the first saved game, read straight from IndexedDB.
async function savedTiles(page: Page): Promise<number[]> {
  return page.evaluate(
    () =>
      new Promise<number[]>((resolve, reject) => {
        const request = indexedDB.open("megarombuilder");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const all = request.result.transaction("projects").objectStore("projects").getAll();
          all.onsuccess = () => resolve(all.result[0].project.levels[0].zones[0].tiles);
        };
      }),
  );
}

async function clickTile(page: Page, x: number, y: number) {
  const box = await page.getByTestId("zone-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  await page.mouse.click(box.x + x * 32 + 16, box.y + y * 32 + 16);
}

test("make a game, paint, undo, save, play and come back", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No games yet. Make one to start building.")).toBeVisible();
  await page.screenshot({ path: "test-results/home.png", fullPage: true });

  await page.getByRole("textbox", { name: "Game name" }).fill("Snow Fortress");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await expect(page.getByRole("heading", { name: "Snow Fortress" })).toBeVisible();

  // Saving happens a moment after each change, so wait for what is stored to catch up.
  const tileAt = (i: number) => expect.poll(async () => (await savedTiles(page))[i]);

  await page.getByRole("button", { name: "Spike" }).click();
  await clickTile(page, 5, 10);
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  await tileAt(10 * 16 + 5).toBe(4);

  await page.getByRole("button", { name: "Undo" }).click();
  await tileAt(10 * 16 + 5).toBe(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await tileAt(10 * 16 + 5).toBe(4);
  await expect(page.getByText("Saved")).toBeVisible();
  await page.screenshot({ path: "test-results/editor.png", fullPage: true });

  // A drag paints a row in one undo step.
  const box = await page.getByTestId("zone-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  await page.getByRole("button", { name: "Ice" }).click();
  await page.mouse.move(box.x + 1 * 32 + 16, box.y + 6 * 32 + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + 4 * 32 + 16, box.y + 6 * 32 + 16, { steps: 8 });
  await page.mouse.up();
  const row = () => expect.poll(async () => (await savedTiles(page)).slice(6 * 16 + 1, 6 * 16 + 5));
  await row().toEqual([2, 2, 2, 2]);
  await page.getByRole("button", { name: "Undo" }).click();
  await row().toEqual([0, 0, 0, 0]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Snow Fortress" })).toBeVisible();
  expect((await savedTiles(page))[10 * 16 + 5]).toBe(4);

  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Stop playing" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.screenshot({ path: "test-results/playing.png", fullPage: true });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("zone-canvas")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open Snow Fortress" })).toBeVisible();
});

test("open a copy of the demo stage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start from the demo stage" }).click();
  await expect(page.getByRole("button", { name: /Snowy Path/ })).toBeVisible();
  await page.getByRole("button", { name: /Frozen Shaft/ }).click();
  await expect(page.getByLabel("Frozen Shaft, 2 screens")).toBeVisible();
});
```

- [ ] **Step 2: Run it**

Run: `npm run e2e`
Expected: all three Playwright tests PASS (including `play.spec.ts`).

- [ ] **Step 3: Look at the screenshots**

Open `test-results/home.png`, `test-results/editor.png` and `test-results/playing.png`. Check them against the Design section: the zone chain reads as a numbered sequence with the selected zone in yellow; the palette shows the real tiles; nothing overlaps or is cut off; the text is easy to read. Fix anything that is off in the CSS and rerun.

- [ ] **Step 4: Run every check and commit**

Run: `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e`
Expected: everything passes.

```bash
git add e2e src
git commit -m "test: drive the whole first-time flow in a browser"
```

---

## Done when

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` and `npm run e2e` all succeed.
- A person can make a game on the home page, paint tiles in each zone, rename and add zones, undo and redo, play from the start or from any zone, and find their game saved after reloading.
- A person has looked at the editor and judged whether a child could find their way around it. That is the check no test can make.

Plan 7 (editor tools) adds the things and pieces palettes, the checker overlay and zone badges, the zone menu (resize, look, intent, delete, reorder), and export and import.
