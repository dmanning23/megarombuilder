# MegaRomBuilder milestone 3: your own enemies and boss

Date: 2026-10-06
Status: design approved in conversation, awaiting written-spec review

## 1. Purpose

Milestone 2 let kids design their hero. Milestone 3 lets them design the
creatures it fights: their own enemies, built on the game's tested behaviours,
and their own boss, a robot master with attacks they choose. The assistant
builds levels around them: "build me a level for my Frost Fang".

### Success criteria

1. A kid makes an enemy: names it, picks a behaviour, tunes it with named steps,
   draws (or imports) its two frames, and places it in a level like any other.
2. A kid makes a boss: names it, picks the fight length and 2 or 3 attacks in
   order, draws (or imports) its three frames, and fights it in the boss room.
3. A preview shows each enemy and the boss doing what they will do in the game.
4. The checker treats zones with the kid's enemies exactly like any others.
5. Asked for "a level for my Frost Fang", the assistant makes that enemy the
   star of the level, and every zone passes the checker.
6. Games saved before milestone 3 open and play exactly as before.

### In scope

- The kid's enemies and boss in the game file, with an upgrade for old games
- A game pack: the content pack plus the kid's designs, used everywhere
- Three new boss attacks (aimed shot, rain, big shot) alongside the three that
  exist (jump, dash, spread shot); an attack order; faster at low health
- A Characters screen with Hero, Enemies and Boss tabs, reusing the hero
  screen's drawing, colours, import and preview
- The assistant knowing and building around the kid's enemies and boss

### Out of scope (later milestones)

- New behaviours built from parts, or changing a behaviour's body size
- More than one boss per game; multi-level games and a stage select
- Winning a weapon from the boss; sounds
- The assistant designing, drawing, tuning or deleting enemies or bosses

### Constraints

- Milestones 1 and 2's constraints stand: original art only, the API key stays
  on the server, language and scope suit young users.
- Each behaviour keeps its body size, so the checker and levels stay fair.
- The simulation stays deterministic: no randomness in boss attacks.

## 2. Architecture

No new units. The work lands in the existing ones:

| Unit | Changes |
|---|---|
| Project model | `enemies` and `boss` in the game file; format version 3 with an upgrade from 2; design validation; the tuning table; `gamePack` |
| Commands | enemy and boss commands |
| Runtime | the boss's attack list and order, three new attacks, faster at low health; drawing own enemies and the boss from their looks |
| Checker | none beyond taking the game pack |
| Content | the snow enemies and the Blizzard Bot available as starting drawings |
| Editor UI | the Characters screen (Hero, Enemies, Boss tabs); the palette lists the kid's enemies |
| AI assistant | the catalogue and prompt know the kid's designs |

`gamePack(project, pack)` returns the content pack with the kid's enemies and
boss added as thing types. Everything that takes a pack (the game, the checker,
the palette, validation, the assistant's catalogue) is given the game pack, so
the kid's designs need almost no special handling. The rules of milestone 1
still hold: model, commands, the simulation and the checker have no React, no
DOM and no randomness; the editor and the assistant change the game only
through commands.

## 3. The designs in the game file

```
Project
  formatVersion: 3
  enemies: EnemyDesign[]          0 to 12
  boss: BossDesign | null
  ...everything else as in milestone 2

EnemyDesign
  id                              unique among the game's enemies
  name                            1 to 40 characters, unique among the game's enemies (ignoring case and extra spaces)
  behaviour                       "walker" | "flyer" | "turret" | "jumper" | "shielded" | "dropper"
  tuning: EnemyTuning
  look: { colours: number[] (1 to 8 palette indices), frames: [string[], string[]] }

EnemyTuning
  health: 1 | 2 | 3 | 5           hits to destroy it
  damage: "low" | "normal" | "high"   1, 2 or 4 on touch, and for its shots
  speed: "slow" | "normal" | "fast"   used by walker, flyer, jumper, shielded
  shoots: "rarely" | "sometimes" | "often"   used by turret, shielded

BossDesign
  name                            1 to 40 characters
  fight: "short" | "normal" | "long"     20, 28 or 40 health
  attacks: BossAttack[]           2 or 3, in order
  look: { colours: number[] (1 to 8), frames: [stand, jump, attack] }

BossAttack: "jump" | "dash" | "spread" | "aimed" | "rain" | "big"
```

### Tuning

One table turns tuning steps into the thing settings the runtime already reads
(`health`, `damage`/`shotDamage`, `speed`, `interval`, and so on). "Normal"
speed and "sometimes" shooting are the snow enemy's own numbers for that
behaviour; "slow" and "fast" are about two thirds and one and a half times;
"rarely" and "often" shoot about half and twice as often. Steps a behaviour
doesn't use are stored but ignored (so changing behaviour keeps them).

### Pictures

- Enemy frames are 16×16; the boss's are 24×28 (the boss's body size). Pictures
  are drawn centred on the body with their bottom on its feet, as now.
- Pixels are `.` or a digit naming a colour slot, as for the hero.
- Frames are used as the snow enemies use theirs: walking steps (walker,
  flyer), shield down and up (shielded), on the ground and in the air (jumper),
  hanging and falling (dropper), the same picture twice (turret). The boss's are
  standing, jumping and attacking.

### The game pack

- Each enemy becomes a thing type `own-<id>` with category "enemy", the
  design's behaviour, its name, the description "Yours", and its tuning's
  settings as defaults.
- A boss becomes the thing type `own-boss` with behaviour "boss" and settings
  for its health and attack list.
- The renderer draws `own-…` types from their looks (each with its own palette),
  as it draws the hero.
- The Blizzard Bot keeps its fight (jump, spread, dash) and is described with
  the same attack list in its settings.

### Old games

Format version 2 games upgrade to version 3 with `enemies: []` and
`boss: null`, and play exactly as before.

## 4. Commands

| Command | Arguments | Notes |
|---|---|---|
| `addEnemy` | id, name, behaviour | Starts from a copy of that snow enemy's drawing, colours snapped to the 8-bit palette; refused past 12 |
| `renameEnemy` | id, name | Names unique, as for zones |
| `setEnemyBehaviour` | id, behaviour | Keeps the drawing and tuning |
| `setEnemyTuning` | id, any of the tuning steps | Only the given ones change |
| `setEnemyColours` | id, colours | Removing a colour still in use is refused, as for the hero |
| `setEnemyFrame` | id, frame (0 or 1), rows | One stroke is one command group |
| `removeEnemy` | id | Refused while it is placed anywhere: "Frost Fang is used in Zone 1 and Ice Cave." |
| `createBoss` | name | Starts from a copy of the Blizzard Bot's drawing and attacks |
| `setBoss` | any of name, fight, attacks | 2 or 3 attacks |
| `setBossColours` | colours | As for enemies |
| `setBossFrame` | frame (0 to 2), rows | |
| `useBoss` | "snow" or "yours" | Swaps the boss placed in the boss room, keeping its position; "yours" needs a boss |
| `removeBoss` | none | Refused while it is the boss in use |

All validate their arguments and keep the game valid; all are undoable.

## 5. Boss attacks

| Attack | What it does | How to dodge |
|---|---|---|
| Jump | Leaps toward the hero (as now) | Run under it |
| Dash | Charges along the floor until it hits a wall (as now) | Jump over |
| Spread | Three shots fanning out (as now) | Jump or slide through the gap |
| Aimed | One quick shot straight at the hero's position | Move after it fires |
| Rain | Four shots fall from the top of the room, spaced so there is always a safe gap at least two tiles wide | Stand in the gap |
| Big | One large, slow shot (16×16, 4 damage) at chest height | Jump over, or slide under with slide |

- The boss uses its attacks in its list's order, round and round, with a pause
  between them. Below half health the pause is about 40% shorter.
- Rain's safe gap moves each time in a fixed pattern, so it is learnable and
  deterministic.
- The checker is unchanged: a boss room counts as passable once the hero
  reaches it.

## 6. The Characters screen

The toolbar's Hero button becomes **Characters**, a screen with three tabs:
**Hero** (milestone 2's hero screen, unchanged), **Enemies** and **Boss**.
**Level** swaps back. The zone list, the chat and undo stay.

### Enemies tab

- A list of the kid's enemies with thumbnails, and **New enemy** (off at 12,
  with a note). New enemy asks for a behaviour, then a name, and starts from
  that snow enemy's drawing.
- For the chosen enemy: its name; behaviour as six buttons; tuning as step
  buttons, showing only the steps its behaviour uses; its two frames on the
  hero screen's canvas (with the behaviour's body outline), drawing tools,
  colours, Copy from the other frame, Flip, Clear and Import picture.
- A preview: a one-screen game with the hero standing still and the enemy
  doing what it does.
- **Delete enemy**, after asking; refused with the plain message while it is
  placed.

### Boss tab

- With no boss: **Make your own boss**, which starts from the Blizzard Bot.
- With a boss: its name; fight length as step buttons; attacks chosen in order
  (2 or 3) from the six, each with its one-line description; its three frames
  with the same drawing tools; a preview of it fighting in a boss room;
  **Use in the boss room: Blizzard Bot / Your boss**; **Delete boss** (refused
  while in use).

### The palette

"Enemies and items" lists the kid's enemies first, marked "Yours", with their
drawings as swatches. A kid's boss is placed by "Use in the boss room", not from
the palette.

## 7. The assistant

- The catalogue lists the kid's enemies by name, behaviour and strength ("Frost
  Fang (yours): a walker, fast, 3 hits, high damage") and their boss with its
  attacks in order.
- It places them with `place_thing` using their `own-…` types.
- The system prompt adds: when the user mentions one of their own enemies, make
  it the star of the level, introduced safely first; build the boss room to suit
  the boss's attacks (room to dodge rain and dashes); never delete or change the
  kid's designs. Asked to change a design, it points to the Characters screen.
- No new tools.

## 8. Error handling

| Situation | Behaviour |
|---|---|
| Opening a version 2 game | Upgraded with no enemies or boss of its own; plays exactly as before |
| A game file with a broken design (wrong frame size, missing colour, unknown behaviour or attack, a placed `own-…` type with no design) | Refused with a plain explanation |
| Deleting an enemy that is placed | Refused: "Frost Fang is used in Zone 1 and Ice Cave." |
| A thirteenth enemy | New enemy is off, with "12 is the most" |
| Fewer than 2 or more than 3 attacks | The picker doesn't allow it; the command refuses too |
| Using "Your boss" with no boss, or deleting the boss in use | Not offered; the commands refuse too |

## 9. Testing

- **Model and commands:** the upgrade; validation of designs; the tuning table;
  every command, its refusals and exact undo.
- **Game pack:** own types appear with the right behaviour, settings and art;
  an own enemy plays exactly like a snow enemy with the same behaviour and
  numbers.
- **Boss:** each new attack (it appears, moves and hurts); rain always leaves a
  gap; the big shot can be jumped and slid under; attack order; shorter pauses
  below half health; the Blizzard Bot fights as before.
- **Checker:** zones with own enemies are checked like any other; every level
  piece still passes.
- **Screens:** component tests for making, tuning, drawing and deleting enemies,
  and for making, arming and using a boss. Browser tests: make an enemy, place
  it, play; make a boss, use it, fight it.
- **Assistant:** catalogue text; a scripted turn that places the kid's enemy;
  hand-run prompts added to `docs/superpowers/ai-prompts.md`.

## 10. Build order

One spec, five plans:

1. Enemy data, the game pack, and drawing own enemies in the game.
2. The Characters screen and the Enemies tab.
3. Boss data and the new boss attacks.
4. The Boss tab.
5. The assistant.

## 11. Later milestones

Weapons won from bosses and a weapon menu; multi-level games with a stage
select; tilesets; sound and gamepad; accounts, cloud saves and publishing.
