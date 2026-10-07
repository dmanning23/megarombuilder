import { z } from "zod";
import {
  defaultTuning,
  DAMAGE_STEPS,
  ENEMY_BEHAVIOURS,
  ENEMY_FRAME,
  framesProblems,
  HEALTH_STEPS,
  MAX_ENEMIES,
  SHOOT_STEPS,
  SPEED_STEPS,
  type EnemyDesign,
} from "@/model/designs";
import { ownType } from "@/model/gamePack";
import { MAX_COLOURS } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
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
    return editEnemy(project, args.enemyId, (enemy) => ({ ...enemy, behaviour: args.behaviour }));
  },
});

const setEnemyTuningCommand = defineCommand({
  name: "setEnemyTuning",
  description: "Change any of an enemy's tuning steps: health (1, 2, 3, 5), damage, speed, shoots.",
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

const setEnemyColoursCommand = defineCommand({
  name: "setEnemyColours",
  description: `Set an enemy's colour slots: 1 to ${MAX_COLOURS} colours from the 8-bit palette.`,
  args: z.strictObject({
    enemyId: idArg,
    colours: z.array(z.number().int().min(0).max(PALETTE_8BIT.length - 1)).min(1).max(MAX_COLOURS),
  }),
  apply(project, args) {
    return editEnemy(project, args.enemyId, (enemy) => {
      for (let slot = args.colours.length + 1; slot <= enemy.look.colours.length; slot++) {
        const frames = enemy.look.frames.flatMap((rows, i) => (rows.some((row) => row.includes(String(slot))) ? [`frame ${i + 1}`] : []));
        if (frames.length > 0) return `Colour ${slot} is still used in ${tidyName(enemy.name)}'s ${listNames(frames)}.`;
      }
      return { ...enemy, look: { ...enemy.look, colours: args.colours } };
    });
  },
});

const setEnemyFrameCommand = defineCommand({
  name: "setEnemyFrame",
  description: 'Replace one of an enemy\'s two frames (0 or 1) with rows of pixels: "." is empty, a digit is a colour.',
  args: z.strictObject({ enemyId: idArg, frame: z.union([z.literal(0), z.literal(1)]), rows: z.array(z.string()).min(1).max(64) }),
  apply(project, args) {
    return editEnemy(project, args.enemyId, (enemy) => {
      const frames = enemy.look.frames.map((rows, i) => (i === args.frame ? args.rows : rows));
      const look = { ...enemy.look, frames: frames as [string[], string[]] };
      const problem = framesProblems(tidyName(enemy.name), { colours: look.colours, frames: [args.rows] }, ENEMY_FRAME)[0];
      if (problem) return problem.replace(" frame 1 ", ` frame ${args.frame + 1} `);
      return { ...enemy, look };
    });
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
    const zones = project.levels.flatMap((level) => level.zones.filter((z) => z.things.some((t) => t.type === type)).map((z) => z.name));
    if (zones.length > 0) return fail(`${tidyName(enemy.name)} is used in ${listNames(zones)}.`);
    return ok({ ...project, enemies: project.enemies.filter((e) => e.id !== enemy.id) });
  },
});

export const enemyCommands = [
  addEnemyCommand,
  renameEnemyCommand,
  setEnemyBehaviourCommand,
  setEnemyTuningCommand,
  setEnemyColoursCommand,
  setEnemyFrameCommand,
  removeEnemyCommand,
];
