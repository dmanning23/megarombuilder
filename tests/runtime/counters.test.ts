import { describe, expect, it } from "vitest";
import { kill } from "@/runtime/sim/hazards";
import { flatArt, rowWith, thing } from "./helpers";
import { entity, makeSim, run, standOn } from "./simHelpers";

describe("the hero's steps in the air", () => {
  it("count up in the air, and start again from zero on each jump", () => {
    const sim = makeSim([{ art: flatArt() }]);
    standOn(sim, 3, 13);
    run(sim, {}, 2);
    expect(sim.player.airSteps).toBe(0);
    run(sim, { jump: true }, 5);
    expect(sim.player.airSteps).toBe(5);
    for (let i = 0; i < 200 && !sim.player.onGround; i++) run(sim, {}, 1);
    expect(sim.player.airSteps).toBe(0);
    run(sim, { jump: true }, 1);
    expect(sim.player.airSteps).toBe(1);
  });
});

describe("the hero's steps in the air after a ladder or a respawn", () => {
  it("don't count while climbing, so letting go starts the jump animation from its first frame", () => {
    const overrides: Record<number, string> = {};
    for (let y = 5; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
    const sim = makeSim([{ art: flatArt(overrides) }]);
    standOn(sim, 4, 13);
    sim.player.x = 62;
    run(sim, { up: true }, 40);
    expect(sim.player.onLadder).toBe(true);
    expect(sim.player.airSteps).toBe(0);
  });

  it("start from zero after a respawn", () => {
    const sim = makeSim([{ art: flatArt() }]);
    standOn(sim, 3, 13);
    sim.player.airSteps = 80;
    kill(sim);
    for (let i = 0; i < 300 && sim.phase !== "play"; i++) run(sim, {}, 1);
    expect(sim.player.airSteps).toBeLessThanOrEqual(1);
  });
});

describe("an entity's steps in its mode", () => {
  it("count up, and start from zero when the mode changes, even to the same attack again", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("boss", 12, 12, { attacks: "aimed,aimed" })] }]);
    const boss = entity(sim, "boss")!;
    sim.player.invuln = 1_000_000;
    for (let i = 0; i < 300 && boss.mode !== "aimed"; i++) run(sim, {}, 1);
    expect(boss.modeSteps).toBe(0);
    run(sim, {}, 10);
    expect(boss.modeSteps).toBe(10);
    for (let i = 0; i < 300 && boss.mode === "aimed"; i++) run(sim, {}, 1);
    for (let i = 0; i < 300 && boss.mode !== "aimed"; i++) run(sim, {}, 1);
    expect(boss.modeSteps).toBe(0); // a second aimed shot starts its own count
  });
});
