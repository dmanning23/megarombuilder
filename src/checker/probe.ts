import type { ContentPack } from "@/model/contentPack";
import { createZone } from "@/model/factory";
import { tileIndex, zoneSize } from "@/model/geometry";
import { DEFAULT_ABILITIES } from "@/model/hero";
import { FORMAT_VERSION, type Level, type PlayerSettings, type Project, type Zone } from "@/model/schema";
import { num } from "@/runtime/sim/entities/types";
import { createSim, NO_INPUT, type Player, type Sim } from "@/runtime/sim/state";
import type { TileMap } from "@/runtime/sim/tilemap";

const NEXT_ZONE_ID = "__checker_next";

// The checker runs a little slower than the real player, so it never approves a jump that only
// works with pixel-perfect timing (the player's box can overhang an edge by a single pixel).
export const FAIR_RUN_SPEED = 0.9;

// The zone as the checker sees it: no things, and every moving platform's whole path turned into
// one-way tiles, because a platform can be stood on anywhere along its path (optimistic about timing).
export function checkerZone(zone: Zone, pack: ContentPack): Zone {
  const size = zoneSize(zone.scroll, zone.screens);
  const tiles = zone.tiles.slice();
  const oneWay = pack.tiles.find((t) => t.behaviour === "oneWay")?.id;
  if (oneWay !== undefined) {
    for (const thing of zone.things) {
      const def = pack.things.find((d) => d.type === thing.type);
      if (def?.behaviour !== "platform") continue;
      const settings = { ...def.defaults, ...thing.settings };
      const distance = Math.max(0, Math.round(num(settings, "distance", 4)));
      const vertical = settings.axis === "y";
      const right = thing.x + 1 + (vertical ? 0 : distance);
      const bottom = thing.y + (vertical ? distance : 0);
      for (let y = thing.y; y <= bottom; y++) {
        for (let x = thing.x; x <= right; x++) {
          if (x < 0 || y < 0 || x >= size.width || y >= size.height) continue;
          const i = tileIndex(size, x, y);
          if (tiles[i] === 0) tiles[i] = oneWay;
        }
      }
    }
  }
  return { ...zone, tiles, things: [] };
}

// A simulation of one zone, with an empty zone after it so that leaving by the exit can be seen.
export type Probe = { sim: Sim; map: TileMap; zone: Zone };

export function createProbe(zone: Zone, pack: ContentPack, settings: PlayerSettings): Probe {
  const checked = checkerZone(zone, pack);
  const zones = checked.exit ? [checked, createZone({ id: NEXT_ZONE_ID, name: NEXT_ZONE_ID }, pack)] : [checked];
  const level: Level = { id: "check", name: "check", brief: "", zones, checkpoints: [] };
  const project: Project = {
    formatVersion: FORMAT_VERSION,
    id: "check",
    name: "check",
    contentPackId: pack.id,
    hero: { abilities: { ...DEFAULT_ABILITIES }, look: pack.hero },
    levels: [level],
    chat: [],
    enemies: [],
    boss: null,
  };
  const sim = createSim(project, "check", pack, {
    settings: { ...settings, runSpeed: settings.runSpeed * FAIR_RUN_SPEED },
  });
  return { sim, map: sim.map, zone: checked };
}

// Puts the probe back in its zone with the player in a saved state.
export function reset(probe: Probe, player: Player): void {
  const sim = probe.sim;
  sim.phase = "play";
  sim.timer = 0;
  sim.transition = null;
  sim.zoneIndex = 0;
  sim.map = probe.map;
  sim.shots = [];
  sim.enemyShots = [];
  sim.slots = [];
  sim.prev = NO_INPUT;
  Object.assign(sim.player, player);
}

export const leftZone = (sim: Sim): boolean => sim.zoneIndex !== 0;
