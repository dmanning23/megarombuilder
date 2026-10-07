import { describe, expect, it } from "vitest";
import { BIG_SHOT_SIZE, BOSS_IDLE_STEPS, BOSS_HURRIED_IDLE_STEPS, PLAYER_H } from "@/runtime/sim/constants";
import { attacksOf } from "@/runtime/sim/entities/boss";
import type { Entity } from "@/runtime/sim/entities/types";
import type { Sim } from "@/runtime/sim/state";
import { flatArt, thing } from "./helpers";
import { entity, makeSim, run } from "./simHelpers";

function arena(attacks?: string, x = 12, art = flatArt()) {
  const settings: Record<string, string> = attacks === undefined ? {} : { attacks };
  const sim = makeSim([{ art, things: [thing("boss", x, 12, settings)] }]);
  const boss = entity(sim, "boss");
  if (!boss) throw new Error("no boss");
  sim.player.invuln = 1_000_000;
  return { sim, boss };
}

// Runs until the boss starts the given attack (or gives up).
function until(sim: Sim, boss: Entity, mode: string) {
  for (let i = 0; i < 2000 && boss.mode !== mode; i++) run(sim, {}, 1);
  expect(boss.mode).toBe(mode);
}

function order(sim: Sim, boss: Entity, count: number): string[] {
  const seen: string[] = [];
  for (let i = 0; i < 4000 && seen.length < count; i++) {
    const before = boss.mode;
    run(sim, {}, 1);
    if (boss.mode !== before && boss.mode !== "idle") seen.push(boss.mode);
  }
  return seen;
}

describe("boss attack lists", () => {
  it("default to jump, spread, dash", () => {
    const { boss } = arena();
    expect(attacksOf(boss)).toEqual(["jump", "spread", "dash"]);
  });

  it("follow the order given, round and round, skipping unknown names", () => {
    const { sim, boss } = arena("rain, fireworks,big");
    expect(attacksOf(boss)).toEqual(["rain", "big"]);
    expect(order(sim, boss, 4)).toEqual(["rain", "big", "rain", "big"]);
  });

  it("leave the Blizzard Bot (no attack list) pausing as before when hurt", () => {
    const { sim, boss } = arena();
    boss.health = 5;
    until(sim, boss, "jump");
    for (let i = 0; i < 400 && boss.mode !== "idle"; i++) run(sim, {}, 1);
    expect(boss.timer).toBe(BOSS_IDLE_STEPS);
  });

  it("pause for less time between attacks below half health", () => {
    const { sim, boss } = arena("aimed,aimed");
    until(sim, boss, "aimed");
    for (let i = 0; i < 200 && boss.mode !== "idle"; i++) run(sim, {}, 1);
    expect(boss.timer).toBe(BOSS_IDLE_STEPS);
    boss.health = 13;
    until(sim, boss, "aimed");
    for (let i = 0; i < 200 && boss.mode !== "idle"; i++) run(sim, {}, 1);
    expect(boss.timer).toBe(BOSS_HURRIED_IDLE_STEPS);
  });
});

describe("the new attacks", () => {
  it("aimed: one quick shot straight at the hero", () => {
    const { sim, boss } = arena("aimed,aimed");
    until(sim, boss, "aimed");
    expect(sim.enemyShots).toHaveLength(1);
    const shot = sim.enemyShots[0];
    expect(Math.hypot(shot.vx, shot.vy)).toBeCloseTo(3);
    expect(shot.vx).toBeLessThan(0); // the hero is to the left
  });

  it("rain: four falling shots with gaps over two tiles wide", () => {
    const { sim, boss } = arena("rain,rain");
    until(sim, boss, "rain");
    const xs = sim.enemyShots.map((s) => s.x).sort((a, b) => a - b);
    expect(sim.enemyShots.every((s) => s.vx === 0 && s.vy > 0)).toBe(true);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1] - 6).toBeGreaterThan(32);
    expect(xs.length).toBeGreaterThan(0);
    expect(xs.length).toBeLessThanOrEqual(4);
  });

  it("rain: falls from under a ceiling, not inside it", () => {
    const ceiling = flatArt({ 0: "#".repeat(16), 1: "#".repeat(16) });
    const { sim, boss } = arena("rain,rain", 12, ceiling);
    until(sim, boss, "rain");
    run(sim, {}, 1);
    expect(sim.enemyShots.length).toBeGreaterThan(0);
    expect(sim.enemyShots.every((s) => s.y >= 32)).toBe(true);
  });

  it("rain: the pattern moves every other rain, even between other attacks", () => {
    const { sim, boss } = arena("jump,rain");
    until(sim, boss, "rain");
    const first = sim.enemyShots.map((s) => s.x - sim.player.x).sort((a, b) => a - b);
    for (let i = 0; i < 200 && boss.mode !== "idle"; i++) run(sim, {}, 1);
    sim.enemyShots = [];
    until(sim, boss, "rain");
    const second = sim.enemyShots.map((s) => s.x - sim.player.x).sort((a, b) => a - b);
    expect(second).not.toEqual(first);
  });

  it("big: one large, slow shot that a sliding hero passes under and a standing hero doesn't", () => {
    const { sim, boss } = arena("big,big");
    until(sim, boss, "big");
    const shot = sim.enemyShots[0];
    expect(sim.enemyShots).toHaveLength(1);
    expect(shot.size).toBe(BIG_SHOT_SIZE);
    expect(shot.damage).toBe(4);
    const floor = boss.y + boss.h;
    const bottom = shot.y + BIG_SHOT_SIZE;
    expect(floor - bottom).toBe(14); // a 14-high sliding body fits under
    expect(bottom).toBeGreaterThan(floor - PLAYER_H); // a standing body doesn't
  });
});
