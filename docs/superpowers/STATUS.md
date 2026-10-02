# Project status

Last updated: 2026-10-02

## What this project is

A web tool for young Mega Man fans to build their own run-and-gun games with no
programming, with a built-in AI chat that builds and revises levels zone by
zone. Next.js and React, one AI proxy route, projects stored in the browser.

## Where things stand

No application code exists yet. Design and planning are done for the first step.

| Document | State |
|---|---|
| `specs/2026-10-02-playable-core-ai-level-builder-design.md` | Milestone 1 spec, approved |
| `plans/2026-10-02-plan-1-project-model-and-commands.md` | Plan 1 of 5, written, awaiting review |

Milestone 1 is split into five plans. Only plan 1 is written:

1. Project model and commands
2. Runtime: simulation, rendering, a playable hand-made level
3. Snow content pack, level pieces and the checker
4. Editor UI and IndexedDB storage
5. AI assistant: proxy route, tools, chat loop

## Open items before implementation starts

1. **Plan 1 review.** Not yet approved.
2. **Execution method.** Not yet chosen. The recommendation was native: one
   session implements all nine tasks, then one fresh reviewer checks the branch.

Settled: the folder is now `megarombuilder`, and plan 1 Task 1 generates the app
with `create-next-app`.

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
