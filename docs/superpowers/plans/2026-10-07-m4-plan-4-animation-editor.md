# The Animation Editor Implementation Plan (Milestone 4, Plan 4 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Hero, Enemies and Boss tabs, kids pick an animation from a list, see its frames in a strip, add, copy, delete and reorder frames, draw each with an onion skin of the frame before, play the animation at slow, normal or fast, and use up to 16 colours.

**Architecture:** One new component, `AnimationEditor`, holds the animation list, the frame strip, the play box, the speed and onion-skin controls and the drawing area (`PictureEditor`, as now), and sends the look commands from plan 1 with a `target`. The three tabs swap their picture buttons and drawing area for it. The pixel canvas gains a faint "onion skin" layer. The colour limit in the editor rises to 16.

**Tech Stack:** as plan 1. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-07-milestone-4-characters-that-fit-design.md` (section 6; section 8, "A ninth frame", "Deleting the last frame"; section 9, "Screens"; build order item 4)

**Plan series for milestone 4:**

1. The shared look, format 4, the upgrade, the look commands (done)
2. Animations in the game (done)
3. Sizes, hitboxes and shot points in the game (done)
4. The animation editor (this plan)
5. The editor: size, hitbox, shot marker

## Global Constraints

- Every change is one undo step: a stroke, a frame added, copied, deleted or moved, a speed.
- Kid-friendly: plain labels, buttons that do one thing, nothing offered that would be refused (Add and Copy off at 8 frames, Delete off at 1).
- The editor changes the game only through commands; the screens' fieldsets still turn everything off while the assistant works.
- Import alias `@/` maps to `src/`. Component tests run in jsdom.

## Decisions this plan makes

- **Names on screen:** the animation list's buttons read "Run, 2 frames" (or "1 frame"); frame buttons read "Frame 1", "Frame 2"…; the canvas reads "Run frame 2, 16 by 24 pixels". The hero's slide keeps its "(needs slide)" note, and the charged shot gets "(needs charge shot)".
- **The frame strip** has Add frame (a blank frame after the chosen one), Copy frame (a copy after it), Delete frame, Move left and Move right; frames can also be dragged onto each other to reorder. The chosen frame follows the change: the new frame after Add or Copy, the moved frame after a move, the one before after a delete.
- **Play** loops the animation in a small box at its speed, using the game's timing (`frameSteps`), whether or not the game plays it once. Play turns into Stop while it runs.
- **Onion skin** (off at first) shows the frame before the chosen one (for the first frame, the last one) faintly under the drawing, in its own colours at a third of their strength.
- **The hitbox outline** on the canvas is the look's own (`body`, or `slideBody` on the slide), not the fixed sizes; the shots show no outline. (This settles plan 3's deferred item about the outline.)
- **"Copy from"** lists every frame on the same canvas ("Stand frame 1", "Run frame 2"…), so a kid can start a frame from any other.
- **"Run and shoot"** is now its own animation in the list, so the hero screen stops mirroring Run into it.
- **16 colours** in the screens and for imported pictures.
- **Choosing another enemy, or changing an enemy's behaviour,** starts the editor on that look's first animation and frame.

## Review Focus

1. **Deleting the chosen frame when it is the last in the strip:** the chosen frame becomes the new last one, never past the end. Tested in Task 2.
2. **Undo after Add frame while frame 3 is chosen and the animation has only 2 frames again:** the editor shows a frame that exists. Tested in Task 2.
3. **Switching animation in the middle of a stroke:** the stroke ends as one undo step in its own frame (the drawing area is keyed by animation and frame, as now by picture). Tested in Task 2.
4. **An enemy whose behaviour changes while its third walk frame is chosen:** the editor starts on the new behaviour's first animation. Tested in Task 3.
5. **Sixteen colours, then importing a picture:** the import keeps up to 16 colours and nothing is refused. Tested in Task 1.

## File Structure

```
src/editor/hero/pixels.ts               drawPixels draws an onion skin; bodyBox and enemyBody go
src/editor/hero/importPicture.ts        16 colours (EDITOR_MAX_COLOURS removed)
src/editor/components/Colours.tsx       16 colours
src/editor/components/PixelCanvas.tsx, PictureEditor.tsx   pass the onion skin through
src/editor/components/AnimationEditor.tsx   the animation list, frame strip, play box, speed, onion skin and drawing
src/runtime/render/animate.ts           baseFor(animation)
src/editor/components/HeroScreen.tsx, EnemiesScreen.tsx, BossScreen.tsx   use AnimationEditor
src/editor/editor.module.css            the strip and the play box
tests/editor/pixels.test.ts, tests/editor/animationEditor.test.tsx, and the screens' tests; e2e/enemies.spec.ts
```

---

### Task 1: Onion skin, sixteen colours, and each animation's timing

**Files:**
- Modify: `src/editor/hero/pixels.ts`, `src/editor/hero/importPicture.ts`, `src/editor/components/Colours.tsx`, `src/runtime/render/animate.ts`
- Test: `tests/editor/pixels.test.ts` (or the file that already tests `drawPixels`: `grep -rln drawPixels tests`), `tests/editor/heroColours.test.tsx`, `tests/editor/importPicture.test.ts`, `tests/runtime/animate.test.ts`

**Interfaces:**
- Produces: `drawPixels(ctx, rows, palette, size, body: Box | null, feet: boolean, under?: string[])`; `type PixelCtx = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect" | "globalAlpha">`; `ONION_ALPHA = 1 / 3`; `baseFor(animation: string): number` (6 for run and runShoot, 8 otherwise)

- [ ] **Step 1: Write the failing tests**

Add to the `drawPixels` test file:

```ts
describe("the onion skin", () => {
  it("draws the frame underneath faintly, and the frame itself at full strength", () => {
    const fills: { colour: string; alpha: number; x: number; y: number }[] = [];
    const ctx = {
      fillStyle: "",
      globalAlpha: 1,
      fillRect(x: number, y: number) {
        fills.push({ colour: String(this.fillStyle), alpha: this.globalAlpha, x, y });
      },
    };
    drawPixels(ctx, ["1.", ".."], { "1": "#ff0000", "2": "#00ff00" }, { w: 2, h: 2 }, null, false, ["..", ".2"]);
    expect(fills).toContainEqual({ colour: "#00ff00", alpha: ONION_ALPHA, x: ZOOM, y: ZOOM });
    expect(fills).toContainEqual({ colour: "#ff0000", alpha: 1, x: 0, y: 0 });
    expect(ctx.globalAlpha).toBe(1); // put back
  });
});
```

(import `drawPixels`, `ONION_ALPHA`, `ZOOM` from `@/editor/hero/pixels`.)

In `tests/editor/heroColours.test.tsx`, change "adds a colour, chooses it, and draws with it" so it keeps adding until sixteen:

```tsx
  it("adds colours up to sixteen, and draws with the sixteenth", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    for (let i = 0; i < 9; i++) await choose("Add a colour");
    expect(screen.getByRole("button", { name: "Colour 16" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Add a colour" })).toBeNull(); // sixteen is the most
    press(0, 0);
    const look = saved().hero.look;
    expect(look.colours).toHaveLength(16);
    expect(pictureRows(look, "stand")[0][0]).toBe("g");
  });
```

(the snow hero starts with 7 colours.) In `tests/editor/importPicture.test.ts`, add:

```ts
  it("keeps up to sixteen colours", () => {
    const colours = Array.from({ length: 16 }, (_, i) => i * 3);
    const data: number[] = [];
    for (const c of colours) data.push(...PALETTE_RGB[c], 255);
    const result = importPicture({ width: 16, height: 1, data }, { w: 16, h: 1, stand: false }, [colours[0]], false);
    expect(result.colours).toHaveLength(16);
    expect(result.rows[0]).toBe("123456789abcdefg");
  });
```

(`PALETTE_RGB` from `@/model/palette`; if a palette entry is a hex string rather than an RGB triple there, convert the way the file's other tests build images.)

Add to `tests/runtime/animate.test.ts`:

```ts
describe("baseFor", () => {
  it("times the run every 6 steps and everything else every 8", () => {
    expect(["run", "runShoot", "stand", "walk", "attack"].map(baseFor)).toEqual([6, 6, 8, 8, 8]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor tests/runtime/animate.test.ts`
Expected: FAIL (no onion skin; 8 colours at most; no `baseFor`).

- [ ] **Step 3: Write the implementation**

`src/editor/hero/pixels.ts`:
- `export type PixelCtx = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect" | "globalAlpha">;` and `export const ONION_ALPHA = 1 / 3;`
- `drawPixels(ctx, rows, palette, size, body: Box | null, feet: boolean, under?: string[])`: after the background and before the picture, when `under` is given, set `ctx.globalAlpha = ONION_ALPHA`, fill its pixels in their palette colours, and set `ctx.globalAlpha = 1`. The body outline is drawn only when `body` is not null.
- Delete `bodyBox`, `enemyBody` and `drawPicture` once Task 2 and 3 no longer use them (Task 3, Step 5 says when).

`src/editor/hero/importPicture.ts`: delete `EDITOR_MAX_COLOURS`; use `MAX_LOOK_COLOURS` (from `@/model/look`) where it was used. `src/editor/components/Colours.tsx`: use `MAX_LOOK_COLOURS` for "Add a colour", and change the comment to "A character's colours, and the 8-bit palette to change the chosen one."

`src/runtime/render/animate.ts`: `export const baseFor = (animation: string): number => (animation === "run" || animation === "runShoot" ? RUN_BASE : BASE);` and use it in `heroShown`'s loop for run and runShoot.

In `src/editor/editor.module.css`, let `.slots` wrap (`flex-wrap: wrap`) so sixteen colours fit narrow screens.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: draw an onion skin under a picture, and let characters use sixteen colours"
```

---

### Task 2: The animation editor, on the Hero tab

**Files:**
- Create: `src/editor/components/AnimationEditor.tsx`
- Modify: `src/editor/components/PixelCanvas.tsx`, `src/editor/components/PictureEditor.tsx`, `src/editor/components/HeroScreen.tsx`, `src/editor/editor.module.css`
- Test: `tests/editor/animationEditor.test.tsx`; the hero screen's tests (`tests/editor/heroScreen.test.tsx`, `heroColours.test.tsx`, `heroImport.test.tsx`, `charactersScreen.test.tsx`)

**Interfaces:**
- Consumes: Task 1; `KINDS`, `ANIMATION_NAMES`, `MAX_FRAMES`, `ANIMATION_SPEEDS`, `type Look`, `type LookKind` from `@/model/look`; `type LookTarget` from `@/commands/look`; `lookSprites`, `lookArt` palettes; `frameSteps`, `baseFor`
- Produces: `AnimationEditor({ kind, look, target, label, notes?, testId, locked, onCommand, onBegin, onCommit, readPicture })`; `PictureEditor`'s and `PixelCanvas`'s new optional prop `under?: string[]`

- [ ] **Step 1: Write the failing tests**

`tests/editor/animationEditor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

const animations = () => screen.getByRole("group", { name: "Animations" });
const frames = () => screen.getByRole("group", { name: "Frames" });
const chooseAnimation = (name: string) => userEvent.click(within(animations()).getByRole("button", { name: new RegExp(`^${name},`) }));
const frameButton = (n: number) => within(frames()).getByRole("button", { name: `Frame ${n}` });

describe("the animation editor", () => {
  it("lists every animation with its frame count, and shows the chosen one's frames", async () => {
    const { open } = setupHero();
    await open();
    const names = within(animations()).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names).toContain("Run, 2 frames");
    expect(names).toContain("Stand, 1 frame");
    expect(names).toContain("Run and shoot, 2 frames");
    await chooseAnimation("Run");
    expect(frameButton(2)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Run frame 1, 16 by 24 pixels" })).toBeTruthy();
  });

  it("adds a blank frame after the chosen one, chooses it, and one undo takes it away", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Run");
    await userEvent.click(frameButton(2));
    await userEvent.click(screen.getByRole("button", { name: "Add frame" }));
    expect(frameButton(3).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("img", { name: "Run frame 3, 16 by 24 pixels" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(within(frames()).queryByRole("button", { name: "Frame 3" })).toBeNull();
    expect(screen.getByRole("img", { name: "Run frame 2, 16 by 24 pixels" })).toBeTruthy(); // a frame that exists
    expect(saved().hero.look.animations.run.frames).toHaveLength(2);
  });

  it("copies, moves and deletes frames, with the chosen frame following", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Run");
    await userEvent.click(screen.getByRole("button", { name: "Copy frame" })); // frame 1 copied to frame 2
    expect(frameButton(2).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Move right" }));
    expect(frameButton(3).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Delete frame" }));
    expect(frameButton(2).getAttribute("aria-pressed")).toBe("true"); // the last one now
    const run = saved().hero.look.animations.run.frames;
    expect(run).toHaveLength(2);
    expect(run[0]).toEqual(snowHero.animations.run.frames[0]);
  });

  it("reorders by dragging one frame onto another", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Run");
    fireEvent.dragStart(frameButton(2));
    fireEvent.dragOver(frameButton(1));
    fireEvent.drop(frameButton(1));
    expect(saved().hero.look.animations.run.frames).toEqual([...snowHero.animations.run.frames].reverse());
  });

  it("turns off Add and Copy at eight frames and Delete at one", async () => {
    const { open } = setupHero();
    await open();
    await chooseAnimation("Stand");
    expect(screen.getByRole("button", { name: "Delete frame" })).toHaveProperty("disabled", true);
    for (let i = 0; i < 7; i++) await userEvent.click(screen.getByRole("button", { name: "Add frame" }));
    expect(screen.getByRole("button", { name: "Add frame" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Copy frame" })).toHaveProperty("disabled", true);
    expect(screen.getByText("8 frames is the most.")).toBeTruthy();
  });

  it("sets the speed, plays and stops, and turns the onion skin on", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Run");
    const speed = screen.getByRole("group", { name: "Speed" });
    await userEvent.click(within(speed).getByRole("button", { name: "Fast" }));
    expect(within(speed).getByRole("button", { name: "Fast" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    const onion = screen.getByRole("button", { name: "Onion skin" });
    expect(onion.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(onion);
    expect(onion.getAttribute("aria-pressed")).toBe("true");
    expect(saved().hero.look.animations.run.speed).toBe("fast");
  });

  it("copies a frame from another animation on the same canvas", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Hurt");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Copy from" }), "Stand frame 1");
    expect(saved().hero.look.animations.hurt.frames[0]).toEqual(snowHero.animations.stand.frames[0]);
  });
});
```

The hero screen's existing tests reach pictures through the old picture buttons. Update them with these rules (don't change what they check):
- `choose("Stand")`-style picture choices become `chooseAnimation("Stand")` (and for "Run 1" / "Run 2", `chooseAnimation("Run")` then `Frame 1` / `Frame 2`).
- Canvas names "Stand, 16 by 24 pixels" become "Stand frame 1, 16 by 24 pixels"; "Slide, 24 by 16 pixels" becomes "Slide frame 1, 24 by 16 pixels"; and so on.
- The two "keeps Run and shoot in step with Run" tests are deleted: Run and shoot is now drawn on its own.
- "Copy from" options are now "Stand frame 1", "Run frame 2" and so on.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/animationEditor.test.tsx`
Expected: FAIL (no "Animations" group).

- [ ] **Step 3: Pass the onion skin through**

`PixelCanvas`: `under?: string[]` prop, passed to `drawPixels` (and in the effect's dependencies); `body` becomes `Box | null`. `PictureEditor`: the same `under?` prop, passed to `PixelCanvas`; `body: Box | null`.

- [ ] **Step 4: The animation editor**

`src/editor/components/AnimationEditor.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LookTarget } from "@/commands/look";
import type { Command } from "@/commands/types";
import { ANIMATION_NAMES, ANIMATION_SPEEDS, KINDS, MAX_FRAMES, type AnimationSpeed, type Look, type LookKind } from "@/model/look";
import { baseFor, frameSteps } from "@/runtime/render/animate";
import { lookSprites, paletteOf } from "@/runtime/render/lookArt";
import styles from "../editor.module.css";
import type { RawImage } from "../hero/importPicture";
import { Colours } from "./Colours";
import { SpriteSwatch } from "./Palette";
import { PictureEditor, type DrawTool } from "./PictureEditor";

const SPEED_NAMES: Record<AnimationSpeed, string> = { slow: "Slow", normal: "Normal", fast: "Fast" };
const frameCount = (n: number) => (n === 1 ? "1 frame" : `${n} frames`);

type Props = {
  kind: LookKind;
  look: Look;
  target: LookTarget;
  testId: string; // the drawing canvas's test id: "hero-canvas", "enemy-canvas", "boss-canvas"
  notes?: Record<string, string>; // shown after an animation's name, such as "(needs slide)"
  locked: boolean;
  onCommand(command: Command): void;
  onBegin(label: string): void;
  onCommit(): void;
  readPicture(file: File): Promise<RawImage>;
};

// Loops an animation's frames in a small box at its speed, while playing.
function Player({ frames, palette, size, speed, base }: { frames: string[][]; palette: Record<string, string>; size: { w: number; h: number }; speed: AnimationSpeed; base: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let step = 0;
    const steps = frameSteps(base, speed);
    const draw = () => {
      const ctx = ref.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, size.w, size.h);
      const rows = frames[Math.floor(step / steps) % frames.length];
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          const colour = palette[ch];
          if (!colour) return;
          ctx.fillStyle = colour;
          ctx.fillRect(x, y, 1, 1);
        }),
      );
    };
    draw();
    const timer = setInterval(() => {
      step++;
      draw();
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [frames, palette, size, speed, base]);
  return <canvas ref={ref} width={size.w} height={size.h} className={styles.playBox} aria-hidden="true" />;
}

// A character's animations: choose one, work on its frames, play it, and draw each frame.
export function AnimationEditor({ kind, look, target, testId, notes = {}, locked, onCommand, onBegin, onCommit, readPicture }: Props) {
  const rule = KINDS[kind];
  const names = Object.keys(rule.animations);
  const [animation, setAnimation] = useState(names[0]);
  const [chosen, setChosen] = useState(0);
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [slot, setSlot] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [onion, setOnion] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);

  const sprites = useMemo(() => lookSprites(look), [look]);
  const palette = useMemo(() => paletteOf(look.colours), [look.colours]);
  const anim = look.animations[animation];
  const frame = Math.min(chosen, anim.frames.length - 1); // undo can take the chosen frame away
  const group = rule.animations[animation];
  const canvas = look.canvases[group];
  const body = group === "main" ? look.body : group === "slide" ? (look.slideBody ?? null) : null;
  const colour = Math.min(slot, look.colours.length);
  const send = (name: string, args: Record<string, unknown>) => onCommand({ name, args: { target, ...args } });
  const label = ANIMATION_NAMES[animation];
  const under = onion && anim.frames.length > 1 ? anim.frames[(frame - 1 + anim.frames.length) % anim.frames.length] : undefined;

  const partners = names
    .filter((other) => rule.animations[other] === group)
    .flatMap((other) =>
      look.animations[other].frames.flatMap((rows, i) =>
        other === animation && i === frame ? [] : [{ id: `${other}:${i}`, name: `${ANIMATION_NAMES[other]} frame ${i + 1}`, rows }],
      ),
    );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= anim.frames.length || from === to) return;
    send("moveFrame", { animation, from, to });
    setChosen(to);
  };

  return (
    <div className={styles.animationEditor}>
      <ul className={styles.poses} role="group" aria-label="Animations">
        {names.map((name) => {
          const count = look.animations[name].frames.length;
          return (
            <li key={name}>
              <button
                type="button"
                className={styles.swatch}
                aria-label={`${ANIMATION_NAMES[name]}, ${frameCount(count)}`}
                aria-pressed={name === animation}
                onClick={() => {
                  setAnimation(name);
                  setChosen(0);
                  setPlaying(false);
                }}
              >
                <SpriteSwatch sprite={sprites[name].frames[0]} palette={palette} />
                {ANIMATION_NAMES[name]}
                {notes[name] && <span className={styles.needs}> {notes[name]}</span>}
                <span className={styles.note}> {frameCount(count)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.frameStrip}>
        <div role="group" aria-label="Frames" className={styles.frames}>
          {anim.frames.map((_, i) => (
            <button
              key={i}
              type="button"
              draggable
              className={styles.frameButton}
              aria-label={`Frame ${i + 1}`}
              aria-pressed={i === frame}
              onClick={() => setChosen(i)}
              onDragStart={() => setDragged(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragged !== null) move(dragged, i);
                setDragged(null);
              }}
            >
              <SpriteSwatch sprite={sprites[animation].frames[i]} palette={palette} />
              {i + 1}
            </button>
          ))}
        </div>
        <div className={styles.drawTools} role="group" aria-label="Frame tools">
          <button type="button" className={styles.swatch} disabled={anim.frames.length >= MAX_FRAMES} onClick={() => { send("addFrame", { animation, after: frame }); setChosen(frame + 1); }}>
            Add frame
          </button>
          <button type="button" className={styles.swatch} disabled={anim.frames.length >= MAX_FRAMES} onClick={() => { send("addFrame", { animation, after: frame, copy: true }); setChosen(frame + 1); }}>
            Copy frame
          </button>
          <button type="button" className={styles.swatch} disabled={anim.frames.length <= 1} onClick={() => { send("removeFrame", { animation, frame }); setChosen(Math.max(0, frame - 1)); }}>
            Delete frame
          </button>
          <button type="button" className={styles.swatch} disabled={frame === 0} onClick={() => move(frame, frame - 1)}>
            Move left
          </button>
          <button type="button" className={styles.swatch} disabled={frame === anim.frames.length - 1} onClick={() => move(frame, frame + 1)}>
            Move right
          </button>
        </div>
        {anim.frames.length >= MAX_FRAMES && <p className={styles.note}>{MAX_FRAMES} frames is the most.</p>}
      </div>

      <div className={styles.playRow}>
        <button type="button" className={styles.swatch} onClick={() => setPlaying((p) => !p)}>
          {playing ? "Stop" : "Play"}
        </button>
        {playing && <Player frames={anim.frames} palette={palette} size={canvas} speed={anim.speed} base={baseFor(animation)} />}
        <div role="group" aria-label="Speed" className={styles.steps}>
          {ANIMATION_SPEEDS.map((speed) => (
            <button key={speed} type="button" className={styles.step} aria-pressed={anim.speed === speed} onClick={() => send("setAnimationSpeed", { animation, speed })}>
              {SPEED_NAMES[speed]}
            </button>
          ))}
        </div>
        <button type="button" className={styles.swatch} aria-pressed={onion} onClick={() => setOnion((o) => !o)}>
          Onion skin
        </button>
      </div>

      <PictureEditor
        key={`${animation}:${frame}`}
        name={`${label} frame ${frame + 1}`}
        rows={anim.frames[frame]}
        under={under}
        palette={palette}
        size={canvas}
        body={body}
        feet={group === "main" || group === "slide"}
        testId={testId}
        colours={look.colours}
        tool={tool}
        onTool={setTool}
        slot={colour}
        onSlot={setSlot}
        partners={partners}
        importTarget={{ ...canvas, stand: group === "main" || group === "slide" }}
        readPicture={readPicture}
        locked={locked}
        onRows={(rows) => send("setFrame", { animation, frame, rows })}
        onImport={(result) => {
          if (result.colours.length !== look.colours.length) send("setLookColours", { colours: result.colours });
          send("setFrame", { animation, frame, rows: result.rows });
        }}
        onBegin={onBegin}
        onCommit={onCommit}
      />
      <Colours colours={look.colours} slot={colour} onSlot={setSlot} onColours={(colours) => send("setLookColours", { colours })} />
    </div>
  );
}
```

Notes for this step:
- Add `export const paletteOf = (colours: number[]): Record<string, string> => Object.fromEntries(colours.map((colour, i) => [slotChar(i + 1), PALETTE_8BIT[colour]]));` to `src/runtime/render/lookArt.ts`, and use it in `lookArt` and `ownSkins` too (which also settles plan 2's nit about the roundabout palette).
- Prettier will lay out the long button lines; run the formatter or write them out over several lines.
- The `Colours` component moves into the editor (it was beside the drawing on each tab); remove it from the tabs.

CSS in `editor.module.css`: `.animationEditor` (a grid: the list on the left, the strip, play row and drawing in the middle, the colours on the right; one column under 760px, like `.heroScreen`), `.frameStrip`, `.frames` (a wrapping row), `.frameButton` (like `.swatch`, small, with a visible pressed state), `.playRow` (a wrapping row with a gap), `.playBox` (`width: 64px; height: auto; image-rendering: pixelated;` with a border).

- [ ] **Step 5: The Hero tab uses it**

In `HeroScreen.tsx`: delete the picture list, `PictureEditor`, the `save` mirroring, `Colours`, `sprites`, `picture`, `tool`, `slot` and their imports; render

```tsx
      <AnimationEditor
        kind="hero"
        look={look}
        target="hero"
        testId="hero-canvas"
        notes={{
          ...(abilities.slide ? {} : { slide: "(needs slide)" }),
          ...(abilities.chargeShot ? {} : { chargedShot: "(needs charge shot)" }),
        }}
        locked={locked}
        onCommand={onCommand}
        onBegin={onBegin}
        onCommit={onCommit}
        readPicture={readPicture}
      />
```

followed by the preview (`GamePreview`) and `HeroAbilities` as now.

Update the hero screen's existing tests by the rules in Step 1.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A src tests
git commit -m "feat: add the animation editor to the Hero tab: frames, play, speed and onion skin"
```

---

### Task 3: The Enemies and Boss tabs

**Files:**
- Modify: `src/editor/components/EnemiesScreen.tsx`, `src/editor/components/BossScreen.tsx`, `src/editor/hero/pixels.ts`
- Test: `tests/editor/enemiesScreen.test.tsx`, `tests/editor/bossScreen.test.tsx`

**Interfaces:**
- Consumes: Task 2's `AnimationEditor`

- [ ] **Step 1: Write the failing tests**

Add to `tests/editor/enemiesScreen.test.tsx`:

```tsx
  it("adds walk frames to an enemy and speeds them up", async () => {
    const { open, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    const frames = screen.getByRole("group", { name: "Frames" });
    await userEvent.click(within(frames).getByRole("button", { name: "Frame 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy frame" }));
    await userEvent.click(screen.getByRole("button", { name: "Add frame" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Speed" })).getByRole("button", { name: "Fast" }));
    const walk = saved().enemies[0].look.animations.walk;
    expect(walk.frames).toHaveLength(4);
    expect(walk.speed).toBe("fast");
  });

  it("starts on the first animation again when the behaviour changes", async () => {
    const { open, group } = setup();
    await open();
    await make("Frost Fang", "Walker");
    await userEvent.click(screen.getByRole("button", { name: "Add frame" }));
    await userEvent.click(screen.getByRole("button", { name: "Add frame" }));
    await userEvent.click(within(group("Behaviour")).getByRole("button", { name: "Hopper" }));
    expect(screen.getByRole("img", { name: "On the ground frame 1, 16 by 16 pixels" })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Animations" })).getByRole("button", { name: "In the air, 3 frames" })).toBeTruthy();
  });
```

Add to `tests/editor/bossScreen.test.tsx`:

```tsx
  it("draws the attack animation's frames", async () => {
    const { open, make, press, saved } = setup();
    await open();
    await make();
    await userEvent.click(within(screen.getByRole("group", { name: "Animations" })).getByRole("button", { name: /^Attack,/ }));
    await userEvent.click(screen.getByRole("button", { name: "Copy frame" }));
    press(0, 0);
    const attack = saved().boss!.look.animations.attack.frames;
    expect(attack).toHaveLength(2);
    expect(attack[1][0][0]).toBe("1");
  });
```

Update the two files' existing tests:
- the Enemies tab's "Frame 1" / "Frame 2" buttons are now the frame strip's (same names, in the "Frames" group), so `screen.getByRole("button", { name: "Frame 2" })` still finds them; canvas names change from "Frame 1, 16 by 16 pixels" to "Walk frame 1, 16 by 16 pixels";
- the Boss tab's Stand / Jump / Attack buttons are now animations ("Stand, 1 frame"…, in the "Animations" group), and canvas names change from "Stand, 24 by 28 pixels" to "Stand frame 1, 24 by 28 pixels" (and "Attack frame 1, 24 by 28 pixels").

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/editor/enemiesScreen.test.tsx tests/editor/bossScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: The Enemies tab**

In `EnemiesScreen.tsx`, replace the frame buttons, `PictureEditor` and `Colours` with

```tsx
            <AnimationEditor
              key={`${enemy.id}:${enemy.behaviour}`}
              kind={enemy.behaviour}
              look={enemy.look}
              target={{ enemy: enemy.id }}
              testId="enemy-canvas"
              locked={locked}
              onCommand={onCommand}
              onBegin={onBegin}
              onCommit={onCommit}
              readPicture={readPicture}
            />
```

The key starts the editor afresh for another enemy or a new behaviour. Remove the `frame`, `tool`, `slot` state and the now-unused imports. The list's thumbnails keep using `lookArt(designLook(...))`.

- [ ] **Step 4: The Boss tab**

In `BossScreen.tsx`, the same with `kind="boss"`, `look={boss.look}`, `target="boss"`, `testId="boss-canvas"` and no key; remove `FRAME_NAMES`, `WHOLE_FRAME`, the frame buttons, `PictureEditor`, `Colours`, and the frame, tool and slot state.

- [ ] **Step 5: Tidy up**

`src/editor/hero/pixels.ts`: delete `bodyBox`, `enemyBody` and `drawPicture` if nothing uses them now (`grep -rn "bodyBox\|enemyBody\|drawPicture" src tests`), with their tests.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A src tests
git commit -m "feat: use the animation editor on the Enemies and Boss tabs"
```

---

### Task 4: In a browser

**Files:**
- Modify: `e2e/enemies.spec.ts`, `e2e/hero.spec.ts`, `e2e/boss.spec.ts` (where they name pictures), `docs/superpowers/STATUS.md`

- [ ] **Step 1: Add frames to an enemy in a browser**

In `e2e/enemies.spec.ts`, after the enemy is made and tuned, add frames, check the save, and take a screenshot:

```ts
  await page.getByRole("group", { name: "Frames" }).getByRole("button", { name: "Frame 2" }).click();
  await page.getByRole("button", { name: "Copy frame" }).click();
  await page.getByRole("button", { name: "Copy frame" }).click();
  await page.getByRole("button", { name: "Play" }).click();
  await expect.poll(async () => (await saved(page)).enemies[0].look.animations.walk.frames.length).toBe(4);
  await page.screenshot({ path: "test-results/enemy-frames.png", fullPage: true });
  await page.getByRole("button", { name: "Stop" }).click();
```

(extending the file's `Saved` type with `look: { animations: { walk: { frames: string[][] } } }` on each enemy). Update the hero and boss specs where they name pictures or canvases, by the rules in Task 2, Step 1.

- [ ] **Step 2: Run the browser tests and look**

Run: `npm run e2e`
Expected: all pass. Open `test-results/enemy-frames.png`: the animation list, the frame strip with four frames, the play box and the drawing area sit together without overlapping.

- [ ] **Step 3: Update the status and commit**

In `docs/superpowers/STATUS.md`: mark this plan implemented, reviewed and merged; say the Hero, Enemies and Boss tabs have the animation editor (frames, play, speed, onion skin) and sixteen colours; remove plan 3's deferred item about the outline; update the test counts; add this plan's deferred review findings.

```bash
git add -A e2e docs/superpowers/STATUS.md
git commit -m "test: add frames to an enemy and play them in a browser"
```

---

## Self-review

- **Spec coverage:** section 6's animation list (name, thumbnail, frame count), frame strip (add, copy, delete off at one, move left and right, drag to reorder), play with slow / normal / fast, onion skin, sixteen colours in one row, live previews using the animations (they already do, plan 2) and every change one undo step → Tasks 1 to 3; section 8's ninth-frame and last-frame rows → Task 2; section 9's screen tests for the animation list, strip, play and onion skin on each tab → Tasks 2 and 3, and the browser test's "add walk frames to an enemy … and play" → Task 4 (resizing is plan 5). Size, hitbox handles and the shot marker are plan 5.
- **Placeholder scan:** Task 2's Step 1 gives rules for updating the old tests rather than every changed line; each rule is mechanical and named. Task 1's import test notes how to adapt to the file's image helpers.
- **Types:** `AnimationEditor`'s props, `paletteOf`, `baseFor`, `ONION_ALPHA`, `drawPixels`'s `under` and nullable `body` are defined once and used with the same names.
