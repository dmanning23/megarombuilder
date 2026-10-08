# Character Editor Tidy-up, Plan 1 of 2: The Screen Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Characters screen uses the whole window (no zone panel, no assistant), each tab opens with one "About" bar holding the character's settings, the live preview moves into the look editor, and the screen's buttons, fields and headings share one look.

**Architecture:** The Editor stops rendering the zone panel and the chat while the Characters screen shows (their state already lives in the Editor, so nothing is lost), and the characters area spans the window's columns. Each tab's fieldset becomes a single column: an About bar (`section`, labelled), then the `AnimationEditor`, which gains a `preview` slot. Two button classes, `.choice` (pills that stay pressed) and `.action` (solid, with a `.danger` variant), plus styled text inputs and one heading style, replace the mix used on the Characters screen.

**Tech Stack:** as before. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-character-editor-cleanup-design.md` (sections 2, 4, 6; build order item 1)

## Global Constraints

- No behaviour changes; every control keeps its accessible name and role, so existing tests keep finding it.
- The chat keeps its messages, its unsent text and any turn in progress while hidden.
- Kid-friendly, plain labels; one style for choices, one for actions; destructive actions (Delete enemy, Delete boss, Delete frame, Clear) marked in a warning colour.
- Import alias `@/` maps to `src/`. Component tests run in jsdom.

## Review Focus

1. **Playing the game from the Characters screen (Play):** the game shows full width, and Stop playing returns to the Characters screen with the panels still hidden. Tested in Task 1.
2. **Typing in the chat, going to Characters and back:** the text is still there. Tested in Task 1.
3. **The Enemies tab with no enemies yet:** the About bar shows the list's "New enemy" and the invitation, and nothing else breaks. Tested in Task 2.
4. **The Boss tab with no boss:** the About bar holds "Make your own boss", and no look editor shows. Tested in Task 2.
5. **A narrow window:** the About bar wraps and nothing overflows sideways. Checked by screenshot in Task 3.

## File Structure

```
src/editor/Editor.tsx                       no zone panel or chat on the Characters screen
src/editor/components/HeroScreen.tsx        About bar; preview into the look editor
src/editor/components/EnemiesScreen.tsx     About bar (list, name, behaviour, tuning, Delete); preview into the look editor
src/editor/components/BossScreen.tsx        About bar; preview into the look editor
src/editor/components/AnimationEditor.tsx   a "Look" section with a preview slot; action and choice classes
src/editor/components/PictureEditor.tsx, Colours.tsx, HeroAbilities.tsx, NameField.tsx   action and choice classes
src/editor/editor.module.css                .characterWork, .characterScreen, .aboutBar, .panelHeading, .choice, .action, .danger, text inputs
tests/editor/charactersScreen.test.tsx, e2e/characters.spec.ts
```

---

### Task 1: The Characters screen uses the whole window

**Files:**
- Modify: `src/editor/Editor.tsx`, `src/editor/editor.module.css`
- Test: additions to `tests/editor/charactersScreen.test.tsx`

**Interfaces:**
- Produces: CSS class `.characterWork` (the Characters screen's `main`, spanning every column)

- [ ] **Step 1: Write the failing tests**

Add to `tests/editor/charactersScreen.test.tsx`, in `describe("the Characters screen")`:

```tsx
  it("uses the whole window: no zone list and no assistant", async () => {
    const { open } = setupHero();
    await open();
    expect(screen.queryByRole("navigation", { name: "Zones" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Ask the assistant" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Level" }));
    expect(screen.getByRole("navigation", { name: "Zones" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Ask the assistant" })).toBeTruthy();
  });

  it("keeps what was typed in the chat while the Characters screen shows", async () => {
    const { open } = setupHero();
    await userEvent.type(screen.getByRole("textbox", { name: "Ask the assistant" }), "add spikes");
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Level" }));
    expect((screen.getByRole("textbox", { name: "Ask the assistant" }) as HTMLTextAreaElement).value).toBe("add spikes");
  });

  it("plays full width and comes back to the Characters screen", async () => {
    const { open } = setupHero();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.queryByRole("navigation", { name: "Zones" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Stop playing" }));
    expect(screen.getByRole("tab", { name: "Hero" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Zones" })).toBeNull();
  });
```

(The zone list is a `nav` labelled by its "Zones" heading; if its accessible name differs, use the name the existing editor tests use. If the chat box's name differs from "Ask the assistant", use its real name.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/charactersScreen.test.tsx`
Expected: FAIL (the zone list and the chat show on the Characters screen).

- [ ] **Step 3: Write the implementation**

In `Editor.tsx`, work out once whether the side panels show:

```tsx
  // The Characters screen (and a game played from it) uses the whole window: the zone panel and the
  // chat are about the level. Their state lives here, so hiding them loses nothing.
  const sidePanels = screen !== "characters";
```

Render `<aside className={styles.side}>…</aside>` and `<ChatPanel … />` only when `sidePanels`; give the playing `main` and the characters `main` the extra class `styles.fullWidth` when `!sidePanels` (`className={`${styles.playing} ${sidePanels ? "" : styles.fullWidth}`}` and `className={styles.characterWork}` for the characters `main`).

In `editor.module.css`:

```css
/* The Characters screen spans every column of the editor. */
.characterWork {
  grid-column: 1 / -1;
  min-height: 0;
  overflow: auto;
  padding: 1rem 1.25rem;
}
.fullWidth {
  grid-column: 1 / -1;
}
```

(`.heroWork` is no longer used: delete it.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: give the Characters screen the whole window"
```

---

### Task 2: About bars, and the preview beside the drawing

**Files:**
- Modify: `src/editor/components/HeroScreen.tsx`, `src/editor/components/EnemiesScreen.tsx`, `src/editor/components/BossScreen.tsx`, `src/editor/components/AnimationEditor.tsx`, `src/editor/editor.module.css`
- Test: additions to `tests/editor/charactersScreen.test.tsx`, `tests/editor/enemiesScreen.test.tsx`, `tests/editor/bossScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1
- Produces: `AnimationEditor`'s new prop `preview?: React.ReactNode` and its root `<section aria-label="Look">`; the About bars `<section aria-label="About your hero">`, `"About your enemies"`, `"About your boss"`; CSS `.characterScreen`, `.aboutBar`, `.aboutGroup`, `.panel`, `.panelHeading`

- [ ] **Step 1: Write the failing tests**

Add to `tests/editor/charactersScreen.test.tsx`:

```tsx
  it("puts the hero's abilities in its About bar, and its preview beside the drawing", async () => {
    const { open } = setupHero();
    await open();
    const about = screen.getByRole("region", { name: "About your hero" });
    expect(within(about).getByRole("group", { name: "Jump" })).toBeTruthy();
    expect(within(about).getByRole("button", { name: /Start again/ })).toBeTruthy();
    const look = screen.getByRole("region", { name: "Look" });
    expect(within(look).getByRole("img", { name: "Your hero in action" })).toBeTruthy();
    expect(within(look).getByRole("img", { name: "Stand frame 1, 16 by 24 pixels" })).toBeTruthy();
  });
```

(import `within` from `@testing-library/react`. The reset button's name is whatever `HeroAbilities` renders for "Start again from the snow hero"; match it with the regex.)

Add to `tests/editor/enemiesScreen.test.tsx`:

```tsx
  it("holds the list, name, behaviour, tuning and Delete in the About bar, and the preview beside the drawing", async () => {
    const { open } = setup();
    await open();
    const about = () => screen.getByRole("region", { name: "About your enemies" });
    expect(within(about()).getByRole("button", { name: "New enemy" })).toBeTruthy();
    await make("Frost Fang", "Walker");
    expect(within(about()).getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(within(about()).getByRole("group", { name: "Behaviour" })).toBeTruthy();
    expect(within(about()).getByRole("group", { name: "Speed" })).toBeTruthy();
    expect(within(about()).getByRole("button", { name: "Delete enemy" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Look" })).getByRole("img", { name: "Frost Fang in action" })).toBeTruthy();
  });
```

Add to `tests/editor/bossScreen.test.tsx`:

```tsx
  it("holds the boss's settings in the About bar, with Make your own boss there before there is one", async () => {
    const { open, make } = setup();
    await open();
    const about = () => screen.getByRole("region", { name: "About your boss" });
    expect(within(about()).getByRole("button", { name: "Make your own boss" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Look" })).toBeNull();
    await make();
    for (const name of ["Fight", "Use in the boss room"]) expect(within(about()).getByRole("group", { name })).toBeTruthy();
    expect(within(about()).getByRole("combobox", { name: "Attack 1" })).toBeTruthy();
    expect(within(about()).getByRole("button", { name: "Delete boss" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Look" })).getByRole("img", { name: "My Boss fighting" })).toBeTruthy();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/charactersScreen.test.tsx tests/editor/enemiesScreen.test.tsx tests/editor/bossScreen.test.tsx`
Expected: FAIL (no About regions; no Look region).

- [ ] **Step 3: The look editor's section and preview slot**

In `AnimationEditor.tsx`: add `preview?: ReactNode` (import `type ReactNode` from React) to the props; make the root `<section className={styles.animationEditor} aria-label="Look">` (it was a `div`); and after the Colours, inside the same column, render

```tsx
        {preview && (
          <div className={styles.panel}>
            <h3 className={styles.panelHeading}>Preview</h3>
            {preview}
          </div>
        )}
```

- [ ] **Step 4: The Hero tab**

`HeroScreen.tsx` renders, inside its fieldset (now `className={styles.characterScreen}`):

```tsx
      {error && (/* the alert, as now */)}
      <section className={styles.aboutBar} aria-label="About your hero">
        <HeroAbilities … as now … />
      </section>
      <AnimationEditor
        … as now …
        preview={<GamePreview label="Your hero in action" start={startPreview} inputs={previewShow} heroLook={look} enemies={NO_ENEMIES} art={art} />}
      />
```

and no longer renders the `heroSide` div.

- [ ] **Step 5: The Enemies tab**

`EnemiesScreen.tsx`'s fieldset (`className={styles.characterScreen}`, label "Your enemies" as now) renders:

```tsx
      {error && (/* the alert, as now */)}
      <section className={styles.aboutBar} aria-label="About your enemies">
        <div className={styles.aboutGroup}>{/* the enemy list, New enemy, the 12-is-the-most note and the New enemy form, as now */}</div>
        {enemy ? (
          <>
            <div className={styles.aboutGroup}>{/* NameField, the Behaviour group and the tuning rows, as now */}</div>
            <button type="button" className={`${styles.action} ${styles.danger}`} onClick={/* as now */}>
              Delete enemy
            </button>
          </>
        ) : (
          <p className={styles.note}>Make your own enemies to fight. Start with New enemy.</p>
        )}
      </section>
      {enemy && (
        <AnimationEditor
          key={`${enemy.id}:${enemy.behaviour}`}
          … as now …
          preview={<EnemyPreview enemy={enemy} project={project} pack={pack} art={art} />}
        />
      )}
```

The old `drawing` and `heroSide` wrappers go.

- [ ] **Step 6: The Boss tab**

`BossScreen.tsx`'s fieldset (`className={styles.characterScreen}`) renders an About bar `<section className={styles.aboutBar} aria-label="About your boss">` holding, with no boss, the invitation text and **Make your own boss**; with a boss, one `aboutGroup` with the NameField, the Fight group and the three attack drop-downs (as now), another with the "Use in the boss room" group, and **Delete boss** (`action danger`). Then, with a boss, the `AnimationEditor` with `preview={<BossPreview boss={boss} project={project} pack={pack} art={art} />}`.

- [ ] **Step 7: The layout's CSS**

In `editor.module.css` (replacing `.heroScreen`, `.bossScreen`, `.heroSide`, `.drawing`, `.enemyList` rules that nothing uses any more: `grep -rn "styles.heroScreen\|styles.bossScreen\|styles.heroSide\|styles.drawing\|styles.enemyList" src` must find nothing before deleting each):

```css
/* A character tab: its About bar, then its look. */
.characterScreen {
  display: grid;
  gap: 1rem;
  align-content: start;
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.characterScreen > .alert {
  margin: 0;
}
/* The character's settings, in one bar that wraps. */
.aboutBar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem 2rem;
  padding: 1rem 1.25rem;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 1px 0 var(--panel-2);
}
.aboutGroup {
  display: grid;
  gap: 0.6rem;
  align-content: start;
  min-width: 0;
}
.aboutBar > .action:last-child {
  margin-left: auto;
  align-self: flex-start;
}
/* A labelled panel beside the drawing. */
.panel {
  display: grid;
  gap: 0.5rem;
  align-content: start;
}
.panelHeading {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--panel);
}
```

(If `#ffffff` clashes with the existing `--paper` palette, use whichever light token the stylesheet already defines for raised surfaces; the bar should read as a card on the page.)

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. Existing tests that relied on the old wrappers' structure get updated only where they named a wrapper; every control is still found by name.

- [ ] **Step 9: Commit**

```bash
git add -A src tests
git commit -m "feat: put each character's settings in an About bar, and its preview beside the drawing"
```

---

### Task 3: One look for buttons, fields and headings

**Files:**
- Modify: `src/editor/editor.module.css`, `src/editor/components/AnimationEditor.tsx`, `src/editor/components/PictureEditor.tsx`, `src/editor/components/Colours.tsx`, `src/editor/components/HeroAbilities.tsx`, `src/editor/components/EnemiesScreen.tsx`, `src/editor/components/BossScreen.tsx`, `src/editor/components/NameField.tsx`, `docs/superpowers/STATUS.md`
- Create: `e2e/characters.spec.ts`

**Interfaces:**
- Produces: CSS `.choice` (a pill that stays pressed: `aria-pressed`), `.action` (a solid button), `.danger` (warning colour for an action)

- [ ] **Step 1: Write the screenshot test**

`e2e/characters.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const SIZES = [
  { name: "1280", width: 1280, height: 800 },
  { name: "1600", width: 1600, height: 1000 },
  { name: "phone", width: 390, height: 844 },
];

for (const size of SIZES) {
  test(`the Characters screen at ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await page.getByRole("textbox", { name: "Game name" }).fill("Look");
    await page.getByRole("button", { name: "Make a new game" }).click();
    await page.getByRole("button", { name: "Characters" }).click();
    await page.screenshot({ path: `test-results/characters-hero-${size.name}.png`, fullPage: true });
    await page.getByRole("tab", { name: "Enemies" }).click();
    await page.getByRole("button", { name: "New enemy" }).click();
    await page.getByRole("textbox", { name: "Enemy name" }).fill("Frost Fang");
    await page.getByRole("group", { name: "Choose how it behaves" }).getByRole("button", { name: "Turret" }).click();
    await page.screenshot({ path: `test-results/characters-enemies-${size.name}.png`, fullPage: true });
    await page.getByRole("tab", { name: "Boss" }).click();
    await page.getByRole("button", { name: "Make your own boss" }).click();
    await page.screenshot({ path: `test-results/characters-boss-${size.name}.png`, fullPage: true });
    // Nothing spills sideways off the page.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/characters.spec.ts`
Expected: PASS or FAIL on the overflow check at phone width; either way, look at the nine screenshots now to record how it looks before the styling.

- [ ] **Step 3: The styles**

In `editor.module.css`:

```css
/* A choice that stays chosen: a pill, filled when pressed. */
.choice {
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  border: 2px solid var(--panel);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}
.choice[aria-pressed="true"] {
  background: var(--signal);
  border-color: var(--signal);
}
/* An action: a solid button that does something once. */
.action {
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  padding: 0.35rem 0.9rem;
  border-radius: 10px;
  border: 2px solid var(--panel);
  background: var(--panel);
  color: var(--paper);
  cursor: pointer;
}
.danger {
  background: transparent;
  color: #c0392b;
  border-color: #c0392b;
}
.choice:disabled,
.action:disabled {
  opacity: 0.4;
  cursor: default;
}
.choice:focus-visible,
.action:focus-visible {
  outline: 3px solid var(--signal);
  outline-offset: 2px;
}
.field input {
  font: inherit;
  font-weight: 400;
  font-size: 15px;
  padding: 0.3rem 0.4rem;
  border-radius: 8px;
  border: 2px solid var(--panel-2);
}
.field input:focus-visible {
  outline: 3px solid var(--signal);
  outline-offset: 2px;
}
```

(Use the colour tokens the stylesheet already has; if it has a warning or error colour, use it for `.danger` instead of `#c0392b`.)

Then use them on the Characters screen:
- **choices** (`className={styles.choice}`): the drawing tools (PictureEditor's tool buttons, including Hitbox and Shot point), Onion skin and the speed buttons. The ability, behaviour, tuning, fight and "Use in the boss room" steps already use `.step`, which is a pill: make `.step` and `.choice` share the same rule (`.step, .choice { … }`) rather than renaming every `.step`.
- **actions** (`className={styles.action}`): Add frame, Copy frame, Move left, Move right, Play animation / Stop animation, Narrower, Wider, Shorter, Taller, Fit to drawing, Flip, Import picture, Add a colour, New enemy, Make your own boss, "Start again from the snow hero".
- **actions marked danger** (`` `${styles.action} ${styles.danger}` ``): Delete frame, Clear, Remove colour N, Delete enemy, Delete boss.
- The animation list and the frame strip keep their thumbnail buttons (they are choices with pictures).
- **headings:** the Colours heading and the About bar's group headings (for example HeroAbilities' "Abilities") use `.panelHeading`.

- [ ] **Step 4: Run everything, and look**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass, including the overflow check at every size (fix any sideways overflow at phone width: usually a fixed-width row that needs `flex-wrap: wrap` or `min-width: 0`). Open all nine `test-results/characters-*.png` screenshots and check: the About bar is one wrapping card; every action looks like a solid button and every choice like a pill; Delete and Clear stand out; nothing overlaps.

- [ ] **Step 5: Update the status and commit**

In `docs/superpowers/STATUS.md`: add this plan to the documents table (implemented, reviewed and merged) and the spec as approved; say the Characters screen now uses the whole window with an About bar per tab and one look for its buttons; update the test counts; add this plan's deferred review findings.

```bash
git add -A src tests e2e docs/superpowers/STATUS.md
git commit -m "feat: give the Characters screen one look for its choices, actions, fields and headings"
```

---

## Self-review

- **Spec coverage:** section 2 (full width without the zone panel and assistant, the chat kept as it was, the tabs, the About bars per tab with their exact contents, the preview moved beside the drawing) → Tasks 1 and 2; section 4 (choice pills, solid actions, destructive ones marked, dimmed unavailable buttons, styled inputs, one heading style) → Task 3; section 6's tests for the hidden panels, the About bars and the screenshots at 1280, 1600 and a phone width → Tasks 1 to 3. Section 3's paint-app layout and growing canvas, and section 5's stacking, are plan 2; the screenshot test written here is reused there.
- **Placeholder scan:** Task 2's JSX for the Enemies and Boss tabs moves existing markup into new wrappers, named piece by piece rather than repeated in full; Task 3's class list names every button.
- **Types:** `preview`, `.characterWork`, `.fullWidth`, `.characterScreen`, `.aboutBar`, `.aboutGroup`, `.panel`, `.panelHeading`, `.choice`, `.action`, `.danger` are defined once and used with the same names.
