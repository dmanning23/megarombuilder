# MegaRomBuilder: tidying the character editor

Date: 2026-10-08
Status: design approved in conversation, awaiting written-spec review

## 1. Purpose

Milestones 2 to 4 grew the Characters screen piece by piece: the hero's
abilities, enemy tuning, boss attacks, then animations, frames, size, hitbox
and shot point. Everything works, but the controls sit in one long column with
no clear grouping, so it is hard to see what belongs to what. This change
regroups the screen; it adds no features and changes no behaviour.

### Success criteria

1. On each tab a kid can tell at a glance which controls are about the
   character (its settings), which are about the chosen animation, which are
   about the chosen frame, and which draw.
2. The drawing canvas sits in the middle of the screen with its tools beside
   it, like a drawing program.
3. Every button looks like what it is: a choice that stays chosen, or an
   action.
4. Nothing a kid can do today is lost or renamed, and the existing tests still
   find every control by its name.

### In scope

- The Characters screen's frame: full width, without the zone panel and the
  assistant
- An "About" bar per tab holding the character's settings
- The look editor's paint-app layout: animations, frames bar, tools column,
  canvas, picture bar, and labelled panels on the right
- One style for choice buttons, one for action buttons, styled inputs and
  panel headings, across the Characters screen
- A canvas that grows with the space available

### Out of scope

- New features or behaviour; the Level screen's layout; the assistant

## 2. The screen frame

- On the Characters screen the zone panel (left) and the assistant chat
  (right) are not shown; the character editor uses the full width under the
  toolbar. **Level** brings both back, with the chat as it was (its messages,
  its draft, and any turn in progress keep going while hidden).
- The **Hero / Enemies / Boss** tabs stay at the top.
- Under the tabs, an **About** bar holds the character's settings, on one row
  that wraps:
  - **Hero:** its abilities (speed, jump, health, shots, slide, charge shot),
    the note about zones it can't finish, and "Start again from the snow
    hero".
  - **Enemies:** the enemy list and **New enemy** sit at the bar's left; the
    bar holds the chosen enemy's name, behaviour and tuning, and **Delete
    enemy** at its end.
  - **Boss:** name, fight length, the three attack drop-downs with their tips,
    **Use in the boss room**, and **Delete boss**; with no boss, **Make your
    own boss** in its place.
- The live game preview moves into the look editor's right column (section 3).

## 3. The look editor

Below the About bar, three columns:

```
+-----------+------------------------------------+---------------+
| ANIMATIONS| FRAMES  [1][2][3]  Add Copy Delete |  ANIMATION    |
|  Stand  1 |         ◀ Move  Move ▶             |  Play  [box]  |
| >Run    2 | +------+ +---------------------+   |  Slow Nml Fast|
|  Jump   1 | |Pencil| |                     |   |  Onion skin   |
|  ...      | |Eraser| |       CANVAS        |   |---------------|
|           | |Fill  | |                     |   |  SIZE         |
|           | |Pick  | |                     |   |  16 × 24      |
|           | |      | |                     |   |  - + - +      |
|           | |Hitbox| |                     |   |---------------|
|           | |Shot  | +---------------------+   |  COLOURS      |
|           | +------+ Copy from Flip Clear      |---------------|
|           |          Import  (Fit to drawing)  |  PREVIEW      |
+-----------+------------------------------------+---------------+
```

- **Left, Animations:** the animation list as now (thumbnail, name, frame
  count, "(needs slide)" notes).
- **Middle:**
  - a **frames bar** above the canvas: the frame thumbnails in a row, then
    Add, Copy, Delete, ◀ Move and Move ▶ (each with its current accessible
    name: "Add frame", "Copy frame", "Delete frame", "Move left", "Move
    right"), and the "8 frames is the most." note when it applies;
  - a **tools column** down the canvas's left: Pencil, Eraser, Fill, Pick
    colour, a gap, then Hitbox and Shot point;
  - the **canvas**, which grows to fill the middle column with a whole-number
    zoom (so pixels stay square and crisp), from today's 12 screen pixels per
    picture pixel up to 24;
  - a **picture bar** under the canvas: Copy from, Flip, Clear, Import
    picture, and **Fit to drawing** while the Hitbox tool is chosen (so the
    canvas no longer moves when it appears).
- **Right, labelled panels**, each with a small heading:
  - **Animation:** Play animation / Stop animation and its play box, Slow /
    Normal / Fast (the "Animation speed" group), Onion skin;
  - **Size:** the size and Narrower / Wider / Shorter / Taller (hidden for
    the hero's shots, as now);
  - **Colours:** as now;
  - **Preview:** the live game preview.

## 4. One look

- **Choice buttons** (a tool, a speed, a tuning step, a behaviour, an
  animation, a frame) are pills, filled when chosen.
- **Action buttons** (Add, Copy, Delete, Flip, Clear, Import, Fit to drawing,
  Play, New enemy, Make your own boss, Delete enemy or boss) are solid
  buttons; destructive ones (Delete…, Clear) are marked in a warning colour.
- Unavailable buttons are dimmed the same way everywhere.
- Text inputs (the name boxes) and drop-downs use the same styled field as the
  Level screen's zone settings.
- Panel headings share one style.

## 5. Small screens

Under about 900 pixels wide the columns stack: the animations become a
horizontally scrolling row, then the canvas area, then the panels. The About
bar wraps as it already does.

## 6. Testing

- Every control keeps its accessible name and role, so existing tests keep
  working; only tests that check layout or the hidden panels change.
- New tests: the zone panel and assistant are not shown on the Characters
  screen and come back with Level, the chat unchanged; each tab shows its
  About bar and the three columns; Fit to drawing appearing doesn't move the
  canvas; the canvas zoom grows with the space (a pure function choosing the
  zoom from the space and the picture size, tested on its own).
- A browser test takes screenshots of the three tabs at 1280 and 1600 pixels
  wide and at a phone width; they are looked at before the work is called
  done.

## 7. Build order

1. The screen frame (full width, About bars, the preview into the right
   column) and the shared button, field and heading styles.
2. The look editor's paint-app layout: tools column, frames bar, picture bar,
   right-hand panels, and the growing canvas.

## 8. Amendment, 2026-10-09: the workbench design

After plan 1, user feedback: the About bar is obtrusive for settings that are
rarely changed; the colour picker is enormous; the 8-bit palette is unsorted.
This replaces sections 2 (About bars) and 3–5 (the look editor's layout):

- **Settings in a drawer.** The About bars go. A **How it plays** button in the
  tab row (with `aria-expanded`) opens a side drawer over the right column,
  closed with **Done**: the hero's abilities, its can't-finish note and Start
  from the snow hero; an enemy's name, behaviour, tuning and Delete enemy; the
  boss's name, fight, attacks, Use in the boss room and Delete boss. On the
  Enemies tab the enemy chips and **New enemy** stay in the tab row; with no
  boss, **Make your own boss** shows in place of the look editor.
- **The workbench.** Three columns: the animation list; a dark "light table"
  (the app's navy) holding a frames-and-playback strip above, the drawing tools
  down the left of the canvas, the canvas (growing, whole-number zoom 12–24),
  and a picture bar beneath (Flip, Clear, Copy from, Import, Fit to drawing,
  Size); and a light right column with Colours and Preview.
- **A compact, sorted palette.** Up to 16 colour slots in one small row, and the
  palette as a tight grid of small squares (about 18 pixels): greys in one
  column from black to white, then one column per hue (red through purple),
  each from dark to light.
- Every control keeps its accessible name; the existing tests change only to
  open the drawer first.
