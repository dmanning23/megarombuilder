import { z } from "zod";
import { lookSchema, slotOf, type Look } from "./look";
import type { PlayerSettings } from "./schema";

// The hero: what the kid chose for it (abilities, from named steps) and what it looks like.

export const HERO_POSES = ["stand", "standShoot", "run1", "run2", "jump", "jumpShoot", "climb", "hurt", "slide"] as const;
export type HeroPose = (typeof HERO_POSES)[number];

export const HERO_PICTURES = [...HERO_POSES, "shot", "chargedShot"] as const;
export type HeroPicture = (typeof HERO_PICTURES)[number];

const BODY = { w: 16, h: 24 };
export const PICTURE_SIZES: Record<HeroPicture, { w: number; h: number }> = {
  stand: BODY,
  standShoot: BODY,
  run1: BODY,
  run2: BODY,
  jump: BODY,
  jumpShoot: BODY,
  climb: BODY,
  hurt: BODY,
  slide: { w: 24, h: 16 },
  shot: { w: 6, h: 4 },
  chargedShot: { w: 12, h: 10 },
};

export const PICTURE_NAMES: Record<HeroPicture, string> = {
  stand: "Stand",
  standShoot: "Stand and shoot",
  run1: "Run 1",
  run2: "Run 2",
  jump: "Jump",
  jumpShoot: "Jump and shoot",
  climb: "Climb",
  hurt: "Hurt",
  slide: "Slide",
  shot: "Shot",
  chargedShot: "Charged shot",
};

// Where each of the hero's old pictures lives in its look: run1 and run2 are run's two frames.
export const HERO_PICTURE_SLOTS: Record<HeroPicture, { animation: string; frame: number }> = {
  stand: { animation: "stand", frame: 0 },
  standShoot: { animation: "standShoot", frame: 0 },
  run1: { animation: "run", frame: 0 },
  run2: { animation: "run", frame: 1 },
  jump: { animation: "jump", frame: 0 },
  jumpShoot: { animation: "jumpShoot", frame: 0 },
  climb: { animation: "climb", frame: 0 },
  hurt: { animation: "hurt", frame: 0 },
  slide: { animation: "slide", frame: 0 },
  shot: { animation: "shot", frame: 0 },
  chargedShot: { animation: "chargedShot", frame: 0 },
};

// ---- Abilities ----

export const SPEEDS = ["normal", "fast", "veryFast"] as const;
export const JUMPS = ["low", "normal", "high", "veryHigh"] as const;
export const HEALTHS = ["fragile", "normal", "tough"] as const;
export const SHOT_COUNTS = [1, 2, 3, 5] as const;

export const abilitiesSchema = z.object({
  speed: z.enum(SPEEDS),
  jump: z.enum(JUMPS),
  health: z.enum(HEALTHS),
  shots: z.literal(SHOT_COUNTS),
  slide: z.boolean(),
  chargeShot: z.boolean(),
});
export type Abilities = z.infer<typeof abilitiesSchema>;

export const DEFAULT_ABILITIES: Abilities = {
  speed: "normal",
  jump: "normal",
  health: "normal",
  shots: 3,
  slide: false,
  chargeShot: false,
};

// The only place ability steps become numbers. Normal everywhere is milestone 1's hero.
// Measured with the checker: low and normal jumps clear a 2-tile wall, high 3 and very high 4.
const RUN_SPEED: Record<Abilities["speed"], number> = { normal: 1.375, fast: 1.625, veryFast: 1.875 };
const JUMP_VELOCITY: Record<Abilities["jump"], number> = { low: 4.375, normal: 4.875, high: 5.375, veryHigh: 6.125 };
const MAX_HEALTH: Record<Abilities["health"], number> = { fragile: 20, normal: 28, tough: 40 };

export function heroPhysics(abilities: Abilities): PlayerSettings {
  return {
    runSpeed: RUN_SPEED[abilities.speed],
    jumpVelocity: JUMP_VELOCITY[abilities.jump],
    gravity: 0.25,
    maxFallSpeed: 7,
    ladderSpeed: 1.25,
    maxHealth: MAX_HEALTH[abilities.health],
    maxShots: abilities.shots,
    slide: abilities.slide,
    chargeShot: abilities.chargeShot,
  };
}

// The step whose value is closest (the first, on a tie); the default when the value is unreadable.
function nearest<K extends string | number>(steps: [K, number][], value: unknown, fallback: K): K {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  let best = steps[0];
  for (const step of steps) if (Math.abs(step[1] - value) < Math.abs(best[1] - value)) best = step;
  return best[0];
}

// For games saved before heroes: the steps nearest to the physics numbers they stored.
export function abilitiesFromSettings(old: unknown): Abilities {
  const s = (typeof old === "object" && old !== null ? old : {}) as Record<string, unknown>;
  const entries = <K extends string>(table: Record<K, number>) => Object.entries(table) as [K, number][];
  return {
    speed: nearest(entries(RUN_SPEED), s.runSpeed, "normal"),
    jump: nearest(entries(JUMP_VELOCITY), s.jumpVelocity, "normal"),
    health: nearest(entries(MAX_HEALTH), s.maxHealth, "normal"),
    shots: nearest(SHOT_COUNTS.map((n): [Abilities["shots"], number] => [n, n]), s.maxShots, 3),
    slide: false,
    chargeShot: false,
  };
}

// ---- Look ----

export type HeroLook = Look;

export const heroSchema = z.object({ abilities: abilitiesSchema, look: lookSchema });
export type Hero = z.infer<typeof heroSchema>;

// The hero's old pictures, read from and written to its look. A run with one frame shows it for run2.
export function pictureRows(look: Look, picture: HeroPicture): string[] {
  const { animation, frame } = HERO_PICTURE_SLOTS[picture];
  const frames = look.animations[animation].frames;
  return frames[Math.min(frame, frames.length - 1)];
}

export function withPicture(look: Look, picture: HeroPicture, rows: string[]): Look {
  const { animation, frame } = HERO_PICTURE_SLOTS[picture];
  const anim = look.animations[animation];
  const frames = anim.frames.map((f, i) => (i === Math.min(frame, anim.frames.length - 1) ? rows : f));
  return { ...look, animations: { ...look.animations, [animation]: { ...anim, frames } } };
}

// Everything wrong with one of the hero's old pictures in a look: its size, and pixels naming
// missing colours. Used by setHeroPose until the look commands replace it.
export function pictureProblems(look: Look, picture: HeroPicture): string[] {
  const name = PICTURE_NAMES[picture];
  const { w, h } = PICTURE_SIZES[picture];
  const pixels = pictureRows(look, picture);
  if (pixels.length !== h || pixels[0].length !== w) {
    return [`${name} is ${pixels[0].length} by ${pixels.length} pixels, not ${w} by ${h}.`];
  }
  const ragged = pixels.findIndex((row) => row.length !== w);
  if (ragged >= 0) return [`${name} row ${ragged + 1} is ${pixels[ragged].length} pixels wide, not ${w}.`]; // counted from 1
  const odd = [...pixels.join("")].find((ch) => ch !== "." && slotOf(ch) === 0);
  if (odd) return [`${name} has a pixel "${odd}" that is not a colour.`];
  const highest = Math.max(0, ...[...pixels.join("")].map(slotOf));
  const count = look.colours.length;
  if (highest > count) {
    return [`${name} uses colour ${highest}, but the hero only has ${count} colour${count === 1 ? "" : "s"}.`];
  }
  return [];
}
