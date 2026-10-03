"use client";

import { useEffect, useRef, useState } from "react";
import { checkZone, levelProblems, type LevelCheck, type ZoneCheck } from "@/checker/check";
import type { ContentPack } from "@/model/contentPack";
import type { Checkpoint, PlayerSettings, Project, Zone } from "@/model/schema";

type Cached = { player: PlayerSettings; checkpoints: Checkpoint[]; pack: ContentPack; check: ZoneCheck };

// Checks the level a moment after editing pauses; keeps the last result while waiting.
// A zone's check depends only on the zone itself, the player's settings, the level's checkpoints
// and the pack, and unchanged zones keep the same object through edits, so only zones that
// actually changed are checked again. That keeps editing smooth on levels with many long zones.
export function useLevelCheck(
  project: Project,
  levelId: string,
  pack: ContentPack,
  paused: boolean,
  delay = 400,
): LevelCheck | null {
  const [check, setCheck] = useState<LevelCheck | null>(null);
  const cache = useRef(new WeakMap<Zone, Cached>());
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => {
      const level = project.levels.find((l) => l.id === levelId);
      if (!level) return;
      const zones = level.zones.map((zone) => {
        const hit = cache.current.get(zone);
        if (hit && hit.player === project.player && hit.checkpoints === level.checkpoints && hit.pack === pack) {
          return hit.check;
        }
        const fresh = checkZone(project, levelId, zone.id, pack);
        cache.current.set(zone, { player: project.player, checkpoints: level.checkpoints, pack, check: fresh });
        return fresh;
      });
      setCheck({ zones, problems: levelProblems(project, levelId, pack) });
    }, delay);
    return () => clearTimeout(timer);
  }, [project, levelId, pack, paused, delay]);
  return check;
}
