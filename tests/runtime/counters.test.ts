import { describe, expect, it } from "vitest";
import { flatArt, thing } from "./helpers";
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
