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

  it("ignore settings an older game stored on a placed copy, so the design always wins", () => {
    const project = withFang("own-e1", { speed: "fast", health: 5 });
    const zone = project.levels[0].zones[0];
    const stale: Project = {
      ...project,
      levels: [{ ...project.levels[0], zones: [{ ...zone, things: [{ ...zone.things[0], settings: { speed: 9, health: 99 } }] }, ...project.levels[0].zones.slice(1)] }],
    };
    const sim = createSim(stale, "L1", pack);
    step(sim, NO_INPUT);
    const fang = sim.slots[0].entity!;
    expect(fang.health).toBe(5);
    expect(fang.settings).toMatchObject({ speed: 0.75 });
  });

  it("are checked like any enemy, by name", () => {
    const check = checkZone(withFang("own-e1", {}, 1), "L1", "z1", pack);
    expect(check.warnings).toContain("The Frost Fang at (1, 12) is right where the player arrives.");
  });
});

describe("the kid's boss in the game", () => {
  it("fights with its own attacks and health", () => {
    let project = run(game(), "createBoss", { name: "Volt Viper" });
    project = run(project, "setBoss", { fight: "long", attacks: ["rain", "big"] });
    project = run(project, "useBoss", { boss: "yours" });
    const sim = createSim(project, "L1", pack, { startZoneId: "boss" });
    step(sim, NO_INPUT);
    const boss = sim.slots.find((s) => s.def.behaviour === "boss")!.entity!;
    expect(boss.health).toBe(40);
    expect(boss.settings.attacks).toBe("rain,big");
  });

  it("leaves the checker's verdict on the boss room unchanged", () => {
    let project = run(game(), "createBoss", { name: "Volt Viper" });
    const before = checkZone(project, "L1", "boss", pack).passable;
    project = run(project, "useBoss", { boss: "yours" });
    expect(checkZone(project, "L1", "boss", pack).passable).toBe(before);
  });
});

describe("the kid's enemies' own hitboxes and shot points", () => {
  function bigTurret(shotY: number) {
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "Ice Eye", behaviour: "turret" });
    const target = { enemy: "e1" };
    project = run(project, "resizeCanvas", { target, canvas: "main", w: 24, h: 24 });
    project = run(project, "setBody", { target, body: { x: 2, y: 4, w: 20, h: 20 } });
    project = run(project, "setShotY", { target, y: shotY });
    return run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 8, y: 12 });
  }

  it("stand on their tile at their own size", () => {
    const sim = createSim(bigTurret(2), "L1", pack);
    step(sim, NO_INPUT);
    const turret = sim.slots.find((s) => s.thing.type === "own-e1")!.entity!;
    expect([turret.w, turret.h]).toEqual([20, 20]);
    expect(turret.y + turret.h).toBe(13 * 16); // feet on the bottom of its tile
    expect(turret.x + turret.w / 2).toBe(8 * 16 + 8); // centred on its tile
  });

  it("shoot from their shot point, while the snow turret still shoots from its middle", () => {
    const sim = createSim(bigTurret(12), "L1", pack);
    sim.player.invuln = 1_000_000;
    for (let i = 0; i < 400 && sim.enemyShots.length === 0; i++) step(sim, NO_INPUT);
    const turret = sim.slots.find((s) => s.thing.type === "own-e1")!.entity!;
    const shot = sim.enemyShots[0];
    expect(shot.y - shot.vy).toBeCloseTo(turret.y + 12); // it has moved once since it was fired
  });
});
