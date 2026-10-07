import type { ThingBehaviour, ThingDef } from "@/model/contentPack";
import { TILE_SIZE } from "@/model/geometry";
import type { Thing } from "@/model/schema";
import { BOSS_INTRO_STEPS } from "../constants";
import { num, type Box, type Entity } from "./types";

const SIZES: Record<ThingBehaviour, [number, number]> = {
  walker: [14, 14],
  flyer: [14, 12],
  turret: [14, 14],
  jumper: [14, 14],
  shielded: [14, 16],
  dropper: [14, 12],
  platform: [32, 8],
  health: [10, 10],
  boss: [24, 28],
};

const HEALTH: Record<ThingBehaviour, number> = {
  walker: 1,
  flyer: 1,
  turret: 3,
  jumper: 2,
  shielded: 2,
  dropper: 1,
  platform: 0,
  health: 0,
  boss: 28,
};

// How big each kind of thing's body is, in pixels.
export function bodySize(behaviour: ThingBehaviour): { w: number; h: number } {
  const [w, h] = SIZES[behaviour];
  return { w, h };
}

// Where a thing appears. Most stand on the bottom of their tile, centred across it.
export function spawnBox(thing: Thing, behaviour: ThingBehaviour): Box {
  const [w, h] = SIZES[behaviour];
  const left = thing.x * TILE_SIZE;
  const top = thing.y * TILE_SIZE;
  const x = behaviour === "platform" ? left : left + (TILE_SIZE - w) / 2;
  let y = top + TILE_SIZE - h;
  if (behaviour === "flyer") y = top + (TILE_SIZE - h) / 2;
  if (behaviour === "dropper" || behaviour === "platform") y = top;
  return { x, y, w, h };
}

export function createEntity(thing: Thing, def: ThingDef, playerCentreX: number): Entity {
  const behaviour = def.behaviour;
  const box = spawnBox(thing, behaviour);
  // The kid's own enemies and boss take their settings from their designs alone, even when an
  // older game stored some on the placed copy.
  const settings = def.own ? { ...def.defaults } : { ...def.defaults, ...thing.settings };
  const initialMode: Partial<Record<ThingBehaviour, string>> = { boss: "intro", dropper: "hang" };
  return {
    ...box,
    vx: 0,
    vy: 0,
    onGround: false,
    onIce: false,
    id: thing.id,
    type: thing.type,
    behaviour,
    facing: playerCentreX < box.x + box.w / 2 ? -1 : 1,
    health: num(settings, "health", HEALTH[behaviour]),
    mode: initialMode[behaviour] ?? "walk",
    timer: behaviour === "boss" ? BOSS_INTRO_STEPS : 0,
    attack: 0,
    homeX: box.x,
    homeY: box.y,
    dx: 0,
    dy: 0,
    flash: 0,
    modeSteps: 0,
    settings,
  };
}
