import type { ContentPack, ThingDef } from "./contentPack";
import { bossSettings, tuningSettings } from "./designs";
import type { Project } from "./schema";

export const ownType = (id: string): string => `own-${id}`;
export const OWN_BOSS = "own-boss";

// The content pack plus the kid's own designs as thing types, so the game, the checker, commands
// and validation treat them like any other thing. Own types already in `pack` are replaced, so
// building it from a game pack is harmless.
export function gamePack(project: Project, pack: ContentPack): ContentPack {
  const base = pack.things.filter((d) => !d.own);
  if (project.enemies.length === 0 && !project.boss && base.length === pack.things.length) return pack;
  const own: ThingDef[] = project.enemies.map((enemy) => ({
    type: ownType(enemy.id),
    name: enemy.name,
    category: "enemy",
    behaviour: enemy.behaviour,
    description: "Yours",
    defaults: tuningSettings(enemy.behaviour, enemy.tuning),
    own: true,
  }));
  if (project.boss) {
    own.push({
      type: OWN_BOSS,
      name: project.boss.name,
      category: "boss",
      behaviour: "boss",
      description: "Yours",
      defaults: bossSettings(project.boss),
      own: true,
    });
  }
  return { ...pack, things: [...own, ...base] };
}
