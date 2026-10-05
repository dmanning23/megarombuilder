import { applyCommand } from "@/commands";
import { snowPack } from "@/content/snow/pack";
import { createLevel, createProject } from "@/model/factory";
import type { Project } from "@/model/schema";

export const pack = snowPack;

// One level "L1": "Zone 1" (z1), the boss corridor and the boss room with the boss in it.
export function game(): Project {
  const project: Project = {
    ...createProject({ id: "p1", name: "Game" }, pack),
    levels: [createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["z1", "corridor", "boss"] }, pack)],
  };
  return run(project, "placeThing", { levelId: "L1", zoneId: "boss", thingId: "the-boss", type: "boss", x: 12, y: 12 });
}

export function run(project: Project, name: string, args: unknown): Project {
  const result = applyCommand(project, { name, args }, { pack });
  if (!result.ok) throw new Error(`${name} failed: ${result.error}`);
  return result.project;
}

export function counter(prefix = "id"): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
