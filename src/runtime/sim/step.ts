import { kill, respawn, touchCheckpoints, touchingSpike } from "./hazards";
import { updatePlayer } from "./player";
import type { Input, Sim } from "./state";

// Advances the simulation by one step of 1/60 second.
export function step(sim: Sim, input: Input): void {
  sim.steps++;
  if (sim.phase === "dead") {
    if (--sim.timer <= 0) respawn(sim);
    sim.prev = input;
    return;
  }
  updatePlayer(sim, input);
  touchCheckpoints(sim);
  if (touchingSpike(sim) || sim.player.y > sim.map.heightPx) kill(sim);
  sim.prev = input;
}
