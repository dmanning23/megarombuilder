import type { ContentPack } from "@/model/contentPack";
import { TILE_SIZE } from "@/model/geometry";
import { gamePack } from "@/model/gamePack";
import { heroPhysics } from "@/model/hero";
import type { Level, PlayerSettings, Project } from "@/model/schema";
import { SLIDE_H } from "./constants";
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
  slide: number; // steps left of a slide's own length (it carries on past this under a low ceiling)
  charge: number; // steps shoot has been held, for a charged shot
  airSteps: number; // steps since leaving the ground, for the jump animation
  standH: number; // the standing hitbox's height, from the hero's look
  slideH: number; // the sliding hitbox's height
  shotY: number; // where shots come out, below the hitbox's top
};

export type Shot = { x: number; y: number; vx: number; charged?: boolean };

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
export function entryPosition(map: TileMap, carry: number | null, body: { w: number; h: number }): { x: number; y: number } {
  const entry = map.zone.entry;
  const start = entry.from * TILE_SIZE;
  const end = (entry.to + 1) * TILE_SIZE;
  if (entry.edge === "left" || entry.edge === "right") {
    const feet = carry === null ? end : clamp(start + carry, start + body.h, end);
    return { x: 2, y: feet - body.h };
  }
  const y = entry.edge === "bottom" ? map.heightPx - body.h : 0;
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
    return { x: col * TILE_SIZE + (TILE_SIZE - body.w) / 2, y };
  }
  const half = body.w / 2;
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
  pack = gamePack(project, pack); // the kid's own enemies are thing types like any other
  const level = project.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`There is no level with id "${levelId}".`);
  const zoneIndex =
    opts.startZoneId === undefined ? 0 : level.zones.findIndex((z) => z.id === opts.startZoneId);
  if (zoneIndex < 0) throw new Error(`There is no zone with id "${opts.startZoneId}".`);

  const map = createTileMap(level.zones[zoneIndex], pack);
  const look = project.hero.look;
  const body = { w: look.body.w, h: look.body.h };
  const start = entryPosition(map, null, body);
  const settings = opts.settings ?? heroPhysics(project.hero.abilities);
  const player: Player = {
    ...start,
    vx: 0,
    vy: 0,
    w: body.w,
    h: body.h,
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
    slide: 0,
    charge: 0,
    airSteps: 0,
    standH: body.h,
    slideH: look.slideBody?.h ?? SLIDE_H,
    shotY: look.shotY ?? 8,
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
