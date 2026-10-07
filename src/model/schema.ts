import { z } from "zod";
import { bossDesignSchema, enemyDesignSchema, MAX_ENEMIES } from "./designs";
import { heroSchema } from "./hero";

export const FORMAT_VERSION = 3;

export const MAX_ID_LENGTH = 64;

export const MAX_NAME_LENGTH = 40;

// The stored form of a name: no spaces at the ends, single spaces inside.
export function tidyName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

const idSchema = z.string().min(1).max(MAX_ID_LENGTH);
const nameSchema = z.string().min(1).max(MAX_NAME_LENGTH);
const intSchema = z.number().int();

export const openingSchema = z.object({
  edge: z.enum(["left", "right", "top", "bottom"]),
  from: intSchema.min(0),
  to: intSchema.min(0),
});

export const thingSettingsSchema = z.record(
  z.string(),
  z.union([z.number(), z.string(), z.boolean()]),
);

export const thingSchema = z.object({
  id: idSchema,
  type: z.string().min(1),
  x: intSchema,
  y: intSchema,
  settings: thingSettingsSchema,
});

export const zoneKindSchema = z.enum(["normal", "bossCorridor", "bossRoom"]);

export const zoneSchema = z.object({
  id: idSchema,
  name: nameSchema,
  kind: zoneKindSchema,
  scroll: z.enum(["horizontal", "vertical"]),
  screens: intSchema.min(1).max(8),
  variant: z.string(),
  intent: z.string().max(200),
  tiles: z.array(intSchema.min(0)),
  things: z.array(thingSchema),
  entry: openingSchema,
  exit: openingSchema.nullable(), // null only for the boss room
});

export const checkpointSchema = z.object({ zoneId: idSchema, x: intSchema, y: intSchema });

export const levelSchema = z.object({
  id: idSchema,
  name: nameSchema,
  brief: z.string().max(1000),
  zones: z.array(zoneSchema),
  checkpoints: z.array(checkpointSchema),
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  at: z.string(),
});

export const projectSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  id: idSchema,
  name: z.string(),
  contentPackId: z.string().min(1),
  hero: heroSchema,
  levels: z.array(levelSchema),
  chat: z.array(chatMessageSchema),
  enemies: z.array(enemyDesignSchema).max(MAX_ENEMIES),
  boss: bossDesignSchema.nullable(),
});

export type ThingSettings = z.infer<typeof thingSettingsSchema>;
export type Thing = z.infer<typeof thingSchema>;
export type ZoneKind = z.infer<typeof zoneKindSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type Checkpoint = z.infer<typeof checkpointSchema>;
export type Level = z.infer<typeof levelSchema>;
// The hero's physics, computed from its abilities by heroPhysics. Units are pixels and simulation
// steps (60 per second).
export type PlayerSettings = {
  runSpeed: number;
  jumpVelocity: number;
  gravity: number;
  maxFallSpeed: number;
  ladderSpeed: number;
  maxHealth: number;
  maxShots: number;
  slide: boolean;
  chargeShot: boolean;
};
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type Project = z.infer<typeof projectSchema>;

export const DEFAULT_PLAYER: PlayerSettings = {
  runSpeed: 1.375,
  jumpVelocity: 4.875,
  gravity: 0.25,
  maxFallSpeed: 7,
  ladderSpeed: 1.25,
  maxHealth: 28,
  maxShots: 3,
  slide: false,
  chargeShot: false,
};
