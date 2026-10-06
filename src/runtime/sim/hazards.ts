import { TILE_SIZE } from "@/model/geometry";
import { PLAYER_H, RESPAWN_STEPS } from "./constants";
import { loadZoneThings } from "./entities/slots";
import type { Sim } from "./state";
import {
  createTileMap,
  firstTile,
  isSolid,
  lastTile,
  touchingLadder,
  type Cell,
} from "./tilemap";

function touching(sim: Sim, matches: (cell: Cell) => boolean): boolean {
  const { map, player: p } = sim;
  for (let ty = firstTile(p.y); ty <= lastTile(p.y + p.h); ty++) {
    for (let tx = firstTile(p.x); tx <= lastTile(p.x + p.w); tx++) {
      if (matches(map.behaviourAt(tx, ty))) return true;
    }
  }
  return false;
}

export const touchingSpike = (sim: Sim): boolean => touching(sim, (cell) => cell === "spike");

// Collision never leaves the player inside a solid tile, so this only happens when a level
// puts them there: an entry or checkpoint that has been tiled over.
export const insideSolid = (sim: Sim): boolean => touching(sim, isSolid);

export function kill(sim: Sim): void {
  if (sim.phase === "dead") return;
  sim.phase = "dead";
  sim.timer = RESPAWN_STEPS;
  sim.transition = null;
  sim.player.health = 0;
  sim.player.vx = 0;
  sim.player.vy = 0;
}

export function respawn(sim: Sim): void {
  const p = sim.player;
  sim.zoneIndex = sim.respawn.zoneIndex;
  sim.map = createTileMap(sim.level.zones[sim.zoneIndex], sim.pack);
  p.x = sim.respawn.x;
  p.y = sim.respawn.y;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.onIce = false;
  p.onLadder = touchingLadder(sim.map, p);
  p.health = sim.settings.maxHealth;
  p.hurt = 0;
  p.invuln = 0;
  p.ridingId = null;
  p.shotTimer = 0;
  p.h = PLAYER_H;
  p.slide = 0;
  p.charge = 0;
  sim.shots = [];
  loadZoneThings(sim);
  sim.phase = "play";
  sim.timer = 0;
}

// Touching a checkpoint in the current zone makes it the respawn point.
export function touchCheckpoints(sim: Sim): void {
  const { map, player: p } = sim;
  for (const checkpoint of sim.level.checkpoints) {
    if (checkpoint.zoneId !== map.zone.id) continue;
    const left = checkpoint.x * TILE_SIZE;
    const top = checkpoint.y * TILE_SIZE;
    const touching =
      p.x < left + TILE_SIZE && p.x + p.w > left && p.y < top + TILE_SIZE && p.y + p.h > top;
    if (!touching) continue;
    sim.respawn = {
      zoneIndex: sim.zoneIndex,
      x: left + (TILE_SIZE - p.w) / 2,
      y: top + TILE_SIZE - PLAYER_H,
    };
  }
}
