import { z } from "zod";
import type { ContentPack } from "@/model/contentPack";
import { inBounds, rectInBounds, tileIndex, zoneSize, type Size } from "@/model/geometry";
import type { Zone } from "@/model/schema";
import { editZone } from "./helpers";
import { coordArg, defineCommand, idArg } from "./types";

const tileArg = z.number().int().min(0);
const rectArgs = {
  x: coordArg,
  y: coordArg,
  w: z.number().int().min(1),
  h: z.number().int().min(1),
};

function tileProblem(pack: ContentPack, tile: number): string | null {
  if (tile === 0 || pack.tiles.some((t) => t.id === tile)) return null;
  return `There is no tile with id ${tile} in the content pack.`;
}

function sizeText(zone: Zone, size: Size): string {
  return `"${zone.name}", which is ${size.width} tiles wide and ${size.height} tiles high`;
}

function rectProblem(zone: Zone, size: Size, x: number, y: number, w: number, h: number) {
  if (rectInBounds(size, x, y, w, h)) return null;
  return `The rectangle at (${x}, ${y}) sized ${w} by ${h} does not fit inside ${sizeText(zone, size)}.`;
}

const setTilesCommand = defineCommand({
  name: "setTiles",
  description: "Set individual tiles in a zone. Tile 0 is empty.",
  args: z.strictObject({
    levelId: idArg,
    zoneId: idArg,
    cells: z.array(z.strictObject({ x: coordArg, y: coordArg, tile: tileArg })).min(1).max(2000),
  }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const size = zoneSize(zone.scroll, zone.screens);
      const tiles = zone.tiles.slice();
      for (const cell of args.cells) {
        if (!inBounds(size, cell.x, cell.y)) {
          return `(${cell.x}, ${cell.y}) is outside ${sizeText(zone, size)}.`;
        }
        const problem = tileProblem(ctx.pack, cell.tile);
        if (problem) return problem;
        tiles[tileIndex(size, cell.x, cell.y)] = cell.tile;
      }
      return { ...zone, tiles };
    });
  },
});

const fillRectCommand = defineCommand({
  name: "fillRect",
  description: "Fill a rectangle of a zone with one tile.",
  args: z.strictObject({ levelId: idArg, zoneId: idArg, ...rectArgs, tile: tileArg }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const size = zoneSize(zone.scroll, zone.screens);
      const problem =
        rectProblem(zone, size, args.x, args.y, args.w, args.h) ?? tileProblem(ctx.pack, args.tile);
      if (problem) return problem;
      const tiles = zone.tiles.slice();
      for (let y = args.y; y < args.y + args.h; y++) {
        for (let x = args.x; x < args.x + args.w; x++) tiles[tileIndex(size, x, y)] = args.tile;
      }
      return { ...zone, tiles };
    });
  },
});

const clearRectCommand = defineCommand({
  name: "clearRect",
  description: "Empty a rectangle of a zone: removes its tiles and any things inside it.",
  args: z.strictObject({ levelId: idArg, zoneId: idArg, ...rectArgs }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const size = zoneSize(zone.scroll, zone.screens);
      const problem = rectProblem(zone, size, args.x, args.y, args.w, args.h);
      if (problem) return problem;
      const tiles = zone.tiles.slice();
      for (let y = args.y; y < args.y + args.h; y++) {
        for (let x = args.x; x < args.x + args.w; x++) tiles[tileIndex(size, x, y)] = 0;
      }
      const inside = (x: number, y: number) =>
        x >= args.x && x < args.x + args.w && y >= args.y && y < args.y + args.h;
      return { ...zone, tiles, things: zone.things.filter((t) => !inside(t.x, t.y)) };
    });
  },
});

export const tileCommands = [setTilesCommand, fillRectCommand, clearRectCommand];
