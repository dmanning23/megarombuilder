# Project status

Last updated: 2026-10-07

## What this project is

A web tool for young Mega Man fans to build their own run-and-gun games with no
programming, with a built-in AI chat that builds and revises levels zone by
zone. Next.js and React, one AI proxy route, projects stored in the browser.

## Where things stand

Milestone 1 (plans 1 to 8), milestone 2 (your own hero, plans 1 to 5) and
milestone 3 (your own enemies and boss, plans 1 to 5) are implemented, reviewed
and merged to `main`.

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
the README). The Characters button opens Hero, Enemies and Boss tabs. The Hero tab: draw the hero picture by
picture (or import a picture and touch it up), pick its colours from the 8-bit palette, choose its abilities
(including slide and charge shot), watch the live preview, and see at once
which zones it can't finish. The assistant knows the hero: it builds levels
that use its abilities (crawl spaces only for a hero that can slide) and
changes its abilities when asked. On the Enemies tab, kids make their own
enemies (a behaviour and a name), tune them, draw or import their two frames,
watch them in a preview, and place them from the palette, where they come first
marked "Yours". On the Boss tab, kids make their own boss from the
Blizzard Bot, name it, pick its fight length and 2 or 3 of six attacks in order
(jump, dash, spread, aimed shot, rain and big shot; quicker when hurt), draw or
import its three frames, watch it fight in a preview, and put it in the boss
room. The assistant knows the kid's own enemies and boss: asked for "a level
for my Frost Fang", it makes that enemy the star, builds the boss room for the
boss's attacks, and never changes the designs (their settings come from the
Characters screen alone). Milestone 4 has begun: game files are format 4, and
every character (hero, enemies, boss) stores one shared look with canvas sizes,
up to 16 colours, named animations of 1 to 8 frames, a hitbox and a shot point,
changed by ten look commands; nothing visible has changed yet. 953 tests and 12 browser tests pass; typecheck, lint and build are clean. Browser tests: `npm run e2e`
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
| `plans/2026-10-06-m2-plan-2-slide-and-charge-shot.md` | Milestone 2 plan 2 of 5, implemented, reviewed and merged |
| `plans/2026-10-06-m2-plan-3-hero-screen.md` | Milestone 2 plan 3 of 5, implemented, reviewed and merged |
| `plans/2026-10-06-m2-plan-4-picture-import.md` | Milestone 2 plan 4 of 5, implemented, reviewed and merged |
| `plans/2026-10-06-m2-plan-5-assistant-and-hero.md` | Milestone 2 plan 5 of 5, implemented, reviewed and merged |
| `specs/2026-10-06-milestone-3-your-own-enemies-and-boss-design.md` | Milestone 3 spec (your own enemies and boss), approved |
| `plans/2026-10-06-m3-plan-1-enemy-data.md` | Milestone 3 plan 1 of 5, implemented, reviewed and merged |
| `plans/2026-10-07-m3-plan-2-enemies-tab.md` | Milestone 3 plan 2 of 5, implemented, reviewed and merged |
| `plans/2026-10-07-m3-plan-3-boss-data-and-attacks.md` | Milestone 3 plan 3 of 5, implemented, reviewed and merged |
| `plans/2026-10-07-m3-plan-4-boss-tab.md` | Milestone 3 plan 4 of 5, implemented, reviewed and merged |
| `plans/2026-10-07-m3-plan-5-assistant.md` | Milestone 3 plan 5 of 5, implemented, reviewed and merged |
| `specs/2026-10-07-milestone-4-characters-that-fit-design.md` | Milestone 4 spec (characters that fit), approved |
| `plans/2026-10-07-m4-plan-1-shared-look.md` | Milestone 4 plan 1 of 5, implemented, reviewed and merged |
| `plans/2026-10-07-m4-plan-2-animations-in-game.md` | Milestone 4 plan 2 of 5, written, waiting for approval |

Milestone 1 is now eight plans (the editor became two):

1. Project model and commands (done)
2. Runtime core (done)
3. Runtime things (done)
4. Snow pack and pixel art (done)
5. Level pieces and the checker (done)
6. Editor core: projects, zone list, tile painting, undo, playtest (done)
7. Editor tools: things and pieces palettes, checker overlay and badges, zone menu, export and import (done)
8. AI assistant: proxy route, tools, chat loop (done)

Milestone 2, your own hero, was five plans:

1. Hero data and abilities (done)
2. Slide and charge shot (done)
3. The hero screen (done)
4. Picture import (done)
5. The assistant and the hero (done)

Milestone 3, your own enemies and boss, was five plans:

1. Enemy data, the game pack, and drawing own enemies (done)
2. The Characters screen and the Enemies tab (done)
3. Boss data and the new boss attacks (done)
4. The Boss tab (done)
5. The assistant and the kid's designs (done)

## Open items

1. A person needs to play `/play` through the boss fight and say whether the
   movement, enemies and boss feel right.
2. Try the assistant with a real API key using `docs/superpowers/ai-prompts.md`
   (prompts 1–17), and play what it builds.
3. Review findings deferred in each plan's final review, to decide on:
   - M4 plan 1: runShoot is copied from run once and doesn't follow run edits;
     plan 2 must resync or mirror it before the game plays runShoot.
   - M4 plan 1: fitBody or resizeCanvas on a shooter shorter than its shot
     refuses with "shot point is outside its hitbox" instead of the real cause.
   - M4 plan 1: resizeCanvas's comment on odd differences is wrong for trims
     (unreachable: resizable sides are even); pixels.ts comments still say
     pixels are digits.
   - M3 plan 5: the assistant's boss line can name a boss that isn't there
     (the Blizzard Bot erased, or the kid's boss placed outside the boss room).
   - M3 plan 5: enemy lines say a bare "normal" or "slow" for speed; "normal
     speed" would read better.
   - M3 plan 5: the designs text says "Boss tab" where the prompt says
     "Characters screen".
   - M3 plan 5: no turn-level test of place_thing with settings on an own
     enemy; the odd-spacing test is tidied by addEnemy before describe sees it.
   - M3 plan 4: no test for undo after Delete boss (it works when traced).
   - M3 plan 4: the boss preview test checks the hero only at the end; a
     death mid-run would respawn and pass (an exhaustive check found none).
   - M3 plan 4: the attack tips aren't linked to their drop-downs for screen
     readers (aria-describedby).
   - M3 plan 4: the spec's section 8 says deleting the boss in use is "not
     offered", section 6 says "refused"; the code follows section 6.
   - M3 plan 4: the browser fight test asserts nothing after its wait; tests
     assume the boss room is the third zone.
   - M3 plan 4: Palette.tsx imports gamePack above React.
   - M3 plan 3: useBoss swaps bosses in any zone, though its refusal speaks
     of the boss room.
   - M3 plan 3: the Blizzard Bot's attacks are an in-code default, not in its
     pack settings as the spec's section 3 says.
   - M3 plan 3: setBossFrame renumbers its error by string replacement, so a
     boss named with " frame 1 " in it would get odd text.
   - M3 plan 2: no tests switch frames, enemies or tabs mid-stroke on the
     Enemies tab (it uses the same picture editor the hero tests cover).
   - M3 plan 2: the Characters tabs lack arrow-key movement; the Enemies tab's
     canvas and tools don't name their enemy for screen readers; the name box is
     unstyled.
   - M3 plan 2: the open import dialog on the Enemies tab recomputes on any
     re-render (its target is a new object each time).
   - M3 plan 1: once a game has its own enemies, the zone canvas redraws after
     every edit (the editor's game pack is memoised on the whole project).
   - M3 plan 1: a file with a placed own enemy but no design says "unknown thing
     type" rather than kid-facing words.
   - M2 plan 5: the hero sentence shows low and normal jump both as "2 tiles",
     so "jump higher" from low may skip a step; name the step in the sentence.
   - M2 plan 5: the jump heights in the hero sentence are copied by hand; add a
     test tying them to the physics.
   - M2 plan 5: setting the hero's abilities to the values they already have
     still makes the level be checked again (one extra round at most).
   - M2 plan 4: the 5 MB import limit is on file size, not pixel size; a small
     PNG of a huge solid picture decodes in full and could crash the tab.
   - M2 plan 4: SVG files are offered by the picture picker but always refused.
   - M2 plan 4: the import dialog's Remove background setting isn't reset if a
     second file is picked while it is open.
   - M2 plan 3: for 400 ms after an ability change the hero screen's note still
     shows the previous result.
   - M2 plan 3: the preview restarts on every pixel drawn, so it stays on its
     opening frames during a long stroke.
   - M2 plan 3: the hero screen doesn't show the "open in another tab" warning,
     and its canvas doesn't look locked while the assistant works.
   - M2 plan 3: colour buttons are named by number only; screen readers hear
     no colour name.
   - M2 plan 2: sliding out of a zone into a next zone whose entry is under a
     low ceiling kills at once; the checker blames "something deadly at the
     entry" instead of the missing headroom.
   - M2 plan 2: stuck reasons inside a blocked tunnel count the ceiling as a
     tall wall, and can blame an earlier low gap a sliding hero could pass.
   - M2 plan 2: the checker's slide move waits its full 600 steps in a
     dead-end tunnel.
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
