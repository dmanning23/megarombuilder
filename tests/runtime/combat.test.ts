import { describe, expect, it } from "vitest";
import { HURT_STEPS, INVULN_STEPS, RESPAWN_STEPS } from "@/runtime/sim/constants";
import { kill } from "@/runtime/sim/hazards";
import { flatArt, rowWith, thing } from "./helpers";
import { entity, makeSim, run, standOn } from "./simHelpers";

function shootOnce(sim: ReturnType<typeof makeSim>) {
  run(sim, { shoot: true }, 1);
  run(sim, {}, 1);
}

describe("player shots", () => {
  it("destroy a one-hit enemy", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 8, 12)] }]);
    run(sim, {}, 1);
    shootOnce(sim);
    run(sim, {}, 30);
    expect(entity(sim, "walker")).toBeNull();
    expect(sim.shots).toEqual([]);
  });

  it("take three hits to destroy a turret", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("turret", 10, 12, { interval: 1000 })] }]);
    run(sim, {}, 1);
    shootOnce(sim);
    run(sim, {}, 40);
    expect(entity(sim, "turret")?.health).toBe(2);
    shootOnce(sim);
    run(sim, {}, 40);
    expect(entity(sim, "turret")?.health).toBe(1);
    shootOnce(sim);
    run(sim, {}, 40);
    expect(entity(sim, "turret")).toBeNull();
  });

  it("are blocked by a walking shielded enemy's shield", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("shielded", 8, 12)] }]);
    run(sim, {}, 1);
    shootOnce(sim);
    run(sim, {}, 40);
    expect(entity(sim, "shielded")?.health).toBe(2);
    expect(sim.shots).toEqual([]);
  });

  it("hit a shielded enemy from behind", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("shielded", 8, 12)] }]);
    run(sim, {}, 1);
    const shielded = entity(sim, "shielded");
    if (!shielded) throw new Error("no shielded enemy");
    shielded.facing = 1;
    shootOnce(sim);
    run(sim, {}, 40);
    expect(shielded.health).toBe(1);
  });

  it("hit a shielded enemy from the front while it is open", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("shielded", 4, 12)] }]);
    run(sim, {}, 1);
    const shielded = entity(sim, "shielded");
    if (!shielded) throw new Error("no shielded enemy");
    shielded.mode = "open";
    shielded.timer = 0;
    shootOnce(sim);
    run(sim, {}, 15);
    expect(shielded.health).toBe(1);
  });

  it("pass by pickups", () => {
    const sim = makeSim([
      { art: flatArt(), things: [thing("health", 6, 12), thing("walker", 12, 12)] },
    ]);
    sim.player.health = 28;
    run(sim, {}, 1);
    shootOnce(sim);
    run(sim, {}, 40);
    expect(entity(sim, "health")).not.toBeNull();
    expect(entity(sim, "walker")).toBeNull();
  });
});

describe("contact damage", () => {
  // A walker one tile to the right of the start, which reaches the player on the second step.
  const nearWalker = () => makeSim([{ art: flatArt(), things: [thing("walker", 1, 12)] }]);

  it("hurts the player and pushes them away", () => {
    const sim = nearWalker();
    run(sim, {}, 2);
    expect(sim.player.health).toBe(26);
    expect(sim.player.hurt).toBeGreaterThan(0);
    expect(sim.player.invuln).toBe(INVULN_STEPS - 1);
    expect(sim.player.knockback).toBe(-1);
  });

  it("ignores input while the player is knocked back", () => {
    const sim = nearWalker();
    run(sim, {}, 2);
    run(sim, { right: true, jump: true }, 1);
    expect(sim.player.vx).toBe(-0.75);
    expect(sim.player.vy).toBeGreaterThanOrEqual(0);
  });

  it("gives control back after the knockback", () => {
    const sim = nearWalker();
    run(sim, {}, 2);
    run(sim, {}, HURT_STEPS);
    run(sim, { right: true }, 1);
    expect(sim.player.vx).toBe(1.375);
  });

  it("does not hurt again while invulnerable", () => {
    const sim = nearWalker();
    run(sim, {}, 2);
    run(sim, {}, INVULN_STEPS - 5);
    expect(sim.player.health).toBe(26);
  });

  it("can kill", () => {
    const sim = nearWalker();
    sim.player.health = 2;
    run(sim, {}, 2);
    expect(sim.phase).toBe("dead");
  });

  it("knocks the player off a ladder", () => {
    const overrides: Record<number, string> = {};
    for (let y = 5; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
    const sim = makeSim([
      { art: flatArt(overrides), things: [thing("flyer", 7, 8, { speed: 0, amplitude: 0 })] },
    ]);
    standOn(sim, 4, 13);
    run(sim, { up: true }, 30);
    expect(sim.player.onLadder).toBe(true);
    const flyer = entity(sim, "flyer");
    if (!flyer) throw new Error("no flyer");
    flyer.x = sim.player.x + 4;
    flyer.homeY = sim.player.y;
    run(sim, { up: true }, 1);
    expect(sim.player.onLadder).toBe(false);
    expect(sim.player.hurt).toBeGreaterThan(0);
  });

  it("can knock the player into spikes, which kill as usual", () => {
    // a spike sticking out at body height to the player's left
    const sim = makeSim([
      { art: flatArt({ 12: rowWith({ 4: "^" }) }), things: [thing("walker", 6, 12, { speed: 0 })] },
    ]);
    standOn(sim, 5, 13);
    sim.player.x = 85;
    run(sim, {}, 40);
    expect(sim.phase).toBe("dead");
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.phase).toBe("play");
  });
});

describe("enemy shots", () => {
  it("hurt the player and are used up", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("turret", 8, 12)] }]);
    run(sim, {}, 90);
    expect(sim.enemyShots).toHaveLength(1);
    run(sim, {}, 70);
    expect(sim.player.health).toBe(26);
    expect(sim.enemyShots).toEqual([]);
  });
});

describe("health pickups", () => {
  it("restore health and disappear", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("health", 5, 12)] }]);
    sim.player.health = 20;
    run(sim, { right: true }, 70);
    expect(sim.player.health).toBe(24);
    expect(entity(sim, "health")).toBeNull();
    expect(sim.collected.has("z1:health-5-12")).toBe(true);
  });

  it("do not heal past the maximum", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("health", 5, 12)] }]);
    sim.player.health = 27;
    run(sim, { right: true }, 70);
    expect(sim.player.health).toBe(28);
  });

  it("stay collected after the player respawns", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("health", 5, 12)] }]);
    run(sim, { right: true }, 70);
    kill(sim);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.phase).toBe("play");
    expect(entity(sim, "health")).toBeNull();
  });
});
