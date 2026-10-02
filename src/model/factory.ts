import type { ContentPack } from "./contentPack";
import { tileIndex, zoneSize, type Opening, type Scroll } from "./geometry";
import {
  DEFAULT_PLAYER,
  FORMAT_VERSION,
  type Level,
  type Project,
  type Zone,
  type ZoneKind,
} from "./schema";

export type NewZone = {
  id: string;
  name: string;
  kind?: ZoneKind;
  scroll?: Scroll;
  screens?: number;
  variant?: string;
  intent?: string;
};

// Horizontal zones start with a two-row floor so they can be walked across at once.
export function defaultTiles(scroll: Scroll, screens: number, groundTileId: number): number[] {
  const size = zoneSize(scroll, screens);
  const tiles = new Array<number>(size.width * size.height).fill(0);
  if (scroll === "horizontal") {
    for (let y = size.height - 2; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) tiles[tileIndex(size, x, y)] = groundTileId;
    }
  }
  return tiles;
}

export function defaultOpenings(
  kind: ZoneKind,
  scroll: Scroll,
): { entry: Opening; exit: Opening | null } {
  if (scroll === "vertical") {
    return {
      entry: { edge: "bottom", from: 7, to: 8 },
      exit: { edge: "top", from: 7, to: 8 },
    };
  }
  return {
    entry: { edge: "left", from: 9, to: 12 },
    exit: kind === "bossRoom" ? null : { edge: "right", from: 9, to: 12 },
  };
}

export function createZone(opts: NewZone, pack: ContentPack): Zone {
  const kind = opts.kind ?? "normal";
  const scroll = opts.scroll ?? "horizontal";
  const screens = opts.screens ?? 1;
  return {
    id: opts.id,
    name: opts.name,
    kind,
    scroll,
    screens,
    variant: opts.variant ?? pack.variants[0],
    intent: opts.intent ?? "",
    tiles: defaultTiles(scroll, screens, pack.groundTileId),
    things: [],
    ...defaultOpenings(kind, scroll),
  };
}

export function createLevel(
  opts: { id: string; name: string; brief?: string; zoneIds: [string, string, string] },
  pack: ContentPack,
): Level {
  const [first, corridor, bossRoom] = opts.zoneIds;
  return {
    id: opts.id,
    name: opts.name,
    brief: opts.brief ?? "",
    zones: [
      createZone({ id: first, name: "Zone 1" }, pack),
      createZone({ id: corridor, name: "Boss Corridor", kind: "bossCorridor" }, pack),
      createZone({ id: bossRoom, name: "Boss Room", kind: "bossRoom" }, pack),
    ],
    checkpoints: [],
  };
}

export function createProject(opts: { id: string; name: string }, pack: ContentPack): Project {
  return {
    formatVersion: FORMAT_VERSION,
    id: opts.id,
    name: opts.name,
    contentPackId: pack.id,
    player: { ...DEFAULT_PLAYER },
    levels: [],
    chat: [],
  };
}
