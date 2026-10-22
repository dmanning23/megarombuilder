import { describe, expect, it } from "vitest";
import { hitEntities } from "@/runtime/sim/combat";
import { SNIPER_GUARD_STEPS, SNIPER_OPEN_STEPS } from "@/runtime/sim/entities/enemies";
import { createSim, type Sim } from "@/runtime/sim/state";
import { flatArt, projectFromArt, thing } from "./helpers";
import { entity, run } from "./simHelpers";
import { testPack } from "../fixtures/testPack";

// A flat screen with the hero at the left and a Sniper at tile 10, standing on the floor.
function sim(): Sim {
  const s = createSim(projectFromArt([{ art: flatArt(), things: [thing("sniper", 10, 12)] }]), "L1", testPack);
  run(s, {}, 5);
  return s;
}
const sniper = (s: Sim) => entity(s, "sniper")!;
// Steps until the Sniper is in a mode, at most `limit` steps.
function until(s: Sim, mode: string, limit = 400) {
  for (let i = 0; i < limit && sniper(s).mode !== mode; i++) run(s, {}, 1);
}

describe("the Sniper", () => {
  it("stands its ground, facing the hero", () => {
    const s = sim();
    const x = sniper(s).x;
    run(s, {}, 300);
    expect(sniper(s).x).toBe(x);
    expect(sniper(s).facing).toBe(-1); // the hero is to its left
  });

  it("guards for 2 seconds, then fires three level shots 12 steps apart and guards again", () => {
    const s = sim();
    until(s, "shoot");
    s.enemyShots = [];
    const fired: number[] = [];
    for (let i = 1; i <= SNIPER_OPEN_STEPS; i++) {
      const before = s.enemyShots.length;
      run(s, {}, 1);
      if (s.enemyShots.length > before) fired.push(i);
    }
    expect(fired).toHaveLength(3);
    expect(fired[1] - fired[0]).toBe(12);
    expect(fired[2] - fired[1]).toBe(12);
    expect(s.enemyShots.every((shot) => shot.vy === 0 && shot.vx < 0)).toBe(true);
    expect(sniper(s).mode).toBe("guard");
    const guardStart = s.steps;
    until(s, "shoot");
    expect(s.steps - guardStart).toBe(SNIPER_GUARD_STEPS);
  });

  it("fires from its shot point: low, for the pack's Sniper", () => {
    const s = sim();
    until(s, "shoot");
    s.enemyShots = [];
    run(s, {}, 2);
    expect(s.enemyShots[0].y).toBe(sniper(s).y + 9);
  });

  it("blocks shots at its shield while guarding, but not at its back, and not while shooting", () => {
    const s = sim();
    const e = sniper(s);
    const health = e.health;
    const shotAt = (vx: number) => ({ x: e.x + 2, y: e.y + 4, vx });
    e.mode = "guard";
    e.facing = -1;
    s.shots = [shotAt(4)]; // coming from the left, into its shield
    hitEntities(s);
    expect(e.health).toBe(health);
    e.facing = 1;
    s.shots = [shotAt(4)]; // the same shot, now at its back
    hitEntities(s);
    expect(e.health).toBe(health - 1);
    e.facing = -1;
    e.mode = "shoot";
    s.shots = [shotAt(4)]; // at its front, but the shield is down
    hitEntities(s);
    expect(e.health).toBe(health - 2);
  });

  it("keeps its burst going the way it started when the hero jumps over it", () => {
    const s = sim();
    until(s, "shoot");
    s.player.x = sniper(s).x + 40; // the hero is suddenly behind it
    s.enemyShots = [];
    run(s, {}, 30);
    expect(s.enemyShots.length).toBeGreaterThan(0);
    expect(s.enemyShots.every((shot) => shot.vx < 0)).toBe(true); // still the way it started
    until(s, "guard");
    run(s, {}, 1);
    expect(sniper(s).facing).toBe(1); // it turns once it guards again
  });
});
