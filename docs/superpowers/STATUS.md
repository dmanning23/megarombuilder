# Project status

Last updated: 2026-10-02

## What this project is

A web tool for young Mega Man fans to build their own run-and-gun games with no
programming, with a built-in AI chat that builds and revises levels zone by
zone. Next.js and React, one AI proxy route, projects stored in the browser.

## Where things stand

Plans 1 and 2 are implemented, reviewed and merged to `main`. Plan 3 is
written and awaiting review.

There is now something to see: run `npm run dev` and open `/play` for a demo
level (running, jumping, ice, spikes, ladders, zone transitions) drawn as
coloured rectangles. There are no enemies yet and the boss room is empty.
258 tests pass; typecheck, lint and build are clean.

| Document | State |
|---|---|
| `specs/2026-10-02-playable-core-ai-level-builder-design.md` | Milestone 1 spec, approved |
| `plans/2026-10-02-plan-1-project-model-and-commands.md` | Plan 1 of 6, implemented, reviewed and merged |
| `plans/2026-10-02-plan-2-runtime-core.md` | Plan 2 of 6, implemented, reviewed and merged |
| `plans/2026-10-02-plan-3-runtime-things.md` | Plan 3 of 6, written, awaiting review |

Milestone 1 is six plans:

1. Project model and commands (done)
2. Runtime core: player, tiles, zones, camera, rendering, a playable demo level (done)
3. Runtime things: enemies, moving platforms, pickups, boss, damage
4. Snow content pack, level pieces and the checker
5. Editor UI and IndexedDB storage
6. AI assistant: proxy route, tools, chat loop

## Open items

1. Review plan 3, then implement it.
2. Review findings deferred from plan 2, to decide on:
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
3. For plan 5: the file-import code must catch `JSON.parse` errors before
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
