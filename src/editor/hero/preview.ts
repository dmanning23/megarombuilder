import type { ContentPack } from "@/model/contentPack";
import { createProject, createZone } from "@/model/factory";
import type { Abilities, HeroLook } from "@/model/hero";
import type { Level, Project } from "@/model/schema";
import { createSim, NO_INPUT, type Input, type Sim } from "@/runtime/sim/state";

// The hero screen's preview: the real game, on one screen with no way out, playing a short show.

export function previewSim(look: HeroLook, abilities: Abilities, pack: ContentPack): Sim {
  const zone = { ...createZone({ id: "preview", name: "Preview" }, pack), exit: null };
  const level: Level = { id: "preview", name: "Preview", brief: "", zones: [zone], checkpoints: [] };
  const project: Project = {
    ...createProject({ id: "preview", name: "Preview" }, pack),
    hero: { abilities, look },
    levels: [level],
  };
  return createSim(project, "preview", pack);
}

const hold = (keys: Partial<Input>, steps: number): Input[] => new Array<Input>(steps).fill({ ...NO_INPUT, ...keys });

// Stand, run, jump, shoot twice, slide and charge if the hero can, then run back to the start.
export function previewInputs(abilities: Abilities): Input[] {
  return [
    ...hold({}, 40),
    ...hold({ right: true }, 36),
    ...hold({ right: true, jump: true }, 18),
    ...hold({ right: true }, 24),
    ...hold({}, 12),
    ...hold({ shoot: true }, 2),
    ...hold({}, 10),
    ...hold({ shoot: true }, 2),
    ...hold({}, 30),
    ...(abilities.slide ? [...hold({ right: true, down: true }, 1), ...hold({ down: true, jump: true }, 1), ...hold({}, 45)] : []),
    ...(abilities.chargeShot ? [...hold({ shoot: true }, 75), ...hold({}, 40)] : []),
    ...hold({ left: true }, 190),
    ...hold({}, 20),
  ];
}
