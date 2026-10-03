import { describe, expect, it } from "vitest";
import { createSim } from "@/runtime/sim/state";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith } from "./helpers";
import { makeSim, run, standOn } from "./simHelpers";

const FLOOR_Y = 13 * 16 - 22; // the player's y when standing on the default floor

describe("createSim", () => {
  it("starts the player at the bottom of the first zone's entry", () => {
    const sim = makeSim([{ art: flatArt() }]);
    expect(sim.zoneIndex).toBe(0);
    expect(sim.phase).toBe("play");
    expect(sim.player).toMatchObject({ x: 2, y: FLOOR_Y, w: 14, h: 22, facing: 1, health: 28 });
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 2, y: FLOOR_Y });
  });

  it("can start from a named zone", () => {
    const sim = makeSim([{ art: flatArt() }], [], "boss");
    expect(sim.zoneIndex).toBe(2);
    expect(sim.map.zone.id).toBe("boss");
  });

  it("starts on the ladder in a bottom opening, whichever column it is in", () => {
    for (const col of [7, 8]) {
      const art = Array.from({ length: 30 }, () => rowWith({ [col]: "H" }));
      const sim = makeSim([{ art, entry: { edge: "bottom", from: 7, to: 8 } }]);
      expect(sim.player.x, `ladder in column ${col}`).toBe(col * 16 + 1);
      expect(sim.player.y).toBe(480 - 22);
      expect(sim.player.onLadder).toBe(true);
    }
  });

  it("starts in the first column of a bottom opening with no ladder", () => {
    const art = Array.from({ length: 30 }, () => rowWith({}));
    const sim = makeSim([{ art, entry: { edge: "bottom", from: 7, to: 8 } }]);
    expect(sim.player.x).toBe(7 * 16 + 1);
  });

  it("throws a clear error for an unknown level or zone", () => {
    const project = projectFromArt([{ art: flatArt() }]);
    expect(() => createSim(project, "nope", testPack)).toThrow(/no level with id "nope"/);
    expect(() => createSim(project, "L1", testPack, { startZoneId: "zz" })).toThrow(
      /no zone with id "zz"/,
    );
  });
});

describe("standing and running", () => {
  it("rests on the floor", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 10);
    expect(sim.player.y).toBe(FLOOR_Y);
    expect(sim.player.onGround).toBe(true);
    expect(sim.steps).toBe(10);
  });

  it("runs right at the project's run speed", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, { right: true }, 60);
    expect(sim.player.x).toBe(2 + 60 * 1.375);
    expect(sim.player.facing).toBe(1);
  });

  it("runs left, faces left and stops at the zone's left edge", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, { left: true }, 20);
    expect(sim.player.x).toBe(0);
    expect(sim.player.facing).toBe(-1);
  });

  it("stops against a wall", () => {
    const sim = makeSim([{ art: flatArt({ 12: rowWith({ 5: "#" }) }) }]);
    run(sim, { right: true }, 120);
    expect(sim.player.x).toBe(5 * 16 - 14);
  });

  it("uses the project's player settings", () => {
    const project = projectFromArt([{ art: flatArt() }]);
    const fast = { ...project, player: { ...project.player, runSpeed: 2 } };
    const sim = createSim(fast, "L1", testPack);
    run(sim, { right: true }, 10);
    expect(sim.player.x).toBe(22);
  });
});

describe("jumping", () => {
  function apexOf(sim: ReturnType<typeof makeSim>, hold: number): number {
    let top = sim.player.y;
    for (let i = 0; i < 60; i++) {
      run(sim, { jump: i < hold }, 1);
      top = Math.min(top, sim.player.y);
    }
    return FLOOR_Y - top;
  }

  it("rises about 45 pixels on a full jump and lands again", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 1);
    expect(apexOf(sim, 60)).toBeCloseTo(45.125);
    expect(sim.player.y).toBe(FLOOR_Y);
    expect(sim.player.onGround).toBe(true);
  });

  it("makes a short hop when jump is released early", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 1);
    expect(apexOf(sim, 1)).toBeLessThan(10);
  });

  it("does not jump again in the air", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 1);
    run(sim, { jump: true }, 5);
    run(sim, {}, 1);
    run(sim, { jump: true }, 1);
    expect(sim.player.vy).toBe(-0.5);
  });

  it("does not jump again while jump stays held on landing", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, {}, 1);
    run(sim, { jump: true }, 120);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("bumps its head on a ceiling", () => {
    const sim = makeSim([{ art: flatArt({ 10: "#".repeat(16) }) }]);
    run(sim, {}, 1);
    let top = sim.player.y;
    for (let i = 0; i < 40; i++) {
      run(sim, { jump: true }, 1);
      top = Math.min(top, sim.player.y);
    }
    expect(top).toBe(11 * 16);
  });

  it("jumps up through a ledge and lands on it", () => {
    const sim = makeSim([{ art: flatArt({ 11: rowWith({ 3: "=", 4: "=", 5: "=" }) }) }]);
    standOn(sim, 4, 13);
    run(sim, { jump: true }, 60);
    expect(sim.player.y).toBe(11 * 16 - 22);
    expect(sim.player.onGround).toBe(true);
  });
});

describe("ice", () => {
  const ice = { art: flatArt({ 13: "~".repeat(16) }) };

  it("builds up speed slowly", () => {
    const sim = makeSim([ice]);
    run(sim, {}, 1);
    run(sim, { right: true }, 10);
    expect(sim.player.onIce).toBe(true);
    expect(sim.player.vx).toBeCloseTo(0.5);
  });

  it("keeps sliding after the key is released", () => {
    const sim = makeSim([ice]);
    run(sim, {}, 1);
    run(sim, { right: true }, 10);
    run(sim, {}, 5);
    expect(sim.player.vx).toBeCloseTo(0.25);
  });

  it("is not slippery on normal ground", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, { right: true }, 10);
    run(sim, {}, 1);
    expect(sim.player.vx).toBe(0);
    expect(sim.player.onIce).toBe(false);
  });
});
