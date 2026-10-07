import { z } from "zod";
import { inBounds, zoneSize } from "@/model/geometry";
import type { ThingDef } from "@/model/contentPack";
import { thingSettingsSchema, tidyName, type Thing, type Zone } from "@/model/schema";
import { editZone } from "./helpers";
import { coordArg, defineCommand, idArg } from "./types";

function outsideProblem(zone: Zone, x: number, y: number): string | null {
  const size = zoneSize(zone.scroll, zone.screens);
  if (inBounds(size, x, y)) return null;
  return `(${x}, ${y}) is outside "${zone.name}", which is ${size.width} tiles wide and ${size.height} tiles high.`;
}

// The kid's own enemies and boss take their settings from their designs, so placed copies always
// follow the Characters screen.
const ownSettingsProblem = (def: ThingDef) =>
  `${tidyName(def.name)}'s settings come from its design. The user can change it on the Characters screen.`;

// Replaces one thing in a zone, or returns an error string if it is not there.
function editThing(zone: Zone, thingId: string, fn: (thing: Thing) => Thing): Zone | string {
  const index = zone.things.findIndex((t) => t.id === thingId);
  if (index < 0) return `There is no thing with id "${thingId}" in "${zone.name}".`;
  const things = zone.things.slice();
  things[index] = fn(zone.things[index]);
  return { ...zone, things };
}

const placeThingCommand = defineCommand({
  name: "placeThing",
  description: "Place an enemy, pickup, platform or other thing in a zone at a tile position.",
  args: z.strictObject({
    levelId: idArg,
    zoneId: idArg,
    thingId: idArg,
    type: z.string().min(1),
    x: coordArg,
    y: coordArg,
    settings: thingSettingsSchema.default({}),
  }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const def = ctx.pack.things.find((d) => d.type === args.type);
      if (!def) {
        const known = ctx.pack.things.map((d) => d.type).join(", ");
        return `There is no thing called "${args.type}". Choose one of: ${known}.`;
      }
      if (def.own && Object.keys(args.settings).length > 0) return ownSettingsProblem(def);
      const outside = outsideProblem(zone, args.x, args.y);
      if (outside) return outside;
      if (zone.things.some((t) => t.id === args.thingId)) {
        return `There is already a thing with id "${args.thingId}" in "${zone.name}".`;
      }
      const thing: Thing = {
        id: args.thingId,
        type: args.type,
        x: args.x,
        y: args.y,
        // An own enemy's or boss's settings come from its design at play time.
        settings: def.own ? {} : { ...def.defaults, ...args.settings },
      };
      return { ...zone, things: [...zone.things, thing] };
    });
  },
});

const moveThingCommand = defineCommand({
  name: "moveThing",
  description: "Move a thing to a new tile position in its zone.",
  args: z.strictObject({ levelId: idArg, zoneId: idArg, thingId: idArg, x: coordArg, y: coordArg }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const moved = editThing(zone, args.thingId, (t) => ({ ...t, x: args.x, y: args.y }));
      if (typeof moved === "string") return moved;
      return outsideProblem(zone, args.x, args.y) ?? moved;
    });
  },
});

const removeThingCommand = defineCommand({
  name: "removeThing",
  description: "Remove a thing from a zone.",
  args: z.strictObject({ levelId: idArg, zoneId: idArg, thingId: idArg }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      if (!zone.things.some((t) => t.id === args.thingId)) {
        return `There is no thing with id "${args.thingId}" in "${zone.name}".`;
      }
      return { ...zone, things: zone.things.filter((t) => t.id !== args.thingId) };
    });
  },
});

const setThingSettingsCommand = defineCommand({
  name: "setThingSettings",
  description: "Change some of a thing's settings. Settings not mentioned are kept.",
  args: z.strictObject({ levelId: idArg, zoneId: idArg, thingId: idArg, settings: thingSettingsSchema }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const thing = zone.things.find((t) => t.id === args.thingId);
      const def = thing && ctx.pack.things.find((d) => d.type === thing.type);
      if (def?.own) return ownSettingsProblem(def);
      return editThing(zone, args.thingId, (t) => ({ ...t, settings: { ...t.settings, ...args.settings } }));
    });
  },
});

export const thingCommands = [
  placeThingCommand,
  moveThingCommand,
  removeThingCommand,
  setThingSettingsCommand,
];
