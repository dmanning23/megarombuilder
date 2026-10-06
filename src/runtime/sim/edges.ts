import { TILE_SIZE } from "@/model/geometry";
import { PLAYER_H, TRANSITION_STEPS } from "./constants";
import { loadZoneThings } from "./entities/slots";
import { kill } from "./hazards";
import { entryPosition, type Sim, type Transition } from "./state";
import { createTileMap, touchingLadder } from "./tilemap";
import { cameraFor } from "./view";

// Moves to the next zone and starts the screen slide.
function leave(sim: Sim, direction: Transition["direction"], carry: number): void {
  const next = sim.zoneIndex + 1;
  if (next >= sim.level.zones.length) return;
  const p = sim.player;
  // A slide ends at the edge of a zone: the player arrives standing.
  p.h = PLAYER_H;
  p.slide = 0;
  sim.transition = { fromIndex: sim.zoneIndex, fromCamera: cameraFor(sim), direction };
  sim.zoneIndex = next;
  sim.map = createTileMap(sim.level.zones[next], sim.pack);
  const position = entryPosition(sim.map, carry);
  p.x = position.x;
  p.y = position.y;
  p.vy = 0;
  p.onGround = false;
  p.onIce = false;
  p.ridingId = null;
  p.onLadder = touchingLadder(sim.map, p);
  sim.shots = [];
  loadZoneThings(sim);
  sim.phase = "transition";
  sim.timer = TRANSITION_STEPS;
}

// Starts a transition when the player crosses the exit opening. Falling out of the
// bottom anywhere else is a pit.
export function checkEdges(sim: Sim): void {
  const { map, player: p } = sim;
  const exit = map.zone.exit;
  const cx = p.x + p.w / 2;
  const along = exit === null ? 0 : cx - exit.from * TILE_SIZE;
  const inColumns =
    exit !== null && along >= 0 && cx < (exit.to + 1) * TILE_SIZE;

  if (exit?.edge === "right" && cx >= map.widthPx) {
    leave(sim, "right", p.y + p.h - exit.from * TILE_SIZE);
  } else if (exit?.edge === "top" && p.y < 0 && inColumns) {
    leave(sim, "up", along);
  } else if (p.y > map.heightPx) {
    if (exit?.edge === "bottom" && inColumns) leave(sim, "down", along);
    else kill(sim);
  }
}
