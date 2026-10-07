# The Boss Tab Implementation Plan (Milestone 3, Plan 4 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Characters screen's new Boss tab, a kid makes their own boss from the Blizzard Bot, names it, picks its fight length and its 2 or 3 attacks in order, draws (or imports) its three frames, watches it fight in a preview, puts it in the boss room, and can delete it.

**Architecture:** A `BossScreen` beside `EnemiesScreen`, built from the same pieces: the name box (moved to its own file so both screens share it), `PictureEditor`, `Colours` and `GamePreview`. Every change is one of plan 3's boss commands. A new `bossPreviewSim` puts the kid's boss in a one-screen boss room with the hero standing still. The level palette stops listing the kid's boss: it goes in the boss room through "Use in the boss room".

**Tech Stack:** as plan 2. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-milestone-3-your-own-enemies-and-boss-design.md` (sections 6 (Boss tab, the palette), 8 and 9; build order item 4)

**Plan series for milestone 3:**

1. Enemy data, the game pack, and drawing own enemies (done)
2. The Characters screen and the Enemies tab (done)
3. Boss data and the new boss attacks (done)
4. The Boss tab (this plan)
5. The assistant

## Global Constraints

- The editor changes the game only through commands; a refused command shows its message in the screen's alert.
- Language suits young users: short, plain, sentence case.
- Import alias `@/` maps to `src/`.
- Component tests run in jsdom (`// @vitest-environment jsdom`); browser tests run against a production build on port 3100 (`npm run e2e`).

## Decisions this plan makes

- **Making a boss:** one button, **Make your own boss**, creates it as "My Boss" (renamed in its name box), a copy of the Blizzard Bot.
- **Attacks:** three drop-downs, **Attack 1**, **Attack 2** and **Attack 3**, each listing the six attacks; Attack 3 also has **None**. Under them, each chosen attack's one-line description:

  | Attack | Shown as | Description |
  |---|---|---|
  | jump | Jump | Leaps at you. Run under it. |
  | dash | Dash | Charges along the floor. Jump over it. |
  | spread | Spread | Three shots fan out. Jump through the gap. |
  | aimed | Aimed shot | One quick shot right at you. Move after it fires. |
  | rain | Rain | Shots fall from above. Stand in a gap. |
  | big | Big shot | A huge, slow shot. Jump over it or slide under. |

- **Fight:** step buttons Short, Normal, Long.
- **Frames:** Stand, Jump and Attack, each 24 by 28 with the whole frame as the body outline.
- **Use in the boss room:** two buttons, the pack's boss by name ("Blizzard Bot") and **Your boss**, pressed by what is placed: "Your boss" when any `own-boss` is placed, otherwise the pack's boss when a boss is placed, otherwise neither.
- **The preview:** 420 steps (seven seconds), then it starts again. The hero (28 health) can't be beaten in that time: after the 60-step intro, at most one hit lands per 60 steps of invulnerability, at most 4 damage each, so at most 24 damage.
- **The palette** leaves out the kid's boss (spec section 6).

## Review Focus

1. **Undo after Make your own boss, after Use in the boss room, after Delete boss**: the tab follows (back to the invitation, the pressed button moves, the boss returns). Tested in Task 2.
2. **Attack 3 set to None, then Attack 1 changed**: the list stays two long, in order. Tested in Task 2.
3. **Delete while the boss is in use**: refused with the plain message, the boss stays. Tested in Task 2.
4. **A game whose boss room has no boss**: Use in the boss room shows the command's message, and nothing breaks. Tested in Task 2.
5. **The preview with each attack list**: the hero is never beaten and every attack shows. Tested in Task 1.

## File Structure

```
src/editor/hero/preview.ts              bossPreviewSim, BOSS_PREVIEW_INPUTS
src/editor/components/NameField.tsx     the name box (moved from EnemiesScreen)
src/editor/components/EnemiesScreen.tsx imports NameField
src/editor/components/BossScreen.tsx    the Boss tab
src/editor/components/CharactersScreen.tsx   the Boss tab
src/editor/components/Palette.tsx       leaves out the kid's boss
tests/editor/heroPreview.test.ts, tests/editor/paletteEnemies.test.tsx, tests/editor/bossScreen.test.tsx, tests/editor/charactersScreen.test.tsx
e2e/boss.spec.ts
```

---

### Task 1: The boss preview, and the palette without the kid's boss

**Files:**
- Modify: `src/editor/hero/preview.ts`, `src/editor/components/Palette.tsx`
- Test: additions to `tests/editor/heroPreview.test.ts`, `tests/editor/paletteEnemies.test.tsx`

**Interfaces:**
- Consumes: plan 3's `OWN_BOSS`, `BossDesign`, boss modes
- Produces: `bossPreviewSim(boss: BossDesign, hero: Hero, pack: ContentPack): Sim`; `BOSS_PREVIEW_INPUTS: Input[]` (420 idle steps)

- [ ] **Step 1: Write the failing tests**

Add to `tests/editor/heroPreview.test.ts` (importing `bossPreviewSim`, `BOSS_PREVIEW_INPUTS`, `type BossAttack`, and `snowPack`/`snowHero` as the file already does):

```ts
describe("the boss preview", () => {
  const lists: BossAttack[][] = [
    ["jump", "spread", "dash"],
    ["rain", "big", "aimed"],
    ["dash", "jump"],
    ["big", "rain"],
  ];

  it("shows every attack in the list, and the hero is never beaten", () => {
    const hero = { abilities: DEFAULT_ABILITIES, look: snowHero };
    for (const attacks of lists) {
      const boss = { name: "My Boss", fight: "long" as const, attacks, look: snowPack.bossLook };
      const sim = bossPreviewSim(boss, hero, snowPack);
      const seen = new Set<string>();
      for (const input of BOSS_PREVIEW_INPUTS) {
        step(sim, input);
        const e = sim.slots[0].entity;
        if (e) seen.add(e.mode);
      }
      expect([...seen], attacks.join()).toEqual(expect.arrayContaining(attacks));
      expect(sim.phase, attacks.join()).toBe("play");
      expect(sim.zoneIndex).toBe(0);
    }
  });
});
```

Add to `tests/editor/paletteEnemies.test.tsx`, in its `describe`:

```ts
  it("leaves out the kid's boss: it goes in the boss room another way", async () => {
    const pack = gamePack(
      { ...newProject("Boss", makeId), boss: { name: "Volt Viper", fight: "normal", attacks: ["jump", "dash"], look: snowPack.bossLook } },
      snowPack,
    );
    render(<Palette pack={pack} tool={{ kind: "select" }} onTool={() => {}} />);
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    expect(screen.queryByRole("button", { name: /Volt Viper/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Blizzard Bot/ })).toBeTruthy();
  });
```

(Use the file's existing imports and helpers; add any of `gamePack`, `newProject`, `snowPack`, `Palette`, `userEvent`, `makeId` it lacks, with `const makeId = () => "id"` if it has none. Use the tool value the file's other test uses if `{ kind: "select" }` isn't a `Tool`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/heroPreview.test.ts tests/editor/paletteEnemies.test.tsx`
Expected: FAIL (`bossPreviewSim` doesn't exist; the palette lists Volt Viper).

- [ ] **Step 3: Write the implementation**

In `src/editor/hero/preview.ts` (importing `type BossDesign` and `OWN_BOSS`):

```ts
// The boss preview: a one-screen boss room, the hero standing still, the kid's boss fighting.
export function bossPreviewSim(boss: BossDesign, hero: Hero, pack: ContentPack): Sim {
  const zone = {
    ...createZone({ id: "preview", name: "Preview", kind: "bossRoom" }, pack),
    things: [{ id: "preview-boss", type: OWN_BOSS, x: 12, y: 12, settings: {} }],
  };
  const level: Level = { id: "preview", name: "Preview", brief: "", zones: [zone], checkpoints: [] };
  const project: Project = {
    ...createProject({ id: "preview", name: "Preview" }, pack),
    hero,
    boss,
    levels: [level],
  };
  return createSim(project, "preview", pack);
}

// Seven seconds: long enough for three attacks after the intro, too short for the boss to win (at
// most one 4-damage hit per 60 steps after the 60-step intro is 24 of the hero's 28).
export const BOSS_PREVIEW_INPUTS: Input[] = hold({}, 420);
```

In `src/editor/components/Palette.tsx`, import `OWN_BOSS` and list `pack.things.filter((def) => def.type !== OWN_BOSS)` on the things tab, with the comment `// The kid's boss goes in the boss room from the Boss tab, not from here.`

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: preview a kid's boss fighting, and keep it out of the level palette"
```

---

### Task 2: The Boss tab

**Files:**
- Create: `src/editor/components/NameField.tsx`, `src/editor/components/BossScreen.tsx`
- Modify: `src/editor/components/EnemiesScreen.tsx`, `src/editor/components/CharactersScreen.tsx`
- Test: `tests/editor/bossScreen.test.tsx`, addition to `tests/editor/charactersScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1's `bossPreviewSim`, `BOSS_PREVIEW_INPUTS`; plan 3's boss commands, `OWN_BOSS`, `BOSS_ATTACKS`, `BOSS_FIGHTS`, `BOSS_FRAME`; `GamePreview`'s `boss` prop
- Produces: `NameField({ name, onRename })`; `BossScreen` with the same props as `EnemiesScreen` minus `makeId`; `ATTACK_TEXT: Record<BossAttack, { name: string; tip: string }>`

- [ ] **Step 1: Write the failing tests**

`tests/editor/bossScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowPack } from "@/content/snow/pack";
import { Editor } from "@/editor/Editor";
import { ZOOM } from "@/editor/hero/pixels";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(cleanup);

let n = 0;
const makeId = () => `id-${++n}`;

function setup(initial: Project = newProject("Boss", makeId), confirm = () => true) {
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const view = render(<Editor initial={initial} store={{ save }} makeId={makeId} saveDelay={60_000} confirm={confirm} />);
  const saved = (): Project => {
    view.unmount();
    return save.mock.calls.at(-1)?.[0] ?? initial;
  };
  const open = async () => {
    await userEvent.click(screen.getByRole("button", { name: "Characters" }));
    await userEvent.click(screen.getByRole("tab", { name: "Boss" }));
  };
  const group = (name: string) => screen.getByRole("group", { name });
  const press = (x: number, y: number) => {
    const el = screen.getByTestId("boss-canvas") as HTMLCanvasElement;
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: el.width, height: el.height, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const at = { clientX: x * ZOOM + ZOOM / 2, clientY: y * ZOOM + ZOOM / 2, button: 0 };
    fireEvent.pointerDown(el, at);
    fireEvent.pointerUp(el, at);
  };
  const make = () => userEvent.click(screen.getByRole("button", { name: "Make your own boss" }));
  const placedBoss = (project: Project) => project.levels[0].zones[2].things.map((t) => t.type);
  return { saved, open, group, press, make, placedBoss };
}

describe("the Boss tab", () => {
  it("makes a boss from the Blizzard Bot, and undo takes it away again", async () => {
    const { open, make } = setup();
    await open();
    expect(screen.getByText(/Make your own boss to fight in the boss room/)).toBeTruthy();
    await make();
    expect((screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("My Boss");
    expect(screen.getByRole("img", { name: "Stand, 24 by 28 pixels" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "My Boss fighting" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Make your own boss" })).toBeTruthy();
  });

  it("starts as a copy of the Blizzard Bot's drawing and attacks", async () => {
    const { open, make, saved } = setup();
    await open();
    await make();
    expect(saved().boss).toEqual({ name: "My Boss", fight: "normal", attacks: ["jump", "spread", "dash"], look: snowPack.bossLook });
  });

  it("renames it and sets its fight", async () => {
    const { open, make, group, saved } = setup();
    await open();
    await make();
    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Volt Viper{Enter}");
    await userEvent.click(within(group("Fight")).getByRole("button", { name: "Long" }));
    expect(within(group("Fight")).getByRole("button", { name: "Long" }).getAttribute("aria-pressed")).toBe("true");
    expect(saved().boss).toMatchObject({ name: "Volt Viper", fight: "long" });
  });

  it("chooses attacks in order, two or three, with what each does", async () => {
    const { open, make, saved } = setup();
    await open();
    await make();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Attack 3" }), "None");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Attack 1" }), "Rain");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Attack 2" }), "Big shot");
    expect(screen.getByText("Shots fall from above. Stand in a gap.")).toBeTruthy();
    expect(screen.getByText("A huge, slow shot. Jump over it or slide under.")).toBeTruthy();
    expect(within(screen.getByRole("combobox", { name: "Attack 1" })).queryByRole("option", { name: "None" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Attack 3" }), "Aimed shot");
    expect(saved().boss?.attacks).toEqual(["rain", "big", "aimed"]);
  });

  it("draws on the attack frame", async () => {
    const { open, make, press, saved } = setup();
    await open();
    await make();
    await userEvent.click(within(screen.getByRole("group", { name: "Frames" })).getByRole("button", { name: "Attack" }));
    expect(screen.getByRole("img", { name: "Attack, 24 by 28 pixels" })).toBeTruthy();
    expect(snowPack.bossLook.frames[2][0][0]).toBe(".");
    press(0, 0);
    expect(saved().boss?.look.frames[2][0][0]).toBe("1");
  });

  it("puts it in the boss room and back, and undo follows", async () => {
    const { open, make, group, saved, placedBoss } = setup();
    await open();
    await make();
    const use = (name: string) => within(group("Use in the boss room")).getByRole("button", { name });
    expect(use("Blizzard Bot").getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(use("Your boss"));
    expect(use("Your boss").getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(use("Blizzard Bot").getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(use("Your boss"));
    expect(placedBoss(saved())).toEqual(["own-boss"]);
  });

  it("says plainly when the boss room has no boss to swap", async () => {
    let project = newProject("Empty room", makeId);
    const room = project.levels[0].zones[2];
    project = { ...project, levels: [{ ...project.levels[0], zones: [...project.levels[0].zones.slice(0, 2), { ...room, things: [] }] }] };
    const { open, make, group } = setup(project);
    await open();
    await make();
    expect(within(group("Use in the boss room")).getByRole("button", { name: "Your boss" }).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(within(group("Use in the boss room")).getByRole("button", { name: "Your boss" }));
    expect((await screen.findByRole("alert")).textContent).toContain("There is no boss in a boss room to swap.");
  });

  it("won't delete the boss while it's in the boss room, and deletes it after asking otherwise", async () => {
    const confirm = vi.fn(() => true);
    const { open, make, group, saved } = setup(undefined, confirm);
    await open();
    await make();
    await userEvent.click(within(group("Use in the boss room")).getByRole("button", { name: "Your boss" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete boss" }));
    expect((await screen.findByRole("alert")).textContent).toContain("My Boss is in Boss Room. Put the Blizzard Bot back first.");
    await userEvent.click(within(group("Use in the boss room")).getByRole("button", { name: "Blizzard Bot" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete boss" }));
    expect(confirm).toHaveBeenLastCalledWith("Delete My Boss? You can undo this.");
    expect(screen.getByRole("button", { name: "Make your own boss" })).toBeTruthy();
    expect(saved().boss).toBeNull();
  });
});
```

Add to `tests/editor/charactersScreen.test.tsx`:

```tsx
  it("has a Boss tab", async () => {
    const { open } = setupHero();
    await open();
    await userEvent.click(screen.getByRole("tab", { name: "Boss" }));
    expect(screen.getByRole("tab", { name: "Boss" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "Make your own boss" })).toBeTruthy();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/bossScreen.test.tsx tests/editor/charactersScreen.test.tsx`
Expected: FAIL (no Boss tab).

- [ ] **Step 3: Move the name box to its own file**

Create `src/editor/components/NameField.tsx` with the `NameField` function from `EnemiesScreen.tsx` exactly as it is (with its comment, `"use client"`, and imports of `useState`, `tidyName` and `styles`), exported. In `EnemiesScreen.tsx`, delete it and `import { NameField } from "./NameField";`. Run `npx vitest run tests/editor/enemiesScreen.test.tsx`: it still passes.

- [ ] **Step 4: The Boss screen**

`src/editor/components/BossScreen.tsx`:

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import { BOSS_ATTACKS, BOSS_FIGHTS, BOSS_FRAME, type BossAttack, type BossDesign, type EnemyDesign } from "@/model/designs";
import { OWN_BOSS } from "@/model/gamePack";
import { tidyName, type Project } from "@/model/schema";
import type { ArtSet } from "@/runtime/render/art";
import { lookArt } from "@/runtime/render/lookArt";
import styles from "../editor.module.css";
import type { RawImage } from "../hero/importPicture";
import { BOSS_PREVIEW_INPUTS, bossPreviewSim } from "../hero/preview";
import { readPicture as readPictureFile } from "../hero/readPicture";
import { Colours } from "./Colours";
import { GamePreview } from "./GamePreview";
import { NameField } from "./NameField";
import { PictureEditor, type DrawTool } from "./PictureEditor";

export const ATTACK_TEXT: Record<BossAttack, { name: string; tip: string }> = {
  jump: { name: "Jump", tip: "Leaps at you. Run under it." },
  dash: { name: "Dash", tip: "Charges along the floor. Jump over it." },
  spread: { name: "Spread", tip: "Three shots fan out. Jump through the gap." },
  aimed: { name: "Aimed shot", tip: "One quick shot right at you. Move after it fires." },
  rain: { name: "Rain", tip: "Shots fall from above. Stand in a gap." },
  big: { name: "Big shot", tip: "A huge, slow shot. Jump over it or slide under." },
};

const FIGHT_NAMES: Record<BossDesign["fight"], string> = { short: "Short", normal: "Normal", long: "Long" };
const FRAME_NAMES = ["Stand", "Jump", "Attack"] as const;
const WHOLE_FRAME = { x: 0, y: 0, ...BOSS_FRAME };
const NO_ENEMIES: EnemyDesign[] = []; // one array, so the preview doesn't restart on every render

// The boss fighting in a one-screen boss room, with the hero standing still.
function BossPreview({ boss, project, pack, art }: { boss: BossDesign; project: Project; pack: ContentPack; art?: ArtSet }) {
  const hero = project.hero;
  const start = useCallback(() => bossPreviewSim(boss, hero, pack), [boss, hero, pack]);
  return (
    <GamePreview
      label={`${tidyName(boss.name)} fighting`}
      start={start}
      inputs={BOSS_PREVIEW_INPUTS}
      heroLook={hero.look}
      enemies={NO_ENEMIES}
      boss={boss}
      art={art}
    />
  );
}

// Which boss the game's boss rooms hold: the kid's, the pack's, or none placed.
function bossInUse(project: Project, pack: ContentPack): "yours" | "snow" | null {
  const types = project.levels.flatMap((l) => l.zones.flatMap((z) => z.things.map((t) => t.type)));
  if (types.includes(OWN_BOSS)) return "yours";
  const packBosses = new Set(pack.things.filter((d) => d.behaviour === "boss" && !d.own).map((d) => d.type));
  return types.some((t) => packBosses.has(t)) ? "snow" : null;
}

type Props = {
  project: Project;
  pack: ContentPack;
  art?: ArtSet;
  locked: boolean;
  error: string | null;
  onDismissError(): void;
  onCommand(command: Command): void;
  onBegin(label: string): void;
  onCommit(): void;
  confirm(message: string): boolean;
  readPicture?: (file: File) => Promise<RawImage>;
};

export function BossScreen({
  project,
  pack,
  art,
  locked,
  error,
  onDismissError,
  onCommand,
  onBegin,
  onCommit,
  confirm,
  readPicture = readPictureFile,
}: Props) {
  const { boss } = project;
  const [frame, setFrame] = useState<0 | 1 | 2>(0);
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [slot, setSlot] = useState(1);
  const look = boss?.look;
  const bossArt = useMemo(() => (look ? lookArt(look) : null), [look]);
  const packBoss = pack.things.find((d) => d.behaviour === "boss" && !d.own);
  const inUse = bossInUse(project, pack);

  const setAttacks = (attacks: BossAttack[]) => onCommand({ name: "setBoss", args: { attacks } });

  return (
    <fieldset className={styles.heroScreen} disabled={locked} aria-label="Your boss">
      {error && (
        <p className={styles.alert} role="alert">
          {error}
          <button type="button" onClick={onDismissError}>
            Dismiss
          </button>
        </p>
      )}
      {!boss || !bossArt ? (
        <div>
          <p className={styles.note}>
            Make your own boss to fight in the boss room. It starts as a copy of the {packBoss?.name ?? "boss"}.
          </p>
          <button type="button" className={styles.swatch} onClick={() => onCommand({ name: "createBoss", args: { name: "My Boss" } })}>
            Make your own boss
          </button>
        </div>
      ) : (
        <>
          <div className={styles.drawing}>
            <NameField
              key={boss.name}
              name={tidyName(boss.name)}
              onRename={(name) => onCommand({ name: "setBoss", args: { name } })}
            />
            <div role="group" aria-label="Fight" className={styles.ability}>
              <span className={styles.abilityLabel}>Fight</span>
              <div className={styles.steps}>
                {BOSS_FIGHTS.map((fight) => (
                  <button
                    key={fight}
                    type="button"
                    className={styles.step}
                    aria-pressed={boss.fight === fight}
                    onClick={() => onCommand({ name: "setBoss", args: { fight } })}
                  >
                    {FIGHT_NAMES[fight]}
                  </button>
                ))}
              </div>
            </div>
            <div role="group" aria-label="Attacks, in order" className={styles.ability}>
              <span className={styles.abilityLabel}>Attacks, in order</span>
              {[0, 1, 2].map((i) => (
                <label key={i} className={styles.field}>
                  Attack {i + 1}
                  <select
                    value={boss.attacks[i] ?? ""}
                    onChange={(e) => {
                      const value = e.target.value as BossAttack | "";
                      const next = [...boss.attacks];
                      if (value === "") next.splice(2);
                      else next[i] = value;
                      setAttacks(next);
                    }}
                  >
                    {i === 2 && <option value="">None</option>}
                    {BOSS_ATTACKS.map((a) => (
                      <option key={a} value={a}>
                        {ATTACK_TEXT[a].name}
                      </option>
                    ))}
                  </select>
                  {boss.attacks[i] && <span className={styles.note}>{ATTACK_TEXT[boss.attacks[i]].tip}</span>}
                </label>
              ))}
            </div>
            <div className={styles.drawTools} role="group" aria-label="Frames">
              {([0, 1, 2] as const).map((f) => (
                <button key={f} type="button" className={styles.swatch} aria-pressed={frame === f} onClick={() => setFrame(f)}>
                  {FRAME_NAMES[f]}
                </button>
              ))}
            </div>
            <PictureEditor
              key={frame}
              name={FRAME_NAMES[frame]}
              rows={boss.look.frames[frame]}
              palette={bossArt.palette}
              size={BOSS_FRAME}
              body={WHOLE_FRAME}
              feet
              testId="boss-canvas"
              colours={boss.look.colours}
              tool={tool}
              onTool={setTool}
              slot={Math.min(slot, boss.look.colours.length)}
              onSlot={setSlot}
              partners={([0, 1, 2] as const)
                .filter((f) => f !== frame)
                .map((f) => ({ id: String(f), name: FRAME_NAMES[f], rows: boss.look.frames[f] }))}
              importTarget={{ ...BOSS_FRAME, stand: true }}
              readPicture={readPicture}
              locked={locked}
              onRows={(rows) => onCommand({ name: "setBossFrame", args: { frame, rows } })}
              onImport={(result) => {
                if (result.colours.length !== boss.look.colours.length) {
                  onCommand({ name: "setBossColours", args: { colours: result.colours } });
                }
                onCommand({ name: "setBossFrame", args: { frame, rows: result.rows } });
              }}
              onBegin={onBegin}
              onCommit={onCommit}
            />
          </div>
          <div className={styles.heroSide}>
            <Colours
              colours={boss.look.colours}
              slot={Math.min(slot, boss.look.colours.length)}
              onSlot={setSlot}
              onColours={(colours) => onCommand({ name: "setBossColours", args: { colours } })}
            />
            <BossPreview boss={boss} project={project} pack={pack} art={art} />
            <div role="group" aria-label="Use in the boss room" className={styles.ability}>
              <span className={styles.abilityLabel}>Use in the boss room</span>
              <div className={styles.steps}>
                <button
                  type="button"
                  className={styles.step}
                  aria-pressed={inUse === "snow"}
                  onClick={() => onCommand({ name: "useBoss", args: { boss: "snow" } })}
                >
                  {packBoss?.name ?? "Pack boss"}
                </button>
                <button
                  type="button"
                  className={styles.step}
                  aria-pressed={inUse === "yours"}
                  onClick={() => onCommand({ name: "useBoss", args: { boss: "yours" } })}
                >
                  Your boss
                </button>
              </div>
            </div>
            <button
              type="button"
              className={styles.swatch}
              onClick={() => {
                if (confirm(`Delete ${tidyName(boss.name)}? You can undo this.`)) onCommand({ name: "removeBoss", args: {} });
              }}
            >
              Delete boss
            </button>
          </div>
        </>
      )}
    </fieldset>
  );
}
```

The PictureEditor is keyed by the frame alone: a new boss is only ever made after the old one is gone, so the frame is enough. (`EnemiesScreen` keys by enemy and frame because the kid switches enemies.)

- [ ] **Step 5: The Boss tab**

In `src/editor/components/CharactersScreen.tsx`: `type Tab = "hero" | "enemies" | "boss";`, add `{ id: "boss", label: "Boss" }` to `TABS`, update the comment to "The kid's characters: their hero, their own enemies and their own boss.", and render

```tsx
        {tab === "boss" && (
          <BossScreen
            project={props.project}
            pack={props.pack}
            art={props.art}
            locked={props.locked}
            error={props.error}
            onDismissError={props.onDismissError}
            onCommand={props.onCommand}
            onBegin={props.onBegin}
            onCommit={props.onCommit}
            confirm={props.confirm}
            readPicture={props.readPicture}
          />
        )}
```

turning the existing ternary into `tab === "hero" && …` and `tab === "enemies" && …` alongside it.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A src tests
git commit -m "feat: add the Boss tab: make, arm, draw, preview, use and delete the kid's own boss"
```

---

### Task 3: Fight it in a browser

**Files:**
- Create: `e2e/boss.spec.ts`
- Modify: `docs/superpowers/STATUS.md`

**Interfaces:**
- Consumes: Tasks 1 and 2

- [ ] **Step 1: Write the browser test**

`e2e/boss.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

type Saved = { boss: { name: string; attacks: string[] } | null; levels: { zones: { things: { type: string }[] }[] }[] };

async function saved(page: Page): Promise<Saved> {
  return page.evaluate(
    () =>
      new Promise<Saved>((resolve, reject) => {
        const request = indexedDB.open("megarombuilder");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const all = request.result.transaction("projects").objectStore("projects").getAll();
          all.onsuccess = () => resolve(all.result[0].project);
        };
      }),
  );
}

test("make a boss, put it in the boss room, and fight it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("My Boss");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Characters" }).click();
  await page.getByRole("tab", { name: "Boss" }).click();
  await page.getByRole("button", { name: "Make your own boss" }).click();
  await page.getByRole("combobox", { name: "Attack 1" }).selectOption({ label: "Rain" });
  await page.getByRole("combobox", { name: "Attack 2" }).selectOption({ label: "Big shot" });
  await page.getByRole("group", { name: "Use in the boss room" }).getByRole("button", { name: "Your boss" }).click();
  await expect.poll(async () => (await saved(page)).boss?.attacks).toEqual(["rain", "big", "dash"]);
  await expect.poll(async () => (await saved(page)).levels[0].zones[2].things.map((t) => t.type)).toEqual(["own-boss"]);
  await page.screenshot({ path: "test-results/boss.png", fullPage: true });

  await page.getByRole("button", { name: "Level" }).click();
  await page.getByRole("button", { name: /Boss Room/ }).click();
  await page.getByRole("button", { name: "Play from this zone" }).click();
  await expect(page.getByRole("button", { name: "Stop playing" })).toBeVisible();
  await page.waitForTimeout(2000); // into the fight
  await page.screenshot({ path: "test-results/boss-fight.png" });
});
```

- [ ] **Step 2: Run it**

Run: `npm run e2e`
Expected: 12 passed. Look at `test-results/boss.png` and `test-results/boss-fight.png`: the Boss tab with the drawing, attacks and preview; the kid's boss in the boss room.

- [ ] **Step 3: Update the status and commit**

In `docs/superpowers/STATUS.md`: mark this plan implemented, reviewed and merged; say the Characters screen has a Boss tab where kids make, arm, draw, preview and use their own boss; update the test counts; add this plan's deferred review findings.

```bash
git add e2e/boss.spec.ts docs/superpowers/STATUS.md
git commit -m "test: make a boss, put it in the boss room and fight it in a browser"
```

---

## Self-review

- **Spec coverage:** section 6's Boss tab: Make your own boss from the Blizzard Bot, name, fight length as steps, attacks in order (2 or 3) with one-line descriptions, three frames with the drawing tools and import, a fight preview, Use in the boss room, Delete boss refused while in use → Task 2; the palette not listing the kid's boss → Task 1; section 8's rows for attacks and the boss in use → Task 2 (the picker can't make fewer than 2 or more than 3; the commands refuse too); section 9's screen and browser tests → Tasks 2 and 3. The assistant is plan 5.
- **Types:** `bossPreviewSim`, `BOSS_PREVIEW_INPUTS`, `NameField`, `BossScreen`, `ATTACK_TEXT` are defined once and used with the same names.
- **Known limits, accepted:** "Use in the boss room" swaps every placed boss (plan 3's deferred minor); the attack drop-downs allow the same attack twice ("aimed, aimed"), which the game allows.
