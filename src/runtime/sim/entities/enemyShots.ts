import { ENEMY_SHOT_SIZE, SCREEN_H, SCREEN_W } from "../constants";
import type { Sim } from "../state";
import { firstTile, isSolid } from "../tilemap";
import { cameraFor } from "../view";

// Moves enemy shots, removing any that hit a solid tile or leave the screen.
export function updateEnemyShots(sim: Sim): void {
  const camera = cameraFor(sim);
  sim.enemyShots = sim.enemyShots.filter((shot) => {
    const size = shot.size ?? ENEMY_SHOT_SIZE;
    shot.x += shot.vx;
    shot.y += shot.vy;
    const cx = shot.x + size / 2;
    const cy = shot.y + size / 2;
    if (isSolid(sim.map.behaviourAt(firstTile(cx), firstTile(cy)))) return false;
    return (
      shot.x + size > camera.x &&
      shot.x < camera.x + SCREEN_W &&
      shot.y + size > camera.y &&
      shot.y < camera.y + SCREEN_H
    );
  });
}
