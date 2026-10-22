import { z } from "zod";
import { KINDS, lookSchema, MAX_LOOK_COLOURS, slotChar, type Look, type LookBox } from "./look";
import { nearestColour } from "./palette";

// The kid's own enemies and boss: what they chose (named steps), and what they drew.

export const ENEMY_BEHAVIOURS = ["walker", "flyer", "turret", "jumper", "shielded", "dropper", "sniper"] as const;
export type EnemyBehaviour = (typeof ENEMY_BEHAVIOURS)[number];

export const MAX_ENEMIES = 12;
export const ENEMY_FRAME = { w: 16, h: 16 };
export const BOSS_FRAME = { w: 24, h: 28 };

// ---- Tuning ----

export const HEALTH_STEPS = [1, 2, 3, 5, 8, 12] as const;
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
  sniper: ["health", "damage"], // it shoots on a fixed beat
};

// A new enemy starts as tough as its snow counterpart (the runtime's own health for that behaviour).
export const DEFAULT_HEALTH: Record<EnemyBehaviour, EnemyTuning["health"]> = {
  walker: 1,
  flyer: 1,
  turret: 3,
  jumper: 2,
  shielded: 2,
  dropper: 1,
  sniper: 8,
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
  if (behaviour === "sniper") settings.shotDamage = DAMAGE[tuning.damage]; // it shoots, on a fixed beat
  return settings;
}

// ---- Looks ----

export type DesignLook = { colours: number[]; frames: string[][] };

// Each behaviour's body today, in a 16 by 16 picture: centred, feet on the bottom. The boss fills its 24 by 28.
const body = (w: number, h: number): LookBox => ({ x: (16 - w) / 2, y: 16 - h, w, h });
export const DESIGN_BODIES: Record<EnemyBehaviour | "boss", LookBox> = {
  walker: body(14, 14),
  flyer: body(14, 12),
  turret: body(14, 14),
  jumper: body(14, 14),
  shielded: body(14, 16),
  dropper: body(14, 12),
  sniper: body(14, 16),
  boss: { x: 0, y: 0, w: 24, h: 28 },
};
// Where enemy shots come out today: the middle of the body (an enemy shot is 6 high).
export const DESIGN_SHOT_Y: Partial<Record<EnemyBehaviour | "boss", number>> = { turret: 4, shielded: 5, sniper: 9, boss: 11 }; // the Sniper fires low, to be jumped

// Where an enemy's or boss's old frame lives in its look. Walk, fly and idle took both old frames.
export function designFrameSlot(kind: EnemyBehaviour | "boss", index: number): { animation: string; frame: number } {
  const animations = Object.keys(KINDS[kind].animations);
  return animations.length === 1 ? { animation: animations[0], frame: index } : { animation: animations[index], frame: 0 };
}

const OLD_FRAME_COUNT = (kind: EnemyBehaviour | "boss") => (kind === "boss" ? 3 : 2);

// An enemy's or boss's frames in the old order (two for an enemy, three for the boss). Used until
// the game and the screens play animations (milestone 4, plans 2 to 4).
export function designFrames(kind: EnemyBehaviour | "boss", look: Look): string[][] {
  return Array.from({ length: OLD_FRAME_COUNT(kind) }, (_, i) => {
    const { animation, frame } = designFrameSlot(kind, i);
    const frames = look.animations[animation].frames;
    return frames[Math.min(frame, frames.length - 1)];
  });
}

// Where an old frame is in this look, when its animation has fewer frames than the old slot.
export function designSlot(kind: EnemyBehaviour | "boss", look: Look, index: number): { animation: string; frame: number } {
  const { animation, frame } = designFrameSlot(kind, index);
  return { animation, frame: Math.min(frame, look.animations[animation].frames.length - 1) };
}

export const designLook = (kind: EnemyBehaviour | "boss", look: Look): DesignLook => ({
  colours: look.colours,
  frames: designFrames(kind, look),
});

const id = z.string().min(1).max(64); // as MAX_ID_LENGTH
const name = z.string().min(1).max(40); // as MAX_NAME_LENGTH

export const enemyDesignSchema = z.object({
  id,
  name,
  behaviour: z.enum(ENEMY_BEHAVIOURS),
  tuning: enemyTuningSchema,
  look: lookSchema,
});
export type EnemyDesign = z.infer<typeof enemyDesignSchema>;

export const BOSS_ATTACKS = ["jump", "dash", "spread", "aimed", "rain", "big"] as const;
export type BossAttack = (typeof BOSS_ATTACKS)[number];
export const BOSS_FIGHTS = ["short", "normal", "long"] as const;

export const bossDesignSchema = z.object({
  name,
  fight: z.enum(BOSS_FIGHTS),
  attacks: z.array(z.enum(BOSS_ATTACKS)).min(2).max(3),
  look: lookSchema,
});
export type BossDesign = z.infer<typeof bossDesignSchema>;

export const FIGHT_HEALTH: Record<BossDesign["fight"], number> = { short: 20, normal: 28, long: 40 };

// The thing settings for the kid's boss: its health and its attacks in order.
export function bossSettings(boss: BossDesign): { health: number; attacks: string } {
  return { health: FIGHT_HEALTH[boss.fight], attacks: boss.attacks.join(",") };
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
    return slotChar(slot + 1);
  };
  const converted = frames.map((frame) => frame.map((row) => [...row].map((ch) => (ch === "." ? "." : slotOf(ch))).join("")));
  if (colours.length > MAX_LOOK_COLOURS) throw new Error(`This art uses more than ${MAX_LOOK_COLOURS} colours.`);
  return { colours, frames: converted };
}
