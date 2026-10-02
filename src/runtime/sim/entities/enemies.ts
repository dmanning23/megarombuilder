import type { ThingBehaviour } from "@/model/contentPack";
import { moveX } from "../body";
import type { Sim } from "../state";
import { updateBoss } from "./boss";
import { fall, fireAt, patrol, towardPlayer } from "./motion";
import { num, type Entity } from "./types";

type Update = (sim: Sim, e: Entity) => void;

const walker: Update = (sim, e) => patrol(sim, e, num(e.settings, "speed", 0.5));

const flyer: Update = (sim, e) => {
  e.timer++;
  e.facing = towardPlayer(sim, e);
  e.x += e.facing * num(e.settings, "speed", 0.75);
  const period = num(e.settings, "period", 90);
  e.y = e.homeY + Math.sin((e.timer * 2 * Math.PI) / period) * num(e.settings, "amplitude", 16);
};

const jumper: Update = (sim, e) => {
  if (e.onGround) {
    e.vx = 0;
    e.timer++;
    if (e.timer >= num(e.settings, "interval", 60)) {
      e.timer = 0;
      e.facing = towardPlayer(sim, e);
      e.vy = -num(e.settings, "jumpSpeed", 4);
      e.vx = e.facing * num(e.settings, "hop", 1);
    }
  }
  moveX(sim.map, e, e.vx);
  fall(sim.map, e);
};

const dropper: Update = (sim, e) => {
  if (e.mode === "hang") {
    const p = sim.player;
    const sideways = Math.abs(p.x + p.w / 2 - (e.x + e.w / 2));
    if (sideways <= num(e.settings, "reach", 24) && p.y > e.y) e.mode = "fall";
    return;
  }
  if (e.mode === "fall") {
    fall(sim.map, e);
    if (e.onGround) {
      e.mode = "walk";
      e.facing = towardPlayer(sim, e);
    }
    return;
  }
  patrol(sim, e, num(e.settings, "speed", 0.75));
};

const turret: Update = (sim, e) => {
  const p = sim.player;
  const dx = p.x + p.w / 2 - (e.x + e.w / 2);
  const dy = p.y + p.h / 2 - (e.y + e.h / 2);
  e.facing = dx < 0 ? -1 : 1;
  e.timer++;
  if (e.timer < num(e.settings, "interval", 90)) return;
  e.timer = 0;
  if (Math.abs(dx) > num(e.settings, "range", 160)) return;
  const speed = num(e.settings, "shotSpeed", 2);
  const distance = Math.hypot(dx, dy) || 1;
  fireAt(sim, e, (dx / distance) * speed, (dy / distance) * speed, num(e.settings, "shotDamage", 2));
};

const shielded: Update = (sim, e) => {
  e.timer++;
  if (e.mode === "open") {
    fall(sim.map, e);
    if (e.timer >= num(e.settings, "openSteps", 30)) {
      e.mode = "walk";
      e.timer = 0;
    }
    return;
  }
  patrol(sim, e, num(e.settings, "speed", 0.4));
  if (e.timer >= num(e.settings, "interval", 120)) {
    e.mode = "open";
    e.timer = 0;
    e.facing = towardPlayer(sim, e);
    const speed = num(e.settings, "shotSpeed", 2);
    fireAt(sim, e, e.facing * speed, 0, num(e.settings, "shotDamage", 2));
  }
};

const BEHAVIOURS: Partial<Record<ThingBehaviour, Update>> = {
  walker,
  flyer,
  turret,
  jumper,
  shielded,
  dropper,
  boss: updateBoss,
};

export function updateEntities(sim: Sim): void {
  for (const slot of sim.slots) {
    const e = slot.entity;
    if (!e) continue;
    if (e.flash > 0 && e.behaviour !== "boss") e.flash--;
    BEHAVIOURS[e.behaviour]?.(sim, e);
  }
}
