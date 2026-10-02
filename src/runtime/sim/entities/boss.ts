import { moveX } from "../body";
import { BOSS_IDLE_STEPS } from "../constants";
import type { Sim } from "../state";
import { fall, fireAt, towardPlayer } from "./motion";
import { num, type Entity } from "./types";

const ATTACKS = ["jump", "shot", "dash"] as const;

function toIdle(e: Entity): void {
  e.mode = "idle";
  e.timer = BOSS_IDLE_STEPS;
  e.vx = 0;
}

function startAttack(sim: Sim, e: Entity): void {
  const attack = ATTACKS[e.attack % ATTACKS.length];
  e.attack++;
  e.facing = towardPlayer(sim, e);
  e.mode = attack;
  const s = e.settings;
  if (attack === "jump") {
    e.vy = -num(s, "jumpSpeed", 5.5);
    e.vx = e.facing * num(s, "jumpDrift", 1.75);
  } else if (attack === "shot") {
    const speed = num(s, "shotSpeed", 2);
    const damage = num(s, "shotDamage", 3);
    for (const vy of [-0.5, 0, 0.5]) fireAt(sim, e, e.facing * speed, vy, damage);
    e.timer = 40;
  } else {
    e.vx = e.facing * num(s, "dashSpeed", 3);
  }
}

// Blizzard Bot: an intro, then idle and an attack in turn, forever.
export function updateBoss(sim: Sim, e: Entity): void {
  if (e.flash > 0) e.flash--;
  if (e.mode === "intro" || e.mode === "idle" || e.mode === "shot") {
    e.timer--;
    if (e.timer <= 0) {
      if (e.mode === "idle") startAttack(sim, e);
      else toIdle(e);
    }
  }
  moveX(sim.map, e, e.vx);
  fall(sim.map, e);
  if (e.mode === "jump" && e.onGround) toIdle(e);
  if (e.mode === "dash" && e.vx === 0) toIdle(e); // hit a wall
}
