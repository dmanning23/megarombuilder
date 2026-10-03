import type { ContentPack } from "@/model/contentPack";
import { TILE_SIZE, zoneSize, type Opening } from "@/model/geometry";
import type { Checkpoint, Zone } from "@/model/schema";
import { drawZone, ENTITY_COLOURS, type Ctx2D, type Skin } from "@/runtime/render/draw";
import { spawnBox } from "@/runtime/sim/entities/spawn";

export const GRID_COLOUR = "rgba(16, 33, 58, 0.14)";
export const SCREEN_LINE_COLOUR = "rgba(16, 33, 58, 0.45)";
export const ENTRY_COLOUR = "#2ec4b6";
export const EXIT_COLOUR = "#ffcc33";
export const CHECKPOINT_COLOUR = "#3a86ff";
export const MARKER_COLOUR = "#ef476f";

export function zonePixels(zone: Zone): { width: number; height: number } {
  const size = zoneSize(zone.scroll, zone.screens);
  return { width: size.width * TILE_SIZE, height: size.height * TILE_SIZE };
}

function rect(ctx: Ctx2D, colour: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

function markOpening(ctx: Ctx2D, opening: Opening, width: number, height: number, colour: string): void {
  const start = opening.from * TILE_SIZE;
  const length = (opening.to - opening.from + 1) * TILE_SIZE;
  if (opening.edge === "left") rect(ctx, colour, 0, start, 3, length);
  else if (opening.edge === "right") rect(ctx, colour, width - 3, start, 3, length);
  else if (opening.edge === "top") rect(ctx, colour, start, 0, length, 3);
  else rect(ctx, colour, start, height - 3, length, 3);
}

// The whole zone at full size, with a grid, its things, its openings and its checkpoints.
export function drawZoneView(
  ctx: Ctx2D,
  zone: Zone,
  pack: ContentPack,
  skin: Skin | undefined,
  checkpoints: Checkpoint[],
  marker: { x: number; y: number } | null = null,
): void {
  const { width, height } = zonePixels(zone);
  drawZone(ctx, zone, pack, { x: 0, y: 0 }, 0, 0, skin, width, height);

  for (const thing of zone.things) {
    const def = pack.things.find((d) => d.type === thing.type);
    if (!def) continue;
    const box = spawnBox(thing, def.behaviour);
    const frame = skin?.set.things[thing.type]?.[0];
    if (skin && frame) {
      ctx.drawImage(
        skin.image(frame, false),
        Math.round(box.x + box.w / 2 - frame.w / 2),
        Math.round(box.y + box.h - frame.h),
      );
    } else {
      rect(ctx, ENTITY_COLOURS[def.behaviour], box.x, box.y, box.w, box.h);
    }
  }

  for (let x = 1; x < width / TILE_SIZE; x++) {
    rect(ctx, x % 16 === 0 ? SCREEN_LINE_COLOUR : GRID_COLOUR, x * TILE_SIZE, 0, 1, height);
  }
  for (let y = 1; y < height / TILE_SIZE; y++) {
    rect(ctx, y % 15 === 0 ? SCREEN_LINE_COLOUR : GRID_COLOUR, 0, y * TILE_SIZE, width, 1);
  }

  markOpening(ctx, zone.entry, width, height, ENTRY_COLOUR);
  if (zone.exit) markOpening(ctx, zone.exit, width, height, EXIT_COLOUR);

  for (const c of checkpoints) {
    if (c.zoneId !== zone.id) continue;
    rect(ctx, CHECKPOINT_COLOUR, c.x * TILE_SIZE + 6, c.y * TILE_SIZE + 6, 4, 10);
  }

  if (marker) {
    const x = marker.x * TILE_SIZE;
    const y = marker.y * TILE_SIZE;
    rect(ctx, MARKER_COLOUR, x - 2, y - 2, TILE_SIZE + 4, 2);
    rect(ctx, MARKER_COLOUR, x - 2, y + TILE_SIZE, TILE_SIZE + 4, 2);
    rect(ctx, MARKER_COLOUR, x - 2, y, 2, TILE_SIZE);
    rect(ctx, MARKER_COLOUR, x + TILE_SIZE, y, 2, TILE_SIZE);
  }
}

// The tile under a pointer, whatever size the canvas is displayed at; null outside the zone.
export function tileFromPointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  zone: Zone,
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const size = zoneSize(zone.scroll, zone.screens);
  const x = Math.floor(((clientX - rect.left) / rect.width) * size.width);
  const y = Math.floor(((clientY - rect.top) / rect.height) * size.height);
  if (x < 0 || y < 0 || x >= size.width || y >= size.height) return null;
  return { x, y };
}

// Where a pointer is in a zone: the tile, and the exact point in zone pixels.
export type Spot = { tile: { x: number; y: number }; point: { x: number; y: number } };

export function spotFromPointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  zone: Zone,
): Spot | null {
  const tile = tileFromPointer(clientX, clientY, rect, zone);
  if (!tile) return null;
  const { width, height } = zonePixels(zone);
  return {
    tile,
    point: {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height,
    },
  };
}
