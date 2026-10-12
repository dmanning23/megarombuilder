import { describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { snowPack } from "@/content/snow/pack";
import { BOSS_PREVIEW_INPUTS, bossPreviewSim, enemyPreviewSim, IDLE_INPUTS, previewInputs, previewSim } from "@/editor/hero/preview";
import { defaultTuning, ENEMY_BEHAVIOURS, type BossAttack, type EnemyDesign } from "@/model/designs";
import { DEFAULT_ABILITIES, type Abilities } from "@/model/hero";
import { CHARGE2_STEPS, SLIDE_H } from "@/runtime/sim/constants";
import { step } from "@/runtime/sim/step";

function play(abilities: Abilities) {
  const sim = previewSim(snowHero, abilities, snowPack);
  const start = sim.player.x;
  let slid = false;
  let charged = false;
  let shots = 0;
  let furthest = start;
  for (const input of previewInputs(abilities)) {
    step(sim, input);
    slid ||= sim.player.h === SLIDE_H;
    charged ||= sim.shots.some((s) => s.charged);
    shots = Math.max(shots, sim.shots.length);
    furthest = Math.max(furthest, sim.player.x);
    expect(sim.phase).toBe("play");
    expect(sim.zoneIndex).toBe(0);
  }
  return { sim, start, slid, charged, shots, furthest };
}

describe("the hero preview", () => {
  it("runs, jumps and shoots, then comes back to where it started", () => {
    const show = play(DEFAULT_ABILITIES);
    expect(show.furthest - show.start).toBeGreaterThan(100);
    expect(show.shots).toBeGreaterThan(0);
    expect(show.slid).toBe(false);
    expect(show.charged).toBe(false);
    expect(show.sim.player.x - show.start).toBeLessThan(16);
  });

  it("slides and charges only when the hero can", () => {
    const show = play({ ...DEFAULT_ABILITIES, slide: true, chargeShot: true });
    expect(show.slid).toBe(true);
    expect(show.charged).toBe(true);
  });

  it("stays on the screen even for the fastest, highest-jumping hero", () => {
    const show = play({ ...DEFAULT_ABILITIES, speed: "veryFast", jump: "veryHigh", slide: true, chargeShot: true });
    expect(show.furthest).toBeLessThan(256 - 14);
    expect(show.sim.player.x - show.start).toBeLessThan(16);
  });
});

describe("the enemy preview", () => {
  const enemy = (behaviour: (typeof ENEMY_BEHAVIOURS)[number]): EnemyDesign => ({
    id: "e1",
    name: "Frost Fang",
    behaviour,
    tuning: defaultTuning(behaviour),
    look: snowPack.enemyLooks[behaviour],
  });
  const hero = { abilities: DEFAULT_ABILITIES, look: snowHero };

  it("shows every behaviour doing its thing on one screen, with the hero standing still", () => {
    for (const behaviour of ENEMY_BEHAVIOURS) {
      const sim = enemyPreviewSim(enemy(behaviour), hero, snowPack);
      let moved = false;
      let shot = false;
      for (const input of IDLE_INPUTS.slice(0, 180)) {
        step(sim, input);
        const e = sim.slots[0].entity;
        if (e && (e.x !== e.homeX || e.y !== e.homeY)) moved = true;
        if (sim.enemyShots.length > 0) shot = true;
      }
      expect(sim.zoneIndex, behaviour).toBe(0);
      expect(moved || shot, behaviour).toBe(true); // (a shot may knock the idle hero back)
    }
  });

  it("is idle for six seconds", () => {
    expect(IDLE_INPUTS).toHaveLength(360);
  });
});

describe("the boss preview", () => {
  const lists: BossAttack[][] = [
    ["jump", "spread", "dash"],
    ["rain", "big", "aimed"],
    ["dash", "jump"],
    ["big", "rain"],
  ];

  it("shows every attack in the list, and the hero is never beaten", () => {
    const hero = { abilities: DEFAULT_ABILITIES, look: snowHero };
    for (const attacks of lists) {
      const boss = { name: "My Boss", fight: "long" as const, attacks, look: snowPack.bossLook };
      const sim = bossPreviewSim(boss, hero, snowPack);
      const seen = new Set<string>();
      for (const input of BOSS_PREVIEW_INPUTS) {
        step(sim, input);
        const e = sim.slots[0].entity;
        if (e) seen.add(e.mode);
      }
      expect([...seen], attacks.join()).toEqual(expect.arrayContaining(attacks));
      expect(sim.phase, attacks.join()).toBe("play");
      expect(sim.zoneIndex).toBe(0);
    }
  });
});

describe("the hero preview's charge", () => {
  it("holds shoot long enough for level 2 when the hero has it", () => {
    const inputs = previewInputs({ ...DEFAULT_ABILITIES, chargeShot: true, chargeLevel2: true });
    let longest = 0;
    let held = 0;
    for (const input of inputs) {
      held = input.shoot ? held + 1 : 0;
      longest = Math.max(longest, held);
    }
    expect(longest).toBeGreaterThanOrEqual(CHARGE2_STEPS);
  });
});
