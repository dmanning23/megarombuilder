import { checkEdges } from "./edges";
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
  } else {
    updatePlayer(sim, input);
    if (input.shoot && !sim.prev.shoot) shoot(sim);
    updateShots(sim);
    touchCheckpoints(sim);
    if (touchingSpike(sim) || insideSolid(sim)) kill(sim);
    else checkEdges(sim);
  }
  sim.prev = input;
}
