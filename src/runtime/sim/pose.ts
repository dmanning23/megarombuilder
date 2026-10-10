import { ENEMY_SHOT_SIZE } from "./constants";
import type { Entity } from "./entities/types";
import type { Player } from "./state";

// Which pose (animation) a character is in, from the game's state alone: the renderer draws it,
// and shots come out at its shot point.

export function heroPose(p: Player, shooting: boolean): string {
  if (p.h < p.standH) return "slide";
  if (p.hurt > 0) return "hurt";
  if (p.onLadder) return "climb";
  if (!p.onGround) return shooting ? "jumpShoot" : "jump";
  if (p.vx !== 0) return shooting ? "runShoot" : "run";
  return shooting ? "standShoot" : "stand";
}

const BOSS_ATTACK_MODES = new Set(["spread", "aimed", "rain", "big"]);

export function entityPose(e: Entity): string {
  switch (e.behaviour) {
    case "flyer":
      return "fly";
    case "turret":
      return "idle";
    case "jumper":
      return e.onGround ? "ground" : "air";
    case "shielded":
      return e.mode === "open" ? "open" : "closed";
    case "dropper":
      return e.mode === "hang" ? "hang" : "fall";
    case "boss":
      return e.mode === "jump" ? "jump" : BOSS_ATTACK_MODES.has(e.mode) ? "attack" : "stand";
    default:
      return "walk";
  }
}

// Where the hero's shots come out as it fires: the shooting pose's shot point (8, as always, for a pose without one).
export const heroShotY = (p: Player): number => p.shotYs[heroPose(p, true)] ?? 8;

// Where an enemy's shots come out: its pose's shot point, or the middle of its hitbox, as always.
export const entityShotY = (e: Entity): number => e.shotYs[entityPose(e)] ?? Math.round(e.h / 2 - ENEMY_SHOT_SIZE / 2);
