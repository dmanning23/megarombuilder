import { TILE_SIZE } from "@/model/geometry";
import { firstTile, isPlatform, isSolid, lastTile, type TileMap } from "./tilemap";

// Anything that moves through the tile grid: the player, enemies, the boss.
export type Body = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  onIce: boolean;
};

// Moves sideways and stops at solid tiles.
export function moveX(map: TileMap, b: Body, dx: number): void {
  if (dx === 0) return;
  b.x += dx;
  const top = firstTile(b.y);
  const bottom = lastTile(b.y + b.h);
  const tx = dx > 0 ? lastTile(b.x + b.w) : firstTile(b.x);
  for (let ty = top; ty <= bottom; ty++) {
    if (!isSolid(map.behaviourAt(tx, ty))) continue;
    b.x = dx > 0 ? tx * TILE_SIZE - b.w : (tx + 1) * TILE_SIZE;
    b.vx = 0;
    return;
  }
}

// Moves vertically. Falling lands on solid tiles, and on platforms when coming from above
// unless dropThrough is set. Rising stops at solid tiles.
export function moveY(map: TileMap, b: Body, dy: number, dropThrough: boolean): void {
  if (dy === 0) return;
  const prevBottom = b.y + b.h;
  b.y += dy;
  const left = firstTile(b.x);
  const right = lastTile(b.x + b.w);
  if (dy > 0) {
    const ty = lastTile(b.y + b.h);
    for (let tx = left; tx <= right; tx++) {
      const lands =
        isSolid(map.behaviourAt(tx, ty)) ||
        (!dropThrough && isPlatform(map, tx, ty) && prevBottom <= ty * TILE_SIZE);
      if (!lands) continue;
      b.y = ty * TILE_SIZE - b.h;
      b.vy = 0;
      b.onGround = true;
      b.onIce = map.behaviourAt(firstTile(b.x + b.w / 2), ty) === "ice";
      return;
    }
  } else {
    const ty = firstTile(b.y);
    for (let tx = left; tx <= right; tx++) {
      if (!isSolid(map.behaviourAt(tx, ty))) continue;
      b.y = (ty + 1) * TILE_SIZE;
      b.vy = 0;
      return;
    }
  }
}
