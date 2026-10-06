import { z } from "zod";
import { PALETTE_8BIT } from "./palette";
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

export const MAX_COLOURS = 8;

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

const rows = z.array(z.string()).min(1).max(64);

export const heroLookSchema = z.object({
  colours: z
    .array(z.number().int().min(0).max(PALETTE_8BIT.length - 1))
    .min(1)
    .max(MAX_COLOURS),
  poses: z.record(z.enum(HERO_POSES), rows),
  shot: rows,
  chargedShot: rows,
});
export type HeroLook = z.infer<typeof heroLookSchema>;

export const heroSchema = z.object({ abilities: abilitiesSchema, look: heroLookSchema });
export type Hero = z.infer<typeof heroSchema>;

export function pictureRows(look: HeroLook, picture: HeroPicture): string[] {
  if (picture === "shot") return look.shot;
  if (picture === "chargedShot") return look.chargedShot;
  return look.poses[picture];
}

export function withPicture(look: HeroLook, picture: HeroPicture, rows: string[]): HeroLook {
  if (picture === "shot") return { ...look, shot: rows };
  if (picture === "chargedShot") return { ...look, chargedShot: rows };
  return { ...look, poses: { ...look.poses, [picture]: rows } };
}

// Everything wrong with a look that the schema cannot see: sizes, and pixels naming missing colours.
// A pixel is "." (transparent) or a digit naming a colour slot, "1" for the first.
export function lookProblems(look: HeroLook): string[] {
  const problems: string[] = [];
  for (const picture of HERO_PICTURES) {
    const name = PICTURE_NAMES[picture];
    const { w, h } = PICTURE_SIZES[picture];
    const pixels = pictureRows(look, picture);
    if (pixels.length !== h || pixels[0].length !== w) {
      problems.push(`${name} is ${pixels[0].length} by ${pixels.length} pixels, not ${w} by ${h}.`);
      continue;
    }
    const ragged = pixels.findIndex((row) => row.length !== w);
    if (ragged >= 0) {
      problems.push(`${name} row ${ragged + 1} is ${pixels[ragged].length} pixels wide, not ${w}.`); // counted from 1
      continue;
    }
    const odd = [...pixels.join("")].find((ch) => ch !== "." && !/[1-8]/.test(ch));
    if (odd) {
      problems.push(`${name} has a pixel "${odd}" that is not a colour.`);
      continue;
    }
    const highest = Math.max(0, ...[...pixels.join("")].filter((ch) => ch !== ".").map(Number));
    if (highest > look.colours.length) {
      const count = look.colours.length;
      problems.push(`${name} uses colour ${highest}, but the hero only has ${count} colour${count === 1 ? "" : "s"}.`);
    }
  }
  return problems;
}
