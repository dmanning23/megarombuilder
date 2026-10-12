import { z } from "zod";
import type { EnemyBehaviour } from "./designs";
import { PALETTE_8BIT } from "./palette";

// One look for every character: the hero, enemies and the boss, the kid's and the content pack's.

export const MAX_LOOK_COLOURS = 16;
export const MAX_FRAMES = 8;
export const ANIMATION_SPEEDS = ["slow", "normal", "fast"] as const;
export type AnimationSpeed = (typeof ANIMATION_SPEEDS)[number];

// A pixel is "." (clear) or one character naming a colour slot: "1" to "9", then "a" to "g".
export const PIXEL_SLOTS = "123456789abcdefg";
export const slotChar = (slot: number): string => PIXEL_SLOTS[slot - 1];
export const slotOf = (ch: string): number => (ch === "." ? 0 : PIXEL_SLOTS.indexOf(ch) + 1);

export type Size = { w: number; h: number };
export type Point = { x: number; y: number };
export type LookBox = { x: number; y: number; w: number; h: number };

const sizeSchema = z.object({ w: z.number().int().min(1).max(64), h: z.number().int().min(1).max(64) });
const rows = z.array(z.string()).min(1).max(64);
// A pose: its frames and speed, its own picture size, where the hitbox sits in that picture, and
// (for a pose with the standing hitbox, on a character that shoots) where shots come out.
export const animationSchema = z.object({
  frames: z.array(rows).min(1).max(MAX_FRAMES),
  speed: z.enum(ANIMATION_SPEEDS),
  size: sizeSchema,
  at: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
  shotY: z.number().int().optional(), // below the hitbox's top
});
export type Animation = z.infer<typeof animationSchema>;

// The hitbox sizes are the character's, the same in every pose: its body never changes size.
const bodySchema = z.object({ w: z.number().int().min(1), h: z.number().int().min(1) });
export const lookSchema = z.object({
  colours: z
    .array(z.number().int().min(0).max(PALETTE_8BIT.length - 1))
    .min(1)
    .max(MAX_LOOK_COLOURS),
  animations: z.record(z.string(), animationSchema),
  body: bodySchema,
  slideBody: bodySchema.optional(),
});
export type Look = z.infer<typeof lookSchema>;

export type LookKind = "hero" | EnemyBehaviour | "boss";

export type BodyName = "main" | "slide";
// One pose's rule: which hitbox it carries (none for the hero's shots), and its picture's limits.
export type PoseRule = { body: BodyName | null; min: Size; max: Size };
export type KindRule = {
  animations: Record<string, PoseRule>;
  shotHeight: number | null; // the height of its shots, or null when it doesn't shoot
};

const poseRule = (body: BodyName | null, min: Size, max: Size): PoseRule => ({ body, min, max });
const ENEMY_POSE = poseRule("main", { w: 8, h: 8 }, { w: 32, h: 32 });
const enemy = (animations: string[], shotHeight: number | null = null): KindRule => ({
  animations: Object.fromEntries(animations.map((a) => [a, ENEMY_POSE])),
  shotHeight,
});
const HERO_POSE = poseRule("main", { w: 12, h: 16 }, { w: 32, h: 32 });
const BOSS_POSE = poseRule("main", { w: 16, h: 16 }, { w: 48, h: 48 });

export const HERO_SHOT_H = 4;
export const ENEMY_SHOT_H = 6;
export const HERO_BODY_MAX_H = 30; // fits through the level pieces' 2-tile openings
export const SLIDE_BODY_MAX_H = 14; // fits under the crawl space's 1-tile gap
export const BODY_MIN = 4;
export const HERO_BODY_MAX_W = 16; // centred on a ladder's tile, beside the ladder pieces' wall

export const KINDS: Record<LookKind, KindRule> = {
  hero: {
    animations: {
      stand: HERO_POSE,
      standShoot: HERO_POSE,
      run: HERO_POSE,
      runShoot: HERO_POSE,
      jump: HERO_POSE,
      jumpShoot: HERO_POSE,
      climb: HERO_POSE,
      hurt: HERO_POSE,
      slide: poseRule("slide", { w: 16, h: 8 }, { w: 32, h: 16 }),
      shot: poseRule(null, { w: 6, h: 4 }, { w: 6, h: 4 }),
      chargedShot: poseRule(null, { w: 12, h: 10 }, { w: 12, h: 10 }),
      chargedShot2: poseRule(null, { w: 16, h: 12 }, { w: 16, h: 12 }),
    },
    shotHeight: HERO_SHOT_H,
  },
  walker: enemy(["walk"]),
  flyer: enemy(["fly"]),
  turret: enemy(["idle"], ENEMY_SHOT_H),
  jumper: enemy(["ground", "air"]),
  shielded: enemy(["closed", "open"], ENEMY_SHOT_H),
  dropper: enemy(["hang", "fall"]),
  boss: {
    animations: { stand: BOSS_POSE, jump: BOSS_POSE, attack: BOSS_POSE },
    shotHeight: ENEMY_SHOT_H,
  },
};

export const ANIMATION_NAMES: Record<string, string> = {
  stand: "Stand",
  standShoot: "Stand and shoot",
  run: "Run",
  runShoot: "Run and shoot",
  jump: "Jump",
  jumpShoot: "Jump and shoot",
  climb: "Climb",
  hurt: "Hurt",
  slide: "Slide",
  shot: "Shot",
  chargedShot: "Charged shot",
  chargedShot2: "Level 2 shot",
  walk: "Walk",
  fly: "Fly",
  idle: "Idle",
  ground: "On the ground",
  air: "In the air",
  closed: "Shield closed",
  open: "Shield open",
  hang: "Hang",
  fall: "Fall",
  attack: "Attack",
};

// The animation a body is fitted to: the kind's first.
export const firstStanding = (kind: LookKind): string => Object.keys(KINDS[kind].animations)[0];

export const isFixed = (rule: PoseRule): boolean => rule.min.w === rule.max.w && rule.min.h === rule.max.h;

export const hasShotPoint = (kind: LookKind, animation: string): boolean =>
  KINDS[kind].shotHeight !== null && KINDS[kind].animations[animation]?.body === "main";

// The poses a character fires from: the pose the game shows as a shot comes out
// (src/runtime/sim/pose.ts chooses it). Only these offer the Shot point tool.
const FIRING: Partial<Record<LookKind, string[]>> = {
  hero: ["standShoot", "runShoot", "jumpShoot", "climb", "hurt"],
  turret: ["idle"],
  shielded: ["open"],
  boss: ["attack"],
};
export const firesFrom = (kind: LookKind, animation: string): boolean => FIRING[kind]?.includes(animation) ?? false;

const bodyOf = (look: Look, which: BodyName | null | undefined): Size | undefined =>
  which === "main" ? look.body : which === "slide" ? look.slideBody : undefined;

// A pose's hitbox in its own picture's pixels, or null for a pose without one.
export function poseBox(look: Look, kind: LookKind, animation: string): LookBox | null {
  const at = look.animations[animation]?.at;
  const size = bodyOf(look, KINDS[kind].animations[animation]?.body);
  return at && size ? { ...at, ...size } : null;
}

// Every pose's shot point, by animation.
export const shotPoints = (look: Look): Record<string, number> =>
  Object.fromEntries(Object.entries(look.animations).flatMap(([name, a]) => (a.shotY === undefined ? [] : [[name, a.shotY]])));

const inside = (box: LookBox, canvas: Size) =>
  box.x >= 0 && box.y >= 0 && box.x + box.w <= canvas.w && box.y + box.h <= canvas.h;

// Everything wrong with a look that the schema can't see. `name` is how messages name the character.
// The character-wide checks come first (commands report the first problem), then each pose.
export function lookProblems(kind: LookKind, look: Look, name: string): string[] {
  const rule = KINDS[kind];
  const problems: string[] = [];
  const possessive = `${name}'s`;

  if (look.body.w < BODY_MIN || look.body.h < BODY_MIN) problems.push(`${possessive} hitbox must be at least ${BODY_MIN} by ${BODY_MIN}.`);
  if (kind === "hero" && look.body.h > HERO_BODY_MAX_H) {
    problems.push(`${possessive} hitbox is ${look.body.h} tall; at most ${HERO_BODY_MAX_H}, so it fits through 2-tile gaps.`);
  }
  if (kind === "hero" && look.body.w > HERO_BODY_MAX_W) {
    problems.push(`${possessive} hitbox is ${look.body.w} wide; at most ${HERO_BODY_MAX_W}, so it fits on a ladder beside a wall.`);
  }
  if (kind === "hero") {
    if (!look.slideBody) problems.push(`${name} has no sliding hitbox.`);
    else {
      if (look.slideBody.w < BODY_MIN || look.slideBody.h < BODY_MIN) problems.push(`${possessive} sliding hitbox must be at least ${BODY_MIN} by ${BODY_MIN}.`);
      if (look.slideBody.h > SLIDE_BODY_MAX_H) {
        problems.push(`${possessive} sliding hitbox is ${look.slideBody.h} tall; at most ${SLIDE_BODY_MAX_H}, so it fits under 1-tile gaps.`);
      }
    }
  } else if (look.slideBody) {
    problems.push(`${name} can't slide, so it can't have a sliding hitbox.`);
  }

  for (const [animation, limits] of Object.entries(rule.animations)) {
    const anim = look.animations[animation];
    const label = ANIMATION_NAMES[animation];
    const pose = `${possessive} ${label}`;
    if (!anim) {
      problems.push(`${name} has no ${label} animation.`);
      continue;
    }
    const { w, h } = anim.size;
    const fixed = isFixed(limits);
    if (w < limits.min.w || w > limits.max.w || h < limits.min.h || h > limits.max.h) {
      problems.push(
        fixed
          ? `${pose} must be ${limits.min.w} by ${limits.min.h}.`
          : `${pose} is ${w} by ${h}; it can be ${limits.min.w} to ${limits.max.w} wide and ${limits.min.h} to ${limits.max.h} tall.`,
      );
    } else if (!fixed && (w % 2 !== 0 || h % 2 !== 0)) {
      problems.push(`${pose} is ${w} by ${h}; its sides must be even.`);
    }
    anim.frames.forEach((frame, i) => {
      const where = `${pose} frame ${i + 1}`;
      if (frame.length !== h || frame.some((row) => row.length !== w)) {
        problems.push(`${where} is not ${w} by ${h} pixels.`);
        return;
      }
      const pixels = [...frame.join("")];
      const odd = pixels.find((ch) => ch !== "." && slotOf(ch) === 0);
      if (odd) {
        problems.push(`${where} has a pixel "${odd}" that is not a colour.`);
        return;
      }
      const highest = Math.max(0, ...pixels.map(slotOf));
      const count = look.colours.length;
      if (highest > count) {
        problems.push(`${where} uses colour ${highest}, but ${name.replace(/^The /, "the ")} only has ${count} colour${count === 1 ? "" : "s"}.`);
      }
    });
    const size = bodyOf(look, limits.body);
    if (limits.body === null) {
      if (anim.at) problems.push(`${pose} can't have a hitbox.`);
    } else if (!anim.at) {
      problems.push(`${pose} has no hitbox position.`);
    } else if (size) {
      if (size.w > w || size.h > h) problems.push(`${pose} is ${w} by ${h}; its hitbox needs ${size.w} by ${size.h}.`);
      else if (!inside({ ...anim.at, ...size }, anim.size)) problems.push(`${pose} hitbox doesn't fit inside its picture.`);
    }
    if (hasShotPoint(kind, animation)) {
      if (anim.shotY === undefined) problems.push(`${pose} has no shot point.`);
      else if (anim.shotY < 0 || anim.shotY > look.body.h - rule.shotHeight!) problems.push(`${pose} shot point is outside its hitbox.`);
    } else if (anim.shotY !== undefined) {
      problems.push(rule.shotHeight === null ? `${name} doesn't shoot, so it can't have a shot point.` : `${pose} can't have a shot point.`);
    }
  }
  for (const animation of Object.keys(look.animations)) {
    if (!rule.animations[animation]) problems.push(`${name} has an animation "${animation}" it can't use.`);
  }
  return [...new Set(problems)];
}

// The smallest box around a picture's drawn pixels, at least BODY_MIN square and inside the canvas.
// Taller than maxH keeps its bottom (the feet). Nothing drawn: the whole canvas.
export function fitBody(rows: string[], canvas: Size, maxH: number | null, maxW: number | null = null): LookBox {
  let left = canvas.w;
  let top = canvas.h;
  let right = -1;
  let bottom = -1;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }),
  );
  let box: LookBox = right < 0 ? { x: 0, y: 0, w: canvas.w, h: canvas.h } : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
  const grow = (start: number, length: number, limit: number): [number, number] => {
    if (length >= BODY_MIN) return [start, length];
    const extra = BODY_MIN - length;
    const from = Math.max(0, Math.min(limit - BODY_MIN, start - Math.floor(extra / 2)));
    return [from, BODY_MIN];
  };
  [box.x, box.w] = grow(box.x, box.w, canvas.w);
  [box.y, box.h] = grow(box.y, box.h, canvas.h);
  if (maxH !== null && box.h > maxH) box = { ...box, y: box.y + box.h - maxH, h: maxH };
  if (maxW !== null && box.w > maxW) box = { ...box, x: box.x + Math.floor((box.w - maxW) / 2), w: maxW }; // around its middle
  return box;
}

// A look moved to another kind of enemy: its poses (each with its size and hitbox position), hitbox
// and colours stay, and its frames move across by position (one animation into two: the first
// frame, then the rest; two into one: all of them in order, fitted to the first pose's size). A
// shot point is kept, added at the middle of the hitbox, or dropped, in each pose.
export function lookForKind(look: Look, from: LookKind, to: LookKind): Look {
  const olds = Object.keys(KINDS[from].animations).map((a) => look.animations[a]);
  const names = Object.keys(KINDS[to].animations);
  let groups: Animation[];
  if (olds.length === names.length) groups = olds;
  else if (olds.length === 1) {
    const [first, ...rest] = olds[0].frames;
    groups = [{ ...olds[0], frames: [first] }, ...names.slice(1).map(() => ({ ...olds[0], frames: rest.length > 0 ? rest : [first] }))];
  } else {
    const { w, h } = olds[0].size;
    groups = [{ ...olds[0], frames: olds.flatMap((a) => a.frames.map((f) => reframeRows(f, w, h))).slice(0, MAX_FRAMES) }];
  }
  const shotHeight = KINDS[to].shotHeight;
  const middle = shotHeight === null ? 0 : Math.round(look.body.h / 2) - Math.round(shotHeight / 2);
  const highest = shotHeight === null ? 0 : Math.max(0, look.body.h - shotHeight);
  const animations = Object.fromEntries(
    names.map((name, i) => {
      const { shotY, ...pose } = groups[i] ?? groups[0];
      if (shotHeight === null) return [name, pose];
      return [name, { ...pose, shotY: Math.max(0, Math.min(shotY ?? middle, highest)) }];
    }),
  );
  return { ...look, animations };
}

// Pads or trims a frame: evenly at the left and right (the odd pixel on the right), and at the
// top only, so the bottom row (the feet) stays the bottom row.
export function reframeRows(rows: string[], w: number, h: number): string[] {
  const oldW = rows[0].length;
  const left = Math.floor((w - oldW) / 2);
  const widened = rows.map((row) => {
    if (left >= 0) return ".".repeat(left) + row + ".".repeat(w - oldW - left);
    return row.slice(-left, -left + w);
  });
  const dy = h - widened.length;
  return dy >= 0 ? [...Array.from({ length: dy }, () => ".".repeat(w)), ...widened] : widened.slice(-dy);
}

const drawn = (frames: string[][]) => frames.reduce((n, rows) => n + rows.join("").replace(/\./g, "").length, 0);

// Whether padding or trimming rows to a size would cut off any drawn pixel.
export const cutsRows = (rows: string[], w: number, h: number): boolean => drawn([reframeRows(rows, w, h)]) < drawn([rows]);

// Whether resizing a pose would cut off any drawn pixel of its frames.
export function cutsDrawing(look: Look, animation: string, w: number, h: number): boolean {
  return look.animations[animation].frames.some((rows) => cutsRows(rows, w, h));
}
