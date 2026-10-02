import { describe, expect, it } from "vitest";
import { flatArt, rowWith } from "./helpers";
import { makeSim, run, standOn } from "./simHelpers";

const FLOOR_Y = 13 * 16 - 22;
const LADDER_TOP_Y = 5 * 16 - 22; // standing on the top of a ladder whose top tile is row 5

// A ladder in column 4 from row 5 down to the floor.
function ladderSim() {
  const overrides: Record<number, string> = {};
  for (let y = 5; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
  return makeSim([{ art: flatArt(overrides) }]);
}

describe("ladders", () => {
  it("grabs a ladder when up is pressed, centring on it", () => {
    const sim = ladderSim();
    standOn(sim, 4, 13);
    sim.player.x = 62;
    run(sim, { up: true }, 1);
    expect(sim.player.onLadder).toBe(true);
    expect(sim.player.x).toBe(65);
    expect(sim.player.y).toBe(FLOOR_Y - 1.25);
  });

  it("does not grab when there is no ladder", () => {
    const sim = ladderSim();
    standOn(sim, 8, 13);
    run(sim, { up: true }, 5);
    expect(sim.player.onLadder).toBe(false);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("does not grab without pressing up", () => {
    const sim = ladderSim();
    standOn(sim, 4, 13);
    run(sim, {}, 5);
    expect(sim.player.onLadder).toBe(false);
  });

  it("hangs still, ignoring gravity and sideways keys", () => {
    const sim = ladderSim();
    standOn(sim, 4, 13);
    run(sim, { up: true }, 20);
    const { x, y } = sim.player;
    run(sim, { right: true }, 20);
    expect(sim.player.onLadder).toBe(true);
    expect(sim.player.x).toBe(x);
    expect(sim.player.y).toBe(y);
  });

  it("lets go on jump and falls", () => {
    const sim = ladderSim();
    standOn(sim, 4, 13);
    run(sim, { up: true }, 40);
    run(sim, { jump: true }, 1);
    expect(sim.player.onLadder).toBe(false);
    run(sim, {}, 60);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("climbs off the top and stands on the ladder", () => {
    const sim = ladderSim();
    standOn(sim, 4, 13);
    run(sim, { up: true }, 200);
    expect(sim.player.onLadder).toBe(false);
    expect(sim.player.onGround).toBe(true);
    expect(sim.player.y).toBe(LADDER_TOP_Y);
  });

  it("stays on top of the ladder when idle", () => {
    const sim = ladderSim();
    standOn(sim, 4, 5);
    run(sim, {}, 30);
    expect(sim.player.y).toBe(LADDER_TOP_Y);
    expect(sim.player.onGround).toBe(true);
  });

  it("climbs down from the top when down is pressed", () => {
    const sim = ladderSim();
    standOn(sim, 4, 5);
    run(sim, { down: true }, 1);
    expect(sim.player.onLadder).toBe(true);
    expect(sim.player.y).toBe(LADDER_TOP_Y + 1.25);
  });

  it("lets go on reaching the floor", () => {
    const sim = ladderSim();
    standOn(sim, 4, 5);
    run(sim, { down: true }, 200);
    expect(sim.player.onLadder).toBe(false);
    expect(sim.player.onGround).toBe(true);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("lets go when climbing off the bottom of a ladder that ends in the air", () => {
    const sim = makeSim([
      { art: flatArt({ 5: rowWith({ 4: "H" }), 6: rowWith({ 4: "H" }), 7: rowWith({ 4: "H" }) }) },
    ]);
    standOn(sim, 4, 5);
    run(sim, { down: true }, 200);
    expect(sim.player.onLadder).toBe(false);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("stops climbing at a solid ceiling", () => {
    const overrides: Record<number, string> = { 4: "#".repeat(16) };
    for (let y = 5; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
    const sim = makeSim([{ art: flatArt(overrides) }]);
    standOn(sim, 4, 13);
    run(sim, { up: true }, 200);
    expect(sim.player.onLadder).toBe(true);
    expect(sim.player.y).toBe(5 * 16);
  });
});
