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

type Size = { w: number; h: number };
export type LookBox = { x: number; y: number; w: number; h: number };

const boxSchema = z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int().min(1), h: z.number().int().min(1) });
const rows = z.array(z.string()).min(1).max(64);
export const animationSchema = z.object({
  frames: z.array(rows).min(1).max(MAX_FRAMES),
  speed: z.enum(ANIMATION_SPEEDS),
});
export type Animation = z.infer<typeof animationSchema>;

export const lookSchema = z.object({
  colours: z
    .array(z.number().int().min(0).max(PALETTE_8BIT.length - 1))
    .min(1)
    .max(MAX_LOOK_COLOURS),
  canvases: z.record(z.string(), z.object({ w: z.number().int().min(1).max(64), h: z.number().int().min(1).max(64) })),
  animations: z.record(z.string(), animationSchema),
  body: boxSchema,
  slideBody: boxSchema.optional(),
  shotY: z.number().int().optional(),
});
export type Look = z.infer<typeof lookSchema>;

export type LookKind = "hero" | EnemyBehaviour | "boss";

export type KindRule = {
  animations: Record<string, string>; // animation → its canvas group
  canvases: Record<string, { min: Size; max: Size }>; // min = max for a fixed size
  shotHeight: number | null; // the height of its shots, or null when it doesn't shoot
};

const enemyCanvas = { main: { min: { w: 8, h: 8 }, max: { w: 32, h: 32 } } };
const enemy = (animations: string[], shotHeight: number | null = null): KindRule => ({
  animations: Object.fromEntries(animations.map((a) => [a, "main"])),
  canvases: enemyCanvas,
  shotHeight,
});

export const HERO_SHOT_H = 4;
export const ENEMY_SHOT_H = 6;
export const HERO_BODY_MAX_H = 30; // fits through the level pieces' 2-tile openings
export const SLIDE_BODY_MAX_H = 14; // fits under the crawl space's 1-tile gap
export const BODY_MIN = 4;

export const KINDS: Record<LookKind, KindRule> = {
  hero: {
    animations: {
      stand: "main",
      standShoot: "main",
      run: "main",
      runShoot: "main",
      jump: "main",
      jumpShoot: "main",
      climb: "main",
      hurt: "main",
      slide: "slide",
      shot: "shot",
      chargedShot: "chargedShot",
    },
    canvases: {
      main: { min: { w: 12, h: 16 }, max: { w: 32, h: 32 } },
      slide: { min: { w: 16, h: 8 }, max: { w: 32, h: 16 } },
      shot: { min: { w: 6, h: 4 }, max: { w: 6, h: 4 } },
      chargedShot: { min: { w: 12, h: 10 }, max: { w: 12, h: 10 } },
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
    animations: { stand: "main", jump: "main", attack: "main" },
    canvases: { main: { min: { w: 16, h: 16 }, max: { w: 48, h: 48 } } },
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

const inside = (box: LookBox, canvas: Size) =>
  box.x >= 0 && box.y >= 0 && box.x + box.w <= canvas.w && box.y + box.h <= canvas.h;

// Everything wrong with a look that the schema can't see. `name` is how messages name the character.
export function lookProblems(kind: LookKind, look: Look, name: string): string[] {
  const rule = KINDS[kind];
  const problems: string[] = [];
  const possessive = `${name}'s`;

  for (const [group, limits] of Object.entries(rule.canvases)) {
    const canvas = look.canvases[group];
    const label = group === "main" ? `${possessive} canvas` : `${possessive} ${ANIMATION_NAMES[group]?.toLowerCase() ?? group} canvas`;
    if (!canvas) {
      problems.push(`${label} is missing.`);
      continue;
    }
    const fixed = limits.min.w === limits.max.w && limits.min.h === limits.max.h;
    if (canvas.w < limits.min.w || canvas.w > limits.max.w || canvas.h < limits.min.h || canvas.h > limits.max.h) {
      problems.push(
        fixed
          ? `${label} must be ${limits.min.w} by ${limits.min.h}.`
          : `${label} is ${canvas.w} by ${canvas.h}; it can be ${limits.min.w} to ${limits.max.w} wide and ${limits.min.h} to ${limits.max.h} tall.`,
      );
    } else if (!fixed && (canvas.w % 2 !== 0 || canvas.h % 2 !== 0)) {
      problems.push(`${label} is ${canvas.w} by ${canvas.h}; its sides must be even.`);
    }
  }
  for (const group of Object.keys(look.canvases)) {
    if (!rule.canvases[group]) problems.push(`${name} has a canvas "${group}" it can't use.`);
  }

  for (const [animation, group] of Object.entries(rule.animations)) {
    const anim = look.animations[animation];
    const label = ANIMATION_NAMES[animation];
    if (!anim) {
      problems.push(`${name} has no ${label} animation.`);
      continue;
    }
    const canvas = look.canvases[group];
    if (!canvas) continue;
    anim.frames.forEach((frame, i) => {
      const where = `${possessive} ${label} frame ${i + 1}`;
      if (frame.length !== canvas.h || frame.some((row) => row.length !== canvas.w)) {
        problems.push(`${where} is not ${canvas.w} by ${canvas.h} pixels.`);
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
        problems.push(`${where} uses colour ${highest}, but ${name} only has ${count} colour${count === 1 ? "" : "s"}.`);
      }
    });
  }
  for (const animation of Object.keys(look.animations)) {
    if (!rule.animations[animation]) problems.push(`${name} has an animation "${animation}" it can't use.`);
  }

  const main = look.canvases.main;
  if (main) {
    if (look.body.w < BODY_MIN || look.body.h < BODY_MIN) problems.push(`${possessive} hitbox must be at least ${BODY_MIN} by ${BODY_MIN}.`);
    if (!inside(look.body, main)) problems.push(`${possessive} hitbox doesn't fit inside its canvas.`);
    if (kind === "hero" && look.body.h > HERO_BODY_MAX_H) {
      problems.push(`${possessive} hitbox is ${look.body.h} tall; at most ${HERO_BODY_MAX_H}, so it fits through 2-tile gaps.`);
    }
  }
  if (kind === "hero") {
    const slide = look.canvases.slide;
    if (!look.slideBody) problems.push(`${name} has no sliding hitbox.`);
    else if (slide) {
      if (look.slideBody.w < BODY_MIN || look.slideBody.h < BODY_MIN) problems.push(`${possessive} sliding hitbox must be at least ${BODY_MIN} by ${BODY_MIN}.`);
      if (!inside(look.slideBody, slide)) problems.push(`${possessive} sliding hitbox doesn't fit inside its slide canvas.`);
      if (look.slideBody.h > SLIDE_BODY_MAX_H) {
        problems.push(`${possessive} sliding hitbox is ${look.slideBody.h} tall; at most ${SLIDE_BODY_MAX_H}, so it fits under 1-tile gaps.`);
      }
    }
  } else if (look.slideBody) {
    problems.push(`${name} can't slide, so it can't have a sliding hitbox.`);
  }

  if (rule.shotHeight === null) {
    if (look.shotY !== undefined) problems.push(`${name} doesn't shoot, so it can't have a shot point.`);
  } else if (look.shotY === undefined) {
    problems.push(`${name} has no shot point.`);
  } else if (look.shotY < 0 || look.shotY > look.body.h - rule.shotHeight) {
    problems.push(`${possessive} shot point is outside its hitbox.`);
  }
  return problems;
}

// The smallest box around a picture's drawn pixels, at least BODY_MIN square and inside the canvas.
// Taller than maxH keeps its bottom (the feet). Nothing drawn: the whole canvas.
export function fitBody(rows: string[], canvas: Size, maxH: number | null): LookBox {
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
  return box;
}
