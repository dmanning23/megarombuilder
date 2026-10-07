import { z } from "zod";
import { BOSS_ATTACKS, BOSS_FIGHTS, type BossDesign } from "@/model/designs";
import { OWN_BOSS } from "@/model/gamePack";
import { tidyName, type Project } from "@/model/schema";
import { listNames } from "./helpers";
import { defineCommand, fail, nameArg, ok, type CommandResult } from "./types";

const NO_BOSS = "Your game has no boss of its own yet.";

function editBoss(project: Project, change: (boss: BossDesign) => BossDesign | string): CommandResult {
  if (!project.boss) return fail(NO_BOSS);
  const next = change(project.boss);
  return typeof next === "string" ? fail(next) : ok({ ...project, boss: next });
}

const createBossCommand = defineCommand({
  name: "createBoss",
  description: "Give the game a boss of its own, starting from the content pack's boss drawing and attacks.",
  args: z.strictObject({ name: nameArg }),
  apply(project, args, ctx) {
    if (project.boss) return fail("Your game already has a boss of its own.");
    return ok({ ...project, boss: { name: args.name, fight: "normal", attacks: ["jump", "spread", "dash"], look: ctx.pack.bossLook } });
  },
});

const setBossCommand = defineCommand({
  name: "setBoss",
  description: "Change the kid's boss: its name, its fight length (short, normal, long), its 2 or 3 attacks in order.",
  args: z.strictObject({
    name: nameArg.optional(),
    fight: z.enum(BOSS_FIGHTS).optional(),
    attacks: z.array(z.enum(BOSS_ATTACKS)).min(2).max(3).optional(),
  }),
  apply(project, args) {
    const given = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
    if (Object.keys(given).length === 0) return fail("Give something about the boss to change.");
    return editBoss(project, (boss) => ({ ...boss, ...given }));
  },
});

const useBossCommand = defineCommand({
  name: "useBoss",
  description: 'Put the content pack\'s boss ("snow") or the kid\'s own ("yours") in the boss room, in the same place.',
  args: z.strictObject({ boss: z.enum(["snow", "yours"]) }),
  apply(project, args, ctx) {
    if (args.boss === "yours" && !project.boss) return fail(NO_BOSS);
    const snow = ctx.pack.things.find((d) => d.behaviour === "boss" && !d.own);
    if (args.boss === "snow" && !snow) return fail("This content pack has no boss.");
    const isBoss = (type: string) => ctx.pack.things.find((d) => d.type === type)?.behaviour === "boss";
    const target = args.boss === "yours" ? OWN_BOSS : snow!.type;
    let found = 0;
    let swapped = 0;
    const levels = project.levels.map((level) => ({
      ...level,
      zones: level.zones.map((zone) => {
        if (!zone.things.some((t) => isBoss(t.type) && t.type !== target)) {
          found += zone.things.filter((t) => isBoss(t.type)).length;
          return zone;
        }
        return {
          ...zone,
          things: zone.things.map((t) => {
            if (!isBoss(t.type)) return t;
            found++;
            if (t.type === target) return t; // already the chosen boss: keep its settings
            swapped++;
            return args.boss === "yours"
              ? { ...t, type: OWN_BOSS, settings: {} }
              : { ...t, type: snow!.type, settings: { ...snow!.defaults } };
          }),
        };
      }),
    }));
    if (found === 0) return fail("There is no boss in a boss room to swap. Put one there first.");
    return ok(swapped === 0 ? project : { ...project, levels });
  },
});

const removeBossCommand = defineCommand({
  name: "removeBoss",
  description: "Remove the kid's own boss. Refused while it is in the boss room.",
  args: z.strictObject({}),
  apply(project, _args, ctx) {
    if (!project.boss) return fail(NO_BOSS);
    const zones = project.levels.flatMap((level) => level.zones.filter((z) => z.things.some((t) => t.type === OWN_BOSS)).map((z) => z.name));
    if (zones.length > 0) {
      const snow = ctx.pack.things.find((d) => d.behaviour === "boss" && !d.own);
      return fail(`${tidyName(project.boss.name)} is in ${listNames(zones)}. Put the ${snow?.name ?? "other boss"} back first.`);
    }
    return ok({ ...project, boss: null });
  },
});

export const bossCommands = [
  createBossCommand,
  setBossCommand,
  useBossCommand,
  removeBossCommand,
];
