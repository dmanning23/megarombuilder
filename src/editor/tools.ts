import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import { zoneSize } from "@/model/geometry";
import type { Thing, Zone } from "@/model/schema";
import { spawnBox } from "@/runtime/sim/entities/spawn";
import type { Spot } from "./zoneView";

// The thing under a point: the last placed one, since it is drawn on top.
export function thingAt(zone: Zone, pack: ContentPack, point: { x: number; y: number }): Thing | null {
  for (let i = zone.things.length - 1; i >= 0; i--) {
    const thing = zone.things[i];
    const def = pack.things.find((d) => d.type === thing.type);
    if (!def) continue;
    const box = spawnBox(thing, def.behaviour);
    if (point.x >= box.x && point.x < box.x + box.w && point.y >= box.y && point.y < box.y + box.h) {
      return thing;
    }
  }
  return null;
}

// What painting or erasing does at one spot of a stroke.
export function paintCommand(
  tool: { kind: "tile"; tile: number } | { kind: "erase" },
  levelId: string,
  zone: Zone,
  pack: ContentPack,
  spot: Spot,
): Command {
  if (tool.kind === "erase") {
    const hit = thingAt(zone, pack, spot.point);
    if (hit) return { name: "removeThing", args: { levelId, zoneId: zone.id, thingId: hit.id } };
  }
  const tile = tool.kind === "tile" ? tool.tile : 0;
  return { name: "setTiles", args: { levelId, zoneId: zone.id, cells: [{ ...spot.tile, tile }] } };
}

// What placing a thing or stamping a piece does at the pressed spot.
export function placeCommand(
  tool: { kind: "thing"; type: string } | { kind: "piece"; pieceId: string; settings: Record<string, number> },
  levelId: string,
  zone: Zone,
  spot: Spot,
  makeId: () => string,
): Command {
  if (tool.kind === "thing") {
    return {
      name: "placeThing",
      args: { levelId, zoneId: zone.id, thingId: makeId(), type: tool.type, x: spot.tile.x, y: spot.tile.y },
    };
  }
  const height = zoneSize(zone.scroll, zone.screens).height;
  const y = zone.scroll === "horizontal" ? 0 : Math.max(0, Math.min(spot.tile.y, height - 15));
  return {
    name: "insertPiece",
    args: {
      levelId,
      zoneId: zone.id,
      pieceId: tool.pieceId,
      x: spot.tile.x,
      y,
      settings: tool.settings,
      idPrefix: makeId(),
    },
  };
}
