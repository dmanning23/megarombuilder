import { describe, expect, it } from "vitest";
import { createDemoProject, DEMO_LEVEL_ID, demoPack } from "@/content/demo";
import { chainProblems, structureProblems } from "@/model/validate";
import { createSim, step } from "@/runtime/sim";
import { botInput } from "./bot";

describe("the demo level", () => {
  it("is a valid project with every zone connected", () => {
    const project = createDemoProject();
    expect(structureProblems(project, demoPack)).toEqual([]);
    expect(chainProblems(project.levels[0])).toEqual([]);
    expect(project.levels[0].zones.map((z) => z.name)).toEqual([
      "Snowy Path",
      "Ice Cave",
      "Frozen Shaft",
      "Boss Corridor",
      "Boss Room",
    ]);
  });

  it("can be played from the start to the boss room without dying", () => {
    const sim = createSim(createDemoProject(), DEMO_LEVEL_ID, demoPack);
    let deaths = 0;
    for (let i = 0; i < 6000 && sim.map.zone.kind !== "bossRoom"; i++) {
      const wasDead = sim.phase === "dead";
      step(sim, botInput(sim));
      if (sim.phase === "dead" && !wasDead) deaths++;
    }
    expect(deaths).toBe(0);
    expect(sim.map.zone.kind).toBe("bossRoom");
  });

  it("sets the respawn point at the checkpoint on the way", () => {
    const sim = createSim(createDemoProject(), DEMO_LEVEL_ID, demoPack);
    for (let i = 0; i < 6000 && sim.zoneIndex === 0; i++) step(sim, botInput(sim));
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 36 * 16 + 1, y: 13 * 16 - 22 });
  });

  it("gives a fresh project each time", () => {
    expect(createDemoProject()).not.toBe(createDemoProject());
    expect(createDemoProject()).toEqual(createDemoProject());
  });
});
