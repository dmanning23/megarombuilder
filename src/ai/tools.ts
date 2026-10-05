import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { commandDefs } from "@/commands/registry";

export const MAX_TOOL_CALLS = 40;

export type ToolKind = "look" | "plan" | "build" | "check";

type Generated = "zoneId" | "thingId" | "idPrefix";

export type AiTool = {
  name: string;
  kind: ToolKind;
  description: string;
  input: z.ZodObject;
  // For a tool that makes a change: its command, which id the browser makes up, and whether the
  // tool's `zone` (an id or a name) becomes the command's zoneId.
  command: { name: string; generated: Generated | null; zoneArg: boolean } | null;
};

const zoneArg = z.string().min(1).describe('The zone, by its id or its name, for example "Zone 1".');

const COMMAND_TOOLS: { tool: string; command: string; kind: "plan" | "build"; generated?: Generated }[] = [
  { tool: "set_level_brief", command: "setLevelBrief", kind: "plan" },
  { tool: "add_zone", command: "addZone", kind: "plan", generated: "zoneId" },
  { tool: "remove_zone", command: "removeZone", kind: "plan" },
  { tool: "move_zone", command: "moveZone", kind: "plan" },
  { tool: "rename_zone", command: "renameZone", kind: "plan" },
  { tool: "resize_zone", command: "resizeZone", kind: "plan" },
  { tool: "set_zone_variant", command: "setZoneVariant", kind: "plan" },
  { tool: "set_zone_intent", command: "setZoneIntent", kind: "plan" },
  { tool: "set_zone_openings", command: "setZoneOpenings", kind: "plan" },
  { tool: "insert_piece", command: "insertPiece", kind: "build", generated: "idPrefix" },
  { tool: "fill_rect", command: "fillRect", kind: "build" },
  { tool: "clear_rect", command: "clearRect", kind: "build" },
  { tool: "set_tiles", command: "setTiles", kind: "build" },
  { tool: "place_thing", command: "placeThing", kind: "build", generated: "thingId" },
  { tool: "move_thing", command: "moveThing", kind: "build" },
  { tool: "remove_thing", command: "removeThing", kind: "build" },
  { tool: "set_thing_settings", command: "setThingSettings", kind: "build" },
  { tool: "add_checkpoint", command: "addCheckpoint", kind: "build" },
  { tool: "remove_checkpoint", command: "removeCheckpoint", kind: "build" },
];

// Added to the command's own description, where Claude needs more to use the tool well.
const HINTS: Record<string, string> = {
  set_level_brief: " Call this first when building a new level: a sentence or two on its theme and how it plays.",
  add_zone: " Give it a short name the user can say in chat.",
  set_zone_intent: " Say in a few words what the zone is for, for example \"introduce ice\" or \"rest before the boss\".",
  insert_piece: " Call get_catalogue to see the pieces, their widths and settings. Build zones from pieces first.",
  fill_rect: " Use tile 0 to empty an area, or clear_rect.",
  set_tiles: " Use it for small, scattered changes; use fill_rect for blocks.",
  place_thing:
    " x and y are the tile the thing stands in: an enemy on a floor whose top row is 13 goes at y 12. Flying enemies float in their tile, droppers hang from the top of theirs, and moving platforms ride along the top of theirs.",
  add_checkpoint: " x and y are the tile the player respawns standing in.",
};

function commandTool(spec: (typeof COMMAND_TOOLS)[number]): AiTool {
  const def = commandDefs.find((d) => d.name === spec.command);
  if (!def || !(def.args instanceof z.ZodObject)) throw new Error(`No command called ${spec.command}.`);
  const shape = def.args.shape as Record<string, z.ZodType>;
  const zoneArgUsed = "zoneId" in shape && spec.generated !== "zoneId";
  const rest = Object.fromEntries(
    Object.entries(shape).filter(([key]) => key !== "levelId" && key !== "zoneId" && key !== spec.generated),
  );
  return {
    name: spec.tool,
    kind: spec.kind,
    description: def.description + (HINTS[spec.tool] ?? ""),
    input: z.strictObject({ ...(zoneArgUsed ? { zone: zoneArg } : {}), ...rest }),
    command: { name: spec.command, generated: spec.generated ?? null, zoneArg: zoneArgUsed },
  };
}

const LOOK_TOOLS: AiTool[] = [
  {
    name: "get_level_overview",
    kind: "look",
    description:
      "See the whole level: its brief, every zone in order with its id, name, size, look, purpose and checker verdict, any problems with how the zones connect, and the checkpoints. Call this when you need to see the level as it is now.",
    input: z.strictObject({}),
    command: null,
  },
  {
    name: "get_zone",
    kind: "look",
    description:
      "See one zone as a grid of tiles with a legend, plus its things (with ids), checkpoints, size and ways in and out. Call this before changing a zone, and again after big changes.",
    input: z.strictObject({ zone: zoneArg }),
    command: null,
  },
  {
    name: "get_catalogue",
    kind: "look",
    description:
      "List the tiles, things and pieces you can build with, with their ids, settings and sizes, and how high and far the player can jump. Call this before you build.",
    input: z.strictObject({}),
    command: null,
  },
];

const CHECK_TOOLS: AiTool[] = [
  {
    name: "check_zone",
    kind: "check",
    description:
      "Run the checker on one zone: it plays the zone to see whether the player can get from the way in to the way out, says why not if they can't, and estimates difficulty. Call this on every zone you changed before you finish.",
    input: z.strictObject({ zone: zoneArg }),
    command: null,
  },
  {
    name: "check_level",
    kind: "check",
    description:
      "Run the checker on every zone in the level, and list any problems with how the zones connect. Use it after building or changing several zones.",
    input: z.strictObject({}),
    command: null,
  },
];

export const AI_TOOLS: AiTool[] = [...LOOK_TOOLS, ...COMMAND_TOOLS.map(commandTool), ...CHECK_TOOLS];

// The tool list sent to Claude. The order never changes, so the prompt cache keeps working.
export function toolDefinitions(): Anthropic.Tool[] {
  return AI_TOOLS.map((tool) => {
    const schema: Record<string, unknown> = { ...z.toJSONSchema(tool.input, { io: "input" }) };
    delete schema.$schema;
    return {
      name: tool.name,
      description: tool.description,
      input_schema: schema as Anthropic.Tool["input_schema"],
      eager_input_streaming: true,
    };
  });
}
