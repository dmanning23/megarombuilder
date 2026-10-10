import type { ContentPack, ThingDef } from "./contentPack";
import { bossSettings, tuningSettings } from "./designs";
import { shotPoints, type Look } from "./look";
import type { Project } from "./schema";

export const ownType = (id: string): string => `own-${id}`;
export const OWN_BOSS = "own-boss";

// A design's hitbox size and each pose's shot point, which spawning and shooting read from its thing type.
const bodyOf = (look: Look): Pick<ThingDef, "body" | "shotYs"> => {
  const shotYs = shotPoints(look);
  return { body: { w: look.body.w, h: look.body.h }, ...(Object.keys(shotYs).length > 0 ? { shotYs } : {}) };
};

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
    ...bodyOf(enemy.look),
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
      ...bodyOf(project.boss.look),
    });
  }
  return { ...pack, things: [...own, ...base] };
}
