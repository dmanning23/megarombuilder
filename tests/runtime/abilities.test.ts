import { describe, expect, it } from "vitest";
import { createDemoProject, DEMO_LEVEL_ID } from "@/content/demo";
import { snowPack } from "@/content/snow/pack";
import type { Abilities } from "@/model/hero";
import { draw } from "@/runtime/render/draw";
import { createSim, step } from "@/runtime/sim";
import { NO_INPUT } from "@/runtime/sim/state";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt } from "./helpers";
import { run } from "./simHelpers";

function sim(changes: Partial<Abilities>) {
  const project = projectFromArt([{ art: flatArt() }]);
  const hero = { ...project.hero, abilities: { ...project.hero.abilities, ...changes } };
  return createSim({ ...project, hero }, "L1", testPack);
}

describe("the hero's abilities in play", () => {
  it("runs at the hero's speed", () => {
    for (const [speed, perStep] of [["normal", 1.375], ["fast", 1.625], ["veryFast", 1.875]] as const) {
      const s = sim({ speed });
      const start = s.player.x;
      run(s, { right: true }, 10);
      expect(s.player.x - start, speed).toBeCloseTo(10 * perStep);
    }
  });

  it("starts with the hero's health", () => {
    expect(sim({ health: "fragile" }).player.health).toBe(20);
    expect(sim({ health: "normal" }).player.health).toBe(28);
    expect(sim({ health: "tough" }).player.health).toBe(40);
  });

  it("allows the hero's number of shots on screen", () => {
    for (const shots of [1, 2, 3, 5] as const) {
      const s = sim({ shots });
      let most = 0;
      for (let i = 0; i < 20; i++) {
        run(s, { shoot: true }, 1);
        run(s, {}, 1);
        most = Math.max(most, s.shots.length);
      }
      expect(most, `${shots} shots`).toBe(shots);
    }
  });

  it("fits the tough hero's longer health bar on screen", () => {
    const project = createDemoProject();
    const hero = { ...project.hero, abilities: { ...project.hero.abilities, health: "tough" as const } };
    const s = createSim({ ...project, hero }, DEMO_LEVEL_ID, snowPack);
    step(s, NO_INPUT);
    const rects: { y: number; h: number }[] = [];
    const ctx = {
      fillStyle: "",
      font: "",
      textAlign: "start" as CanvasTextAlign,
      fillRect: (_x: number, y: number, _w: number, h: number) => rects.push({ y, h }),
      fillText: () => {},
      drawImage: () => {},
    };
    draw(ctx, s);
    expect(rects.every((r) => r.y >= 0 && r.y + r.h <= 240)).toBe(true);
    expect(rects.some((r) => r.h === 40 * 2 + 1)).toBe(true); // the bar's frame, one tick per point
  });
});
