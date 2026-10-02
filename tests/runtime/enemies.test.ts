import { describe, expect, it } from "vitest";
import { flatArt, rowWith, thing } from "./helpers";
import { entity, makeSim, run, standOn } from "./simHelpers";

describe("walker", () => {
  it("walks toward the player", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 10, 12)] }]);
    run(sim, {}, 10);
    expect(entity(sim, "walker")).toMatchObject({ x: 151, y: 194, facing: -1, onGround: true });
  });

  it("turns round at a wall", () => {
    const wall = flatArt({ 11: rowWith({ 5: "#" }), 12: rowWith({ 5: "#" }) });
    const sim = makeSim([{ art: wall, things: [thing("walker", 9, 12)] }]);
    run(sim, {}, 60);
    const walker = entity(sim, "walker");
    expect(walker?.facing).toBe(1);
    expect(walker?.x).toBeGreaterThanOrEqual(96);
  });

  it("turns round at a ledge instead of walking off", () => {
    const block = flatArt({ 10: "......#####....." });
    const sim = makeSim([{ art: block, things: [thing("walker", 8, 9)] }]);
    for (let i = 0; i < 200; i++) {
      run(sim, {}, 1);
      const walker = entity(sim, "walker");
      expect(walker?.y).toBe(146);
      expect(walker?.x).toBeGreaterThanOrEqual(95);
      expect(walker?.x).toBeLessThanOrEqual(176 - 14 + 1);
    }
  });

  it("falls to the floor when placed in the air", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 8, 5)] }]);
    run(sim, {}, 60);
    expect(entity(sim, "walker")).toMatchObject({ y: 194, onGround: true });
  });
});

describe("flyer", () => {
  it("flies toward the player, bobbing around its spawn height", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("flyer", 12, 5)] }]);
    const heights: number[] = [];
    for (let i = 0; i < 60; i++) {
      run(sim, {}, 1);
      heights.push(entity(sim, "flyer")?.y ?? NaN);
    }
    expect(entity(sim, "flyer")?.x).toBeCloseTo(193 - 60 * 0.75);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(82 - 16);
    expect(Math.max(...heights)).toBeLessThanOrEqual(82 + 16);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(10);
  });

  it("passes through walls", () => {
    const wall = flatArt(Object.fromEntries([...Array(13).keys()].map((y) => [y, rowWith({ 8: "#" })])));
    const sim = makeSim([{ art: wall, things: [thing("flyer", 12, 5)] }]);
    run(sim, {}, 100);
    expect(entity(sim, "flyer")?.x).toBeLessThan(8 * 16);
  });
});

describe("jumper", () => {
  it("waits on the ground, then hops toward the player", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("jumper", 10, 12)] }]);
    run(sim, {}, 30);
    expect(entity(sim, "jumper")).toMatchObject({ onGround: true, x: 161 });
    let hopped = false;
    for (let i = 0; i < 60; i++) {
      run(sim, {}, 1);
      const jumper = entity(sim, "jumper");
      if (jumper && !jumper.onGround && jumper.vx < 0) hopped = true;
    }
    expect(hopped).toBe(true);
    run(sim, {}, 30);
    expect(entity(sim, "jumper")?.x).toBeLessThan(161);
  });
});

describe("dropper", () => {
  it("hangs still until the player is below it", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("dropper", 8, 3)] }]);
    run(sim, {}, 30);
    expect(entity(sim, "dropper")).toMatchObject({ y: 48, mode: "hang" });
  });

  it("drops onto the floor when the player passes under it, then walks toward them", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("dropper", 8, 3)] }]);
    run(sim, {}, 1);
    standOn(sim, 8, 13);
    run(sim, {}, 60);
    expect(entity(sim, "dropper")).toMatchObject({ y: 196, mode: "walk", onGround: true });
  });
});
