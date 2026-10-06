# MegaRomBuilder milestone 2: your own hero

Date: 2026-10-06
Status: design approved in conversation, awaiting written-spec review

## 1. Purpose

Milestone 1 made a game you can build, play and change by chatting. Milestone 2
makes the game feel like the kid's own from the first second: they design the
hero. They draw it (or import a picture), choose how it plays, give it new
moves, and the assistant builds levels that use what the hero can do.

### Success criteria

1. A kid draws their hero in the app, or imports a PNG and touches it up, and
   plays every level as that hero.
2. A kid chooses the hero's speed, jump, health and shots from named steps, and
   can turn on slide and charge shot.
3. A live preview shows the hero standing, running, jumping, shooting, and
   sliding and charging when it has those moves.
4. After any ability change, the editor shows which zones can no longer be
   finished, and one undo puts it back.
5. Asked for "a level where I have to slide under things", the assistant gives
   the hero slide if needed, builds crawl spaces, and every zone passes the
   checker.
6. Games saved before milestone 2 open and play exactly as before.

### In scope

- The hero in the game file: abilities and look, with an upgrade for old games
- An ability table: named steps turned into tested physics
- Two new moves, slide and charge shot, in the game, the checker and the assistant
- A crawl-space level piece
- A hero screen: pixel drawing, an 8-bit palette, colour slots, live preview,
  abilities
- PNG import into a pose
- The assistant knowing the hero and changing its abilities when asked

### Out of scope (later milestones)

- Changing the hero's body size, or adding poses and animations of one's own
- Double jump, wall jump and other moves
- Enemy and boss designers (they will reuse the drawing tools built here)
- The assistant drawing or recolouring the hero
- Tilesets, sound, accounts and publishing

### Constraints

- Milestone 1's constraints stand: original art only, the API key stays on the
  server, language and scope suit young users.
- The hero's body (its hit box) does not change size, except while sliding, so
  the checker and every level stay fair.
- Every ability combination is one the game, the checker and the tests know.

## 2. Architecture

No new units. The work lands in the existing ones:

| Unit | Changes |
|---|---|
| Project model (`src/model/`) | `hero` replaces `player`; format version 2 with an upgrade from 1; the 8-bit palette; hero look validation |
| Commands (`src/commands/`) | `setHeroAbilities`, `setHeroColours`, `setHeroPose`, `resetHeroLook` |
| Runtime (`src/runtime/`) | Physics from the ability table; slide; charge shot; drawing the hero from the game's own look |
| Checker (`src/checker/`) | Slide as a move; reasons for gaps too low to walk through |
| Content (`src/content/`) | The snow hero in the new look format; the crawl-space piece |
| Editor UI (`src/editor/`) | The hero screen, picture import |
| AI assistant (`src/ai/`) | The hero in its view of the level, `set_hero_abilities`, prompt updates |

The rules of milestone 1 still hold: model, commands, the simulation and the
checker have no React, no DOM and no randomness; the editor and the assistant
change the game only through commands.

## 3. The hero in the game file

```
Project
  formatVersion: 2
  hero: Hero              (replaces player)
  ...everything else as in milestone 1

Hero
  abilities: Abilities
  look: HeroLook

Abilities
  speed: "normal" | "fast" | "veryFast"
  jump: "low" | "normal" | "high" | "veryHigh"
  health: "fragile" | "normal" | "tough"
  shots: 1 | 2 | 3 | 5
  slide: boolean
  chargeShot: boolean

HeroLook
  colours: number[]                   1 to 8 entries, each an index into the 8-bit palette
  poses: Record<HeroPose, string[]>   rows of pixels
  shot: string[]
  chargedShot: string[]
```

### Abilities

| Ability | Steps (default first in brackets) | Meaning |
|---|---|---|
| Speed | [normal], fast, very fast | Running speed; normal is milestone 1's |
| Jump | low, [normal], high, very high | Highest ledge the hero can land on: about 2, 2½ (milestone 1), 3 and 4 tiles |
| Health | fragile, [normal], tough | 20, 28 (milestone 1) and 40; the health bar grows to match |
| Shots | 1, 2, [3], 5 | The hero's shots on screen at once |
| Slide | [off], on | Section 5 |
| Charge shot | [off], on | Section 5 |

- `heroPhysics(abilities)` turns abilities into the physics settings the game
  and the checker use. It is the only place the numbers live.
- Gravity, fall speed and ladder speed are fixed at milestone 1's values.
- "Low" jump is the lowest jump that still gets through every level piece at
  every setting (section 9), so no piece in the palette is impossible for any
  hero.
- The checker's per-zone cache keys on the hero's abilities, so changing them
  rechecks every zone.

### Look

- **The 8-bit palette** is a fixed list of about 50 NES-style colours, defined
  in the model and referred to by index.
- **Colours**: a hero uses 1 to 8 colour slots. A pixel is `.` (transparent) or
  a digit `1`–`8` naming a slot. Changing a slot's colour changes it in every
  pose.
- **Poses** (`HeroPose`): `stand`, `standShoot`, `run1`, `run2`, `jump`,
  `jumpShoot`, `climb`, `hurt` at 16×24 pixels, and `slide` at 24×16.
  `shot` is 6×4 and `chargedShot` 12×10. Exact sizes for the shots are settled
  in planning against the runtime's shot boxes.
- Pictures are drawn centred on the hero's body with their bottom on its feet,
  as in milestone 1. The body is 14×22, and 14×14 while sliding.
- Validation: every pose present and the right size, every pixel `.` or a
  digit naming an existing slot, every colour a palette index.

### New games and old games

- A new game's hero is the snow hero with default abilities. The snow pack's
  hero art moves into the `HeroLook` format; it is also what "Start from the
  snow hero" restores.
- Format version 1 games upgrade on load: `player` is dropped (every saved game
  has milestone 1's default numbers, which are exactly the default abilities),
  and `hero` is the default hero. A version 1 game with any other `player`
  numbers maps each to the nearest step.

## 4. Commands

| Command | Arguments | Notes |
|---|---|---|
| `setHeroAbilities` | any of the six abilities | Only the given ones change |
| `setHeroColours` | the full list of 1–8 palette indices | Removing a slot that pixels use is refused with a readable error |
| `setHeroPose` | a pose (or `shot`, `chargedShot`) and its rows | A drawing stroke is one command group, like a paint stroke |
| `resetHeroLook` | none | Restores the snow hero's look; abilities unchanged |

All validate their arguments and keep the project valid, as in milestone 1.

## 5. Slide and charge shot

### Slide

- **Control:** hold down and press jump, when the hero has slide and is
  standing on the ground.
- **Movement:** about 4 tiles forward at more than running speed. The body
  becomes 14×14, so it fits through one-tile gaps.
- **Low ceilings:** the slide continues past its normal length until there is
  room to stand.
- **Jumping and falling:** jump ends a slide when there is headroom. Sliding off
  a ledge falls as normal.
- **No shooting** while sliding.
- **Checker:** "slide left" and "slide right" join the moves it tries from each
  resting place, played in the real simulation, and only when the hero can
  slide. When a hero without slide is stopped by a gap too low to walk through,
  the reason says so: "The gap at column 20 is too low to walk through. Give
  your hero slide, or make the gap taller."
- **Crawl space piece:** a low tunnel with a length setting. The catalogue and
  the pieces palette mark it "needs slide", and the editor greys it out with
  that hint when the hero can't slide.

### Charge shot

- **Control:** hold shoot. After about a second the hero flashes; releasing
  fires a charged shot. A quick tap fires a normal shot.
- **Effect:** 3 damage instead of 1; it carries on through anything it
  destroys. Shields still block it.
- **Charging glow:** drawn by the game by flashing the hero's colours, not a
  pose the kid draws.
- **Checker and difficulty:** unchanged. Charge shot never changes where the
  player can go.

## 6. The hero screen

A **Hero** button in the toolbar swaps the level area for the hero screen;
**Level** swaps back. The zone list, the chat and undo stay.

```
+-------------+-------------------------------+-------------+
| Poses       |  Pixel canvas (zoomed)        | Colours     |
|  Stand  ▣   |  grid, body outline, feet line|  1 2 3 4    |
|  Run 1  ▣   |                               |  5 6 7 8    |
|  ...        |                               | 8-bit picker|
|  Slide  ▣   |                               | Preview     |
|  Shot   ▣   |                               | (animated)  |
+-------------+-------------------------------+-------------+
| Pencil  Eraser  Fill  Pick colour | Flip  Copy from…  Clear  Import picture |
+-----------------------------------------------------------+
| Abilities: Speed [normal|fast|very fast]  Jump [...]  ...  |
+-----------------------------------------------------------+
```

- **Poses list:** thumbnails of every pose and the two shots; the slide pose is
  marked when the hero can't slide, and still drawable.
- **Canvas:** pencil, eraser, fill and pick-colour, with mouse, pen and touch.
  One stroke is one undo step. The body outline and feet line show what the game
  counts as the hero.
- **Pose tools:** "Copy from…" starts a pose from another; "Flip" mirrors;
  "Clear" empties.
- **Colours:** eight slots; choosing a slot then a palette colour recolours it
  everywhere. Empty slots can be added up to eight; a slot in use cannot be
  removed.
- **Preview:** loops the hero through standing, running, jumping and shooting,
  plus sliding and the charge flash when it has them, drawn by the real game
  renderer. It updates as you draw.
- **Abilities row:** step buttons for each ability. Below it, a live note from
  the checker: "All zones can still be finished", or "2 zones can't be finished
  with this hero: Ice Cave, Frozen Gate", each name going to that zone.
- **Start from the snow hero:** resets the look after a confirmation; undoable.
- **Play** and **Play from this zone** play as the hero, from either screen.

## 7. Picture import

On the current pose, **Import picture**:

1. Choose a PNG (or any image the browser can read) up to 5 MB.
2. It is fitted inside the pose's frame, keeping its shape, and placed with its
   bottom on the feet line.
3. Transparent pixels stay empty. For pictures without transparency, a "Remove
   background" toggle (on by default when the corners share a colour) empties
   that colour.
4. Each pixel snaps to the nearest 8-bit palette colour, then the picture is cut
   down to the hero's colours: existing slots are reused where a colour is close,
   and new slots are added up to eight; beyond that, colours merge into their
   nearest slot.
5. A before/after view shows the result. **Use this** replaces the pose (and may
   add colour slots) as one undoable step; **Cancel** changes nothing.

The fitting and colour work is plain code with no DOM, tested on pixel arrays;
only reading the file into pixels uses the browser.

## 8. The assistant

- The level overview and the catalogue describe the hero in words: "Your hero
  runs fast, jumps up to 3 tiles, has 28 health, can slide under one-tile gaps
  and has a charge shot."
- A new tool, `set_hero_abilities`, maps to `setHeroAbilities`. It is a "plan"
  tool, so the activity line reads "Changing your hero…".
- Changing abilities counts as changing every zone, so the turn loop's check
  rule (check every changed zone before finishing) covers it.
- The system prompt adds: build crawl spaces only when the hero can slide, or
  give it slide first if the user asks for sliding; a charge shot lets levels use
  tougher enemies; never change the hero's abilities unless asked.
- The assistant does not draw or recolour the hero.

## 9. Error handling

| Situation | Behaviour |
|---|---|
| Opening a version 1 game | Upgraded on load as in section 3; plays exactly as before |
| A game file with a broken hero | Refused with a plain explanation, like other broken files |
| Importing a file that is not a readable picture, or over 5 MB | "That file isn't a picture we can use. Try a PNG." Nothing changes |
| A huge or oddly shaped picture | Fitted anyway; the before/after view shows the result first |
| An ability change makes zones impossible | Allowed; the hero screen and the zone badges name them; one undo restores |
| Removing a colour slot that pixels use | Refused: "Colour 3 is still used in Stand and Run 1." |
| The assistant sends a bad ability value | A readable error goes back to it, as for every tool |

## 10. Testing

- **Abilities:** for every step, scripted runs in the simulation prove its jump
  height and speed. Every level piece passes the checker at every setting with
  every jump and speed step.
- **Slide:** simulation tests: fits through a one-tile gap, continues under a
  ceiling, falls off a ledge, jumps out with headroom, cannot start without the
  ability or in the air. The checker finds crawl-space routes only with slide,
  and a scripted player replays one to prove it.
- **Charge shot:** tap versus hold, damage, passing through destroyed enemies,
  blocked by shields, no charge without the ability.
- **Model:** the version 1 upgrade (a saved milestone 1 game plays identically),
  hero validation, palette indices.
- **Commands:** each hero command applies, rejects bad input, and undoes exactly.
- **Import:** fitting, background removal, palette snapping and colour
  reduction on small pixel arrays.
- **Hero screen:** component tests for drawing, fill, colour change, copy, flip,
  import with small test PNGs, and undo. Browser tests: draw a pixel and see it
  in play; import a picture.
- **Assistant:** `set_hero_abilities` tool tests; a scripted-model turn that
  gives the hero slide and builds a crawl space; new hand-run prompts in
  `docs/superpowers/ai-prompts.md`.

## 11. Build order

One spec, five plans:

1. Hero data and abilities: the file format and its upgrade, the palette, the
   ability table, the hero commands, and the game and checker using them.
2. Slide and charge shot in the game and the checker, plus the crawl-space piece.
3. The hero screen: drawing tools, colours, preview and the abilities row.
4. Picture import.
5. The assistant: the hero in its view, `set_hero_abilities`, prompt updates.

## 12. Later milestones

Enemy and boss designers reusing the drawing tools and import; more moves
(double jump, wall jump); tilesets; sound and gamepad; accounts, cloud saves and
publishing; multi-level games with a stage select.
