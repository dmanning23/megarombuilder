import { z } from "zod";
import { KEEP_TILE, type PieceDef } from "@/model/contentPack";
import { rectInBounds, tileIndex, zoneSize } from "@/model/geometry";
import type { Thing } from "@/model/schema";
import { editZone } from "./helpers";
import { coordArg, defineCommand, idArg } from "./types";

// Fills in defaults and checks ranges. Returns the full settings, or an error string.
function resolveSettings(
  piece: PieceDef,
  given: Record<string, number>,
): Record<string, number> | string {
  const known = piece.settings.map((s) => s.key);
  for (const key of Object.keys(given)) {
    if (!known.includes(key)) {
      return `The piece "${piece.id}" has no setting called "${key}". Its settings are: ${known.join(", ")}.`;
    }
  }
  const resolved: Record<string, number> = {};
  for (const setting of piece.settings) {
    const value = given[setting.key] ?? setting.default;
    if (!Number.isInteger(value) || value < setting.min || value > setting.max) {
      return `"${setting.key}" must be a whole number from ${setting.min} to ${setting.max}.`;
    }
    resolved[setting.key] = value;
  }
  return resolved;
}

const insertPieceCommand = defineCommand({
  name: "insertPiece",
  description:
    "Stamp a ready-made level piece into a zone with its top-left corner at a tile position. It overwrites the tiles it covers and adds its things.",
  args: z.object({
    levelId: idArg,
    zoneId: idArg,
    pieceId: z.string().min(1),
    x: coordArg,
    y: coordArg,
    settings: z.record(z.string(), z.number()).default({}),
    idPrefix: idArg,
  }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const piece = ctx.pack.pieces.find((p) => p.id === args.pieceId);
      if (!piece) {
        const known = ctx.pack.pieces.map((p) => p.id).join(", ");
        return `There is no piece called "${args.pieceId}". Choose one of: ${known}.`;
      }
      const settings = resolveSettings(piece, args.settings);
      if (typeof settings === "string") return settings;

      const built = piece.build(settings);
      const size = zoneSize(zone.scroll, zone.screens);
      if (!rectInBounds(size, args.x, args.y, built.width, built.height)) {
        return `The piece is ${built.width} tiles wide and ${built.height} tiles high, so it does not fit at (${args.x}, ${args.y}) in "${zone.name}", which is ${size.width} tiles wide and ${size.height} tiles high.`;
      }

      const tiles = zone.tiles.slice();
      for (let py = 0; py < built.height; py++) {
        for (let px = 0; px < built.width; px++) {
          const tile = built.tiles[py * built.width + px];
          if (tile !== KEEP_TILE) tiles[tileIndex(size, args.x + px, args.y + py)] = tile;
        }
      }

      const things: Thing[] = zone.things.slice();
      for (const [i, placed] of built.things.entries()) {
        const id = `${args.idPrefix}-${i + 1}`;
        if (things.some((t) => t.id === id)) {
          return `There is already a thing with id "${id}" in "${zone.name}". Use a different idPrefix.`;
        }
        const def = ctx.pack.things.find((d) => d.type === placed.type);
        things.push({
          id,
          type: placed.type,
          x: args.x + placed.x,
          y: args.y + placed.y,
          settings: { ...def?.defaults, ...placed.settings },
        });
      }
      return { ...zone, tiles, things };
    });
  },
});

export const pieceCommands = [insertPieceCommand];
