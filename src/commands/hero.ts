import { z } from "zod";
import { abilitiesSchema, type HeroLook } from "@/model/hero";
import type { Project } from "@/model/schema";
import { defineCommand, fail, ok, type CommandResult } from "./types";

const withLook = (project: Project, look: HeroLook): Project => ({ ...project, hero: { ...project.hero, look } });

const setHeroAbilitiesCommand = defineCommand({
  name: "setHeroAbilities",
  description:
    "Change the hero's abilities: speed (normal, fast, veryFast), jump (low, normal, high, veryHigh), health (fragile, normal, tough), shots on screen (1, 2, 3 or 5), slide and chargeShot (true or false). Only the given ones change.",
  args: abilitiesSchema.partial().strict(),
  apply(project, args): CommandResult {
    const given = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
    if (Object.keys(given).length === 0) return fail("Give at least one ability to change.");
    return ok({ ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, ...given } } });
  },
});

const resetHeroLookCommand = defineCommand({
  name: "resetHeroLook",
  description: "Put back the content pack's hero look. The hero's abilities stay as they are.",
  args: z.strictObject({}),
  apply(project, _args, ctx) {
    return ok(withLook(project, ctx.pack.hero));
  },
});

export const heroCommands = [setHeroAbilitiesCommand, resetHeroLookCommand];
