import { describe, expect, it } from "vitest";
import { cameraFor } from "@/runtime/sim/view";
import { flatArt, rowWith } from "./helpers";
import { makeSim } from "./simHelpers";

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
