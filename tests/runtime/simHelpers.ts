import type { Checkpoint } from "@/model/schema";
import type { Entity } from "@/runtime/sim/entities/types";
import { createSim, NO_INPUT, type Input, type Sim } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { testPack } from "../fixtures/testPack";
import { projectFromArt, type ZoneArt } from "./helpers";

export function makeSim(
  zones: ZoneArt[],
  checkpoints: Checkpoint[] = [],
  startZoneId?: string,
): Sim {
  return createSim(projectFromArt(zones, checkpoints), "L1", testPack, { startZoneId });
}

export const press = (keys: Partial<Input> = {}): Input => ({ ...NO_INPUT, ...keys });

export function run(sim: Sim, keys: Partial<Input>, steps: number): void {
  for (let i = 0; i < steps; i++) step(sim, press(keys));
}

// Steps with the given keys until the condition holds. Returns the number of steps taken.
export function runUntil(
  sim: Sim,
  keys: Partial<Input>,
  done: (sim: Sim) => boolean,
  limit = 600,
): number {
  for (let i = 0; i < limit; i++) {
    if (done(sim)) return i;
    step(sim, press(keys));
  }
  throw new Error("The condition was not reached.");
}

// Puts the player's feet on top of tile (tx, ty) and runs one step so they settle.
export function standOn(sim: Sim, tx: number, ty: number): void {
  const p = sim.player;
  p.x = tx * 16 + 1;
  p.y = ty * 16 - p.h;
  p.vx = 0;
  p.vy = 0;
  p.onLadder = false;
  step(sim, press());
}

// The live entity for the first thing of this type in the current zone, if it exists.
export function entity(sim: Sim, type: string): Entity | null {
  return sim.slots.find((s) => s.thing.type === type)?.entity ?? null;
}
