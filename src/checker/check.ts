import { gamePack } from "@/model/gamePack";
import { heroPhysics } from "@/model/hero";
import type { ContentPack } from "@/model/contentPack";
import { TILE_SIZE } from "@/model/geometry";
import type { Level, Project, Zone } from "@/model/schema";
import { chainProblems } from "@/model/validate";
import { spawnBox } from "@/runtime/sim/entities/spawn";
import { ENEMY_BEHAVIOURS } from "@/runtime/sim/entities/types";
import { createTileMap, firstTile, isPlatform, isSolid, lastTile } from "@/runtime/sim/tilemap";
import { difficulty } from "./difficulty";
import { findPassage } from "./passage";
import { createProbe } from "./probe";
import { standingColumn, stuckReason, surfaceRow } from "./reasons";

export type ZoneCheck = {
  zoneId: string;
  name: string;
  passable: boolean;
  difficulty: number;
  reason: string | null;
  furthest: { x: number; y: number } | null; // in tiles: the column and the row the player stands in
  warnings: string[];
};

export type LevelCheck = { zones: ZoneCheck[]; problems: string[] };

const NEAR = 48; // pixels: an enemy this close to an arrival or respawn point gets a warning

function findLevel(project: Project, levelId: string): Level {
  const level = project.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`There is no level with id "${levelId}".`);
  return level;
}

function warningsFor(project: Project, level: Level, zone: Zone, pack: ContentPack, arrival: { x: number; y: number }): string[] {
  const spots = [{ ...arrival, label: "is right where the player arrives" }];
  for (const c of level.checkpoints.filter((c) => c.zoneId === zone.id)) {
    spots.push({ x: c.x * TILE_SIZE + 8, y: c.y * TILE_SIZE + 8, label: "is right next to a checkpoint" });
  }
  const warnings: string[] = [];
  for (const thing of zone.things) {
    const def = pack.things.find((d) => d.type === thing.type);
    if (!def || !ENEMY_BEHAVIOURS.has(def.behaviour)) continue;
    const box = spawnBox(thing, def);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    for (const spot of spots) {
      if (Math.hypot(cx - spot.x, cy - spot.y) < NEAR) {
        warnings.push(`The ${def.name} at (${thing.x}, ${thing.y}) ${spot.label}.`);
        break;
      }
    }
  }
  return warnings;
}

export function checkZone(project: Project, levelId: string, zoneId: string, pack: ContentPack): ZoneCheck {
  pack = gamePack(project, pack); // the kid's own enemies are thing types like any other
  const level = findLevel(project, levelId);
  const zone = level.zones.find((z) => z.id === zoneId);
  if (!zone) throw new Error(`There is no zone with id "${zoneId}" in level "${level.name}".`);

  const settings = heroPhysics(project.hero.abilities);
  const found = findPassage(zone, pack, settings, project.hero.look);
  const probe = createProbe(zone, pack, settings, project.hero.look);
  const p = probe.sim.player;
  const arrival = { x: p.x + p.w / 2, y: p.y + p.h / 2 };

  let reason: string | null = null;
  let furthest: ZoneCheck["furthest"] = null;
  if (!found.passable) {
    if (found.furthest) {
      reason = stuckReason(probe, found.furthest, settings);
      furthest = {
        x: standingColumn(probe.map, found.furthest, probe.zone.exit?.edge),
        y: surfaceRow(found.furthest) - 1,
      };
    } else if (found.arrival === "dies") {
      reason = "The player dies as soon as they arrive: something deadly is at the entry.";
    } else {
      reason = "The player has nothing to stand on or climb where they arrive.";
    }
  }

  return {
    zoneId: zone.id,
    name: zone.name,
    passable: found.passable,
    difficulty: difficulty(zone, pack, found.jumps),
    reason,
    furthest,
    warnings: warningsFor(project, level, zone, pack, arrival),
  };
}

function bossProblems(level: Level, pack: ContentPack): string[] {
  const problems: string[] = [];
  const isBoss = (type: string) => pack.things.find((d) => d.type === type)?.behaviour === "boss";
  const room = level.zones[level.zones.length - 1];
  for (const zone of level.zones) {
    if (zone !== room && zone.things.some((t) => isBoss(t.type))) {
      problems.push(`"${zone.name}" has a boss in it. Bosses belong in the boss room.`);
    }
  }
  if (!room) return problems;
  const bosses = room.things.filter((t) => isBoss(t.type));
  if (bosses.length === 0) problems.push(`The boss room "${room.name}" has no boss, so the level can never be won.`);
  if (bosses.length > 1) problems.push(`The boss room "${room.name}" has ${bosses.length} bosses. It should have exactly one.`);

  const map = createTileMap(room, pack);
  for (const boss of bosses) {
    const box = spawnBox(boss, pack.things.find((d) => d.type === boss.type) ?? { behaviour: "boss" });
    let floor = false;
    for (let c = firstTile(box.x); c <= lastTile(box.x + box.w) && !floor; c++) {
      for (let r = boss.y + 1; r < map.height && !floor; r++) {
        floor = isSolid(map.behaviourAt(c, r)) || isPlatform(map, c, r);
      }
    }
    if (!floor) problems.push(`The boss in "${room.name}" has nothing to stand on.`);
  }
  return problems;
}

// Problems with the level as a whole: zones that don't connect, and the boss rules.
export function levelProblems(project: Project, levelId: string, pack: ContentPack): string[] {
  pack = gamePack(project, pack);
  const level = findLevel(project, levelId);
  return [...chainProblems(level), ...bossProblems(level, pack)];
}

export function checkLevel(project: Project, levelId: string, pack: ContentPack): LevelCheck {
  const level = findLevel(project, levelId);
  return {
    zones: level.zones.map((z) => checkZone(project, levelId, z.id, pack)),
    problems: levelProblems(project, levelId, pack),
  };
}
