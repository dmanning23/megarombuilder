import type { ContentPack } from "@/model/contentPack";
import { TILE_SIZE } from "@/model/geometry";
import { heroPhysics } from "@/model/hero";
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
  shotTimer: number; // steps left of the shooting pose
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
  const y = entry.edge === "bottom" ? map.heightPx - PLAYER_H : 0;
  if (carry === null) {
    // A fresh start: stand in the first column with a ladder at this edge, or the first column.
    const row = entry.edge === "bottom" ? map.height - 1 : 0;
    let col = entry.from;
    for (let c = entry.from; c <= entry.to; c++) {
      if (map.behaviourAt(c, row) === "ladder") {
        col = c;
        break;
      }
    }
    return { x: col * TILE_SIZE + (TILE_SIZE - PLAYER_W) / 2, y };
  }
  const half = PLAYER_W / 2;
  const centre = clamp(start + carry, start + half, end - half);
  return { x: centre - half, y };
}

export function createSim(
  project: Project,
  levelId: string,
  pack: ContentPack,
  // settings: exact physics instead of the hero's (the checker plays at a fair, slightly slower speed)
  opts: { startZoneId?: string; settings?: PlayerSettings } = {},
): Sim {
  const level = project.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`There is no level with id "${levelId}".`);
  const zoneIndex =
    opts.startZoneId === undefined ? 0 : level.zones.findIndex((z) => z.id === opts.startZoneId);
  if (zoneIndex < 0) throw new Error(`There is no zone with id "${opts.startZoneId}".`);

  const map = createTileMap(level.zones[zoneIndex], pack);
  const start = entryPosition(map, null);
  const settings = opts.settings ?? heroPhysics(project.hero.abilities);
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
    health: settings.maxHealth,
    hurt: 0,
    invuln: 0,
    knockback: 1,
    ridingId: null,
    shotTimer: 0,
  };
  player.onLadder = touchingLadder(map, player);
  const sim: Sim = {
    level,
    pack,
    settings,
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
