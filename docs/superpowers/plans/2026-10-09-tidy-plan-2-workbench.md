# Character Editor Tidy-up, Plan 2 (revised): The Workbench

Replaces `2026-10-08-tidy-plan-2-paint-layout.md` (not built). Spec: section 8 of
`docs/superpowers/specs/2026-10-08-character-editor-cleanup-design.md`.
Executed natively with TDD, screenshot checks at 1280, 1600 and phone width, and one
whole-branch review.

## Tasks

1. **A sorted, compact palette.** `paletteColumns(): number[][]` in `src/model/palette.ts`
   (pure; greys first, black to white; then hue columns, each dark to light; every index
   once). `Colours` shows the slots as a small row and the palette as a grid of those
   columns, small squares, keeping the names "Colour N", "8-bit colour N", "Add a
   colour", "Remove colour N". Tests: the column rules and that every colour appears
   once; the component still recolours a slot.
2. **A canvas that grows.** `chooseZoom(space, picture)` (12–24, whole numbers) in
   `src/editor/hero/zoom.ts`; `drawPixels`, `PixelCanvas` and `PictureEditor` take a
   `zoom`. Tests: `chooseZoom`'s range and fit; drawing at a zoom.
3. **How it plays.** A `SettingsDrawer` component (button with `aria-expanded`, a
   labelled `aside` "How it plays", Done). The Hero, Enemies and Boss tabs move their
   settings into it; the enemy chips and New enemy move to the tab row. Tests: closed at
   first; opens and closes; holds each tab's settings; existing tests open it first.
4. **The workbench layout.** `AnimationEditor` and `PictureEditor` regrouped into the
   three columns and the dark light table (frames-and-playback strip, tool column,
   canvas measured for zoom, picture bar with Size); CSS; the browser test screenshots
   the whole panel at three sizes with no sideways overflow. Tests: Fit to drawing and
   Size in the picture bar; Colours and Preview in the right column.
