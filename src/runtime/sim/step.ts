import { updatePlayer } from "./player";
import type { Input, Sim } from "./state";

// Advances the simulation by one step of 1/60 second.
export function step(sim: Sim, input: Input): void {
  sim.steps++;
  updatePlayer(sim, input);
  sim.prev = input;
}
