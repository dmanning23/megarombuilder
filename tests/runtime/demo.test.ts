import { describe, expect, it } from "vitest";
import { createDemoProject, DEMO_LEVEL_ID } from "@/content/demo";
import { snowPack } from "@/content/snow/pack";
import { chainProblems, structureProblems } from "@/model/validate";
import { createSim, step } from "@/runtime/sim";
import type { Project } from "@/model/schema";
import { botInput } from "./bot";
import { entity } from "./simHelpers";

// The demo with every thing removed, for the bot, which cannot fight.
function terrainOnly(project: Project): Project {
  return {
    ...project,
    levels: project.levels.map((level) => ({
      ...level,
      zones: level.zones.map((zone) => ({ ...zone, things: [] })),
    })),
  };
}

describe("the demo level", () => {
  it("is a valid project with every zone connected", () => {
    const project = createDemoProject();
    expect(structureProblems(project, snowPack)).toEqual([]);
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
    const sim = createSim(terrainOnly(createDemoProject()), DEMO_LEVEL_ID, snowPack);
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
    const sim = createSim(terrainOnly(createDemoProject()), DEMO_LEVEL_ID, snowPack);
    for (let i = 0; i < 6000 && sim.zoneIndex === 0; i++) step(sim, botInput(sim));
    expect(sim.respawn).toEqual({ zoneIndex: 0, x: 36 * 16 + 1, y: 13 * 16 - 22 });
  });

  it("gives a fresh project each time", () => {
    expect(createDemoProject()).not.toBe(createDemoProject());
    expect(createDemoProject()).toEqual(createDemoProject());
  });
  it("has enemies, pickups, a platform and the boss", () => {
    const zones = createDemoProject().levels[0].zones;
    const types = zones.flatMap((z) => z.things.map((t) => t.type));
    for (const type of ["walker", "flyer", "turret", "jumper", "shielded", "dropper", "platform", "small-health", "large-health"]) {
      expect(types).toContain(type);
    }
    expect(zones[zones.length - 1].things.map((t) => t.type)).toEqual(["boss"]);
  });

  it("runs with every thing active without crashing", () => {
    const sim = createSim(createDemoProject(), DEMO_LEVEL_ID, snowPack);
    for (let i = 0; i < 3000; i++) step(sim, botInput(sim));
    expect(sim.steps).toBe(3000);
    expect(Number.isFinite(sim.player.x)).toBe(true);
    expect(Number.isFinite(sim.player.y)).toBe(true);
  });

  it("starts the boss fight in the boss room", () => {
    const sim = createSim(createDemoProject(), DEMO_LEVEL_ID, snowPack, { startZoneId: "boss" });
    expect(entity(sim, "boss")).toMatchObject({ mode: "intro", health: 28 });
  });
});
