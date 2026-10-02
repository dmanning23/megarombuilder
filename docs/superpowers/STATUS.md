# Project status

Last updated: 2026-10-02

## What this project is

A web tool for young Mega Man fans to build their own run-and-gun games with no
programming, with a built-in AI chat that builds and revises levels zone by
zone. Next.js and React, one AI proxy route, projects stored in the browser.

## Where things stand

Plan 1 is implemented on the branch `plan-1-model-and-commands` (not yet merged
to `main`): the Next.js app scaffold, the project model with validation and
import parsing, and all 22 edit commands with undo, redo and grouped rollback.
143 tests pass; typecheck and build are clean. There is no editor or game to
see in the browser yet, only a placeholder page.

| Document | State |
|---|---|
| `specs/2026-10-02-playable-core-ai-level-builder-design.md` | Milestone 1 spec, approved |
| `plans/2026-10-02-plan-1-project-model-and-commands.md` | Plan 1 of 5, implemented and reviewed |

Milestone 1 is split into five plans. Plans 2 to 5 are not written yet:

1. Project model and commands (done)
2. Runtime: simulation, rendering, a playable hand-made level
3. Snow content pack, level pieces and the checker
4. Editor UI and IndexedDB storage
5. AI assistant: proxy route, tools, chat loop

## Open items

1. Merge `plan-1-model-and-commands` into `main`.
2. Write plan 2 (runtime).
3. Review findings deferred from plan 1, to decide on:
   - Zone names differing only by internal spaces ("Zone  1") count as different.
   - Fractional coordinates are refused with a technical message.
   - A command that changes nothing still adds an undo step.
   - Import accepts untrimmed or over-long names that commands would refuse.
   - `removeCheckpoint` on a missing zone says "no checkpoint" instead of "no zone".
   - A history test's name mentions redo but does not assert it.
   - A zone's entry and exit can be the same opening.
4. For plan 4: the file-import code must catch `JSON.parse` errors before
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
