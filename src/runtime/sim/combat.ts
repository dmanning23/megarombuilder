import {
  BOSS_FLASH_STEPS,
  ENEMY_FLASH_STEPS,
  ENEMY_SHOT_SIZE,
  HURT_STEPS,
  INVULN_STEPS,
  SHOT_H,
  SHOT_W,
} from "./constants";
import { pickupKey } from "./entities/slots";
import { ENEMY_BEHAVIOURS, num, overlaps, type Entity } from "./entities/types";
import { kill } from "./hazards";
import type { Sim } from "./state";

export function hurtPlayer(sim: Sim, amount: number, fromX: number): void {
  const p = sim.player;
  if (sim.phase !== "play" || p.invuln > 0) return;
  p.health -= amount;
  if (p.health <= 0) {
    kill(sim);
    return;
  }
  p.hurt = HURT_STEPS;
  p.invuln = INVULN_STEPS;
  p.knockback = fromX > p.x + p.w / 2 ? -1 : 1;
  p.onLadder = false;
}

const isTarget = (e: Entity) => ENEMY_BEHAVIOURS.has(e.behaviour) || e.behaviour === "boss";

// A walking shielded enemy blocks shots coming at the side it faces.
const shieldBlocks = (e: Entity, shotVx: number) =>
  e.behaviour === "shielded" && e.mode === "walk" && shotVx * e.facing < 0;

// Player shots against enemies and the boss.
export function hitEntities(sim: Sim): void {
  sim.shots = sim.shots.filter((shot) => {
    const box = { x: shot.x, y: shot.y, w: SHOT_W, h: SHOT_H };
    for (const slot of sim.slots) {
      const e = slot.entity;
      if (!e || !isTarget(e) || !overlaps(box, e)) continue;
      if (shieldBlocks(e, shot.vx)) return false;
      if (e.behaviour === "boss" && (e.mode === "intro" || e.flash > 0)) return false;
      e.health -= 1;
      e.flash = e.behaviour === "boss" ? BOSS_FLASH_STEPS : ENEMY_FLASH_STEPS;
      if (e.health <= 0) {
        slot.entity = null;
        if (e.behaviour === "boss") sim.phase = "won";
      }
      return false;
    }
    return true;
  });
}

// Contact damage, enemy-shot damage and pickups.
export function touchEntities(sim: Sim): void {
  const p = sim.player;
  for (const slot of sim.slots) {
    const e = slot.entity;
    if (!e || e.behaviour === "platform" || !overlaps(p, e)) continue;
    if (e.behaviour === "health") {
      p.health = Math.min(sim.settings.maxHealth, p.health + num(e.settings, "amount", 4));
      sim.collected.add(pickupKey(sim, e.id));
      slot.entity = null;
      continue;
    }
    if (e.behaviour === "boss" && e.mode === "intro") continue;
    hurtPlayer(sim, num(e.settings, "damage", e.behaviour === "boss" ? 4 : 2), e.x + e.w / 2);
  }
  sim.enemyShots = sim.enemyShots.filter((shot) => {
    const box = { x: shot.x, y: shot.y, w: ENEMY_SHOT_SIZE, h: ENEMY_SHOT_SIZE };
    if (!overlaps(p, box)) return true;
    hurtPlayer(sim, shot.damage, shot.x + ENEMY_SHOT_SIZE / 2);
    return false;
  });
}
