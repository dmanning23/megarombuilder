import type { ContentPack, ThingDef } from "./contentPack";
import { tuningSettings } from "./designs";
import type { Project } from "./schema";

export const ownType = (id: string): string => `own-${id}`;

// The content pack plus the kid's own designs as thing types, so the game, the checker, commands
// and validation treat them like any other thing. Own types already in `pack` are replaced, so
// building it from a game pack is harmless.
export function gamePack(project: Project, pack: ContentPack): ContentPack {
  const base = pack.things.filter((d) => !d.own);
  if (project.enemies.length === 0 && base.length === pack.things.length) return pack;
  const own: ThingDef[] = project.enemies.map((enemy) => ({
    type: ownType(enemy.id),
    name: enemy.name,
    category: "enemy",
    behaviour: enemy.behaviour,
    description: "Yours",
    defaults: tuningSettings(enemy.behaviour, enemy.tuning),
    own: true,
  }));
  return { ...pack, things: [...own, ...base] };
}
