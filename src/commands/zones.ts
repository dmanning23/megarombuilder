import { z } from "zod";
import type { ContentPack } from "@/model/contentPack";
import { createZone } from "@/model/factory";
import {
  MAX_SCREENS,
  clampOpening,
  edgeLength,
  inBounds,
  tileIndex,
  zoneSize,
  type Opening,
} from "@/model/geometry";
import type { Level, Zone } from "@/model/schema";
import { openingProblem } from "@/model/validate";
import { editLevel, editZone, nameTaken } from "./helpers";
import { defineCommand, idArg, nameArg } from "./types";

const scrollArg = z.enum(["horizontal", "vertical"]);
const screensArg = z.number().int().min(1).max(8);
const openingArg = z.object({
  edge: z.enum(["left", "right", "top", "bottom"]),
  from: z.number().int().min(0),
  to: z.number().int().min(0),
});

function variantProblem(pack: ContentPack, variant: string): string | null {
  if (pack.variants.includes(variant)) return null;
  return `Unknown variant "${variant}". Choose one of: ${pack.variants.join(", ")}.`;
}

function nameProblem(level: Level, name: string, exceptZoneId?: string): string | null {
  if (!nameTaken(level, name, exceptZoneId)) return null;
  return `There is already a zone called "${name}" in this level. Zone names must be different.`;
}

const addZoneCommand = defineCommand({
  name: "addZone",
  description:
    "Add a zone to a level. By default it goes just before the boss corridor. Horizontal zones can be 1 to 8 screens, vertical zones 1 to 6.",
  args: z.object({
    levelId: idArg,
    zoneId: idArg,
    name: nameArg,
    scroll: scrollArg.default("horizontal"),
    screens: screensArg.default(1),
    variant: z.string().optional(),
    intent: z.string().max(200).default(""),
    index: z.number().int().min(0).optional(),
  }),
  apply(project, args, ctx) {
    return editLevel(project, args.levelId, (level) => {
      if (level.zones.some((z) => z.id === args.zoneId)) {
        return `A zone with id "${args.zoneId}" already exists in this level.`;
      }
      const clash = nameProblem(level, args.name);
      if (clash) return clash;
      if (args.screens > MAX_SCREENS[args.scroll]) {
        return `A ${args.scroll} zone can be at most ${MAX_SCREENS[args.scroll]} screens long.`;
      }
      const variant = args.variant ?? ctx.pack.variants[0];
      const badVariant = variantProblem(ctx.pack, variant);
      if (badVariant) return badVariant;
      const last = level.zones.length - 2;
      const index = args.index ?? last;
      if (index > last) {
        return `A zone can only be added before the boss corridor (position 0 to ${last}).`;
      }
      const zone = createZone(
        {
          id: args.zoneId,
          name: args.name,
          scroll: args.scroll,
          screens: args.screens,
          variant,
          intent: args.intent,
        },
        ctx.pack,
      );
      const zones = level.zones.slice();
      zones.splice(index, 0, zone);
      return { ...level, zones };
    });
  },
});

const removeZoneCommand = defineCommand({
  name: "removeZone",
  description: "Remove a zone and any checkpoints in it. Boss zones cannot be removed.",
  args: z.object({ levelId: idArg, zoneId: idArg }),
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => {
      const zone = level.zones.find((z) => z.id === args.zoneId);
      if (!zone) return `There is no zone with id "${args.zoneId}" in level "${level.name}".`;
      if (zone.kind !== "normal") return "The boss corridor and boss room cannot be removed.";
      if (level.zones.filter((z) => z.kind === "normal").length <= 1) {
        return "A level needs at least one zone before the boss corridor.";
      }
      return {
        ...level,
        zones: level.zones.filter((z) => z.id !== args.zoneId),
        checkpoints: level.checkpoints.filter((c) => c.zoneId !== args.zoneId),
      };
    });
  },
});

const moveZoneCommand = defineCommand({
  name: "moveZone",
  description: "Move a zone to a new position in the level. Boss zones stay at the end.",
  args: z.object({ levelId: idArg, zoneId: idArg, toIndex: z.number().int().min(0) }),
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => {
      const from = level.zones.findIndex((z) => z.id === args.zoneId);
      if (from < 0) return `There is no zone with id "${args.zoneId}" in level "${level.name}".`;
      if (level.zones[from].kind !== "normal") {
        return "The boss corridor and boss room cannot be moved.";
      }
      const last = level.zones.length - 3;
      if (args.toIndex > last) {
        return `A zone can only be moved to position 0 to ${last}, before the boss corridor.`;
      }
      const zones = level.zones.slice();
      const [zone] = zones.splice(from, 1);
      zones.splice(args.toIndex, 0, zone);
      return { ...level, zones };
    });
  },
});

const renameZoneCommand = defineCommand({
  name: "renameZone",
  description: "Change a zone's name. Names must be different within a level.",
  args: z.object({ levelId: idArg, zoneId: idArg, name: nameArg }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone, level) => {
      const clash = nameProblem(level, args.name, zone.id);
      return clash ?? { ...zone, name: args.name };
    });
  },
});

// Returns the resized zone and how many rows its contents moved down by.
function resized(zone: Zone, screens: number, groundTileId: number): { zone: Zone; dy: number } {
  const old = zoneSize(zone.scroll, zone.screens);
  const size = zoneSize(zone.scroll, screens);
  const keepBottom = zone.scroll === "vertical" && zone.entry.edge !== "top";
  const dy = keepBottom ? size.height - old.height : 0;

  const tiles = new Array<number>(size.width * size.height).fill(0);
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const oldY = y - dy;
      if (x < old.width && oldY >= 0 && oldY < old.height) {
        tiles[tileIndex(size, x, y)] = zone.tiles[tileIndex(old, x, oldY)];
      } else if (zone.scroll === "horizontal" && y >= size.height - 2) {
        tiles[tileIndex(size, x, y)] = groundTileId;
      }
    }
  }

  const fit = (opening: Opening): Opening => {
    const shift = opening.edge === "left" || opening.edge === "right" ? dy : 0;
    return clampOpening(
      { edge: opening.edge, from: opening.from + shift, to: opening.to + shift },
      edgeLength(size, opening.edge),
    );
  };

  return {
    dy,
    zone: {
      ...zone,
      screens,
      tiles,
      things: zone.things
        .map((t) => ({ ...t, y: t.y + dy }))
        .filter((t) => inBounds(size, t.x, t.y)),
      entry: fit(zone.entry),
      exit: zone.exit ? fit(zone.exit) : null,
    },
  };
}

const resizeZoneCommand = defineCommand({
  name: "resizeZone",
  description:
    "Change how many screens long a zone is. Things and checkpoints left outside are removed.",
  args: z.object({ levelId: idArg, zoneId: idArg, screens: screensArg }),
  apply(project, args, ctx) {
    return editLevel(project, args.levelId, (level) => {
      const index = level.zones.findIndex((z) => z.id === args.zoneId);
      if (index < 0) return `There is no zone with id "${args.zoneId}" in level "${level.name}".`;
      const zone = level.zones[index];
      if (zone.kind !== "normal") return "The boss corridor and boss room are always one screen.";
      if (args.screens > MAX_SCREENS[zone.scroll]) {
        return `A ${zone.scroll} zone can be at most ${MAX_SCREENS[zone.scroll]} screens long.`;
      }
      const next = resized(zone, args.screens, ctx.pack.groundTileId);
      const size = zoneSize(next.zone.scroll, next.zone.screens);
      const zones = level.zones.slice();
      zones[index] = next.zone;
      const checkpoints = level.checkpoints
        .map((c) => (c.zoneId === zone.id ? { ...c, y: c.y + next.dy } : c))
        .filter((c) => c.zoneId !== zone.id || inBounds(size, c.x, c.y));
      return { ...level, zones, checkpoints };
    });
  },
});

const setZoneVariantCommand = defineCommand({
  name: "setZoneVariant",
  description: "Change which look of the theme a zone uses, such as outdoor or cave.",
  args: z.object({ levelId: idArg, zoneId: idArg, variant: z.string() }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      return variantProblem(ctx.pack, args.variant) ?? { ...zone, variant: args.variant };
    });
  },
});

const setZoneIntentCommand = defineCommand({
  name: "setZoneIntent",
  description: "Set the one-line note on what a zone is for.",
  args: z.object({ levelId: idArg, zoneId: idArg, intent: z.string().max(200) }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) => ({
      ...zone,
      intent: args.intent,
    }));
  },
});

const setZoneOpeningsCommand = defineCommand({
  name: "setZoneOpenings",
  description:
    "Set where the player enters and leaves a zone. For left and right edges, from and to are rows; for top and bottom they are columns.",
  args: z.object({
    levelId: idArg,
    zoneId: idArg,
    entry: openingArg.optional(),
    exit: openingArg.optional(),
  }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      if (!args.entry && !args.exit) return "Give an entry, an exit, or both.";
      if (args.exit && zone.kind === "bossRoom") return "The boss room has no exit.";
      const size = zoneSize(zone.scroll, zone.screens);
      if (args.entry) {
        const problem = openingProblem(size, args.entry, "entry");
        if (problem) return problem;
      }
      if (args.exit) {
        const problem = openingProblem(size, args.exit, "exit");
        if (problem) return problem;
      }
      return { ...zone, entry: args.entry ?? zone.entry, exit: args.exit ?? zone.exit };
    });
  },
});

export const zoneCommands = [
  addZoneCommand,
  removeZoneCommand,
  moveZoneCommand,
  renameZoneCommand,
  resizeZoneCommand,
  setZoneVariantCommand,
  setZoneIntentCommand,
  setZoneOpeningsCommand,
];
