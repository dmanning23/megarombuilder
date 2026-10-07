import { describe, expect, it } from "vitest";
import { checkZone } from "@/checker/check";
import type { EnemyTuning } from "@/model/designs";
import type { Project } from "@/model/schema";
import { createSim } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { NO_INPUT } from "@/runtime/sim/state";
import { game, pack, run } from "../ai/helpers";

// The snow game with the kid's walker "Frost Fang" (e1), and one thing placed in Zone 1.
function withFang(type: string, tuning: Partial<EnemyTuning> = {}, x = 8): Project {
  let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
  if (Object.keys(tuning).length > 0) project = run(project, "setEnemyTuning", { enemyId: "e1", ...tuning });
  return run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type, x, y: 12 });
}

function track(project: Project, steps: number): number[] {
  const sim = createSim(project, "L1", pack);
  const xs: number[] = [];
  for (let i = 0; i < steps; i++) {
    step(sim, NO_INPUT);
    xs.push(sim.slots[0].entity?.x ?? Number.NaN);
  }
  return xs;
}

describe("the kid's own enemies in the game", () => {
  it("play exactly like the snow enemy with the same behaviour, when tuned normal", () => {
    expect(track(withFang("own-e1"), 120)).toEqual(track(withFang("walker"), 120));
  });

  it("follow their tuning, even after they are placed", () => {
    const fast = createSim(withFang("own-e1", { speed: "fast", health: 5, damage: "high" }), "L1", pack);
    step(fast, NO_INPUT);
    const fang = fast.slots[0].entity!;
    expect(fang.health).toBe(5);
    expect(fang.settings).toMatchObject({ speed: 0.75, damage: 4 });
  });

  it("are checked like any enemy, by name", () => {
    const check = checkZone(withFang("own-e1", {}, 1), "L1", "z1", pack);
    expect(check.warnings).toContain("The Frost Fang at (1, 12) is right where the player arrives.");
  });
});
