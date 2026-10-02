import type { ContentPack, TileBehaviour } from "@/model/contentPack";
import { TILE_SIZE, tileIndex, zoneSize } from "@/model/geometry";
import type { Zone } from "@/model/schema";

export type Cell = TileBehaviour | "empty";

export type TileMap = {
  zone: Zone;
  width: number;
  height: number;
  widthPx: number;
  heightPx: number;
  behaviourAt(tx: number, ty: number): Cell;
};

export function createTileMap(zone: Zone, pack: ContentPack): TileMap {
  const size = zoneSize(zone.scroll, zone.screens);
  const behaviours = new Map(pack.tiles.map((t) => [t.id, t.behaviour]));
  const exit = zone.exit;
  return {
    zone,
    width: size.width,
    height: size.height,
    widthPx: size.width * TILE_SIZE,
    heightPx: size.height * TILE_SIZE,
    behaviourAt(tx, ty) {
      // The left edge is always a wall. The right edge is a wall except across a right-hand exit.
      if (tx < 0) return "solid";
      if (tx >= size.width) {
        const open = exit !== null && exit.edge === "right" && ty >= exit.from && ty <= exit.to;
        return open ? "empty" : "solid";
      }
      if (ty < 0 || ty >= size.height) return "empty";
      return behaviours.get(zone.tiles[tileIndex(size, tx, ty)]) ?? "empty";
    },
  };
}

export const isSolid = (cell: Cell): boolean => cell === "solid" || cell === "ice";

// Something the player can land on from above but pass through from below.
export function isPlatform(map: TileMap, tx: number, ty: number): boolean {
  const cell = map.behaviourAt(tx, ty);
  return cell === "oneWay" || (cell === "ladder" && map.behaviourAt(tx, ty - 1) !== "ladder");
}

// The first tile covered by a span that starts at px.
export const firstTile = (px: number): number => Math.floor(px / TILE_SIZE);
// The last tile covered by a span that ends at px.
export const lastTile = (px: number): number => Math.ceil(px / TILE_SIZE) - 1;

export function ladderAtPx(map: TileMap, px: number, py: number): boolean {
  return map.behaviourAt(firstTile(px), firstTile(py)) === "ladder";
}

// True when there is a ladder at the box's centre or at its feet.
export function touchingLadder(
  map: TileMap,
  box: { x: number; y: number; w: number; h: number },
): boolean {
  const cx = box.x + box.w / 2;
  return ladderAtPx(map, cx, box.y + box.h / 2) || ladderAtPx(map, cx, box.y + box.h - 1);
}
