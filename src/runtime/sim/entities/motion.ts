import { moveX, moveY, type Body } from "../body";
import { ENEMY_GRAVITY, ENEMY_MAX_FALL, ENEMY_SHOT_SIZE } from "../constants";
import type { Sim } from "../state";
import { firstTile, isPlatform, isSolid, type TileMap } from "../tilemap";
import type { Entity } from "./types";

export function fall(map: TileMap, body: Body): void {
  body.vy = Math.min(body.vy + ENEMY_GRAVITY, ENEMY_MAX_FALL);
  body.onGround = false;
  moveY(map, body, body.vy, false);
}

export function towardPlayer(sim: Sim, e: Entity): 1 | -1 {
  return sim.player.x + sim.player.w / 2 < e.x + e.w / 2 ? -1 : 1;
}

function standable(map: TileMap, px: number, py: number): boolean {
  const tx = firstTile(px);
  const ty = firstTile(py);
  return isSolid(map.behaviourAt(tx, ty)) || isPlatform(map, tx, ty);
}

// Walks along the ground, turning round at walls and at edges, and falls when unsupported.
export function patrol(sim: Sim, e: Entity, speed: number): void {
  if (e.onGround) {
    const front = e.facing > 0 ? e.x + e.w + 1 : e.x - 1;
    if (!standable(sim.map, front, e.y + e.h + 1)) e.facing = e.facing > 0 ? -1 : 1;
  }
  e.vx = e.facing * speed;
  moveX(sim.map, e, e.vx);
  if (e.vx === 0 && speed !== 0) e.facing = e.facing > 0 ? -1 : 1; // walked into a wall
  fall(sim.map, e);
}

// Fires an enemy shot from the entity's centre.
export function fireAt(sim: Sim, e: Entity, vx: number, vy: number, damage: number): void {
  sim.enemyShots.push({
    x: e.x + e.w / 2 - ENEMY_SHOT_SIZE / 2,
    y: e.y + e.shotY,
    vx,
    vy,
    damage,
  });
}
