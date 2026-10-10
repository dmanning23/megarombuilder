# MegaRomBuilder: a size and shot point for every pose

Date: 2026-10-10
Status: approved

## 1. Purpose

Today a character's poses share one picture size: the hero's Stand, Stand and
shoot, Run, Run and shoot, Jump, Jump and shoot, Climb and Hurt are all drawn
on the same canvas, with one hitbox position and one shot point. Kids draw
poses of very different shapes (a wide, arm-out Jump and shoot beside a narrow
Stand), so they need each pose to have its own size, and its shots to come out
where its arm is.

### Success criteria

1. A kid can make any one pose bigger or smaller without changing any other.
2. Each pose's picture lines up on the character's body in the game, so a bigger
   pose simply sticks out further around the same body.
3. Each pose has its own shot point, and shots come out at the shot point of the
   pose being shown.
4. Movement, collisions and the level checker behave exactly as before:
   nothing drawn can make a character stuck.
5. Every game made before this change opens and looks and plays the same.

### In scope

- The hero, enemies and the boss, the kid's and the content pack's
- A picture size, hitbox position and shot point per pose (animation)
- Game file format 5, and the upgrade from format 4
- The Size, Hitbox and Shot point tools, the zoom and Copy from in the editor

### Out of scope

- A hitbox size per pose (the hitbox keeps one size per character, plus the
  hero's sliding hitbox, as now)
- A size or shot point per frame (frames in one pose share them)
- A sideways shot position (shots keep coming from the hitbox's front edge)
- "Same size as..." or "use for every pose" controls

## 2. The model

- **Pose:** each animation is a pose. A pose keeps its frames and speed, and
  gains:
  - its **picture size** (width and height), within the limits its kind
    already has for that pose:
    - the hero's standing poses 12×16 to 32×32 (even sides), Slide 16×8 to
      32×16;
    - the hero's Shot (6×4) and Charged shot (12×10) stay fixed;
    - enemies 8×8 to 32×32;
    - the boss 16×16 to 48×48;
  - its **hitbox position**: where the hitbox's top-left corner sits in this
    pose's picture. The hero's Shot and Charged shot have none.
  - its **shot point** (the height below the hitbox's top that shots come out
    at), for every pose with a hitbox on a character that shoots: the hero,
    Turret, Shielded and the boss. The hero's Slide has none (the hero can't
    shoot while sliding).
- **Hitbox size:** it stays one per character (width and height), plus the
  hero's sliding hitbox size, which belongs to Slide. Its limits are as now:
  - at least 4×4;
  - the hero's at most 16 wide and 30 tall;
  - the sliding hitbox at most 14 tall.
- **Rules a look must keep, each with a kid-facing message naming the pose:**
  - every frame of a pose is its picture size;
  - the hitbox, at the pose's position, fits inside the pose's picture;
  - the pose's shot point keeps the shot inside the hitbox.

  For example: "The hero's Jump and shoot is 12 by 16; its hitbox needs 14 by
  24." and "The hero's Jump and shoot shot point is outside its hitbox."

## 3. The editor

- **Size:** Narrower, Wider, Shorter and Taller change only the chosen pose.
  - The readout shows that pose's size.
  - The picture is padded or trimmed as now: evenly at the sides, at the top,
    so the feet stay on the bottom row. The hitbox position moves with the
    pixels, then is nudged back inside the picture if a trim left it poking
    out.
  - A kid is asked first when drawing would be cut off, as now.
  - A step that would make the picture smaller than the hitbox is unavailable
    (dimmed), with the note "The hitbox needs this much room."
- **Hitbox tool:**
  - Dragging the middle of the box moves it in this pose only.
  - Dragging an edge or corner changes the hitbox's size in every pose. In each
    other pose the box keeps its bottom edge and its centre where they were, then
    is nudged inside its picture.
  - The box can't grow larger than the smallest pose's picture, nor past the
    size limits.
  - **Fit to drawing** fits the box to the chosen pose's drawing: the size
    changes in every pose (as above), and the position changes in this one.
  - On Slide the tool works on the sliding hitbox, as now.
- **Shot point tool:** dragging the line moves the chosen pose's shot point
  only.
- **Zoom:** chosen from the character's largest pose picture (whole-number zoom
  from 12 to 24, as now), so pixels stay the same size when switching poses.
- **Copy from:** a picture copied from a pose of another size is padded or
  trimmed to the chosen pose's size by the same rule as resizing. If that would
  cut off drawing, the kid is asked first.
- **Import picture** fits the import to the chosen pose's size, as now.
- **Thumbnails** in the animation list and the frame strip scale each pose to
  fit. The game preview shows the real sizes.
- **Onion skin** is unchanged: frames in a pose share a size.

## 4. In the game

- **Drawing:** each frame is drawn so its pose's hitbox position lines up with
  the character's body. Facing left, the picture mirrors around the body, as
  now.
- **Body:** the body's size never changes between poses, so walls, ladders,
  platforms, getting hit and the checker's routes behave exactly as before.
  Sliding keeps its own body, as now.
- **Shots** come out at the shot point of the pose shown at the moment of
  firing:
  - the hero's Stand and shoot, Run and shoot, Jump and shoot (in the air) or
    Climb (on a ladder);
  - Turret's Idle;
  - Shielded's Open;
  - the boss's current pose.

  The charged shot is centred on that pose's normal shot line, as now.

## 5. Files, upgrade, commands and the assistant

- **Game file format 5** stores each pose's picture size, hitbox position and
  shot point, and the hitbox sizes once. The separate canvases go.
- **Upgrade:** format 4 files upgrade on open:
  - every pose takes its old canvas group's size and the old hitbox's position;
  - every pose with a shot point takes the old one.

  So the game looks and plays the same. The snow pack's characters are
  converted the same way.
- **Look commands:**
  - Resizing, moving the hitbox and setting the shot point name the pose they
    change.
  - Setting the hitbox's size, and Fit to drawing, change the size everywhere
    and the position in the named pose.
  - Each edit is one undo step, as now.
- **The assistant** is unchanged: it speaks of the hitbox, whose size is still
  one per character.

## 6. Testing

- **Model:**
  - the upgrade gives identical pictures, body and shots for every
    character, including the snow pack's;
  - each new rule and its message;
  - resizing a pose leaves every other pose untouched;
  - hitbox size changes keep each pose's feet and centre;
  - the hitbox can't outgrow the smallest pose, and a pose can't shrink below
    the hitbox.
- **Game:**
  - a hero with a wide, tall Jump and shoot fires from that pose's shot point
    in the air and from Stand and shoot's on the ground;
  - its collisions match a hero whose poses are all one size;
  - a drawn frame lines up on the body, facing either way;
  - an enemy and the boss fire from their pose's shot point.
- **Editor:**
  - Size changes only the chosen pose;
  - the dimmed step and its note;
  - the Hitbox tool moves the box in one pose and resizes it everywhere;
  - the Shot point tool changes one pose;
  - the zoom stays put when switching poses;
  - Copy from across sizes asks before cutting.
- **Browser:** the Characters screenshots as before, plus a hero whose Jump and
  shoot is larger than its Stand.

## 7. Build order

Two plans. Changing the look's shape breaks the game and the editor at once, so
the first plan carries both:

1. **The model, the file and the game:**
   - per-pose sizes, hitbox positions and shot points;
   - the rules and messages;
   - format 5 and the upgrade;
   - the look commands;
   - the snow pack converted;
   - drawing each pose on the body;
   - shots from the shown pose's shot point;
   - the editor's existing Size, Hitbox and Shot point controls working on the
     chosen pose.
2. **The editor's new behaviour:**
   - the dimmed Size step and its note;
   - the hitbox drag limited by the smallest pose;
   - the zoom from the largest pose;
   - Copy from across sizes;
   - scaled thumbnails;
   - the browser test with a larger Jump and shoot.
