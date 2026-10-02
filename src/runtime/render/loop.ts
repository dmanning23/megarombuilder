export const STEP_MS = 1000 / 60;
// After a long pause (a background tab, a slow frame) run at most this many steps and drop the rest.
export const MAX_STEPS_PER_FRAME = 5;

// Turns elapsed time into a whole number of simulation steps, keeping the remainder.
export function stepsFor(
  accumulator: number,
  elapsedMs: number,
): { steps: number; accumulator: number } {
  const total = accumulator + Math.max(0, elapsedMs);
  const steps = Math.floor(total / STEP_MS);
  if (steps > MAX_STEPS_PER_FRAME) return { steps: MAX_STEPS_PER_FRAME, accumulator: 0 };
  return { steps, accumulator: total - steps * STEP_MS };
}
