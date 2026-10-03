# Project status

Last updated: 2026-10-02

## What this project is

A web tool for young Mega Man fans to build their own run-and-gun games with no
programming, with a built-in AI chat that builds and revises levels zone by
zone. Next.js and React, one AI proxy route, projects stored in the browser.

## Where things stand

Plans 1 to 6 are implemented, reviewed and merged to `main`. Plan 7 is written
and awaiting review.

Run `npm run dev` and open `/play` for the demo stage: running, jumping, ice,
spikes, ladders, zone transitions, six enemy types, health pickups, a moving
platform and the Blizzard Bot boss fight, drawn with the snow pack's pixel art.
Run `npm run dev` and open the home page to make a game, paint its zones with the
snow tiles, rename and add zones, undo and redo, and playtest; games are saved in
the browser. The checker and the twelve level pieces have no screen yet (plan 7).
516 tests and 3 browser tests pass; typecheck, lint and build are clean. Browser
tests: `npm run e2e` (builds and serves on port 3100).

| Document | State |
|---|---|
| `specs/2026-10-02-playable-core-ai-level-builder-design.md` | Milestone 1 spec, approved |
| `plans/2026-10-02-plan-1-project-model-and-commands.md` | Plan 1 of 6, implemented, reviewed and merged |
| `plans/2026-10-02-plan-2-runtime-core.md` | Plan 2 of 6, implemented, reviewed and merged |
| `plans/2026-10-02-plan-3-runtime-things.md` | Plan 3, implemented, reviewed and merged |
| `plans/2026-10-02-plan-4-snow-pack-and-art.md` | Plan 4, implemented, reviewed and merged |
| `plans/2026-10-02-plan-5-pieces-and-checker.md` | Plan 5, implemented, reviewed and merged |
| `plans/2026-10-03-plan-6-editor-core.md` | Plan 6, implemented, reviewed and merged |
| `plans/2026-10-03-plan-7-editor-tools.md` | Plan 7, written, awaiting review |

Milestone 1 is now eight plans (the editor became two):

1. Project model and commands (done)
2. Runtime core (done)
3. Runtime things (done)
4. Snow pack and pixel art (done)
5. Level pieces and the checker (done)
6. Editor core: projects, zone list, tile painting, undo, playtest (done)
7. Editor tools: things and pieces palettes, checker overlay and badges, zone menu, export and import
8. AI assistant: proxy route, tools, chat loop

## Open items

1. A person needs to play `/play` through the boss fight and say whether the
   movement, enemies and boss feel right.
2. Review plan 7, then implement it. It also closes the JSON.parse item below
   and two plan 6 minors (Escape in a text box while playing; SELECT in the
   typing check), and the controls-live-during-play minor.
3. Review findings deferred from plans 2 and 3, to decide on:
   - Player settings have no upper bounds; a run speed or fall speed of 16 or
     more passes through walls, and a ladder speed below 1 breaks climbing down
     from a ladder top. Bound them before the editor or AI can change them.
   - An exit on the last zone leaves the player alive outside the zone.
     Validation forbids it on a boss room, but the runtime does not check.
   - A start zone with an unsafe entry is an endless death loop with no message.
   - The player can climb or jump above the top of the screen and walk there.
   - A bad level or zone id in `PlayCanvas` shows a generic error screen.
   - Shots freeze in mid-air during the death pause.
   - Checkpoints trigger through walls.
   - No permanent fuzz test; no test for a shot held across a transition.
   - Thing settings have no bounds either: an enemy shot speed of 0 piles up
     shots for ever, and odd platform speeds make platforms jump.
   - A player killed by contact can still collect a pickup on the same step.
   - A platform rising into a ceiling crushes its rider to death.
   - The boss's box is wider than a tile, so a boss placed against a wall
     starts partly inside it.
   - Enemies placed on screen at an entry or checkpoint can hit the player
     immediately.
   - No test for knockback into a pit, or that the boss fight can be won.
   - Checker: routes are recorded at 90% run speed, so they replay only in the
     checker's own simulation, not the real game; it approves routes over the
     top of the screen; difficulty divides by screens (a wider piece can score
     lower) and pits dominate the score; the boss room counts as passable once
     the player comes to rest, without checking they reach the arena floor.
   - Editor: Escape in the rename box while playing also stops playing; focus
     drops to the page after renaming and after stopping play; F2 is the only
     keyboard way to rename and does not select the name; right and middle
     clicks paint; Undo, Redo, rename and Add a zone stay live during play and
     restart the game; no automated test for interrupted strokes; the home
     page hides a failed save, shows "No games yet" if listing fails, and a
     double click on Make creates two games.
   - Art: the hurt pose floats 2px above the ground; one row of the Frost
     Bat's second frame is a pixel short; platforms and pickups mirror
     depending on which side the player approached from; the large health
     sprite is bigger than its box; the snow cap will show as a stripe at the
     seam between stacked vertical zones; the cannon muzzle sits 1.5px below
     the shot; thing frames are not size-checked; passing art inline to
     `PlayCanvas` would restart the game on every render.
4. For plan 5: the file-import code must catch `JSON.parse` errors before
   calling `parseProject`, which takes an already-parsed value.

## Decisions made in conversation that the spec records

- Web app; games shared by link later.
- First milestone is the playable core plus the AI level builder, using built-in
  starter art. Asset and character editors come after.
- Levels are a single chain of named zones made of screen-sized rooms, ending in
  a boss corridor and boss room.
- One complete snow/ice content pack with original placeholder art. No Capcom
  assets.
- The AI plans at design level, builds from parameterised pieces plus fine
  edits, and a checker confirms each zone can be crossed.
- The game runtime is our own code, not a game engine, so the checker and tests
  share its physics.
