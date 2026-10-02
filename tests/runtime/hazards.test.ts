import { describe, expect, it } from "vitest";
import { RESPAWN_STEPS } from "@/runtime/sim/constants";
import { kill } from "@/runtime/sim/hazards";
import { flatArt, rowWith } from "./helpers";
import { makeSim, run, runUntil, standOn } from "./simHelpers";

const FLOOR_Y = 13 * 16 - 22;
const GAP = { 13: "###...##########", 14: "###...##########" };

describe("pits", () => {
  it("kills a player who falls out of the bottom of the zone", () => {
    const sim = makeSim([{ art: flatArt(GAP) }]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, (s) => s.phase === "dead", 120);
    expect(sim.player.health).toBe(0);
    expect(sim.timer).toBe(RESPAWN_STEPS);
  });

  it("ignores input while dead", () => {
    const sim = makeSim([{ art: flatArt(GAP) }]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, (s) => s.phase === "dead", 120);
    const { x, y } = sim.player;
    run(sim, { right: true, jump: true }, 10);
    expect(sim.player.x).toBe(x);
    expect(sim.player.y).toBe(y);
  });

  it("respawns at the level start with full health", () => {
    const sim = makeSim([{ art: flatArt(GAP) }]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, (s) => s.phase === "dead", 120);
    run(sim, {}, RESPAWN_STEPS - 1);
    expect(sim.phase).toBe("dead");
    run(sim, {}, 1);
    expect(sim.phase).toBe("play");
    expect(sim.player).toMatchObject({ x: 2, y: FLOOR_Y, vx: 0, vy: 0, health: 28 });
  });

  it("does not jump on respawn because jump was held through the death", () => {
    const sim = makeSim([{ art: flatArt(GAP) }]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, (s) => s.phase === "dead", 120);
    run(sim, { jump: true }, RESPAWN_STEPS + 20);
    expect(sim.phase).toBe("play");
    expect(sim.player.y).toBe(FLOOR_Y);
  });
});

describe("spikes", () => {
  const spiked = { art: flatArt({ 13: "######^#########" }) };

  it("kills a player who walks onto them", () => {
    const sim = makeSim([spiked]);
    runUntil(sim, { right: true }, (s) => s.phase === "dead", 120);
    expect(sim.player.x).toBeGreaterThan(5 * 16 - 14);
    expect(sim.player.x).toBeLessThan(7 * 16);
  });

  it("leaves a player standing beside them alone", () => {
    const sim = makeSim([spiked]);
    standOn(sim, 4, 13);
    run(sim, {}, 30);
    expect(sim.phase).toBe("play");
  });

  it("kills from the side too", () => {
    const sim = makeSim([{ art: flatArt({ 12: rowWith({ 6: "^" }) }) }]);
    runUntil(sim, { right: true }, (s) => s.phase === "dead", 120);
    expect(sim.phase).toBe("dead");
  });
});

describe("checkpoints", () => {
  it("moves the respawn point when touched", () => {
    const sim = makeSim([{ art: flatArt() }], [{ zoneId: "z1", x: 8, y: 12 }]);
    run(sim, { right: true }, 60);
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 2, y: FLOOR_Y });
    run(sim, { right: true }, 60);
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 8 * 16 + 1, y: FLOOR_Y });
  });

  it("respawns the player there", () => {
    const sim = makeSim([{ art: flatArt() }], [{ zoneId: "z1", x: 8, y: 12 }]);
    run(sim, { right: true }, 120);
    kill(sim);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.phase).toBe("play");
    expect(sim.player).toMatchObject({ x: 8 * 16 + 1, y: FLOOR_Y, health: 28 });
  });

  it("ignores checkpoints that belong to other zones", () => {
    const sim = makeSim([{ art: flatArt() }], [{ zoneId: "boss", x: 8, y: 12 }]);
    run(sim, { right: true }, 120);
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 2, y: FLOOR_Y });
  });
});

describe("kill", () => {
  it("does not restart the timer when already dead", () => {
    const sim = makeSim([{ art: flatArt() }]);
    kill(sim);
    run(sim, {}, 10);
    kill(sim);
    expect(sim.timer).toBe(RESPAWN_STEPS - 10);
  });
});
