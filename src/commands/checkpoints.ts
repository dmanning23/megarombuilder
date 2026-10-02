import { z } from "zod";
import { inBounds, zoneSize } from "@/model/geometry";
import { editLevel } from "./helpers";
import { coordArg, defineCommand, idArg } from "./types";

const checkpointArgs = z.strictObject({ levelId: idArg, zoneId: idArg, x: coordArg, y: coordArg });

const addCheckpointCommand = defineCommand({
  name: "addCheckpoint",
  description: "Add a checkpoint where the player respawns after reaching it.",
  args: checkpointArgs,
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => {
      const zone = level.zones.find((z) => z.id === args.zoneId);
      if (!zone) return `There is no zone with id "${args.zoneId}" in level "${level.name}".`;
      const size = zoneSize(zone.scroll, zone.screens);
      if (!inBounds(size, args.x, args.y)) {
        return `(${args.x}, ${args.y}) is outside "${zone.name}", which is ${size.width} tiles wide and ${size.height} tiles high.`;
      }
      const same = level.checkpoints.some(
        (c) => c.zoneId === args.zoneId && c.x === args.x && c.y === args.y,
      );
      if (same) return `There is already a checkpoint at (${args.x}, ${args.y}) in "${zone.name}".`;
      return {
        ...level,
        checkpoints: [...level.checkpoints, { zoneId: args.zoneId, x: args.x, y: args.y }],
      };
    });
  },
});

const removeCheckpointCommand = defineCommand({
  name: "removeCheckpoint",
  description: "Remove the checkpoint at a tile position.",
  args: checkpointArgs,
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => {
      if (!level.zones.some((z) => z.id === args.zoneId)) {
        return `There is no zone with id "${args.zoneId}" in level "${level.name}".`;
      }
      const kept = level.checkpoints.filter(
        (c) => !(c.zoneId === args.zoneId && c.x === args.x && c.y === args.y),
      );
      if (kept.length === level.checkpoints.length) {
        return `There is no checkpoint at (${args.x}, ${args.y}) in that zone.`;
      }
      return { ...level, checkpoints: kept };
    });
  },
});

export const checkpointCommands = [addCheckpointCommand, removeCheckpointCommand];
