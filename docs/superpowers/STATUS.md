# Project status

Last updated: 2026-10-06

## What this project is

A web tool for young Mega Man fans to build their own run-and-gun games with no
programming, with a built-in AI chat that builds and revises levels zone by
zone. Next.js and React, one AI proxy route, projects stored in the browser.

## Where things stand

Plans 1 to 8 are implemented, reviewed and merged to `main`. Milestone 1 is complete.

Run `npm run dev` and open `/play` for the demo stage: running, jumping, ice,
spikes, ladders, zone transitions, six enemy types, health pickups, a moving
platform and the Blizzard Bot boss fight, drawn with the snow pack's pixel art.
Run `npm run dev` and open the home page to make a game and build it: paint tiles,
place and drag enemies and items, stamp the twelve level pieces, see each zone's
checker verdict and difficulty as you build, change a zone's length, look,
purpose and ways in and out, reorder, add and delete zones, playtest, and export
or import game files. Games are saved in the browser.
The chat beside the level builds and changes levels: ask for a change and the
assistant looks at the level, builds with pieces and small edits, checks every
zone it changed, and replies in a few sentences; one undo removes a whole turn,
and Stop puts the level back. It needs `ANTHROPIC_API_KEY` in `.env.local` (see
the README). 708 tests and 8 browser tests pass; typecheck, lint and build are clean. Browser tests: `npm run e2e`
(builds and serves on port 3100).

| Document | State |
|---|---|
| `specs/2026-10-02-playable-core-ai-level-builder-design.md` | Milestone 1 spec, approved |
| `plans/2026-10-02-plan-1-project-model-and-commands.md` | Plan 1 of 6, implemented, reviewed and merged |
| `plans/2026-10-02-plan-2-runtime-core.md` | Plan 2 of 6, implemented, reviewed and merged |
| `plans/2026-10-02-plan-3-runtime-things.md` | Plan 3, implemented, reviewed and merged |
| `plans/2026-10-02-plan-4-snow-pack-and-art.md` | Plan 4, implemented, reviewed and merged |
| `plans/2026-10-02-plan-5-pieces-and-checker.md` | Plan 5, implemented, reviewed and merged |
| `plans/2026-10-03-plan-6-editor-core.md` | Plan 6, implemented, reviewed and merged |
| `plans/2026-10-03-plan-7-editor-tools.md` | Plan 7, implemented, reviewed and merged |
| `plans/2026-10-05-plan-8-ai-assistant.md` | Plan 8, implemented, reviewed and merged |
| `specs/2026-10-06-milestone-2-your-own-hero-design.md` | Milestone 2 spec (your own hero), approved |
| `plans/2026-10-06-m2-plan-1-hero-data-and-abilities.md` | Milestone 2 plan 1 of 5, implemented, reviewed and merged |

Milestone 1 is now eight plans (the editor became two):

1. Project model and commands (done)
2. Runtime core (done)
3. Runtime things (done)
4. Snow pack and pixel art (done)
5. Level pieces and the checker (done)
6. Editor core: projects, zone list, tile painting, undo, playtest (done)
7. Editor tools: things and pieces palettes, checker overlay and badges, zone menu, export and import (done)
8. AI assistant: proxy route, tools, chat loop (done)

## Open items

1. A person needs to play `/play` through the boss fight and say whether the
   movement, enemies and boss feel right.
2. Try the assistant with a real API key using `docs/superpowers/ai-prompts.md`,
   and play what it builds.
3. Review findings deferred from plans 2 and 3, to decide on:
   - M2 plan 1: `setHeroAbilities` accepts an explicit `undefined` value and
     writes it, breaking the hero. Fix before the hero screen calls it (M2
     plan 3).
   - M2 plan 1: `setHeroPose` finds a picture's problems by name prefix
     ("Stand " also matches "Stand and shoot"); give each picture its own check.
   - M2 plan 1: an old file with no content pack id says it needs the pack
     "undefined" instead of saying the file is damaged.
   - M2 plan 1: a hero colour outside the palette is reported in the schema's
     wording, like other damaged files.
   - Plan 8: mid-stream "overloaded" errors show "Something went wrong" instead
     of "busy"; dropped connections are retried twice as if the tool input was
     unreadable.
   - Plan 8: the assistant's zone lookup compares stored names without tidying
     spaces.
   - Plan 8: the key boundary test misses relative `./server` imports; add a
     `server-only` guard to `src/ai/server/anthropic.ts`.
   - Plan 8: `/api/chat` reads the whole body before checking its size.
   - Plan 8: a thing drag that started before a chat turn and ends during it
     lands in the assistant's undo step.
   - Plan 8: the rate limit trusts `x-forwarded-for`; put a real limiter in
     front before running the app on the public internet.
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
     restart the game (fixed in plan 7); no automated test for interrupted
     strokes; the home page hides a failed save, shows "No games yet" if
     listing fails, and a double click on Make creates two games.
   - Editor tools: undoing during a thing drag shows a raw id; no feedback
     while dragging a thing; the palette tab and active tool are unrelated and
     re-clicking a piece resets its settings; zone settings assume standard
     opening lengths (matters once the AI writes other lengths); "Delete this
     zone" asks even when it can't succeed; the marker can sit on the wrong tile
     briefly after resizing a climbing zone; export names drop non-ASCII
     letters and revoke the download URL at once; same-named imports are only
     told apart by date; palette tabs lack arrow keys and check verdicts aren't
     announced; some editor-level tests are missing (checker timer reset,
     mid-stroke pause, releasing a thing off the canvas).
   - The checker still runs on the main thread; only changed zones are
     rechecked, but a very large single zone could still cause a pause.
   - Art: the hurt pose floats 2px above the ground; one row of the Frost
     Bat's second frame is a pixel short; platforms and pickups mirror
     depending on which side the player approached from; the large health
     sprite is bigger than its box; the snow cap will show as a stripe at the
     seam between stacked vertical zones; the cannon muzzle sits 1.5px below
     the shot; thing frames are not size-checked; passing art inline to
     `PlayCanvas` would restart the game on every render.

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
