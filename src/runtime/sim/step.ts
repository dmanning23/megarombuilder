import { hitEntities, touchEntities } from "./combat";
import { checkEdges } from "./edges";
import { updateEntities } from "./entities/enemies";
import { updateEnemyShots } from "./entities/enemyShots";
import { updateSlots } from "./entities/slots";
import { insideSolid, kill, respawn, touchCheckpoints, touchingSpike } from "./hazards";
import { updatePlayer } from "./player";
import { shoot, updateShots } from "./shots";
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
  sim.prev = input;
}

function playStep(sim: Sim, input: Input): void {
  updatePlayer(sim, input);
  if (input.shoot && !sim.prev.shoot) shoot(sim);
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
}
