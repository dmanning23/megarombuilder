import { TILE_SIZE } from "@/model/geometry";
import { ICE_ACCEL, JUMP_CUT_SPEED } from "./constants";
import { clamp } from "./math";
import type { Input, Player, Sim } from "./state";
import { firstTile, isPlatform, isSolid, lastTile, type TileMap } from "./tilemap";

// Moves sideways and stops at solid tiles.
export function moveX(map: TileMap, p: Player, dx: number): void {
  if (dx === 0) return;
  p.x += dx;
  const top = firstTile(p.y);
  const bottom = lastTile(p.y + p.h);
  const tx = dx > 0 ? lastTile(p.x + p.w) : firstTile(p.x);
  for (let ty = top; ty <= bottom; ty++) {
    if (!isSolid(map.behaviourAt(tx, ty))) continue;
    p.x = dx > 0 ? tx * TILE_SIZE - p.w : (tx + 1) * TILE_SIZE;
    p.vx = 0;
    return;
  }
}

// Moves vertically. Falling lands on solid tiles, and on platforms when coming from above
// unless dropThrough is set. Rising stops at solid tiles.
export function moveY(map: TileMap, p: Player, dy: number, dropThrough: boolean): void {
  if (dy === 0) return;
  const prevBottom = p.y + p.h;
  p.y += dy;
  const left = firstTile(p.x);
  const right = lastTile(p.x + p.w);
  if (dy > 0) {
    const ty = lastTile(p.y + p.h);
    for (let tx = left; tx <= right; tx++) {
      const lands =
        isSolid(map.behaviourAt(tx, ty)) ||
        (!dropThrough && isPlatform(map, tx, ty) && prevBottom <= ty * TILE_SIZE);
      if (!lands) continue;
      p.y = ty * TILE_SIZE - p.h;
      p.vy = 0;
      p.onGround = true;
      p.onIce = map.behaviourAt(firstTile(p.x + p.w / 2), ty) === "ice";
      return;
    }
  } else {
    const ty = firstTile(p.y);
    for (let tx = left; tx <= right; tx++) {
      if (!isSolid(map.behaviourAt(tx, ty))) continue;
      p.y = (ty + 1) * TILE_SIZE;
      p.vy = 0;
      return;
    }
  }
}

export function updatePlayer(sim: Sim, input: Input): void {
  const { map, player: p, settings, prev } = sim;
  const jumpPressed = input.jump && !prev.jump;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

  const target = dir * settings.runSpeed;
  if (p.onGround && p.onIce) p.vx += clamp(target - p.vx, -ICE_ACCEL, ICE_ACCEL);
  else p.vx = target;

  if (jumpPressed && p.onGround) p.vy = -settings.jumpVelocity;
  else if (!input.jump && p.vy < -JUMP_CUT_SPEED) p.vy = -JUMP_CUT_SPEED;

  p.vy = Math.min(p.vy + settings.gravity, settings.maxFallSpeed);
  p.onGround = false;
  p.onIce = false;
  moveX(map, p, p.vx);
  moveY(map, p, p.vy, false);
}
