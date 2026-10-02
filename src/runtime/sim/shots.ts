import { SCREEN_W, SHOT_H, SHOT_POSE_STEPS, SHOT_SPEED, SHOT_W } from "./constants";
import type { Sim } from "./state";
import { firstTile, isSolid } from "./tilemap";
import { cameraFor } from "./view";

export function shoot(sim: Sim): void {
  const p = sim.player;
  if (sim.shots.length >= sim.settings.maxShots) return;
  sim.shots.push({
    x: p.facing > 0 ? p.x + p.w : p.x - SHOT_W,
    y: p.y + 8,
    vx: p.facing * SHOT_SPEED,
  });
  p.shotTimer = SHOT_POSE_STEPS;
}

// Moves shots, removing any that hit a solid tile or leave the screen.
export function updateShots(sim: Sim): void {
  const camera = cameraFor(sim);
  sim.shots = sim.shots.filter((shot) => {
    shot.x += shot.vx;
    const cx = shot.x + SHOT_W / 2;
    const cy = shot.y + SHOT_H / 2;
    if (isSolid(sim.map.behaviourAt(firstTile(cx), firstTile(cy)))) return false;
    return shot.x + SHOT_W > camera.x && shot.x < camera.x + SCREEN_W;
  });
}
