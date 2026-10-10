# Pose sizes, plan 2 of 2: the editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The editor gets the per-pose behaviour the spec asks for:
- a Size step the hitbox can't fit into is dimmed, with a note;
- the hitbox can't grow past the smallest pose, and dragging its middle moves it in one pose;
- the Shot point tool shows only on poses that fire;
- the zoom stays the same between poses;
- Copy from works across sizes, asking before it cuts;
- a browser test covers a big Jump and shoot.

**Architecture:** All changes sit in the editor, with one helper each in `src/model/look.ts` (`firesFrom`, `cutsRows`) and `src/editor/hero/hitbox.ts` (`pickGrip`, `moveBox`). `AnimationEditor` works out the pose-aware limits and passes them down. `PictureEditor` gains two optional props: `zoomFor`, the picture its zoom must fit, and `confirm`. The commands and the game are unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Vitest 4 (jsdom), Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-pose-sizes-design.md` (section 3, and section 7 item 2)

## Global Constraints

- The note's words are exactly "The hitbox needs this much room."
- The Copy from question's words are exactly "This cuts off part of the picture you're copying. You can undo it." A Size step keeps its own question ("This cuts off part of your drawing. You can undo it.").
- Each drag or copy is one undo step, as now.
- Zoom stays a whole number from 12 to 24.
- Never commit `test-art/`: stage with `git add -A src tests e2e docs`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every task ends with the whole unit suite green (`npx vitest run`).

## Review Focus

1. **Growing the hitbox by an edge past the smallest pose** stops at that pose's size and shows no error (Task 2 test).
2. **Moving the box in one pose** leaves every other pose's box, and the hitbox's size, unchanged, as one undo step (Task 2 test).
3. **Copying from a pose whose drawing would be trimmed:** the kid is asked first, and saying no changes nothing (Task 4 test).
4. **Switching poses of different sizes** keeps the pixels the same size on screen (Task 4 unit test, Task 5 browser test).
5. **A Size step limited by the size range** (not the hitbox) is dimmed with no note, so the note shows only when it's true (Task 1 test).

## Rulings in this plan

- **Shot point on poses that never fire:** the spec says "either not offered there or with a note". It is not offered. This matches how Slide already works.
  - The poses that fire are:
    - the hero's Stand and shoot, Run and shoot, Jump and shoot, Climb and Hurt;
    - Turret's Idle;
    - Shielded's Open;
    - the boss's Attack.
  - These are the poses `src/runtime/sim/pose.ts` chooses when a shot is fired. A test ties the two together.
  - Stored shot points on the other poses stay valid and harmless.
- **Copy from offers poses that share a hitbox:** the standing poses offer each other, and Slide and the shots offer only their own other frames. That is the same set as before, now across sizes.
- **Thumbnails already scale:** `.swatchArt` is drawn at 32×32 with `object-fit: contain`. Task 5's browser test checks it, and no code changes.
- **Moving the box:** pressing strictly inside the box moves it; pressing on its outline grabs the nearest edge, as before. On Slide, an edge press still grabs only the top edge (its feet stay on the floor), and a press inside moves it.

---

### Task 1: The dimmed Size step and its note

**Files:**
- Modify: `src/editor/components/AnimationEditor.tsx` (the Size group)
- Test: `tests/editor/sizeAndHitbox.test.tsx`

**Interfaces:**
- Consumes: `look.body`, `look.slideBody` and `KINDS[kind].animations[a].body` (plan 1).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

In `tests/editor/sizeAndHitbox.test.tsx`, inside `describe("the Size control")`:

```ts
  it("dims a step the hitbox can't fit into, saying why, but not a step at the size limit", async () => {
    const { open } = setupHero();
    await open();
    const note = () => within(size()).queryByText("The hitbox needs this much room.");
    expect(note()).toBeNull();
    await userEvent.click(sizeButton("Narrower")); // 16 → 14: the hitbox is 14 wide
    expect(sizeButton("Narrower")).toHaveProperty("disabled", true);
    expect(note()).toBeTruthy();
    expect(sizeButton("Shorter")).toHaveProperty("disabled", false); // 24 → 22 still fits a 22-tall hitbox
    await chooseAnimation("Slide");
    for (let i = 0; i < 4; i++) await userEvent.click(sizeButton("Wider")); // 24 → 32, the most
    expect(sizeButton("Wider")).toHaveProperty("disabled", true);
    expect(note()).toBeNull(); // Narrower still fits the 14-wide sliding hitbox
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/editor/sizeAndHitbox.test.tsx -t "dims a step"`
Expected: FAIL. Narrower is still enabled at 14 wide (the command would refuse the step with an alert), and there is no note.

- [ ] **Step 3: Dim the step and add the note**

In `AnimationEditor`, after `const fixed = isFixed(poseRule);`:

```ts
  // A Size step the hitbox can't fit into is dimmed, with a note saying why.
  const bodySize =
    poseRule.body === "main" ? look.body : poseRule.body === "slide" ? look.slideBody : undefined;
  const roomFor = (w: number, h: number) => !bodySize || (w >= bodySize.w && h >= bodySize.h);
  const narrowerFits = size.w - 2 >= poseRule.min.w;
  const shorterFits = size.h - 2 >= poseRule.min.h;
  const hitboxStops =
    (narrowerFits && !roomFor(size.w - 2, size.h)) || (shorterFits && !roomFor(size.w, size.h - 2));
```

- Narrower: `disabled={!narrowerFits || !roomFor(size.w - 2, size.h)}`.
- Shorter: `disabled={!shorterFits || !roomFor(size.w, size.h - 2)}`.
- At the end of the Size group's `<div role="group" aria-label="Size">`, add:

```tsx
                  {hitboxStops && <p className={styles.note}>The hitbox needs this much room.</p>}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: PASS (the whole suite).

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: dim a Size step the hitbox can't fit into, and say why

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The hitbox: limited by the smallest pose, and moved by its middle

**Files:**
- Modify: `src/editor/hero/hitbox.ts`, `src/editor/components/AnimationEditor.tsx` (the hitbox tool)
- Test: `tests/editor/hitbox.test.ts`, `tests/editor/sizeAndHitbox.test.tsx`

**Interfaces:**
- Consumes: `moveEdge`, `pickEdge` and `HitboxLimits` (existing); the `setBody` command (plan 1: position in the named pose, size everywhere).
- Produces:
  - `type Grip = Edge | "move"`;
  - `pickGrip(body: LookBox, p: Pixel): Grip`;
  - `moveBox(body: LookBox, from: Pixel, to: Pixel, canvas: { w: number; h: number }): LookBox`.

- [ ] **Step 1: Write the failing tests**

In `tests/editor/hitbox.test.ts`, import `moveBox` and `pickGrip`, and add:

```ts
describe("pickGrip", () => {
  it("moves the box from inside it, and grabs an edge on its outline", () => {
    expect(pickGrip(body, { x: 6, y: 9 })).toBe("move");
    expect(pickGrip(body, { x: 2, y: 9 })).toBe("left");
    expect(pickGrip(body, { x: 11, y: 9 })).toBe("right");
    expect(pickGrip(body, { x: 6, y: 15 })).toBe("bottom");
  });
});

describe("moveBox", () => {
  it("moves the whole box by the drag, keeping its size and keeping it on the canvas", () => {
    expect(moveBox(body, { x: 6, y: 9 }, { x: 8, y: 8 }, { w: 16, h: 20 })).toEqual({ x: 4, y: 3, w: 10, h: 12 });
    expect(moveBox(body, { x: 6, y: 9 }, { x: -50, y: 99 }, { w: 16, h: 20 })).toEqual({ x: 0, y: 8, w: 10, h: 12 });
  });
});
```

In `tests/editor/sizeAndHitbox.test.tsx`, inside `describe("the Hitbox tool")`:

```ts
  it("grows no bigger than the smallest pose, without an error", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await chooseAnimation("Run");
    await userEvent.click(sizeButton("Narrower")); // Run is now 14 wide
    await chooseAnimation("Stand");
    await choose("Hitbox");
    canvasPress("hero-canvas").drag([14, 12], [15, 12]); // the right edge out by 1: Run has no room
    expect(screen.queryByRole("alert")).toBeNull();
    expect(box(saved().hero.look)).toEqual({ x: 1, y: 2, w: 14, h: 22 });
  });

  it("moves the box in this pose only, by dragging its middle, as one undo step", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    canvasPress("hero-canvas").drag([8, 12], [9, 12]); // inside the box: one pixel right
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Redo" }));
    const look = saved().hero.look;
    expect(box(look)).toEqual({ x: 2, y: 2, w: 14, h: 22 });
    expect(box(look, "jump")).toEqual({ x: 1, y: 2, w: 14, h: 22 });
    expect(look.body).toEqual({ w: 14, h: 22 });
  });
```

`canvasPress(...).drag` is the file's existing helper. Check that it presses at the first point and releases at the last.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/editor/hitbox.test.ts tests/editor/sizeAndHitbox.test.tsx`
Expected: FAIL.
- `pickGrip` and `moveBox` don't exist.
- The edge drag past Run shows an alert ("The hero's Run is 14 by 24; its hitbox needs 15 by 22.").
- A press inside the box grabs an edge (the box resizes instead of moving).

- [ ] **Step 3: Write the code**

In `src/editor/hero/hitbox.ts`:

```ts
export type Grip = Edge | "move";

// A press strictly inside the box moves it; a press on its outline (or outside) grabs the nearest edge.
export function pickGrip(body: LookBox, p: Pixel): Grip {
  const inside = p.x > body.x && p.x < body.x + body.w - 1 && p.y > body.y && p.y < body.y + body.h - 1;
  return inside ? "move" : pickEdge(body, p);
}

// The box moved by a drag from one pixel to another, its size kept, staying on the canvas.
export function moveBox(body: LookBox, from: Pixel, to: Pixel, canvas: { w: number; h: number }): LookBox {
  return {
    ...body,
    x: clamp(body.x + to.x - from.x, 0, canvas.w - body.w),
    y: clamp(body.y + to.y - from.y, 0, canvas.h - body.h),
  };
}
```

In `AnimationEditor`:

1. `type Draft = { body?: LookBox; shotY?: number; grip?: Grip; from?: Pixel };` (`edge` goes). Import `moveBox`, `pickGrip` and `type Grip`; drop the unused `pickEdge` and `type Edge` imports.
2. Limit the box by the smallest pose that shares it:

```ts
  // The box can't grow past the smallest picture of the poses that share it.
  const sharing = names.filter((n) => which !== null && rule.animations[n].body === which).map((n) => look.animations[n].size);
  const smallest = {
    w: Math.min(...sharing.map((s) => s.w)),
    h: Math.min(...sharing.map((s) => s.h)),
  };
  const hitboxLimits: HitboxLimits = {
    canvas: size,
    maxW: Math.min(kind === "hero" && which === "main" ? HERO_BODY_MAX_W : Infinity, smallest.w),
    maxH: Math.min(kind === "hero" ? (which === "slide" ? SLIDE_BODY_MAX_H : HERO_BODY_MAX_H) : Infinity, smallest.h),
    minH: which === "main" ? shotHeight : null,
  };
```

3. The hitbox tool's `press` and `drag`:

```ts
            press: (p: Pixel) => {
              const picked = pickGrip(body, p);
              const grip = which === "slide" && picked !== "move" ? "top" : picked; // a slide's feet stay on the floor
              setDraft({ grip, from: p, body: grip === "move" ? body : moveEdge(body, grip, p, hitboxLimits) });
            },
            drag: (p: Pixel) => {
              const d = draftRef.current;
              if (!d?.grip || !d.from) return;
              setDraft({ ...d, body: d.grip === "move" ? moveBox(body, d.from, p, size) : moveEdge(body, d.grip, p, hitboxLimits) });
            },
```

`release` is unchanged: it sends one `setBody { animation, body: next }` when the box changed. A same-size box moves only this pose; the command leaves the other poses alone and keeps this pose's shot row.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: move a pose's hitbox by its middle, and grow it no bigger than the smallest pose

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The Shot point tool only on poses that fire

**Files:**
- Modify: `src/model/look.ts`, `src/editor/components/AnimationEditor.tsx`
- Test: `tests/runtime/pose.test.ts`, `tests/editor/sizeAndHitbox.test.tsx`, `tests/editor/enemiesScreen.test.tsx` (only if it fails)

**Interfaces:**
- Consumes: `hasShotPoint`, `KINDS` (plan 1); `heroPose` and `entityPose` (plan 1, `src/runtime/sim/pose.ts`).
- Produces: `firesFrom(kind: LookKind, animation: string): boolean` in `src/model/look.ts`.

- [ ] **Step 1: Write the failing tests**

In `tests/runtime/pose.test.ts` (it already has `player()` and `entity()`), import `firesFrom` and `KINDS` from `@/model/look`, and `heroPose`, `entityPose` from `@/runtime/sim/pose`:

```ts
describe("the poses that fire", () => {
  it("are exactly the poses the game fires from", () => {
    const fired = new Set<string>();
    for (const onGround of [true, false])
      for (const vx of [0, 1.5])
        for (const onLadder of [false, true])
          for (const hurt of [0, 10]) fired.add(heroPose(player({ onGround, vx, onLadder, hurt }), true));
    expect([...fired].sort()).toEqual(Object.keys(KINDS.hero.animations).filter((a) => firesFrom("hero", a)).sort());
    expect(firesFrom("hero", "stand")).toBe(false);
    expect(firesFrom("turret", entityPose(entity({ behaviour: "turret" })))).toBe(true);
    expect(firesFrom("shielded", entityPose(entity({ mode: "open" })))).toBe(true);
    expect(firesFrom("shielded", "closed")).toBe(false);
    expect(firesFrom("boss", entityPose(entity({ behaviour: "boss", mode: "aimed" })))).toBe(true);
    expect(firesFrom("walker", "walk")).toBe(false);
  });
});
```

In `tests/editor/sizeAndHitbox.test.tsx`, `describe("the Shot point tool")`:
- "moves where shots come out, inside the hitbox": add `await chooseAnimation("Stand and shoot");` after `open()`, and read `look.animations.standShoot.shotY`;
- in "isn't offered on the slide or the shots", add:

```ts
    await chooseAnimation("Stand");
    expect(screen.queryByRole("button", { name: "Shot point" })).toBeNull(); // the hero never fires standing still
    await chooseAnimation("Climb");
    expect(screen.getByRole("button", { name: "Shot point" })).toBeTruthy(); // it fires on ladders
```

- In "resizes and sets the shot point of the chosen pose only" (plan 1), nothing changes: Jump and shoot fires.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/runtime/pose.test.ts tests/editor/sizeAndHitbox.test.tsx`
Expected: FAIL. `firesFrom` doesn't exist, and the Shot point tool shows on Stand.

- [ ] **Step 3: Write the code**

In `src/model/look.ts`, after `hasShotPoint`:

```ts
// The poses a character fires from: the pose the game shows as a shot comes out
// (src/runtime/sim/pose.ts chooses it). Only these offer the Shot point tool.
const FIRING: Partial<Record<LookKind, string[]>> = {
  hero: ["standShoot", "runShoot", "jumpShoot", "climb", "hurt"],
  turret: ["idle"],
  shielded: ["open"],
  boss: ["attack"],
};
export const firesFrom = (kind: LookKind, animation: string): boolean => FIRING[kind]?.includes(animation) ?? false;
```

In `AnimationEditor`, `shotHere` becomes `firesFrom(kind, animation) && hasShotPoint(kind, animation) && body !== null`.

Run `npx vitest run`. If `tests/editor/enemiesScreen.test.tsx` "offers the Shot point tool only to enemies that shoot" fails, it is because a shooter opens on a pose that doesn't fire. Choose the firing pose in that test first: Shielded's Open, using its Animations buttons. Then record a ledger ruling.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: offer the Shot point tool only on the poses a character fires from

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The zoom of the largest pose, and Copy from across sizes

**Files:**
- Modify: `src/model/look.ts` (`cutsRows`), `src/editor/components/PictureEditor.tsx`, `src/editor/components/AnimationEditor.tsx`
- Test: `tests/editor/canvasZoom.test.tsx`, `tests/editor/animationEditor.test.tsx`, `tests/editor/heroScreen.test.tsx` (the "only offers to copy frames on the same canvas" test keeps its list; rename it to "…of poses that share a hitbox")

**Interfaces:**
- Consumes: `reframeRows` (existing, `src/model/look.ts`).
- Produces:
  - `cutsRows(rows: string[], w: number, h: number): boolean`;
  - `PictureEditor` props `zoomFor?: { w: number; h: number }` and `confirm?: (message: string) => boolean`;
  - the partner type gains `cuts?: boolean`.

- [ ] **Step 1: Write the failing tests**

In `tests/editor/canvasZoom.test.tsx`:

```ts
import { applyCommand } from "@/commands";
import { snowPack } from "@/content/snow/pack";
import { newProject } from "@/editor/newProject";
import { userEvent } from "@testing-library/user-event";

  it("fits the character's largest pose, so pixels stay the same size between poses", async () => {
    reported = { width: 500, height: 600 };
    const result = applyCommand(newProject("Big", () => "id-1"), { name: "resizePose", args: { target: "hero", animation: "jumpShoot", w: 32, h: 32 } }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    const { open } = setupHero(result.project);
    await open();
    expect((screen.getByTestId("hero-canvas") as HTMLCanvasElement).width).toBe(16 * 15); // 500 / 32 = 15, 600 / 32 = 18
    await userEvent.click(screen.getByRole("button", { name: /^Jump and shoot,/ }));
    expect((screen.getByTestId("hero-canvas") as HTMLCanvasElement).width).toBe(32 * 15);
  });
```

Use the import style the file and its neighbours already use for `userEvent` (`import userEvent from "@testing-library/user-event"`). If `newProject` needs a different id maker, copy the one `heroHelpers.tsx` uses.

In `tests/editor/animationEditor.test.tsx` (it has `chooseAnimation` and `setupHero`):

```ts
  it("copies a frame from a pose of another size, fitted to this one", async () => {
    const confirm = vi.fn(() => true);
    const { open, saved } = setupHero(undefined, confirm);
    await open();
    await chooseAnimation("Run");
    await userEvent.click(within(screen.getByRole("group", { name: "Size" })).getByRole("button", { name: "Wider" })); // 18 wide, padded
    await chooseAnimation("Stand");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Copy from" }), "Run frame 1");
    expect(confirm).not.toHaveBeenCalledWith("This cuts off part of the picture you're copying. You can undo it.");
    expect(saved().hero.look.animations.stand.frames[0]).toEqual(snowHero.animations.run.frames[0]); // only padding was trimmed
  });

  it("asks before a copy cuts off drawing, and does nothing if the kid says no", async () => {
    const confirm = vi.fn(() => true);
    const { open, saved } = setupHero(undefined, confirm);
    await open();
    await chooseAnimation("Hurt");
    await userEvent.click(within(screen.getByRole("group", { name: "Size" })).getByRole("button", { name: "Narrower" })); // 14 wide
    confirm.mockReturnValue(false);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Copy from" }), "Stand and shoot frame 1"); // its arm reaches the edge
    expect(confirm).toHaveBeenLastCalledWith("This cuts off part of the picture you're copying. You can undo it.");
    expect(saved().hero.look.animations.hurt.frames[0]).toEqual(reframeRows(snowHero.animations.hurt.frames[0], 14, 24));
  });

  it("copies, trimmed, when the kid says yes", async () => {
    const { open, saved } = setupHero(undefined, () => true);
    await open();
    await chooseAnimation("Hurt");
    await userEvent.click(within(screen.getByRole("group", { name: "Size" })).getByRole("button", { name: "Narrower" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Copy from" }), "Stand and shoot frame 1");
    expect(saved().hero.look.animations.hurt.frames[0]).toEqual(reframeRows(snowHero.animations.standShoot.frames[0], 14, 24));
  });
```

Import `reframeRows` from `@/model/look`, plus `vi` and `within` if the file lacks them. `saved()` closes the editor, so each test reads the saved game once, at its end.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/editor/canvasZoom.test.tsx tests/editor/animationEditor.test.tsx`
Expected: FAIL.
- The canvas is drawn at zoom 24 for Stand.
- "Run frame 1" isn't offered once Run is a different size.
- No question is asked before a cutting copy.

- [ ] **Step 3: Write the code**

In `src/model/look.ts`, replace the body of `cutsDrawing` with a call to a new exported helper:

```ts
// Whether padding or trimming rows to a size would cut off any drawn pixel.
export const cutsRows = (rows: string[], w: number, h: number): boolean => drawn([reframeRows(rows, w, h)]) < drawn([rows]);

// Whether resizing a pose would cut off any drawn pixel of its frames.
export function cutsDrawing(look: Look, animation: string, w: number, h: number): boolean {
  return look.animations[animation].frames.some((rows) => cutsRows(rows, w, h));
}
```

Move `drawn` above them if it is defined later in the file.

In `PictureEditor`:

1. Add the props to its `Props` type:
   - `zoomFor?: { w: number; h: number }; // the largest picture the zoom must fit (default: this one)`;
   - `confirm?: (message: string) => boolean;`.

   Change the partner type to `{ id: string; name: string; rows: string[]; cuts?: boolean }[]`, with the comment `// pictures to copy from, already fitted to this size; cuts: fitting them trims drawing`.
2. In the zoom effect:

```ts
  const fitW = (zoomFor ?? size).w;
  const fitH = (zoomFor ?? size).h;
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setZoom(chooseZoom({ w: entry.contentRect.width, h: entry.contentRect.height }, { w: fitW, h: fitH })); // same zoom: no re-render
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitW, fitH]);
```

   Update the comment above it to say it fits the largest picture it is given.
3. In the Copy from `onChange`:

```ts
                const from = partners.find((p) => p.id === e.target.value);
                if (!from) return;
                if (from.cuts && confirm && !confirm("This cuts off part of the picture you're copying. You can undo it.")) return;
                once("Copy picture", from.rows);
```

In `AnimationEditor`:

```ts
  // The zoom fits the character's largest picture, so pixels stay the same size between poses.
  const largest = Object.values(look.animations).reduce(
    (most, a) => ({ w: Math.max(most.w, a.size.w), h: Math.max(most.h, a.size.h) }),
    { w: 0, h: 0 },
  );
  // Copy from offers the frames of poses that share this pose's hitbox (the hero's shots and Slide
  // only their own), fitted to this pose's size the way Size fits them.
  const sharesWith = (other: string) =>
    poseRule.body === null ? other === animation : rule.animations[other].body === poseRule.body;
  const partners = names.filter(sharesWith).flatMap((other) =>
    look.animations[other].frames.flatMap((rows, i) =>
      other === animation && i === frame
        ? []
        : [{ id: `${other}:${i}`, name: `${ANIMATION_NAMES[other]} frame ${i + 1}`, rows: reframeRows(rows, size.w, size.h), cuts: cutsRows(rows, size.w, size.h) }],
    ),
  );
```

Pass `zoomFor={largest}` and `confirm={confirm}` to `PictureEditor`. Import `reframeRows` and `cutsRows`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: keep the zoom of the largest pose, and copy pictures across pose sizes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: A big Jump and shoot in the browser, and the status

**Files:**
- Modify: `e2e/characters.spec.ts`, `docs/superpowers/STATUS.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the browser test**

Append to `e2e/characters.spec.ts`:

```ts
test("a bigger Jump and shoot keeps the pixels the same size, and its thumbnail fits", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("Big jump");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Characters" }).click();
  const canvas = page.getByTestId("hero-canvas");
  const animations = page.getByRole("group", { name: "Animations" });
  const jump = animations.getByRole("button", { name: /^Jump and shoot,/ });
  await jump.click();
  const sizeGroup = page.getByRole("group", { name: "Size" });
  for (let i = 0; i < 4; i++) await sizeGroup.getByRole("button", { name: "Wider" }).click();
  for (let i = 0; i < 2; i++) await sizeGroup.getByRole("button", { name: "Taller" }).click();
  await expect(sizeGroup.getByText("24 × 28")).toBeVisible();
  const jumpWidth = (await canvas.boundingBox())!.width;
  expect((await jump.locator("canvas").boundingBox())!.width).toBeLessThanOrEqual(32); // the thumbnail is scaled to fit
  await page.screenshot({ path: "test-results/characters-big-jump.png" });
  await animations.getByRole("button", { name: /^Stand,/ }).click();
  const standWidth = (await canvas.boundingBox())!.width;
  expect(jumpWidth / 24).toBe(standWidth / 16); // the same pixel size in both poses
});
```


- [ ] **Step 2: Run everything**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build && npx playwright test`
Expected: all pass. Look at `test-results/characters-big-jump.png` and the other Characters screenshots before calling it done.

- [ ] **Step 3: Update STATUS.md and commit**

In `docs/superpowers/STATUS.md`:
- **Document table:** add `plans/2026-10-10-pose-sizes-plan-2-editor.md | Pose sizes plan 2 of 2, implemented` (the final review marks it reviewed and merged).
- **"Where things stand" paragraph:**
  - say the editor dims Size steps the hitbox can't fit, moves a pose's hitbox by its middle, offers the Shot point only on poses that fire, keeps one zoom across poses, and copies across sizes;
  - give the new test counts.

```bash
git add -A e2e docs
git commit -m "test: a bigger Jump and shoot in the browser; pose sizes done

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
