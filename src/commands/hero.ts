import { z } from "zod";
import {
  abilitiesSchema,
  HERO_PICTURES,
  pictureProblems,
  MAX_COLOURS,
  PICTURE_NAMES,
  pictureRows,
  withPicture,
  type HeroLook,
} from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import type { Project } from "@/model/schema";
import { defineCommand, fail, ok, type CommandResult } from "./types";

const withLook = (project: Project, look: HeroLook): Project => ({ ...project, hero: { ...project.hero, look } });

// "Stand", "Stand and Run 1", "Stand, Run 1 and Jump".
function listNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

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

const setHeroColoursCommand = defineCommand({
  name: "setHeroColours",
  description: `Set the hero's colour slots: 1 to ${MAX_COLOURS} colours from the 8-bit palette (0 to ${PALETTE_8BIT.length - 1}). Pixels name slots, so changing a slot recolours it everywhere.`,
  args: z.strictObject({
    colours: z
      .array(z.number().int().min(0).max(PALETTE_8BIT.length - 1))
      .min(1)
      .max(MAX_COLOURS),
  }),
  apply(project, args) {
    const look = project.hero.look;
    for (let slot = args.colours.length + 1; slot <= look.colours.length; slot++) {
      const users = HERO_PICTURES.filter((p) => pictureRows(look, p).some((row) => row.includes(String(slot))));
      if (users.length > 0) {
        return fail(`Colour ${slot} is still used in ${listNames(users.map((p) => PICTURE_NAMES[p]))}.`);
      }
    }
    return ok(withLook(project, { ...look, colours: args.colours }));
  },
});

const setHeroPoseCommand = defineCommand({
  name: "setHeroPose",
  description:
    'Replace one of the hero\'s pictures (a pose, "shot" or "chargedShot") with rows of pixels: "." is empty and a digit names a colour slot.',
  args: z.strictObject({ picture: z.enum(HERO_PICTURES), rows: z.array(z.string()).min(1).max(64) }),
  apply(project, args) {
    const look = withPicture(project.hero.look, args.picture, args.rows);
    const problem = pictureProblems(look, args.picture)[0];
    if (problem) return fail(problem);
    return ok(withLook(project, look));
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

export const heroCommands = [setHeroAbilitiesCommand, setHeroColoursCommand, setHeroPoseCommand, resetHeroLookCommand];
