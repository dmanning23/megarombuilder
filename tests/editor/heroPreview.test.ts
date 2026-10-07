import { describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { snowPack } from "@/content/snow/pack";
import { enemyPreviewSim, IDLE_INPUTS, previewInputs, previewSim } from "@/editor/hero/preview";
import { defaultTuning, ENEMY_BEHAVIOURS, type EnemyDesign } from "@/model/designs";
import { DEFAULT_ABILITIES, type Abilities } from "@/model/hero";
import { SLIDE_H } from "@/runtime/sim/constants";
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
