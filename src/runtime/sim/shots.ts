import { CHARGE_STEPS, CHARGED_H, CHARGED_W, SCREEN_W, SHOT_H, SHOT_POSE_STEPS, SHOT_SPEED, SHOT_W } from "./constants";
import { heroShotY } from "./pose";
import { sliding } from "./slide";
import type { Input, Shot, Sim } from "./state";
import { firstTile, isSolid } from "./tilemap";
import { cameraFor } from "./view";

export function shoot(sim: Sim): void {
  const p = sim.player;
  if (sliding(p)) return; // no shooting while sliding
  if (sim.shots.length >= sim.settings.maxShots) return;
  sim.shots.push({
    x: p.facing > 0 ? p.x + p.w : p.x - SHOT_W,
    y: p.y + heroShotY(p),
    vx: p.facing * SHOT_SPEED,
  });
  p.shotTimer = SHOT_POSE_STEPS;
}

// Moves shots, removing any that hit a solid tile or leave the screen.
export function updateShots(sim: Sim): void {
  const camera = cameraFor(sim);
  sim.shots = sim.shots.filter((shot) => {
    const { w, h } = shotSize(shot);
    shot.x += shot.vx;
    const cx = shot.x + w / 2;
    const cy = shot.y + h / 2;
    if (isSolid(sim.map.behaviourAt(firstTile(cx), firstTile(cy)))) return false;
    return shot.x + w > camera.x && shot.x < camera.x + SCREEN_W;
  });
}

export const shotSize = (shot: Shot): { w: number; h: number } =>
  shot.charged ? { w: CHARGED_W, h: CHARGED_H } : { w: SHOT_W, h: SHOT_H };

// Holding shoot charges; letting go once fully charged fires a charged shot. It always fires: the
// shots-on-screen limit is for normal shots. A release mid-slide is lost (no shooting while sliding).
export function chargeShot(sim: Sim, input: Input): void {
  const p = sim.player;
  if (!sim.settings.chargeShot) return;
  if (input.shoot) {
    p.charge++; // every step shoot is down, the press included
    return;
  }
  if (!input.shoot && sim.prev.shoot && p.charge >= CHARGE_STEPS && !sliding(p)) {
    sim.shots.push({
      x: p.facing > 0 ? p.x + p.w : p.x - CHARGED_W,
      y: p.y + heroShotY(p) + SHOT_H / 2 - CHARGED_H / 2, // centred on a normal shot's line
      vx: p.facing * SHOT_SPEED,
      charged: true,
    });
    p.shotTimer = SHOT_POSE_STEPS;
  }
  if (!input.shoot) p.charge = 0;
}
