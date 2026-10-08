import { describe, expect, it } from "vitest";
import { applyCommand } from "@/commands";
import { snowPack } from "@/content/snow/pack";
import { createSim, NO_INPUT } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { kill } from "@/runtime/sim/hazards";
import { game } from "../ai/helpers";

// The snow game with a hero 14 wide and 30 tall (its canvas grown to 16 by 32), sliding 12 high, shooting from 20.
function tallGame() {
  let project = game();
  const commands: [string, unknown][] = [
    ["setHeroAbilities", { slide: true, chargeShot: true }],
    ["resizeCanvas", { target: "hero", canvas: "main", w: 16, h: 32 }],
    ["setBody", { target: "hero", body: { x: 1, y: 2, w: 14, h: 30 } }],
    ["setBody", { target: "hero", which: "slide", body: { x: 5, y: 4, w: 14, h: 12 } }],
    ["setShotY", { target: "hero", y: 20 }],
  ];
  for (const [name, args] of commands) {
    const result = applyCommand(project, { name, args }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
  }
  return project;
}
const press = (keys: Partial<typeof NO_INPUT>) => ({ ...NO_INPUT, ...keys });

describe("the hero's own size", () => {
  it("stands, slides and stands up at its own heights", () => {
    const sim = createSim(tallGame(), "L1", snowPack);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    const feet = sim.player.y + sim.player.h;
    expect([sim.player.w, sim.player.h]).toEqual([14, 30]);
    step(sim, press({ down: true, right: true }));
    step(sim, press({ down: true, jump: true }));
    expect(sim.player.h).toBe(12);
    expect(sim.player.y + sim.player.h).toBe(feet);
    for (let i = 0; i < 120 && sim.player.h !== 30; i++) step(sim, NO_INPUT);
    expect(sim.player.h).toBe(30);
    expect(sim.player.y + sim.player.h).toBe(feet);
  });

  it("shoots from its shot point, and centres a charged shot on the same line", () => {
    const sim = createSim(tallGame(), "L1", snowPack);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    step(sim, press({ shoot: true }));
    expect(sim.shots[0].y).toBe(sim.player.y + 20);
    sim.shots = [];
    for (let i = 0; i < 80; i++) step(sim, press({ shoot: true }));
    step(sim, NO_INPUT);
    const charged = sim.shots.find((s) => s.charged)!;
    expect(charged.y).toBe(sim.player.y + 20 + 2 - 5);
  });

  it("arrives, respawns and changes zone standing on its feet, never inside a wall", () => {
    const sim = createSim(tallGame(), "L1", snowPack);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    expect(sim.player.h).toBe(30);
    kill(sim);
    for (let i = 0; i < 300 && sim.phase !== "play"; i++) step(sim, NO_INPUT);
    expect(sim.player.h).toBe(30);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    expect(sim.player.onGround).toBe(true);
  });

  it("plays today's hero at today's sizes", () => {
    const sim = createSim(game(), "L1", snowPack);
    expect([sim.player.w, sim.player.h, sim.player.standH, sim.player.slideH, sim.player.shotY]).toEqual([14, 22, 22, 14, 8]);
  });

  it("slides lower than it stands even when its sliding hitbox is taller, and stands up again", () => {
    let project = game();
    for (const [name, args] of [
      ["setHeroAbilities", { slide: true }],
      ["setBody", { target: "hero", body: { x: 2, y: 12, w: 12, h: 12 } }],
    ] as const) {
      const result = applyCommand(project, { name, args }, { pack: snowPack });
      if (!result.ok) throw new Error(result.error);
      project = result.project;
    }
    const sim = createSim(project, "L1", snowPack);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    step(sim, press({ down: true, right: true }));
    step(sim, press({ down: true, jump: true }));
    expect(sim.player.h).toBeLessThan(12);
    for (let i = 0; i < 120 && sim.player.h !== 12; i++) step(sim, NO_INPUT);
    expect(sim.player.h).toBe(12);
  });
});
