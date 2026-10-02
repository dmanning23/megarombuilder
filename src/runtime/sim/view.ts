import { SCREEN_H, SCREEN_W, TRANSITION_STEPS } from "./constants";
import { clamp } from "./math";
import type { Camera, Sim } from "./state";

// The top-left corner of the screen in zone pixels: centred on the player, kept inside the zone.
export function cameraFor(sim: Pick<Sim, "map" | "player">): Camera {
  const { map, player: p } = sim;
  return {
    x: clamp(p.x + p.w / 2 - SCREEN_W / 2, 0, map.widthPx - SCREEN_W),
    y: clamp(p.y + p.h / 2 - SCREEN_H / 2, 0, map.heightPx - SCREEN_H),
  };
}

export type View = {
  camera: Camera;
  incoming: { dx: number; dy: number };
  outgoing: { zoneIndex: number; camera: Camera; dx: number; dy: number } | null;
};

// Where to draw the current zone and, during a transition, the one being left.
export function viewFor(sim: Sim): View {
  const camera = cameraFor(sim);
  const transition = sim.transition;
  if (sim.phase !== "transition" || !transition) {
    return { camera, incoming: { dx: 0, dy: 0 }, outgoing: null };
  }
  const t = 1 - sim.timer / TRANSITION_STEPS;
  const sign = transition.direction === "down" ? 1 : -1;
  const horizontal = transition.direction === "right";
  // Moving right the new screen comes in from the right; moving up, from above; moving down, from below.
  // Adding 0 turns a negative zero into zero.
  const slide = (amount: number) =>
    horizontal
      ? { dx: amount * SCREEN_W + 0, dy: 0 }
      : { dx: 0, dy: sign * amount * SCREEN_H + 0 };
  return {
    camera,
    incoming: slide(1 - t),
    outgoing: { zoneIndex: transition.fromIndex, camera: transition.fromCamera, ...slide(-t) },
  };
}
