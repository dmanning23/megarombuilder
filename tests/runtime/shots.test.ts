import { describe, expect, it } from "vitest";
import { RESPAWN_STEPS } from "@/runtime/sim/constants";
import { flatArt, rowWith } from "./helpers";
import { makeSim, run } from "./simHelpers";

describe("shots", () => {
  it("starts the shooting pose timer when a shot is fired, and counts it down", () => {
    const sim = makeSim([{ art: flatArt() }]);
    expect(sim.player.shotTimer).toBe(0);
    run(sim, { shoot: true }, 1);
    expect(sim.player.shotTimer).toBe(11);
    run(sim, {}, 11);
    expect(sim.player.shotTimer).toBe(0);
  });

  it("does not start the timer when no shot can be fired", () => {
    const sim = makeSim([{ art: flatArt() }]);
    for (let i = 0; i < 3; i++) {
      run(sim, { shoot: true }, 1);
      run(sim, {}, 1);
    }
    run(sim, {}, 20);
    run(sim, { shoot: true }, 1);
    expect(sim.shots).toHaveLength(3);
    expect(sim.player.shotTimer).toBe(0);
  });

  it("fires one shot in the facing direction when shoot is pressed", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 1);
    run(sim, { shoot: true }, 1);
    expect(sim.shots).toHaveLength(1);
    expect(sim.shots[0]).toEqual({ x: 2 + 14 + 4, y: sim.player.y + 8, vx: 4 });
  });

  it("fires left when facing left", () => {
    const sim = makeSim([{ art: flatArt() }]);
    sim.player.x = 100;
    run(sim, { left: true }, 1);
    const x = sim.player.x;
    run(sim, { shoot: true }, 1);
    expect(sim.shots[0]).toMatchObject({ x: x - 6 - 4, vx: -4 });
  });

  it("does not fire again while shoot is held", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, { shoot: true }, 10);
    expect(sim.shots).toHaveLength(1);
  });

  it("allows only the project's maximum number of shots at once", () => {
    const sim = makeSim([{ art: flatArt() }]);
    for (let i = 0; i < 5; i++) {
      run(sim, { shoot: true }, 1);
      run(sim, {}, 1);
    }
    expect(sim.shots).toHaveLength(3);
  });

  it("removes a shot that hits a wall", () => {
    const sim = makeSim([{ art: flatArt({ 12: rowWith({ 5: "#" }), 11: rowWith({ 5: "#" }) }) }]);
    run(sim, { shoot: true }, 1);
    run(sim, {}, 30);
    expect(sim.shots).toEqual([]);
  });

  it("removes a shot that leaves the screen", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    run(sim, { shoot: true }, 1);
    run(sim, {}, 30);
    expect(sim.shots).toHaveLength(1);
    run(sim, {}, 40);
    expect(sim.shots).toEqual([]);
  });

  it("clears shots on death", () => {
    const sim = makeSim([{ art: flatArt({ 13: "######^#########" }) }]);
    run(sim, { shoot: true }, 1);
    sim.player.x = 5 * 16;
    run(sim, { right: true }, 30);
    expect(sim.phase).toBe("dead");
    expect(sim.shots).toHaveLength(1);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.phase).toBe("play");
    expect(sim.shots).toEqual([]);
  });
});
