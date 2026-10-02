import { TILE_SIZE } from "@/model/geometry";
import { moveX } from "../body";
import type { Sim } from "../state";
import { entitiesOf } from "./slots";
import { num } from "./types";

// Moves every platform along its back-and-forth path, carrying anyone riding it.
export function updatePlatforms(sim: Sim): void {
  const p = sim.player;
  for (const e of entitiesOf(sim, "platform")) {
    const travel = num(e.settings, "distance", 4) * TILE_SIZE;
    const speed = num(e.settings, "speed", 0.5);
    e.timer++;
    const along = travel > 0 ? (e.timer * speed) % (2 * travel) : 0;
    const offset = along <= travel ? along : 2 * travel - along;
    const vertical = e.settings.axis === "y";
    const x = vertical ? e.homeX : e.homeX + offset;
    const y = vertical ? e.homeY + offset : e.homeY;
    e.dx = x - e.x;
    e.dy = y - e.y;
    e.x = x;
    e.y = y;
    if (p.ridingId === e.id) {
      moveX(sim.map, p, e.dx);
      p.y = e.y - p.h;
    }
  }
}

// Lands a falling player on a platform they came down onto from above.
export function landOnPlatforms(sim: Sim, prevBottom: number): void {
  const p = sim.player;
  if (p.vy < 0) return;
  for (const e of entitiesOf(sim, "platform")) {
    const across = p.x < e.x + e.w && p.x + p.w > e.x;
    // A platform that moved up this step can meet the feet from below; one that moved down
    // can drop away from feet that were on it.
    const rise = Math.max(0, -e.dy);
    const drop = Math.max(0, e.dy);
    if (!across || prevBottom > e.y + rise + 0.001 || p.y + p.h < e.y - drop) continue;
    p.y = e.y - p.h;
    p.vy = 0;
    p.onGround = true;
    p.onIce = false;
    p.ridingId = e.id;
    return;
  }
}
