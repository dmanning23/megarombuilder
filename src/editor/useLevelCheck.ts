"use client";

import { useEffect, useRef, useState } from "react";
import { createCheckCache } from "@/checker/cache";
import type { LevelCheck } from "@/checker/check";
import type { ContentPack } from "@/model/contentPack";
import type { Project } from "@/model/schema";

// Checks the level a moment after editing pauses; keeps the last result while waiting.
// Only zones that changed since the last check are checked again (see createCheckCache).
export function useLevelCheck(
  project: Project,
  levelId: string,
  pack: ContentPack,
  paused: boolean,
  delay = 400,
): LevelCheck | null {
  const [check, setCheck] = useState<LevelCheck | null>(null);
  const cache = useRef(createCheckCache());
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => {
      if (!project.levels.some((l) => l.id === levelId)) return;
      setCheck(cache.current.level(project, levelId, pack));
    }, delay);
    return () => clearTimeout(timer);
  }, [project, levelId, pack, paused, delay]);
  return check;
}
