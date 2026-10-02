import { SCREEN_H, SCREEN_W } from "./constants";
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
