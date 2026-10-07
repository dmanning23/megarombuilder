import { z } from "zod";
import { MAX_COLOURS } from "./hero";
import { nearestColour, PALETTE_8BIT } from "./palette";

// The kid's own enemies and boss: what they chose (named steps), and what they drew.

export const ENEMY_BEHAVIOURS = ["walker", "flyer", "turret", "jumper", "shielded", "dropper"] as const;
export type EnemyBehaviour = (typeof ENEMY_BEHAVIOURS)[number];

export const MAX_ENEMIES = 12;
export const ENEMY_FRAME = { w: 16, h: 16 };
export const BOSS_FRAME = { w: 24, h: 28 };

// ---- Tuning ----

export const HEALTH_STEPS = [1, 2, 3, 5] as const;
export const DAMAGE_STEPS = ["low", "normal", "high"] as const;
export const SPEED_STEPS = ["slow", "normal", "fast"] as const;
export const SHOOT_STEPS = ["rarely", "sometimes", "often"] as const;

export const enemyTuningSchema = z.object({
  health: z.literal(HEALTH_STEPS),
  damage: z.enum(DAMAGE_STEPS),
  speed: z.enum(SPEED_STEPS),
  shoots: z.enum(SHOOT_STEPS),
});
export type EnemyTuning = z.infer<typeof enemyTuningSchema>;

// The steps each behaviour uses. The others are kept (so changing behaviour loses nothing) but do nothing.
export const TUNING_USED: Record<EnemyBehaviour, (keyof EnemyTuning)[]> = {
  walker: ["health", "damage", "speed"],
  flyer: ["health", "damage", "speed"],
  turret: ["health", "damage", "shoots"],
  jumper: ["health", "damage", "speed"],
  shielded: ["health", "damage", "speed", "shoots"],
  dropper: ["health", "damage"],
};

// A new enemy starts as tough as its snow counterpart (the runtime's own health for that behaviour).
export const DEFAULT_HEALTH: Record<EnemyBehaviour, EnemyTuning["health"]> = {
  walker: 1,
  flyer: 1,
  turret: 3,
  jumper: 2,
  shielded: 2,
  dropper: 1,
};

export const defaultTuning = (behaviour: EnemyBehaviour): EnemyTuning => ({
  health: DEFAULT_HEALTH[behaviour],
  damage: "normal",
  speed: "normal",
  shoots: "sometimes",
});

const DAMAGE: Record<EnemyTuning["damage"], number> = { low: 1, normal: 2, high: 4 };
const SPEED: Record<EnemyTuning["speed"], number> = { slow: 2 / 3, normal: 1, fast: 1.5 };
const SHOOT: Record<EnemyTuning["shoots"], number> = { rarely: 2, sometimes: 1, often: 0.5 }; // times the interval

// The runtime's own numbers for a normal enemy of each behaviour.
const BASE_SPEED: Partial<Record<EnemyBehaviour, { key: string; value: number }>> = {
  walker: { key: "speed", value: 0.5 },
  flyer: { key: "speed", value: 0.75 },
  jumper: { key: "hop", value: 1 },
  shielded: { key: "speed", value: 0.4 },
};
const BASE_INTERVAL: Partial<Record<EnemyBehaviour, number>> = { turret: 90, shielded: 120 };

// The only place tuning steps become numbers: the thing settings the runtime reads.
export function tuningSettings(behaviour: EnemyBehaviour, tuning: EnemyTuning): Record<string, number> {
  const settings: Record<string, number> = { health: tuning.health, damage: DAMAGE[tuning.damage] };
  const speed = BASE_SPEED[behaviour];
  if (speed) settings[speed.key] = speed.value * SPEED[tuning.speed];
  const interval = BASE_INTERVAL[behaviour];
  if (interval !== undefined) {
    settings.interval = interval * SHOOT[tuning.shoots];
    settings.shotDamage = DAMAGE[tuning.damage];
  }
  return settings;
}

// ---- Looks ----

const rows = z.array(z.string()).min(1).max(64);
const colours = z
  .array(z.number().int().min(0).max(PALETTE_8BIT.length - 1))
  .min(1)
  .max(MAX_COLOURS);

export const enemyLookSchema = z.object({ colours, frames: z.tuple([rows, rows]) });
export const bossLookSchema = z.object({ colours, frames: z.tuple([rows, rows, rows]) });
export type DesignLook = { colours: number[]; frames: string[][] };

const id = z.string().min(1).max(64); // as MAX_ID_LENGTH
const name = z.string().min(1).max(40); // as MAX_NAME_LENGTH

export const enemyDesignSchema = z.object({
  id,
  name,
  behaviour: z.enum(ENEMY_BEHAVIOURS),
  tuning: enemyTuningSchema,
  look: enemyLookSchema,
});
export type EnemyDesign = z.infer<typeof enemyDesignSchema>;

export const BOSS_ATTACKS = ["jump", "dash", "spread", "aimed", "rain", "big"] as const;
export type BossAttack = (typeof BOSS_ATTACKS)[number];
export const BOSS_FIGHTS = ["short", "normal", "long"] as const;

export const bossDesignSchema = z.object({
  name,
  fight: z.enum(BOSS_FIGHTS),
  attacks: z.array(z.enum(BOSS_ATTACKS)).min(2).max(3),
  look: bossLookSchema,
});
export type BossDesign = z.infer<typeof bossDesignSchema>;

// Everything wrong with a design's frames that the schema can't see.
export function framesProblems(name: string, look: DesignLook, size: { w: number; h: number }): string[] {
  const problems: string[] = [];
  look.frames.forEach((frame, i) => {
    const label = `${name} frame ${i + 1}`;
    if (frame.length !== size.h || frame.some((row) => row.length !== size.w)) {
      problems.push(`${label} is not ${size.w} by ${size.h} pixels.`);
      return;
    }
    const pixels = frame.join("");
    const odd = [...pixels].find((ch) => ch !== "." && !/[1-8]/.test(ch));
    if (odd) {
      problems.push(`${label} has a pixel "${odd}" that is not a colour.`);
      return;
    }
    const highest = Math.max(0, ...[...pixels].filter((ch) => ch !== ".").map(Number));
    const count = look.colours.length;
    if (highest > count) {
      problems.push(`${label} uses colour ${highest}, but ${name} only has ${count} colour${count === 1 ? "" : "s"}.`);
    }
  });
  return problems;
}

// Pixel art written in palette letters (as the snow pack's) as a look: each letter's colour snapped
// to the 8-bit palette, and letters that snap to the same colour sharing a slot.
export function lettersToLook(frames: string[][], palette: Record<string, string>): DesignLook {
  const colours: number[] = [];
  const slotOf = (ch: string): string => {
    const index = nearestColour(palette[ch]);
    let slot = colours.indexOf(index);
    if (slot < 0) {
      colours.push(index);
      slot = colours.length - 1;
    }
    return String(slot + 1);
  };
  const converted = frames.map((frame) => frame.map((row) => [...row].map((ch) => (ch === "." ? "." : slotOf(ch))).join("")));
  if (colours.length > MAX_COLOURS) throw new Error(`This art uses more than ${MAX_COLOURS} colours.`);
  return { colours, frames: converted };
}
