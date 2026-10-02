import { describe, expect, it } from "vitest";
import { TRANSITION_STEPS } from "@/runtime/sim/constants";
import { cameraFor, viewFor } from "@/runtime/sim/view";
import { flatArt, rowWith } from "./helpers";
import { makeSim, run, runUntil, standOn } from "./simHelpers";

describe("cameraFor", () => {
  it("stays at the left edge at the start of a zone", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    expect(cameraFor(sim)).toEqual({ x: 0, y: 0 });
  });

  it("centres on the player in the middle of a wide zone", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    sim.player.x = 400;
    expect(cameraFor(sim)).toEqual({ x: 400 + 7 - 128, y: 0 });
  });

  it("stops at the right edge", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    sim.player.x = 760;
    expect(cameraFor(sim)).toEqual({ x: 768 - 256, y: 0 });
  });

  it("follows the player up and down a vertical zone", () => {
    const art = Array.from({ length: 30 }, () => rowWith({ 7: "H" }));
    const sim = makeSim([{ art, entry: { edge: "bottom", from: 7, to: 8 } }]);
    expect(cameraFor(sim)).toEqual({ x: 0, y: 240 });
    sim.player.y = 300;
    expect(cameraFor(sim)).toEqual({ x: 0, y: 300 + 11 - 120 });
    sim.player.y = 10;
    expect(cameraFor(sim)).toEqual({ x: 0, y: 0 });
  });
});

describe("viewFor", () => {
  it("draws only the current zone in normal play", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    sim.player.x = 400;
    expect(viewFor(sim)).toEqual({
      camera: { x: 279, y: 0 },
      incoming: { dx: 0, dy: 0 },
      outgoing: null,
    });
  });

  it("slides the screens sideways when moving right", () => {
    const sim = makeSim([{ art: flatArt({}, 2) }, { art: flatArt() }]);
    runUntil(sim, { right: true }, (s) => s.zoneIndex === 1);
    expect(viewFor(sim)).toEqual({
      camera: { x: 0, y: 0 },
      incoming: { dx: 256, dy: 0 },
      outgoing: { zoneIndex: 0, camera: { x: 256, y: 0 }, dx: 0, dy: 0 },
    });
    run(sim, {}, TRANSITION_STEPS / 2);
    expect(viewFor(sim).incoming).toEqual({ dx: 128, dy: 0 });
    expect(viewFor(sim).outgoing).toMatchObject({ dx: -128, dy: 0 });
  });

  it("slides the screens down when moving up", () => {
    const overrides: Record<number, string> = {};
    for (let y = 0; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
    const shaft = Array.from({ length: 30 }, () => rowWith({ 7: "H" }));
    const sim = makeSim([
      { art: flatArt(overrides), exit: { edge: "top", from: 4, to: 5 } },
      { art: shaft, entry: { edge: "bottom", from: 7, to: 8 } },
    ]);
    standOn(sim, 4, 13);
    runUntil(sim, { up: true }, (s) => s.zoneIndex === 1);
    run(sim, {}, TRANSITION_STEPS / 2);
    expect(viewFor(sim).camera).toEqual({ x: 0, y: 240 });
    expect(viewFor(sim).incoming).toEqual({ dx: 0, dy: -120 });
    expect(viewFor(sim).outgoing).toMatchObject({ zoneIndex: 0, dx: 0, dy: 120 });
  });
});
