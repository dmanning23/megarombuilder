import { describe, expect, it } from "vitest";
import { BOSS_FLASH_STEPS, BOSS_INTRO_STEPS } from "@/runtime/sim/constants";
import type { Entity } from "@/runtime/sim/entities/types";
import { flatArt, thing } from "./helpers";
import { entity, makeSim, run } from "./simHelpers";

function arena() {
  const sim = makeSim([{ art: flatArt(), things: [thing("boss", 12, 12)] }]);
  const boss = entity(sim, "boss");
  if (!boss) throw new Error("no boss");
  return { sim, boss };
}

// Puts a player shot right on the boss.
function hit(sim: ReturnType<typeof makeSim>, boss: Entity) {
  sim.shots.push({ x: boss.x + 4, y: boss.y + 8, vx: 0 });
  run(sim, {}, 1);
}

describe("the boss", () => {
  it("waits through its intro, then goes idle", () => {
    const { sim, boss } = arena();
    run(sim, {}, BOSS_INTRO_STEPS - 1);
    expect(boss.mode).toBe("intro");
    run(sim, {}, 1);
    expect(boss.mode).toBe("idle");
  });

  it("does no damage and takes none during its intro", () => {
    const { sim, boss } = arena();
    sim.player.x = boss.x;
    run(sim, {}, 10);
    expect(sim.player.health).toBe(28);
    hit(sim, boss);
    expect(boss.health).toBe(28);
  });

  it("attacks in the order jump, spread, dash, then repeats", () => {
    const { sim, boss } = arena();
    sim.player.invuln = 1_000_000;
    const attacks: string[] = [];
    for (let i = 0; i < 1500 && attacks.length < 4; i++) {
      const before = boss.mode;
      run(sim, {}, 1);
      if (boss.mode !== before && boss.mode !== "idle") attacks.push(boss.mode);
    }
    expect(attacks).toEqual(["jump", "spread", "dash", "jump"]);
  });

  it("fires three spreading shots in its shot attack", () => {
    const { sim, boss } = arena();
    sim.player.invuln = 1_000_000;
    for (let i = 0; i < 1500 && boss.mode !== "spread"; i++) run(sim, {}, 1);
    expect(sim.enemyShots.map((s) => s.vy).sort((a, b) => a - b)).toEqual([-0.5, 0, 0.5]);
    expect(sim.enemyShots.every((s) => s.vx === -2 && s.damage === 3)).toBe(true);
  });

  it("loses health when hit, then ignores hits while it flashes", () => {
    const { sim, boss } = arena();
    run(sim, {}, BOSS_INTRO_STEPS);
    boss.timer = 10_000; // stay idle
    hit(sim, boss);
    expect(boss.health).toBe(27);
    expect(boss.flash).toBe(BOSS_FLASH_STEPS - 1);
    hit(sim, boss);
    expect(boss.health).toBe(27);
    run(sim, {}, BOSS_FLASH_STEPS);
    hit(sim, boss);
    expect(boss.health).toBe(26);
  });

  it("wins the stage when defeated, and the game then stands still", () => {
    const { sim, boss } = arena();
    run(sim, {}, BOSS_INTRO_STEPS);
    boss.timer = 10_000;
    boss.health = 1;
    hit(sim, boss);
    expect(sim.phase).toBe("won");
    expect(entity(sim, "boss")).toBeNull();
    const { x } = sim.player;
    run(sim, { right: true }, 30);
    expect(sim.player.x).toBe(x);
  });

  it("wins the stage even if the boss's touch would have killed the player on the same step", () => {
    const { sim, boss } = arena();
    run(sim, {}, BOSS_INTRO_STEPS);
    boss.timer = 10_000;
    boss.health = 1;
    sim.player.health = 1;
    sim.player.x = boss.x;
    hit(sim, boss);
    expect(sim.phase).toBe("won");
  });

  it("comes back to its spot instead of falling out of the room for ever", () => {
    const pit = flatArt({ 13: "######..........", 14: "######.........." });
    const sim = makeSim([{ art: pit, things: [thing("boss", 10, 12)] }]);
    const boss = entity(sim, "boss");
    if (!boss) throw new Error("no boss");
    sim.player.invuln = 1_000_000;
    const attacks = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      run(sim, {}, 1);
      sim.player.invuln = 1_000_000;
      attacks.add(boss.mode);
      expect(boss.y).toBeLessThanOrEqual(sim.map.heightPx);
    }
    expect([...attacks]).toEqual(expect.arrayContaining(["jump", "spread", "dash"]));
  });
});
