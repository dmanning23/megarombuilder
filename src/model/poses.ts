import { fitBody, HERO_BODY_MAX_H, HERO_BODY_MAX_W, KINDS, poseBox, reframeRows, SLIDE_BODY_MAX_H, type Look, type LookBox, type LookKind, type Point, type Size } from "./look";

// Changes to one pose of a look: its picture size, and its hitbox (whose size every pose shares).

// Moves a hitbox's corner so the box lies inside the picture (to the top-left when it can't fit).
export function nudgeInside(at: Point, box: Size, picture: Size): Point {
  return { x: Math.max(0, Math.min(at.x, picture.w - box.w)), y: Math.max(0, Math.min(at.y, picture.h - box.h)) };
}

// Resizes one pose: its frames padded or trimmed evenly at the sides and at the top (the feet stay
// on the bottom row), its hitbox moving with the pixels and nudged back inside.
export function resizePose(look: Look, kind: LookKind, animation: string, w: number, h: number): Look {
  const anim = look.animations[animation];
  const box = poseBox(look, kind, animation);
  const left = Math.floor((w - anim.size.w) / 2);
  const top = h - anim.size.h;
  const at = box ? nudgeInside({ x: box.x + left, y: box.y + top }, box, { w, h }) : undefined;
  return {
    ...look,
    animations: {
      ...look.animations,
      [animation]: { ...anim, frames: anim.frames.map((rows) => reframeRows(rows, w, h)), size: { w, h }, ...(at ? { at } : {}) },
    },
  };
}

// Sets one pose's hitbox: its position there, and its size in every pose that shares it. The
// other poses keep their box's bottom edge and centre, nudged inside their pictures. Every pose
// keeps its shot point on the same row of its picture, inside the new box.
export function setPoseBody(look: Look, kind: LookKind, animation: string, box: LookBox): Look {
  const which = KINDS[kind].animations[animation].body;
  const old = which === "slide" ? look.slideBody : look.body;
  if (which === null || !old) return look;
  const size = { w: box.w, h: box.h };
  const shotHeight = KINDS[kind].shotHeight;
  const animations = Object.fromEntries(
    Object.entries(look.animations).map(([name, anim]) => {
      if (KINDS[kind].animations[name]?.body !== which || !anim.at) return [name, anim];
      const at =
        name === animation
          ? { x: box.x, y: box.y }
          : nudgeInside({ x: anim.at.x + Math.floor((old.w - box.w) / 2), y: anim.at.y + old.h - box.h }, size, anim.size);
      if (anim.shotY === undefined || shotHeight === null) return [name, { ...anim, at }];
      const shotY = Math.max(0, Math.min(anim.shotY + anim.at.y - at.y, box.h - shotHeight));
      return [name, { ...anim, at, shotY }];
    }),
  );
  return { ...look, animations, ...(which === "slide" ? { slideBody: size } : { body: size }) };
}

// The hitbox fitted to a pose's first frame. Hero hitboxes keep within their limits, and a
// shooter's stays at least as tall as its shot, growing upwards from its feet.
export function fittedPoseBody(look: Look, kind: LookKind, animation: string): LookBox {
  const anim = look.animations[animation];
  const which = KINDS[kind].animations[animation].body;
  const maxH = kind !== "hero" ? null : which === "slide" ? SLIDE_BODY_MAX_H : HERO_BODY_MAX_H;
  const maxW = kind === "hero" && which === "main" ? HERO_BODY_MAX_W : null;
  const box = fitBody(anim.frames[0], anim.size, maxH, maxW);
  const shotHeight = which === "main" ? KINDS[kind].shotHeight : null;
  if (shotHeight === null || box.h >= shotHeight) return box;
  const h = Math.min(shotHeight, anim.size.h);
  return { ...box, y: Math.max(0, box.y + box.h - h), h };
}
