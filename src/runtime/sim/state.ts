import type { ContentPack } from "@/model/contentPack";
import { TILE_SIZE } from "@/model/geometry";
import type { Level, PlayerSettings, Project } from "@/model/schema";
import { PLAYER_H, PLAYER_W } from "./constants";
import { loadZoneThings } from "./entities/slots";
import type { EnemyShot, Slot } from "./entities/types";
import { clamp } from "./math";
import { createTileMap, touchingLadder, type TileMap } from "./tilemap";

export type Input = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  shoot: boolean;
};

export const NO_INPUT: Input = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  shoot: false,
};

export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  onGround: boolean;
  onIce: boolean;
  onLadder: boolean;
  health: number;
  hurt: number; // steps left of being knocked back
  invuln: number; // steps left of not being hurt
  knockback: 1 | -1;
  ridingId: string | null; // the platform the player is standing on
};

export type Shot = { x: number; y: number; vx: number };

export type Camera = { x: number; y: number };

export type Phase = "play" | "transition" | "dead" | "won";

export type Transition = {
  fromIndex: number;
  fromCamera: Camera;
  direction: "right" | "up" | "down";
};

export type Sim = {
  level: Level;
  pack: ContentPack;
  settings: PlayerSettings;
  zoneIndex: number;
  map: TileMap;
  player: Player;
  shots: Shot[];
  phase: Phase;
  timer: number;
  transition: Transition | null;
  respawn: { zoneIndex: number; x: number; y: number };
  prev: Input;
  steps: number;
  slots: Slot[];
  enemyShots: EnemyShot[];
  collected: Set<string>;
};

// Where the player appears at a zone's entry. `carry` is how far along the previous
// zone's exit opening they were, in pixels, or null for a fresh start.
export function entryPosition(map: TileMap, carry: number | null): { x: number; y: number } {
  const entry = map.zone.entry;
  const start = entry.from * TILE_SIZE;
  const end = (entry.to + 1) * TILE_SIZE;
  if (entry.edge === "left" || entry.edge === "right") {
    const feet = carry === null ? end : clamp(start + carry, start + PLAYER_H, end);
    return { x: 2, y: feet - PLAYER_H };
  }
  const half = PLAYER_W / 2;
  const centre = carry === null ? (start + end) / 2 : clamp(start + carry, start + half, end - half);
  return { x: centre - half, y: entry.edge === "bottom" ? map.heightPx - PLAYER_H : 0 };
}

export function createSim(
  project: Project,
  levelId: string,
  pack: ContentPack,
  opts: { startZoneId?: string } = {},
): Sim {
  const level = project.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`There is no level with id "${levelId}".`);
  const zoneIndex =
    opts.startZoneId === undefined ? 0 : level.zones.findIndex((z) => z.id === opts.startZoneId);
  if (zoneIndex < 0) throw new Error(`There is no zone with id "${opts.startZoneId}".`);

  const map = createTileMap(level.zones[zoneIndex], pack);
  const start = entryPosition(map, null);
  const player: Player = {
    ...start,
    vx: 0,
    vy: 0,
    w: PLAYER_W,
    h: PLAYER_H,
    facing: 1,
    onGround: false,
    onIce: false,
    onLadder: false,
    health: project.player.maxHealth,
    hurt: 0,
    invuln: 0,
    knockback: 1,
    ridingId: null,
  };
  player.onLadder = touchingLadder(map, player);
  const sim: Sim = {
    level,
    pack,
    settings: project.player,
    zoneIndex,
    map,
    player,
    shots: [],
    phase: "play",
    timer: 0,
    transition: null,
    respawn: { zoneIndex, ...start },
    prev: NO_INPUT,
    steps: 0,
    slots: [],
    enemyShots: [],
    collected: new Set(),
  };
  loadZoneThings(sim);
  return sim;
}
