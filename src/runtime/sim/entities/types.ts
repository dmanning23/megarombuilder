import type { ThingBehaviour, ThingDef } from "@/model/contentPack";
import type { Thing, ThingSettings } from "@/model/schema";
import type { Body } from "../body";

export type Entity = Body & {
  id: string;
  type: string;
  behaviour: ThingBehaviour;
  facing: 1 | -1;
  health: number;
  mode: string; // behaviour-specific state, such as "walk", "open", "intro"
  timer: number;
  attack: number; // the boss's attack counter
  homeX: number;
  homeY: number;
  dx: number; // last step's movement, for platforms
  dy: number;
  flash: number; // steps left of the hit flash
  settings: ThingSettings;
};

export type EnemyShot = { x: number; y: number; vx: number; vy: number; damage: number; size?: number };

// One placed thing in the current zone, and its live entity if it exists right now.
export type Slot = { thing: Thing; def: ThingDef; entity: Entity | null; wasInView: boolean };

export type Box = { x: number; y: number; w: number; h: number };

export const ENEMY_BEHAVIOURS: ReadonlySet<ThingBehaviour> = new Set([
  "walker",
  "flyer",
  "turret",
  "jumper",
  "shielded",
  "dropper",
]);

// A number from a thing's settings, or the fallback when it is missing or not a number.
export function num(settings: ThingSettings, key: string, fallback: number): number {
  const value = settings[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
