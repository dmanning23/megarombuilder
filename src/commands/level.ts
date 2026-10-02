import { z } from "zod";
import { createLevel } from "@/model/factory";
import { editLevel } from "./helpers";
import { defineCommand, fail, idArg, nameArg, ok } from "./types";

const createLevelCommand = defineCommand({
  name: "createLevel",
  description: "Create a level with one starting zone, a boss corridor and a boss room.",
  args: z.strictObject({
    levelId: idArg,
    name: nameArg,
    brief: z.string().max(1000).default(""),
    zoneIds: z.tuple([idArg, idArg, idArg]),
  }),
  apply(project, args, ctx) {
    if (project.levels.some((l) => l.id === args.levelId)) {
      return fail(`A level with id "${args.levelId}" already exists.`);
    }
    if (new Set(args.zoneIds).size !== 3) return fail("The three zone ids must be different.");
    const level = createLevel(
      { id: args.levelId, name: args.name, brief: args.brief, zoneIds: args.zoneIds },
      ctx.pack,
    );
    return ok({ ...project, levels: [...project.levels, level] });
  },
});

const renameLevelCommand = defineCommand({
  name: "renameLevel",
  description: "Change a level's name.",
  args: z.strictObject({ levelId: idArg, name: nameArg }),
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => ({ ...level, name: args.name }));
  },
});

const setLevelBriefCommand = defineCommand({
  name: "setLevelBrief",
  description: "Set the plain-language design brief for a level.",
  args: z.strictObject({ levelId: idArg, brief: z.string().max(1000) }),
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => ({ ...level, brief: args.brief }));
  },
});

const deleteLevelCommand = defineCommand({
  name: "deleteLevel",
  description: "Delete a level and everything in it.",
  args: z.strictObject({ levelId: idArg }),
  apply(project, args) {
    if (!project.levels.some((l) => l.id === args.levelId)) {
      return fail(`There is no level with id "${args.levelId}".`);
    }
    return ok({ ...project, levels: project.levels.filter((l) => l.id !== args.levelId) });
  },
});

export const levelCommands = [
  createLevelCommand,
  renameLevelCommand,
  setLevelBriefCommand,
  deleteLevelCommand,
];
