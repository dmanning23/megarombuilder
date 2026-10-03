import { applyCommand, type Command } from "@/commands";
import { createDemoProject } from "@/content/demo";
import { DEFAULT_PACK } from "@/content/packs";
import { createProject } from "@/model/factory";
import type { Project } from "@/model/schema";

// A new game: one level with its starting zone, boss corridor and boss room, and the boss waiting.
export function newProject(name: string, makeId: () => string): Project {
  const pack = DEFAULT_PACK;
  let project = createProject({ id: makeId(), name: name.trim() || "My game" }, pack);
  const run = (command: Command) => {
    const result = applyCommand(project, command, { pack });
    if (!result.ok) throw new Error(`New game: ${command.name} failed: ${result.error}`);
    project = result.project;
  };
  const levelId = makeId();
  run({ name: "createLevel", args: { levelId, name: "Level 1", zoneIds: [makeId(), makeId(), makeId()] } });
  const bossRoom = project.levels[0].zones[2].id;
  run({ name: "placeThing", args: { levelId, zoneId: bossRoom, thingId: makeId(), type: "boss", x: 12, y: 12 } });
  return project;
}

export function copyOfDemo(makeId: () => string): Project {
  return { ...createDemoProject(), id: makeId(), name: "Demo Stage" };
}
