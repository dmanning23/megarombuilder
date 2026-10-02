import { describe, expect, it } from "vitest";
import { flatArt, rowWith, thing } from "./helpers";
import { entity, makeSim, run } from "./simHelpers";

describe("turret", () => {
  it("fires a shot aimed at a player in range", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("turret", 8, 12)] }]);
    run(sim, {}, 89);
    expect(sim.enemyShots).toEqual([]);
    run(sim, {}, 1);
    expect(sim.enemyShots).toHaveLength(1);
    const shot = sim.enemyShots[0];
    expect(shot.vx).toBeLessThan(-1.9);
    expect(Math.hypot(shot.vx, shot.vy)).toBeCloseTo(2);
    expect(shot.damage).toBe(2);
    expect(entity(sim, "turret")?.x).toBe(129);
  });

  it("holds fire while the player is out of range", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("turret", 15, 12)] }]);
    run(sim, {}, 300);
    expect(sim.enemyShots).toEqual([]);
  });

  it("uses the thing's own settings", () => {
    const sim = makeSim([
      { art: flatArt(), things: [thing("turret", 8, 12, { interval: 10, shotSpeed: 3 })] },
    ]);
    run(sim, {}, 10);
    expect(Math.hypot(sim.enemyShots[0].vx, sim.enemyShots[0].vy)).toBeCloseTo(3);
  });
});

describe("enemy shots", () => {
  it("stop at walls", () => {
    const wall = flatArt({ 11: rowWith({ 3: "#" }), 12: rowWith({ 3: "#" }) });
    const sim = makeSim([{ art: wall, things: [thing("turret", 8, 12)] }]);
    run(sim, {}, 90);
    expect(sim.enemyShots).toHaveLength(1);
    run(sim, {}, 60);
    expect(sim.enemyShots).toEqual([]);
  });

  it("leave the screen and do not pile up over a long session", () => {
    const sim = makeSim([
      { art: flatArt({}, 3), things: [thing("turret", 12, 12, { interval: 5 })] },
    ]);
    // Hold the player in the air, in range, so the turret keeps firing upward past them.
    const hold = () => {
      sim.player.x = 250;
      sim.player.y = 40;
      sim.player.vy = 0;
      sim.player.invuln = 1_000_000;
    };
    hold();
    let most = 0;
    for (let i = 0; i < 3000; i++) {
      run(sim, {}, 1);
      hold();
      most = Math.max(most, sim.enemyShots.length);
    }
    expect(sim.slots[0].entity).not.toBeNull();
    expect(most).toBeLessThan(60);
  });
});

describe("shielded", () => {
  it("opens and fires a straight shot at the player after its interval", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("shielded", 10, 12)] }]);
    run(sim, {}, 119);
    expect(entity(sim, "shielded")?.mode).toBe("walk");
    run(sim, {}, 1);
    expect(entity(sim, "shielded")).toMatchObject({ mode: "open", facing: -1 });
    expect(sim.enemyShots).toHaveLength(1);
    expect(sim.enemyShots[0]).toMatchObject({ vx: -2, vy: 0 });
  });

  it("closes again and walks on", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("shielded", 10, 12)] }]);
    run(sim, {}, 120);
    const x = entity(sim, "shielded")?.x;
    run(sim, {}, 29);
    expect(entity(sim, "shielded")).toMatchObject({ mode: "open", x });
    run(sim, {}, 1);
    expect(entity(sim, "shielded")?.mode).toBe("walk");
  });
});
