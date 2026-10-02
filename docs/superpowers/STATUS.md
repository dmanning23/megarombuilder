# Project status

Last updated: 2026-10-02

## What this project is

A web tool for young Mega Man fans to build their own run-and-gun games with no
programming, with a built-in AI chat that builds and revises levels zone by
zone. Next.js and React, one AI proxy route, projects stored in the browser.

## Where things stand

Plan 1 is implemented and merged to `main`: the Next.js app scaffold, the project model with validation and
import parsing, and all 22 edit commands with undo, redo and grouped rollback.
156 tests pass; typecheck and build are clean. There is no editor or game to
see in the browser yet, only a placeholder page.

| Document | State |
|---|---|
| `specs/2026-10-02-playable-core-ai-level-builder-design.md` | Milestone 1 spec, approved |
| `plans/2026-10-02-plan-1-project-model-and-commands.md` | Plan 1 of 6, implemented, reviewed and merged |
| `plans/2026-10-02-plan-2-runtime-core.md` | Plan 2 of 6, written, awaiting review |

Milestone 1 is now six plans, because the runtime was too large for one:

1. Project model and commands (done)
2. Runtime core: player, tiles, zones, camera, rendering, a playable demo level
3. Runtime things: enemies, moving platforms, pickups, boss, damage
4. Snow content pack, level pieces and the checker
5. Editor UI and IndexedDB storage
6. AI assistant: proxy route, tools, chat loop

## Open items

1. Review plan 2, then implement it.
2. For plan 5: the file-import code must catch `JSON.parse` errors before
   calling `parseProject`, which takes an already-parsed value.

The seven minor findings deferred from the plan 1 review are fixed and merged.

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
