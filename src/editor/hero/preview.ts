import type { ContentPack } from "@/model/contentPack";
import { createProject, createZone } from "@/model/factory";
import type { BossDesign, EnemyBehaviour, EnemyDesign } from "@/model/designs";
import { OWN_BOSS, ownType } from "@/model/gamePack";
import type { Abilities, Hero, HeroLook } from "@/model/hero";
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

// Where each behaviour shows best on the preview screen (the hero stands at the left).
const ENEMY_SPOT: Record<EnemyBehaviour, { x: number; y: number }> = {
  walker: { x: 11, y: 12 },
  flyer: { x: 10, y: 8 },
  turret: { x: 9, y: 12 }, // within its firing range of the hero
  jumper: { x: 11, y: 12 },
  shielded: { x: 11, y: 12 },
  dropper: { x: 1, y: 5 }, // above the hero, so it drops
};

// The enemy preview: one screen, the hero standing still, the enemy doing what it does.
export function enemyPreviewSim(enemy: EnemyDesign, hero: Hero, pack: ContentPack): Sim {
  const spot = ENEMY_SPOT[enemy.behaviour];
  const zone = {
    ...createZone({ id: "preview", name: "Preview" }, pack),
    exit: null,
    things: [{ id: "preview-enemy", type: ownType(enemy.id), x: spot.x, y: spot.y, settings: {} }],
  };
  const level: Level = { id: "preview", name: "Preview", brief: "", zones: [zone], checkpoints: [] };
  const project: Project = {
    ...createProject({ id: "preview", name: "Preview" }, pack),
    hero,
    enemies: [enemy],
    levels: [level],
  };
  return createSim(project, "preview", pack);
}

export const IDLE_INPUTS: Input[] = hold({}, 360);

// The boss preview: a one-screen boss room, the hero standing still, the kid's boss fighting.
export function bossPreviewSim(boss: BossDesign, hero: Hero, pack: ContentPack): Sim {
  const zone = {
    ...createZone({ id: "preview", name: "Preview", kind: "bossRoom" }, pack),
    things: [{ id: "preview-boss", type: OWN_BOSS, x: 12, y: 12, settings: {} }],
  };
  const level: Level = { id: "preview", name: "Preview", brief: "", zones: [zone], checkpoints: [] };
  const project: Project = {
    ...createProject({ id: "preview", name: "Preview" }, pack),
    hero,
    boss,
    levels: [level],
  };
  return createSim(project, "preview", pack);
}

// Seven seconds: long enough for three attacks after the intro, too short for the boss to win (at
// most one 4-damage hit per 60 steps after the 60-step intro is 24 of the hero's 28).
export const BOSS_PREVIEW_INPUTS: Input[] = hold({}, 420);
