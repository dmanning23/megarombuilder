import { z } from "zod";
import {
  defaultTuning,
  DAMAGE_STEPS,
  ENEMY_BEHAVIOURS,
  HEALTH_STEPS,
  MAX_ENEMIES,
  SHOOT_STEPS,
  SPEED_STEPS,
  type EnemyDesign,
} from "@/model/designs";
import { ownType } from "@/model/gamePack";
import { lookForKind, lookProblems } from "@/model/look";
import { tidyName, type Project } from "@/model/schema";
import { listNames } from "./helpers";
import { defineCommand, fail, idArg, nameArg, ok, type CommandResult } from "./types";

const behaviourArg = z.enum(ENEMY_BEHAVIOURS);

function findEnemy(project: Project, enemyId: string): EnemyDesign | string {
  return project.enemies.find((e) => e.id === enemyId) ?? `There is no enemy with the id "${enemyId}".`;
}

function editEnemy(project: Project, enemyId: string, change: (enemy: EnemyDesign) => EnemyDesign | string): CommandResult {
  const enemy = findEnemy(project, enemyId);
  if (typeof enemy === "string") return fail(enemy);
  const next = change(enemy);
  if (typeof next === "string") return fail(next);
  return ok({ ...project, enemies: project.enemies.map((e) => (e.id === enemyId ? next : e)) });
}

function nameClash(project: Project, name: string, exceptId?: string): string | null {
  const wanted = tidyName(name).toLowerCase();
  const other = project.enemies.find((e) => e.id !== exceptId && tidyName(e.name).toLowerCase() === wanted);
  return other ? `There is already an enemy called "${tidyName(other.name)}".` : null;
}

const addEnemyCommand = defineCommand({
  name: "addEnemy",
  description: "Add one of the kid's own enemies, starting from the content pack's drawing for its behaviour.",
  args: z.strictObject({ enemyId: idArg, name: nameArg, behaviour: behaviourArg }),
  apply(project, args, ctx) {
    if (project.enemies.length >= MAX_ENEMIES) return fail(`A game can have up to ${MAX_ENEMIES} enemies of its own.`);
    if (project.enemies.some((e) => e.id === args.enemyId)) {
      return fail(`There is already an enemy with the id "${args.enemyId}".`);
    }
    const clash = nameClash(project, args.name);
    if (clash) return fail(clash);
    const enemy: EnemyDesign = {
      id: args.enemyId,
      name: args.name,
      behaviour: args.behaviour,
      tuning: defaultTuning(args.behaviour),
      look: ctx.pack.enemyLooks[args.behaviour],
    };
    return ok({ ...project, enemies: [...project.enemies, enemy] });
  },
});

const renameEnemyCommand = defineCommand({
  name: "renameEnemy",
  description: "Rename one of the kid's own enemies.",
  args: z.strictObject({ enemyId: idArg, name: nameArg }),
  apply(project, args) {
    const clash = nameClash(project, args.name, args.enemyId);
    if (clash) return fail(clash);
    return editEnemy(project, args.enemyId, (enemy) => ({ ...enemy, name: args.name }));
  },
});

const setEnemyBehaviourCommand = defineCommand({
  name: "setEnemyBehaviour",
  description: "Change how one of the kid's own enemies behaves. Its drawing and tuning stay.",
  args: z.strictObject({ enemyId: idArg, behaviour: behaviourArg }),
  apply(project, args) {
    // The drawing carries over: its canvas, hitbox and frames, moved into the new behaviour's animations.
    return editEnemy(project, args.enemyId, (enemy) => {
      const look = lookForKind(enemy.look, enemy.behaviour, args.behaviour);
      const problem = lookProblems(args.behaviour, look, tidyName(enemy.name))[0];
      return problem ?? { ...enemy, behaviour: args.behaviour, look };
    });
  },
});

const setEnemyTuningCommand = defineCommand({
  name: "setEnemyTuning",
  description: "Change any of an enemy's tuning steps: health (1, 2, 3, 5, 8, 12), damage, speed, shoots.",
  args: z.strictObject({
    enemyId: idArg,
    health: z.literal(HEALTH_STEPS).optional(),
    damage: z.enum(DAMAGE_STEPS).optional(),
    speed: z.enum(SPEED_STEPS).optional(),
    shoots: z.enum(SHOOT_STEPS).optional(),
  }),
  apply(project, args) {
    const { enemyId, ...steps } = args;
    const given = Object.fromEntries(Object.entries(steps).filter(([, value]) => value !== undefined));
    if (Object.keys(given).length === 0) return fail("Give at least one step to change.");
    return editEnemy(project, enemyId, (enemy) => ({ ...enemy, tuning: { ...enemy.tuning, ...given } }));
  },
});

const removeEnemyCommand = defineCommand({
  name: "removeEnemy",
  description: "Remove one of the kid's own enemies. Refused while it is placed in any zone.",
  args: z.strictObject({ enemyId: idArg }),
  apply(project, args) {
    const enemy = findEnemy(project, args.enemyId);
    if (typeof enemy === "string") return fail(enemy);
    const type = ownType(enemy.id);
    const uses = project.levels.flatMap((level) =>
      level.zones.filter((z) => z.things.some((t) => t.type === type)).map((z) => ({ zone: z.name, level: level.name })),
    );
    // Zone names are only unique within a level, so name the level too when there is more than one.
    const manyLevels = new Set(uses.map((u) => u.level)).size > 1;
    const places = uses.map((u) => (manyLevels ? `${u.zone} in ${u.level}` : u.zone));
    if (places.length > 0) return fail(`${tidyName(enemy.name)} is used in ${listNames(places)}.`);
    return ok({ ...project, enemies: project.enemies.filter((e) => e.id !== enemy.id) });
  },
});

export const enemyCommands = [
  addEnemyCommand,
  renameEnemyCommand,
  setEnemyBehaviourCommand,
  setEnemyTuningCommand,
  removeEnemyCommand,
];
