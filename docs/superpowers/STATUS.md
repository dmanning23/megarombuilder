# Project status

Last updated: 2026-10-02

## What this project is

A web tool for young Mega Man fans to build their own run-and-gun games with no
programming, with a built-in AI chat that builds and revises levels zone by
zone. Next.js and React, one AI proxy route, projects stored in the browser.

## Where things stand

Plans 1 to 3 are implemented, reviewed and merged to `main`. Plan 4 is written
and awaiting review.

Run `npm run dev` and open `/play` for the demo stage: running, jumping, ice,
spikes, ladders, zone transitions, six enemy types, health pickups, a moving
platform and the Blizzard Bot boss fight, all drawn as coloured rectangles.
326 tests pass; typecheck, lint and build are clean.

| Document | State |
|---|---|
| `specs/2026-10-02-playable-core-ai-level-builder-design.md` | Milestone 1 spec, approved |
| `plans/2026-10-02-plan-1-project-model-and-commands.md` | Plan 1 of 6, implemented, reviewed and merged |
| `plans/2026-10-02-plan-2-runtime-core.md` | Plan 2 of 6, implemented, reviewed and merged |
| `plans/2026-10-02-plan-3-runtime-things.md` | Plan 3, implemented, reviewed and merged |
| `plans/2026-10-02-plan-4-snow-pack-and-art.md` | Plan 4, written, awaiting review |

Milestone 1 is now seven plans:

1. Project model and commands (done)
2. Runtime core: player, tiles, zones, camera, rendering, a playable demo level (done)
3. Runtime things: enemies, moving platforms, pickups, boss, damage (done)
4. Snow pack and pixel art
5. Level pieces and the checker
6. Editor UI and IndexedDB storage
7. AI assistant: proxy route, tools, chat loop

## Open items

1. A person needs to play `/play` through the boss fight and say whether the
   movement, enemies and boss feel right.
2. Review plan 4, then implement it. When writing plan 5 (pieces and checker),
   the checker should flag:
   a boss room without exactly one boss, a boss with no floor under it, and
   enemies placed within reach of an entry or checkpoint.
3. Review findings deferred from plans 2 and 3, to decide on:
   - Player settings have no upper bounds; a run speed or fall speed of 16 or
     more passes through walls, and a ladder speed below 1 breaks climbing down
     from a ladder top. Bound them before the editor or AI can change them.
   - An exit on the last zone leaves the player alive outside the zone.
     Validation forbids it on a boss room, but the runtime does not check.
   - A start zone with an unsafe entry is an endless death loop with no message.
   - The player can climb or jump above the top of the screen and walk there.
   - The keyboard handler blocks arrows, Z and X for the whole window, which
     will stop typing in the editor and chat (plan 5). It should ignore events
     from text fields and with Cmd/Ctrl/Alt held.
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
