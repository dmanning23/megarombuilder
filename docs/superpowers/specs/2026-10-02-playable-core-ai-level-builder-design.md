# MegaRomBuilder milestone 1: playable core and AI level builder

Date: 2026-10-02
Status: design approved in conversation, awaiting written-spec review

## 1. Purpose

MegaRomBuilder is a web tool for making Mega Man-style run-and-gun games with no
programming. Its users are young Mega Man fans who enjoy designing robot masters
but know little about level design. A built-in chat assistant edits the project
for them: "build me a level for this enemy", then "add more spikes in zone 2",
"make the outdoor part of zone 3 easier".

The full product has seven subsystems: game runtime, project format, asset
tools, character and enemy editor, level editor, AI assistant, and export. Each
gets its own spec. This spec covers milestone 1 only.

### Milestone 1 goal

Prove the most distinctive and riskiest part: that the assistant can build a fun,
beatable level from a one-line request and revise it zone by zone in
conversation.

### Success criteria

1. A user types "build me a snow level" and gets a complete level of several
   named zones ending in a boss room, which they can play immediately.
2. Every zone the assistant presents as finished passes the checker.
3. A follow-up request naming a zone changes that zone, keeps its purpose, and
   can be undone in one step.
4. The user can make the same kinds of change by hand in the editor.
5. The project survives a page reload and can be exported and re-imported as a
   file.

### In scope

- Game runtime with one player character, six stock enemy types, hazards,
  pickups and one boss
- Project format and edit commands with undo and redo
- Checker for zone passability and rough difficulty
- Level editor with playtest
- Chat assistant that edits levels through tool calls
- One built-in snow/ice content pack with original placeholder art

### Out of scope (later milestones)

- Importing or editing sprites, animations and tilesets
- Creating or editing characters, enemies and bosses
- Accounts, cloud saves, publishing a game to a shareable link
- Sound and music, gamepad input, lives and game-over screens, special weapons
- Background decoration layers, branching paths between zones, leftward zones
- More than one content pack

### Constraints

- All shipped art is original or freely licensed. No Capcom sprites, tiles,
  names or music.
- The Claude API key never reaches browser code.
- The assistant's language and scope suit young users.

## 2. Architecture

One Next.js app (App Router) in TypeScript. Seven units with one-way dependencies:

| Unit | Path | Responsibility | Depends on |
|---|---|---|---|
| Project model | `src/model/` | Types, Zod schemas, validation, version upgrades | nothing |
| Commands | `src/commands/` | Every edit as a named, validated, undoable operation | model |
| Runtime | `src/runtime/` | Plays a level: physics, collision, camera, entities, drawing | model |
| Checker | `src/checker/` | Zone passability and difficulty estimate | model, runtime physics |
| Content | `src/content/` | The snow pack: tiles, enemy definitions, pieces, placeholder art | model |
| Editor UI | `src/editor/`, `src/app/` | React screens, palette, playtest, chat panel | commands, runtime, checker |
| AI assistant | `src/ai/`, `src/app/api/chat/route.ts` | Proxy route, tool definitions, browser-side tool loop | commands, checker |

Rules:

- `model`, `commands`, `checker` and the simulation half of `runtime` are plain
  TypeScript with no React and no DOM. They run under Node in tests.
- `runtime` is split into `runtime/sim/` (no DOM) and `runtime/render/` (canvas
  drawing and keyboard input). The checker imports only from `runtime/sim/`.
- The runtime is our own code, not a game engine. The physics are simple, and
  owning them lets the checker and tests use exactly what the player feels.
- The editor UI and the AI assistant are equal clients of the command layer.
  Neither mutates project data directly.

### Storage

- Projects autosave to IndexedDB (via the `idb` package), debounced after each
  command.
- Export and import as a single `.megarom.json` file.
- Chat history is stored inside the project document.

## 3. Project model

A project is one JSON document.

```ts
type Project = {
  formatVersion: 1;
  id: string;
  name: string;
  contentPackId: string;          // "snow" in milestone 1
  player: PlayerSettings;
  levels: Level[];
  chat: ChatMessage[];
};

type PlayerSettings = {           // units: pixels and simulation steps (60/s)
  runSpeed: number;               // default 1.375
  jumpVelocity: number;           // default 4.875
  gravity: number;                // default 0.25
  maxFallSpeed: number;           // default 7
  ladderSpeed: number;            // default 1.25
  maxHealth: number;              // default 28
  maxShots: number;               // default 3
};

type Level = {
  id: string;
  name: string;
  brief: string;                  // plain-language design brief
  zones: Zone[];                  // ordered; single chain
  checkpoints: { zoneId: string; x: number; y: number }[];
};

type Zone = {
  id: string;                     // stable; all links use this
  name: string;                   // user-visible; chat matches on this
  kind: "normal" | "bossCorridor" | "bossRoom";
  scroll: "horizontal" | "vertical";
  screens: number;                // length along the scroll axis
  variant: string;                // theme variant, e.g. "outdoor" | "cave"
  intent: string;                 // one line: what this zone is for
  tiles: number[];                // row-major tile IDs; 0 = empty
  things: Thing[];
  entry: Opening;
  exit: Opening | null;           // null only for the boss room
};

type Opening = { edge: "left" | "right" | "top" | "bottom"; from: number; to: number };

type Thing = {
  id: string;
  type: string;                   // key into the content pack
  x: number; y: number;           // tile coordinates
  settings: Record<string, number | string | boolean>;
};
```

The default player numbers approximate the classic feel: a jump of about three
tiles high and a little over three tiles across. They are starting values to be
tuned in play.

### Geometry

- A tile is 16 by 16 pixels. A screen is 16 by 15 tiles (256 by 240 pixels).
- A horizontal zone is `screens × 16` tiles wide and 15 high, 1 to 8 screens.
- A vertical zone is 16 tiles wide and `screens × 15` high, 1 to 6 screens.
- Boss corridor and boss room are each one horizontal screen.

### Zone rules

Hard rules, enforced by every command and on import:

- A level has at least three zones. The last two are a `bossCorridor` then a
  `bossRoom`; no other zone has those kinds.
- An exit is never on the left edge and an entry is never on the right edge.
  Leftward travel is not supported.
- The first zone's entry holds the player start. The boss room has no exit.
- Zone names are unique within a level, compared case-insensitively and
  ignoring extra spaces, so chat references are unambiguous. Names are 1 to 40
  characters.
- A zone's entry and exit never overlap on the same edge.

Chain rules, reported as problems but not enforced by commands, because fixing a
connection takes two edits and the state in between must be allowed:

- Zone N's exit edge must pair with zone N+1's entry edge: right to left, top to
  bottom, bottom to top.
- Paired openings must be the same length.

### Player start

The player starts at the first zone's entry opening. There is no separate start
point field.

### Content pack

```ts
type ContentPack = {
  id: string;
  name: string;
  variants: string[];
  tiles: TileDef[];               // id, name, behaviour, art per variant
  things: ThingDef[];             // enemies, pickups, platforms, boss
  pieces: PieceDef[];
};

type TileBehaviour = "solid" | "ladder" | "spike" | "ice" | "oneWay";
```

What a tile does comes from the pack, never from the level. Adding a theme later
means adding a pack.

### Snow pack contents

- **Variants:** outdoor, cave.
- **Tiles:** ground, wall, ice floor, ladder, spike (floor and ceiling),
  one-way ledge.
- **Enemies:**

  | Type | Behaviour |
  |---|---|
  | walker | Patrols a platform, turns at edges |
  | flyer | Flies a sine path toward the player |
  | turret | Fixed; fires aimed shots on a timer |
  | jumper | Hops toward the player |
  | shielded | Blocks shots from the front; vulnerable while attacking |
  | dropper | Hangs from ceilings; drops when the player passes below |

- **Other things:** moving platform (horizontal or vertical path), small and
  large health pickup. Checkpoints are level data, not things. There is no boss
  door thing: the boss room's entry is the door, since zones never lead back,
  and the boss waits through a short intro.
- **Boss:** "Blizzard Bot", an original placeholder with three attack patterns
  (jump across the room, three-way ice shot, sliding dash) chosen in sequence.
- **Pieces:** flat run, staircase up, staircase down, gap, spike pit, spike pit
  with moving platform, ice run, ladder climb, ladder climb with turrets,
  stepped platforms over a pit, enemy gauntlet, rest area with pickup.
  Each piece is a function from whole-number settings (width, height, difficulty
  1 to 3), each with a declared range, to a block of tiles and things.
- **Art:** simple original pixel art generated for the project, stored as PNG
  sheets in `public/packs/snow/`.

## 4. Commands

Every edit is a command: a name, validated arguments, and an `apply` that
returns a new project. Projects are immutable, so undo keeps the project from
before each command group instead of computing an inverse.

| Group | Commands |
|---|---|
| Level | `createLevel`, `renameLevel`, `setLevelBrief`, `deleteLevel` |
| Zones | `addZone`, `removeZone`, `moveZone`, `renameZone`, `resizeZone`, `setZoneVariant`, `setZoneIntent`, `setZoneOpenings` |
| Tiles | `setTiles` (list of cells), `fillRect`, `clearRect` |
| Things | `placeThing`, `moveThing`, `removeThing`, `setThingSettings` |
| Pieces | `insertPiece` (expands to tiles and things at a position) |
| Checkpoints | `addCheckpoint`, `removeCheckpoint` |

- Commands validate arguments and reject anything that would break the model
  rules, returning a readable error string. Nothing invalid reaches the project.
- The history is a stack of command groups. One manual gesture (a paint stroke)
  is one group. One assistant chat turn is one group.
- A group can be rolled back as a unit, which is how a failed assistant turn is
  undone.

## 5. Runtime

### Simulation (`runtime/sim/`)

- Fixed step of 1/60 second, driven by an accumulator, independent of display
  frame rate. Given the same inputs it produces the same result every time.
- **Player:** run, variable-height jump (releasing early cuts the rise), shoot
  with up to `maxShots` on screen, climb ladders, take damage with knockback and
  about one second of invulnerability, die on spikes or pits, respawn at the
  last checkpoint reached or the level start.
- **Collision:** axis-aligned boxes against the tile grid, resolved one axis at
  a time. Tile behaviours: solid, ladder, spike (lethal), ice (reduced
  acceleration and friction), one-way (solid from above only).
- **Moving platforms:** carry the player; follow a straight path set in their
  settings.
- **Enemies:** six behaviour types, each a small state machine parameterised by
  numbers from the pack. An enemy activates when it scrolls into view and resets
  when it is well off screen.
- **Boss:** activates when the boss room's door closes; has a health bar; picks
  its attack patterns in sequence. Defeating it ends the level.
- **Zones:** only the current zone is simulated. Crossing the exit opening
  starts a transition into the next zone's entry.

### Rendering and input (`runtime/render/`)

- 2D canvas at 256 by 240, scaled by whole multiples with smoothing off.
- Camera scrolls on the zone's axis, clamps at zone edges, and slides one screen
  during a zone transition while the simulation is paused.
- Keyboard: arrows to move and climb, Z to jump, X to shoot, Escape to leave
  playtest. Keys are defined in one map for later rebinding.
- Head-up display: player health, boss health in the boss room.

## 6. Checker

### Passability

For one zone, decide whether the player can get from the entry opening to the
exit opening (or, in the boss room, to the floor of the arena).

1. Find every standable cell: empty space for the player's box with a solid,
   ice, one-way or ladder-top surface beneath.
2. Build links between standable cells: walk, fall, climb, and jump. Jump links
   come from arcs computed from `PlayerSettings`, sampled across take-off speeds
   and release times, and tested against the tile grid for collisions. Any arc
   touching a spike is discarded.
3. Search from the entry cells to the exit cells.

Result:

```ts
type CheckResult =
  | { ok: true; difficulty: number }
  | { ok: false; furthest: { x: number; y: number }; reason: string };
```

`reason` is specific, for example: "Cannot pass column 34: the gap is 6 tiles
and the longest jump is 3."

### Difficulty estimate

A score from 1 to 10 per zone, combining enemy count per screen weighted by
type, hazard tiles per screen, and how close the required jumps are to the
player's maximum. It is a rough guide for the assistant and the zone badge, not
a measurement.

### Known limits

- It proves a route exists, not that the zone is fun or fair.
- Enemies are ignored.
- A moving platform counts as standable anywhere along its path, which is
  optimistic about timing.

## 7. AI assistant

### Where things run

- **`POST /api/chat`** holds `ANTHROPIC_API_KEY`, adds the system prompt and
  tool definitions, forwards the messages to Claude and streams the response
  back. It is stateless. The model comes from `ANTHROPIC_MODEL`, defaulting to
  `claude-opus-5-5`.
- **The browser** runs the tool loop. When Claude requests a tool, the browser
  executes it against the command layer or the checker and sends the result in
  the next request.

### Tools

| Group | Tool | Maps to |
|---|---|---|
| Look | `get_level_overview` | zones with id, name, kind, size, variant, intent, check status, difficulty |
| Look | `get_zone` | text grid plus thing list for one zone |
| Look | `get_catalogue` | tiles, things and pieces in the content pack, with piece settings |
| Plan | `set_level_brief`, `add_zone`, `remove_zone`, `move_zone`, `rename_zone`, `resize_zone`, `set_zone_variant`, `set_zone_intent`, `set_zone_openings` | same-named commands |
| Build | `insert_piece`, `fill_rect`, `clear_rect`, `set_tiles`, `place_thing`, `move_thing`, `remove_thing`, `set_thing_settings`, `add_checkpoint`, `remove_checkpoint` | same-named commands |
| Check | `check_zone`, `check_level` | checker |

Tools accept a zone by ID or by name. Tool definitions are generated from the
command schemas so the two cannot drift apart.

### How Claude sees a zone

A text grid, one character per tile, with a legend and coordinates on the
edges, followed by the list of things with their positions:

```
. empty   # solid   ~ ice   H ladder   ^ spike   = one-way
```

Only zones Claude asks for are sent, which keeps requests small.

### A chat turn

1. The user's message is sent with the level overview and the currently
   selected zone attached.
2. Claude calls tools. Each edit is applied immediately, so the user watches the
   level change.
3. Before finishing, Claude must call the checker on every zone it changed and
   fix what it reports. The loop enforces this: if changed zones are unchecked
   when Claude stops, the browser runs the checker and returns the results for
   one more round.
4. Claude replies in a few plain sentences: what changed and why.
5. All edits from the turn form one undo group.

### Building a new level

The system prompt directs a three-stage order: write the brief and create the
zones with names and intents; build each zone from pieces and fine edits; check
and fix each zone. Design guidance in the prompt covers introducing a hazard
safely before combining it, alternating tension and rest, a rising difficulty
curve, and a checkpoint before the boss corridor.

### Guard rails

- **Step limit:** 40 tool calls per turn. If a changed zone still fails the
  checker at the limit, Claude's reply says so and the zone shows a warning in
  the editor.
- **Scope and tone:** the system prompt keeps the assistant on game-making, in
  short friendly language for young users, and has it decline unrelated
  requests.
- **Rate limit:** 20 requests per minute per IP on the route, held in memory.

## 8. Editor UI

One screen with three areas and a toolbar.

```
+-----------+--------------------------------+--------------+
| Zones     |  Level canvas                  |  Chat        |
|  1 Snowy  |  (selected zone, zoom + pan)   |              |
|    Path   |                                |              |
|  2 Ice    |                                |              |
|    Cave ! |                                |              |
|  + Add    +--------------------------------+              |
|           | Tiles | Enemies | Pieces | Erase| [type here] |
+-----------+--------------------------------+--------------+
  [Play]  [Play from this zone]  [Undo] [Redo]  [Export] [Import]
```

- **Zone list:** order, name, difficulty badge, warning mark on zones that fail
  the checker. Click selects, double-click renames, drag reorders, a menu
  offers resize, variant, intent and delete.
- **Canvas:** the selected zone with a tile grid. Paint and erase tiles, drop
  and drag things, stamp pieces. Entry and exit openings are marked.
- **Palette:** tabs for tiles, enemies and other things, and pieces.
- **Checker overlay:** runs after each edit to the selected zone (debounced);
  on failure the furthest reachable point is highlighted with the reason.
- **Play:** swaps the canvas for the runtime, from the level start or the
  selected zone. Escape returns to the editor.
- **Chat:** always visible; shows the conversation, streaming replies and a
  short activity line while tools run ("building Ice Cave..."). A stop button
  cancels the turn and rolls back its edits.
- **Project list:** a simple start page listing saved projects, with new,
  open, delete, and import.

## 9. Error handling

| Situation | Behaviour |
|---|---|
| No API key, network failure, rate limited | Chat shows a plain message; the manual editor keeps working |
| A chat turn fails or is stopped partway | Its command group is rolled back; the level is never left half-changed |
| Claude sends invalid tool arguments | The command returns a readable error as the tool result; Claude retries |
| Step limit reached with a failing zone | Claude says so; the zone keeps its warning mark |
| Imported or stored project is invalid | Validated with the schema; version upgrades applied; an unreadable file is refused with an explanation |
| IndexedDB write fails | A visible warning prompts the user to export a file |

## 10. Testing

Vitest for units, Playwright for the browser.

- **Model:** schema accepts valid projects and rejects each broken rule.
- **Commands:** each command applies correctly, rejects bad input, and
  apply-then-undo returns the exact original project.
- **Runtime:** scripted-input tests on the simulation (hold right for 60 steps,
  jump, assert position), covering each tile behaviour, each enemy type, damage,
  respawn and zone transition.
- **Checker:** hand-made zones known to be passable or impassable, with the
  expected failure column. A cross-check drives a scripted player along a route
  the checker approves and asserts it arrives.
- **Pieces:** every piece at every setting passes the checker on its own.
- **AI loop:** tested against a scripted fake model: tool execution, the
  forced check round, the step limit, rollback on failure and on stop.
- **AI quality:** a small set of saved prompts run by hand against the real
  model, reviewed by playing the results. Not part of the automated suite.
- **Editor:** browser tests for paint, play, undo, rename zone, export and
  import, and a chat edit using the fake model.

## 11. Later milestones

In likely order: character and enemy editor with sprite import (so "build a
level for my enemy" uses the user's own creation); asset and tileset editors;
accounts, cloud saves and publishing to a shareable link; sound, gamepad,
weapons and multi-level games with a stage select.
