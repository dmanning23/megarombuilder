"use client";

import { useEffect, useState } from "react";
import { checkLevel, type LevelCheck } from "@/checker/check";
import type { ContentPack } from "@/model/contentPack";
import type { Project } from "@/model/schema";

// Checks the level a moment after editing pauses; keeps the last result while waiting.
export function useLevelCheck(
  project: Project,
  levelId: string,
  pack: ContentPack,
  paused: boolean,
  delay = 400,
): LevelCheck | null {
  const [check, setCheck] = useState<LevelCheck | null>(null);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setCheck(checkLevel(project, levelId, pack)), delay);
    return () => clearTimeout(timer);
  }, [project, levelId, pack, paused, delay]);
  return check;
}
