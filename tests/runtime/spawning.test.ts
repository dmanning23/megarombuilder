import { describe, expect, it } from "vitest";
import { RESPAWN_STEPS } from "@/runtime/sim/constants";
import { spawnBox } from "@/runtime/sim/entities/spawn";
import { kill } from "@/runtime/sim/hazards";
import { flatArt, thing } from "./helpers";
import { entity, makeSim, run, runUntil } from "./simHelpers";

describe("spawnBox", () => {
  it("stands most things on the bottom of their tile, centred", () => {
    expect(spawnBox(thing("walker", 3, 5), "walker")).toEqual({ x: 49, y: 82, w: 14, h: 14 });
    expect(spawnBox(thing("boss", 3, 5), "boss")).toEqual({ x: 44, y: 68, w: 24, h: 28 });
    expect(spawnBox(thing("health", 3, 5), "health")).toEqual({ x: 51, y: 86, w: 10, h: 10 });
  });

  it("centres flyers, hangs droppers and lays platforms along the top", () => {
    expect(spawnBox(thing("flyer", 3, 5), "flyer")).toEqual({ x: 49, y: 82, w: 14, h: 12 });
    expect(spawnBox(thing("dropper", 3, 5), "dropper")).toEqual({ x: 49, y: 80, w: 14, h: 12 });
    expect(spawnBox(thing("platform", 3, 5), "platform")).toEqual({ x: 48, y: 80, w: 32, h: 8 });
  });
});

describe("slots", () => {
  it("are empty for a zone without things", () => {
    const sim = makeSim([{ art: flatArt() }]);
    expect(sim.slots).toEqual([]);
    expect(sim.enemyShots).toEqual([]);
  });

  it("ignore thing types the pack does not know", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("dragon", 3, 12)] }]);
    expect(sim.slots).toEqual([]);
    run(sim, { right: true }, 10);
    expect(sim.phase).toBe("play");
  });

  it("spawn an enemy that is on screen at the start, facing the player", () => {
    // speed 0 keeps it still once later tasks make walkers move
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 10, 12, { speed: 0 })] }]);
    expect(entity(sim, "walker")).toBeNull();
    run(sim, {}, 1);
    expect(entity(sim, "walker")).toMatchObject({
      x: 161,
      y: 194,
      health: 1,
      facing: -1,
      behaviour: "walker",
      settings: { speed: 0 },
    });
  });

  it("wait to spawn an enemy until its spot scrolls into view", () => {
    const sim = makeSim([{ art: flatArt({}, 3), things: [thing("walker", 40, 12)] }]);
    run(sim, {}, 1);
    expect(entity(sim, "walker")).toBeNull();
    sim.player.x = 600;
    run(sim, {}, 1);
    expect(entity(sim, "walker")).not.toBeNull();
  });

  it("remove an enemy that is well off screen and bring a fresh one back later", () => {
    const sim = makeSim([{ art: flatArt({}, 3), things: [thing("walker", 20, 12)] }]);
    sim.player.x = 300;
    run(sim, {}, 1);
    const first = entity(sim, "walker");
    expect(first).not.toBeNull();
    sim.player.x = 2;
    run(sim, {}, 1);
    expect(entity(sim, "walker")).toBeNull();
    sim.player.x = 300;
    run(sim, {}, 1);
    expect(entity(sim, "walker")).not.toBeNull();
    expect(entity(sim, "walker")).not.toBe(first);
  });

  it("do not bring back a removed enemy while its spot stays on screen", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 10, 12)] }]);
    run(sim, {}, 1);
    sim.slots[0].entity = null;
    run(sim, {}, 30);
    expect(entity(sim, "walker")).toBeNull();
  });

  it("place platforms, pickups and the boss at once, wherever they are", () => {
    const sim = makeSim([
      {
        art: flatArt({}, 3),
        things: [thing("platform", 40, 9), thing("health", 44, 12), thing("boss", 46, 12)],
      },
    ]);
    expect(entity(sim, "platform")).not.toBeNull();
    expect(entity(sim, "health")).not.toBeNull();
    expect(entity(sim, "boss")).toMatchObject({ health: 28, mode: "intro" });
  });

  it("are reloaded on entering the next zone", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt(), things: [thing("walker", 8, 12)] }]);
    expect(sim.slots).toEqual([]);
    runUntil(sim, { right: true }, (s) => s.zoneIndex === 1);
    expect(sim.slots.map((s) => s.thing.type)).toEqual(["walker"]);
  });

  it("are reset when the player respawns", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 10, 12)] }]);
    run(sim, {}, 1);
    const first = entity(sim, "walker");
    kill(sim);
    run(sim, {}, RESPAWN_STEPS + 1);
    expect(entity(sim, "walker")).not.toBe(first);
    expect(entity(sim, "walker")).not.toBeNull();
  });
});

describe("the player", () => {
  it("starts with no damage state", () => {
    const sim = makeSim([{ art: flatArt() }]);
    expect(sim.player).toMatchObject({ hurt: 0, invuln: 0, ridingId: null });
    expect(sim.collected.size).toBe(0);
  });
});
