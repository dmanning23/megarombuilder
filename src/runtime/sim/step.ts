import { hitEntities, touchEntities } from "./combat";
import { checkEdges } from "./edges";
import { updateEntities } from "./entities/enemies";
import { updateEnemyShots } from "./entities/enemyShots";
import { updatePlatforms } from "./entities/platforms";
import { updateSlots } from "./entities/slots";
import { insideSolid, kill, respawn, touchCheckpoints, touchingSpike } from "./hazards";
import { updatePlayer } from "./player";
import { chargeShot, shoot, updateShots } from "./shots";
import type { Input, Sim } from "./state";

// Advances the simulation by one step of 1/60 second.
export function step(sim: Sim, input: Input): void {
  sim.steps++;
  if (sim.phase === "dead") {
    if (--sim.timer <= 0) respawn(sim);
  } else if (sim.phase === "transition") {
    if (--sim.timer <= 0) {
      sim.phase = "play";
      sim.transition = null;
    }
  } else if (sim.phase === "play") {
    playStep(sim, input);
  }
  // A charge is let go when shoot is up, whatever the game was doing (a zone change, say).
  if (!input.shoot) sim.player.charge = 0;
  sim.prev = input;
}

function playStep(sim: Sim, input: Input): void {
  updatePlatforms(sim);
  updatePlayer(sim, input);
  sim.player.airSteps = sim.player.onGround ? 0 : sim.player.airSteps + 1;
  if (input.shoot && !sim.prev.shoot) shoot(sim);
  chargeShot(sim, input);
  updateShots(sim);
  hitEntities(sim);
  if (sim.phase !== "play") return; // the boss was defeated
  updateSlots(sim);
  updateEntities(sim);
  updateEnemyShots(sim);
  touchEntities(sim);
  if (sim.phase !== "play") return; // damage killed the player
  touchCheckpoints(sim);
  if (touchingSpike(sim) || insideSolid(sim)) kill(sim);
  else checkEdges(sim);
  if (sim.player.invuln > 0) sim.player.invuln--;
  if (sim.player.shotTimer > 0) sim.player.shotTimer--;
}
