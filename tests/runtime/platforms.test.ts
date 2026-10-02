import { describe, expect, it } from "vitest";
import { flatArt, thing } from "./helpers";
import { entity, makeSim, run, standOn } from "./simHelpers";

const sideways = (speed = 0.5) => thing("platform", 4, 9, { axis: "x", distance: 4, speed });

function onPlatform(sim: ReturnType<typeof makeSim>) {
  const platform = entity(sim, "platform");
  if (!platform) throw new Error("no platform");
  sim.player.x = platform.x + 6;
  sim.player.y = platform.y - 22;
  sim.player.vy = 0;
  run(sim, {}, 1);
  return platform;
}

describe("moving platforms", () => {
  it("move back and forth over their distance", () => {
    const sim = makeSim([{ art: flatArt(), things: [sideways()] }]);
    run(sim, {}, 64);
    expect(entity(sim, "platform")).toMatchObject({ x: 96, y: 144 });
    run(sim, {}, 64);
    expect(entity(sim, "platform")?.x).toBe(128);
    run(sim, {}, 64);
    expect(entity(sim, "platform")?.x).toBe(96);
    run(sim, {}, 64);
    expect(entity(sim, "platform")?.x).toBe(64);
  });

  it("can move up and down", () => {
    const sim = makeSim([
      { art: flatArt(), things: [thing("platform", 4, 5, { axis: "y", distance: 2, speed: 1 })] },
    ]);
    run(sim, {}, 16);
    expect(entity(sim, "platform")).toMatchObject({ x: 64, y: 96 });
    run(sim, {}, 32);
    expect(entity(sim, "platform")?.y).toBe(96);
  });

  it("carry a player standing on them", () => {
    const sim = makeSim([{ art: flatArt(), things: [sideways()] }]);
    const platform = onPlatform(sim);
    expect(sim.player.ridingId).toBe(platform.id);
    const x = sim.player.x;
    run(sim, {}, 20);
    expect(sim.player.x).toBeCloseTo(x + 10);
    expect(sim.player.y + 22).toBe(platform.y);
    expect(sim.player.onGround).toBe(true);
  });

  it("carry a rider down without them falling behind", () => {
    const sim = makeSim([
      { art: flatArt(), things: [thing("platform", 4, 5, { axis: "y", distance: 3, speed: 1 })] },
    ]);
    const platform = onPlatform(sim);
    for (let i = 0; i < 40; i++) {
      run(sim, {}, 1);
      expect(sim.player.y + 22).toBe(platform.y);
    }
  });

  it("let a rider jump off", () => {
    const sim = makeSim([{ art: flatArt(), things: [sideways()] }]);
    onPlatform(sim);
    run(sim, { jump: true }, 1);
    expect(sim.player.vy).toBeLessThan(0);
    expect(sim.player.ridingId).toBeNull();
  });

  it("are landed on from above and passed through from below", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("platform", 4, 11, { speed: 0 })] }]);
    standOn(sim, 4, 13);
    run(sim, { jump: true }, 60);
    expect(sim.player.y).toBe(11 * 16 - 22);
    expect(sim.player.onGround).toBe(true);
  });

  it("drop a rider who walks off the end", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("platform", 4, 9, { speed: 0 })] }]);
    onPlatform(sim);
    run(sim, { right: true }, 60);
    expect(sim.player.ridingId).toBeNull();
    expect(sim.player.y).toBe(13 * 16 - 22);
  });
});
