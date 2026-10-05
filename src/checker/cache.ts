import type { ContentPack } from "@/model/contentPack";
import type { Checkpoint, PlayerSettings, Project, Zone } from "@/model/schema";
import { checkZone, levelProblems, type LevelCheck, type ZoneCheck } from "./check";

type Cached = { player: PlayerSettings; checkpoints: Checkpoint[]; pack: ContentPack; check: ZoneCheck };

export type CheckCache = {
  zone(project: Project, levelId: string, zoneId: string, pack: ContentPack): ZoneCheck;
  level(project: Project, levelId: string, pack: ContentPack): LevelCheck;
};

// A zone's check depends only on the zone itself, the player's settings, the level's checkpoints
// and the pack. Unchanged zones keep the same object through edits, so only zones that actually
// changed are checked again. That keeps checking quick on levels with many long zones.
export function createCheckCache(): CheckCache {
  const cache = new WeakMap<Zone, Cached>();

  const zone = (project: Project, levelId: string, zoneId: string, pack: ContentPack): ZoneCheck => {
    const level = project.levels.find((l) => l.id === levelId);
    const found = level?.zones.find((z) => z.id === zoneId);
    if (!level || !found) return checkZone(project, levelId, zoneId, pack); // throws the checker's own error
    const hit = cache.get(found);
    if (hit && hit.player === project.player && hit.checkpoints === level.checkpoints && hit.pack === pack) {
      return hit.check;
    }
    const check = checkZone(project, levelId, zoneId, pack);
    cache.set(found, { player: project.player, checkpoints: level.checkpoints, pack, check });
    return check;
  };

  return {
    zone,
    level(project, levelId, pack) {
      const level = project.levels.find((l) => l.id === levelId);
      if (!level) throw new Error(`There is no level with id "${levelId}".`);
      return {
        zones: level.zones.map((z) => zone(project, levelId, z.id, pack)),
        problems: levelProblems(project, levelId, pack),
      };
    },
  };
}
