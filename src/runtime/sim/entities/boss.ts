import { BOSS_ATTACKS, type BossAttack } from "@/model/designs";
import { moveX } from "../body";
import {
  AIMED_SHOT_SPEED,
  BIG_SHOT_DAMAGE,
  BIG_SHOT_HEIGHT,
  BIG_SHOT_SIZE,
  BIG_SHOT_SPEED,
  BOSS_HURRIED_IDLE_STEPS,
  BOSS_IDLE_STEPS,
  ENEMY_SHOT_SIZE,
  RAIN_SPACING,
  RAIN_SPEED,
} from "../constants";
import type { Sim } from "../state";
import { cameraFor } from "../view";
import { fall, fireAt, towardPlayer } from "./motion";
import { num, type Entity } from "./types";

const DEFAULT_ATTACKS: BossAttack[] = ["jump", "spread", "dash"]; // the Blizzard Bot's
const SHOOTING: ReadonlySet<string> = new Set(["spread", "aimed", "rain", "big"]);

// The boss's attacks, in order, from its settings ("jump,rain"); unknown names are skipped.
export function attacksOf(e: Entity): BossAttack[] {
  const list = e.settings.attacks;
  if (typeof list !== "string") return DEFAULT_ATTACKS;
  const attacks = list
    .split(",")
    .map((name) => name.trim())
    .filter((name): name is BossAttack => (BOSS_ATTACKS as readonly string[]).includes(name));
  return attacks.length > 0 ? attacks : DEFAULT_ATTACKS;
}

function toIdle(e: Entity): void {
  e.mode = "idle";
  const hurt = e.health < num(e.settings, "health", 28) / 2;
  e.timer = hurt ? BOSS_HURRIED_IDLE_STEPS : BOSS_IDLE_STEPS;
  e.vx = 0;
}

function startAttack(sim: Sim, e: Entity): void {
  const attacks = attacksOf(e);
  const attack = attacks[e.attack % attacks.length];
  // How many rains came before this one, so the rain's gap moves every other rain whatever the list.
  const cycles = Math.floor(e.attack / attacks.length);
  const rainsBefore =
    cycles * attacks.filter((a) => a === "rain").length +
    attacks.slice(0, e.attack % attacks.length).filter((a) => a === "rain").length;
  e.attack++;
  e.facing = towardPlayer(sim, e);
  e.mode = attack;
  const s = e.settings;
  const damage = num(s, "shotDamage", 3);
  if (attack === "jump") {
    e.vy = -num(s, "jumpSpeed", 5.5);
    e.vx = e.facing * num(s, "jumpDrift", 1.75);
  } else if (attack === "dash") {
    e.vx = e.facing * num(s, "dashSpeed", 3);
  } else if (attack === "spread") {
    const speed = num(s, "shotSpeed", 2);
    for (const vy of [-0.5, 0, 0.5]) fireAt(sim, e, e.facing * speed, vy, damage);
    e.timer = 40;
  } else if (attack === "aimed") {
    const p = sim.player;
    const dx = p.x + p.w / 2 - (e.x + e.w / 2);
    const dy = p.y + p.h / 2 - (e.y + e.h / 2);
    const distance = Math.hypot(dx, dy) || 1;
    fireAt(sim, e, (dx / distance) * AIMED_SHOT_SPEED, (dy / distance) * AIMED_SHOT_SPEED, damage);
    e.timer = 40;
  } else if (attack === "rain") {
    // Four shots from the top of the screen, around the hero, with gaps over two tiles wide. Every
    // other rain the pattern shifts, so standing still isn't always safe.
    const p = sim.player;
    const top = cameraFor(sim).y;
    const shift = rainsBefore % 2 === 0 ? 0 : -RAIN_SPACING / 2;
    const centre = p.x + p.w / 2 - ENEMY_SHOT_SIZE / 2 + shift;
    for (const k of [-2, -1, 0, 1]) {
      sim.enemyShots.push({ x: centre + k * RAIN_SPACING, y: top, vx: 0, vy: RAIN_SPEED, damage });
    }
    e.timer = 40;
  } else {
    // big: one large, slow shot at chest height, low enough to jump, high enough to slide under.
    sim.enemyShots.push({
      x: e.facing > 0 ? e.x + e.w : e.x - BIG_SHOT_SIZE,
      y: e.y + e.h - BIG_SHOT_HEIGHT,
      vx: e.facing * BIG_SHOT_SPEED,
      vy: 0,
      damage: BIG_SHOT_DAMAGE,
      size: BIG_SHOT_SIZE,
    });
    e.timer = 40;
  }
}

// A boss: an intro, then idle and an attack in turn, forever.
export function updateBoss(sim: Sim, e: Entity): void {
  if (e.flash > 0) e.flash--;
  if (e.mode === "intro" || e.mode === "idle" || SHOOTING.has(e.mode)) {
    e.timer--;
    if (e.timer <= 0) {
      if (e.mode === "idle") startAttack(sim, e);
      else toIdle(e);
    }
  }
  moveX(sim.map, e, e.vx);
  fall(sim.map, e);
  if (e.y > sim.map.heightPx) {
    // Fell out of the room: put it back where it started, or the fight could never end.
    e.x = e.homeX;
    e.y = e.homeY;
    e.vy = 0;
    if (e.mode === "jump" || e.mode === "dash") toIdle(e);
    return;
  }
  if (e.mode === "jump" && e.onGround) toIdle(e);
  if (e.mode === "dash" && e.vx === 0) toIdle(e); // hit a wall
}
