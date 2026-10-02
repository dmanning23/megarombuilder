import type { ThingBehaviour } from "@/model/contentPack";
import { DESPAWN_MARGIN, SCREEN_H, SCREEN_W } from "../constants";
import type { Camera, Sim } from "../state";
import { cameraFor } from "../view";
import { createEntity, spawnBox } from "./spawn";
import type { Box, Entity } from "./types";

// These exist for as long as the player is in the zone; enemies come and go with the screen.
const ALWAYS_PRESENT: ReadonlySet<ThingBehaviour> = new Set(["platform", "health", "boss"]);

const playerCentreX = (sim: Sim) => sim.player.x + sim.player.w / 2;

function inView(box: Box, camera: Camera, margin: number): boolean {
  return (
    box.x < camera.x + SCREEN_W + margin &&
    box.x + box.w > camera.x - margin &&
    box.y < camera.y + SCREEN_H + margin &&
    box.y + box.h > camera.y - margin
  );
}

// Collected pickups are remembered by zone and thing id.
export const pickupKey = (sim: Sim, id: string): string => `${sim.map.zone.id}:${id}`;

// Builds the slots for the current zone. Called on starting, entering a zone and respawning.
export function loadZoneThings(sim: Sim): void {
  sim.enemyShots = [];
  sim.slots = sim.map.zone.things.flatMap((thing) => {
    const def = sim.pack.things.find((d) => d.type === thing.type);
    return def ? [{ thing, def, entity: null, wasInView: false }] : [];
  });
  for (const slot of sim.slots) {
    const behaviour = slot.def.behaviour;
    if (!ALWAYS_PRESENT.has(behaviour)) continue;
    if (behaviour === "health" && sim.collected.has(pickupKey(sim, slot.thing.id))) continue;
    slot.entity = createEntity(slot.thing, slot.def, playerCentreX(sim));
  }
}

// Enemies appear when their spot scrolls into view and vanish when they wander well off screen.
export function updateSlots(sim: Sim): void {
  const camera = cameraFor(sim);
  for (const slot of sim.slots) {
    if (ALWAYS_PRESENT.has(slot.def.behaviour)) continue;
    const visible = inView(spawnBox(slot.thing, slot.def.behaviour), camera, 0);
    if (slot.entity) {
      if (!inView(slot.entity, camera, DESPAWN_MARGIN)) slot.entity = null;
    } else if (visible && !slot.wasInView) {
      slot.entity = createEntity(slot.thing, slot.def, playerCentreX(sim));
    }
    slot.wasInView = visible;
  }
}

export function entitiesOf(sim: Sim, behaviour?: ThingBehaviour): Entity[] {
  const found: Entity[] = [];
  for (const slot of sim.slots) {
    if (slot.entity && (!behaviour || slot.entity.behaviour === behaviour)) found.push(slot.entity);
  }
  return found;
}
