# MegaRomBuilder milestone 4: characters that fit

Date: 2026-10-07
Status: design approved in conversation, awaiting written-spec review

## 1. Purpose

User testing with the young players MegaRomBuilder is made for (8 to 14) asked
for three things:

1. Resize their characters' pictures and hitboxes, and choose where shots come
   out.
2. More colours per character.
3. A real animation editor: more frames in the walk, and frames in every pose.

Kids resize mostly to make a character look right (a tall robot, a tiny bug, a
wide tank), so the hitbox follows the drawing. Everything stays kid-friendly:
step buttons and handles on the picture with safe limits, not raw numbers.

### Success criteria

1. A kid changes a character's canvas size, and its hitbox fits the drawing; they
   can drag the hitbox's edges or press Fit to drawing.
2. A kid drags the shot marker, and the hero's (or a shooting enemy's or the
   boss's) shots come out at that height.
3. A character can use up to 16 colours.
4. Every animation has 1 to 8 frames, a speed, and plays in the game; kids add,
   copy, delete and reorder frames, play the animation, and draw with an onion
   skin.
5. The checker's verdicts stay true for resized characters, and a hero never
   grows too big for the level pieces.
6. Games saved before milestone 4 open and play exactly as before.

### In scope

- One shared look for the hero, the kid's enemies, the kid's boss and the
  content pack's characters: canvas size, up to 16 colours, named animations
  with frames and a speed, a body box, an optional shot point
- Game file format 4, with an upgrade from 3
- Animations, bodies and shot points in the game
- The Characters screen's animation list, frame strip, play, onion skin, size,
  hitbox handles and shot marker
- The assistant knowing the hero's size

### Out of scope (later milestones)

- Resizing shots, or shots with their own hitbox shape
- More than 16 colours, or colours outside the 8-bit palette
- Animations for tiles or items; sounds
- The assistant drawing or animating

### Constraints

- Earlier milestones' constraints stand: original art only, the API key stays on
  the server, language and scope suit young users, the simulation is
  deterministic.
- A hero must always fit through the openings the level pieces make: its
  standing body at most 30 pixels tall (under 2 tiles), its sliding body at most
  14 tall (under 1 tile).

## 2. Architecture

No new units. The work lands in the existing ones:

| Unit | Changes |
|---|---|
| Project model | the shared `Look`; format 4 and the upgrade; validation; the hero, enemy and boss designs use `Look` |
| Commands | look commands shared by hero, enemies and boss |
| Runtime | animation playback; bodies and shot points from the look |
| Checker | its moves read the hero's real body |
| Content | the snow hero, enemies and Blizzard Bot as `Look`s |
| Editor UI | the animation list, frame strip, play, onion skin, size, hitbox and shot marker, shared by the three tabs |
| AI assistant | the hero's size in its hero description |

The rules of earlier milestones still hold: model, commands, the simulation and
the checker have no React, no DOM and no randomness; the editor and the
assistant change the game only through commands.

## 3. The look

```
Look
  colours: number[]                  1 to 16 palette indices
  canvases: { [canvas]: { w, h } }   per canvas group (below)
  animations: { [name]: Animation }  the names the character kind has (below)
  body: { x, y, w, h }               the hitbox, in the main canvas's pixels
  slideBody?: { x, y, w, h }         the hero's sliding hitbox, in the slide canvas
  shotY?: number                     where shots come out: pixels below the body's top

Animation
  frames: string[][]                 1 to 8 frames; each frame's rows sized to its canvas
  speed: "slow" | "normal" | "fast"
```

Pixels are `.` (clear), `1` to `9`, then `a` to `g`, naming colour slots 1 to 16.
One character per pixel, so every existing drawing is already valid.

### Canvas groups and sizes

| Character | Canvas | Animations on it | Sizes (w × h) |
|---|---|---|---|
| Hero | main | stand, standShoot, run, runShoot, jump, jumpShoot, climb, hurt | 12 to 32 × 16 to 32 |
| Hero | slide | slide | 16 to 32 × 8 to 16 |
| Hero | shot, chargedShot | shot, chargedShot | fixed (6 × 4, 12 × 10) |
| Enemy | main | its behaviour's animations | 8 to 32 × 8 to 32 |
| Boss | main | stand, jump, attack | 16 to 48 × 16 to 48 |

Sizes change in steps of 2 pixels. Pictures are drawn centred on the body with
the bottom of the canvas on the body's feet, as now.

### Animations by character

| Character | Animations |
|---|---|
| Hero | stand, standShoot, run, runShoot, jump, jumpShoot, climb, hurt, slide, shot, chargedShot |
| Walker | walk |
| Flyer | fly |
| Turret | idle |
| Hopper (jumper) | ground, air |
| Shield guard | closed, open |
| Dropper | hang, fall |
| Boss | stand, jump, attack |

Changing an enemy's behaviour keeps the frames of animations the two behaviours
share by position (the first animation's frames become the new first
animation's, and so on), so the drawing carries over as it does today.

### Bodies and shot points

- A new or resized look's body is fitted to the drawing: the smallest box around
  the drawn pixels of its first standing frame (stand, walk, fly, idle, ground,
  closed, hang, or the boss's stand), then clamped to the limits.
- Body limits: at least 4 × 4; inside the canvas; the hero's standing body at
  most 30 tall; the hero's slide body at most 14 tall. Enemies' and the boss's
  bodies have no further limits beyond their canvas.
- `shotY` is measured from the body's top, 0 to the body's height minus the
  shot's height. It exists for the hero, turrets, shield guards and the boss.
  Running and jumping shots use the same `shotY`.

### Animation playback

- Normal speed keeps today's timing: the hero's run changes frame every 6 steps,
  enemies every 8. Slow is half as fast again (9 and 12), fast is two thirds of
  the time (4 and 5). Other animations use the 8-step timing.
- Looping animations cycle: stand, standShoot, run, runShoot, climb, slide, shot,
  chargedShot, walk, fly, idle, ground, air, closed, open, hang, fall, and the
  boss's stand.
- Once-through animations play from their first frame each time their pose
  starts and hold their last frame: jump, jumpShoot, hurt, and the boss's jump
  and attack.
- Climb steps one frame every 8 pixels climbed instead of over time. A one-frame
  climb flips sideways as it does today.
- Frames are picked from step counts, so play stays deterministic.

### Old games

Format 3 games upgrade to format 4:

- The hero's pictures become one-frame animations, except run (run1, run2 → two
  frames). runShoot starts as a copy of run (today's running shot uses the run
  pictures). Its body is today's (14 × 22, slide 14 × 14), its shotY 8 (today's).
- An enemy's two frames become its behaviour's animations (walker: walk = both
  frames; hopper: ground = frame 1, air = frame 2; and so on). Its body is
  today's size for its behaviour; turrets and shield guards get today's shot
  height.
- A boss's three frames become stand, jump and attack; its body 24 × 28.
- All speeds are normal. The game looks and plays pixel for pixel as before.

The content pack's snow hero, enemies and Blizzard Bot become looks the same
way, so the renderer has one path for every character.

## 4. Commands

Look commands take a `target`: `"hero"`, `{ enemy: id }` or `"boss"`.

| Command | Arguments | Notes |
|---|---|---|
| `setLookColours` | target, colours | 1 to 16; removing a colour still in use is refused, as now |
| `setFrame` | target, animation, frame, rows | One stroke is one command group |
| `addFrame` | target, animation, after, copy? | Blank, or a copy of frame `after`; refused past 8 |
| `removeFrame` | target, animation, frame | Refused for the last frame |
| `moveFrame` | target, animation, from, to | |
| `setAnimationSpeed` | target, animation, speed | |
| `resizeCanvas` | target, canvas, w, h | Pads or trims evenly at the sides and at the top, keeping the bottom row; refits the body; refused outside the limits |
| `setBody` | target, body (and which: main or slide) | Refused outside the limits |
| `fitBody` | target, which | Fits to the drawing |
| `setShotY` | target, y | Refused outside the body |

The hero's, enemies' and boss's existing picture commands (`setHeroPose`,
`setHeroColours`, `setEnemyFrame`, `setEnemyColours`, `setBossFrame`,
`setBossColours`) are replaced by these. Trimming drawn pixels asks first in the
editor; the command itself just trims.

All validate their arguments and keep the game valid; all are undoable.

## 5. The game

- Each character draws the current frame of its current animation.
- The hero's standing and sliding bodies, and every enemy's and the boss's body,
  come from their looks. The boss's attacks measure from its body (the big
  shot's height stays 14 pixels above the floor, so the slide still passes
  under).
- Shots start at `shotY` below the body's top.
- The checker's moves (walking, jumping, climbing, sliding and the crawl-space
  probe) read the hero's real body. A resize that makes a zone impossible turns
  its badge red, as an ability change does.

## 6. The Characters screen

The Hero, Enemies and Boss tabs keep their layout. On each:

- **Animation list** replaces the picture buttons: each animation's name,
  thumbnail and frame count.
- **Frame strip** under the canvas: the animation's frames; **Add frame**
  (blank, after the chosen one), **Copy frame**, **Delete frame** (off at one
  frame), **Move left** and **Move right**, and dragging to reorder.
- **Play** loops the animation at its speed in a small box; **Slow / Normal /
  Fast** beside it.
- **Onion skin**: a toggle that shows the previous frame faintly under the
  canvas.
- **Size**: width and height step buttons for the canvas the animation is on.
  Shrinking over drawn pixels asks first: "This cuts off part of your drawing.
  You can undo it."
- **Hitbox**: shows the body outline with handles on its edges, and **Fit to
  drawing**.
- **Shot point**: an arrow on the canvas's side the kid drags up and down (hero,
  turret, shield guard, boss).
- **Colours**: up to 16 slots in one row.
- The live previews use the animations, sizes and bodies at once.

Every change is one undo step: a stroke, a frame added, a size step, a hitbox
drag, a shot marker drag.

## 7. The assistant

- The hero description adds its size: "Your hero is 26 pixels tall and 14 wide,
  so it fits through 2-tile gaps." The slide limit keeps crawl spaces working, so
  nothing else changes.
- No new tools; it still can't draw, animate or resize.

## 8. Error handling

| Situation | Behaviour |
|---|---|
| Opening a format 3 game | Upgraded; looks and plays as before |
| A game file with a broken look (a frame the wrong size, a 17th colour, an empty animation, a missing animation, a body outside its canvas or past its limits, a shot point outside the body) | Refused with a plain explanation |
| Shrinking over drawn pixels | Asks first; undoable |
| A ninth frame | Add and Copy are off at 8 |
| Deleting the last frame | Delete is off; the command refuses too |
| A size, body or shot point past its limits | Not offered by the handles; the commands refuse too |

## 9. Testing

- **Model and commands:** the upgrade (every format 3 fixture opens, and
  re-saving gives a valid format 4 file); validation of looks; every command,
  its refusals and exact undo; resizing pads and trims as described.
- **Old games play the same:** a format 3 game and its upgrade produce the same
  simulation, step for step, and the same drawing calls.
- **Animation:** frame timing at each speed; looping and once-through play;
  climbing by distance.
- **Bodies and shots:** a tall hero (30) still crosses every level piece; a
  sliding hero still clears crawl spaces; shots come out at `shotY`; an
  enemy's and the boss's hitboxes follow their looks; the checker's verdicts
  match play for resized heroes.
- **Screens:** component tests for the animation list, frame strip, play, onion
  skin, size, hitbox handles and shot marker on each tab. Browser test: add
  walk frames to an enemy, resize it, and play.
- **Assistant:** the hero description with its size.

## 10. Build order

One spec, five plans:

1. The shared look, format 4 and the upgrade, the snow characters as looks, the
   look commands; no visible change.
2. Animations in the game: frames, speeds, looping and once-through play.
3. Sizes, bodies and shot points in the game; the checker and the assistant's
   hero text.
4. The editor: animation list, frame strip, play, onion skin, 16 colours.
5. The editor: size, hitbox handles, shot marker; browser tests.

## 11. Later milestones

Weapons won from bosses and a weapon menu; multi-level games with a stage
select; tilesets; sound and gamepad; resizable shots; accounts, cloud saves and
publishing.
