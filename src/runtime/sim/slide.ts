import { PLAYER_H, SLIDE_H, SLIDE_STEPS } from "./constants";
import type { Player } from "./state";
import { firstTile, isSolid, lastTile, type TileMap } from "./tilemap";

// Sliding makes the body low. Standing up keeps the feet where they are.
export const sliding = (p: Player): boolean => p.h < PLAYER_H;

// Whether a standing body would fit where this body's feet are, clear of solid tiles.
export function roomToStand(map: TileMap, p: { x: number; y: number; w: number; h: number }): boolean {
  const top = p.y + p.h - PLAYER_H;
  for (let ty = firstTile(top); ty <= lastTile(p.y + p.h); ty++) {
    for (let tx = firstTile(p.x); tx <= lastTile(p.x + p.w); tx++) {
      if (isSolid(map.behaviourAt(tx, ty))) return false;
    }
  }
  return true;
}

export function startSlide(p: Player): void {
  p.y += PLAYER_H - SLIDE_H;
  p.h = SLIDE_H;
  p.slide = SLIDE_STEPS;
}

export function standUp(p: Player): void {
  p.y -= PLAYER_H - p.h;
  p.h = PLAYER_H;
  p.slide = 0;
}
