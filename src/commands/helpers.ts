import { tidyName, type Level, type Project, type Zone } from "@/model/schema";
import { fail, ok, type CommandResult } from "./types";

// Replaces one level. The callback returns the new level, or a string to fail with.
export function editLevel(
  project: Project,
  levelId: string,
  fn: (level: Level) => Level | string,
): CommandResult {
  const index = project.levels.findIndex((l) => l.id === levelId);
  if (index < 0) return fail(`There is no level with id "${levelId}".`);
  const next = fn(project.levels[index]);
  if (typeof next === "string") return fail(next);
  const levels = project.levels.slice();
  levels[index] = next;
  return ok({ ...project, levels });
}

// Replaces one zone. The callback returns the new zone, or a string to fail with.
export function editZone(
  project: Project,
  levelId: string,
  zoneId: string,
  fn: (zone: Zone, level: Level) => Zone | string,
): CommandResult {
  return editLevel(project, levelId, (level) => {
    const index = level.zones.findIndex((z) => z.id === zoneId);
    if (index < 0) return `There is no zone with id "${zoneId}" in level "${level.name}".`;
    const next = fn(level.zones[index], level);
    if (typeof next === "string") return next;
    const zones = level.zones.slice();
    zones[index] = next;
    return { ...level, zones };
  });
}

export function nameTaken(level: Level, name: string, exceptZoneId?: string): boolean {
  const key = tidyName(name).toLowerCase();
  return level.zones.some((z) => z.id !== exceptZoneId && tidyName(z.name).toLowerCase() === key);
}

// "Stand", "Stand and Run 1", "Stand, Run 1 and Jump".
export function listNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
