import { describe, expect, it } from "vitest";
import { AI_TOOLS, MAX_TOOL_CALLS, toolDefinitions } from "@/ai/tools";
import { commandDefs } from "@/commands/registry";

const tool = (name: string) => AI_TOOLS.find((t) => t.name === name)!;
const properties = (name: string) => {
  const schema = toolDefinitions().find((t) => t.name === name)!.input_schema as { properties: Record<string, unknown> };
  return Object.keys(schema.properties);
};

describe("AI_TOOLS", () => {
  it("has exactly the tools in the spec, looks first and checks last", () => {
    expect(AI_TOOLS.map((t) => t.name)).toEqual([
      "get_level_overview", "get_zone", "get_catalogue",
      "set_level_brief", "add_zone", "remove_zone", "move_zone", "rename_zone", "resize_zone",
      "set_zone_variant", "set_zone_intent", "set_zone_openings", "set_hero_abilities",
      "insert_piece", "fill_rect", "clear_rect", "set_tiles", "place_thing", "move_thing",
      "remove_thing", "set_thing_settings", "add_checkpoint", "remove_checkpoint",
      "check_zone", "check_level",
    ]);
    expect(MAX_TOOL_CALLS).toBe(40);
  });

  it("maps each change to a real command and keeps its description", () => {
    for (const t of AI_TOOLS.filter((t) => t.command)) {
      const def = commandDefs.find((d) => d.name === t.command!.name);
      expect(def, t.name).toBeDefined();
      expect(t.description.startsWith(def!.description)).toBe(true);
    }
  });

  it("never asks for the level, and takes a zone by id or name instead of a zone id", () => {
    for (const t of toolDefinitions()) {
      const keys = properties(t.name);
      expect(keys, t.name).not.toContain("levelId");
      expect(keys, t.name).not.toContain("zoneId");
    }
    expect(properties("fill_rect")).toEqual(["zone", "x", "y", "w", "h", "tile"]);
    expect(properties("get_zone")).toEqual(["zone"]);
    expect(properties("set_level_brief")).toEqual(["brief"]);
  });

  it("leaves new ids to the browser", () => {
    expect(properties("add_zone")).not.toContain("zone");
    expect(tool("add_zone").command!.generated).toBe("zoneId");
    expect(properties("place_thing")).not.toContain("thingId");
    expect(properties("insert_piece")).not.toContain("idPrefix");
    expect(properties("move_thing")).toContain("thingId");
  });

  it("lets the assistant change the hero's abilities, and nothing else about the hero", () => {
    expect(properties("set_hero_abilities")).toEqual(["speed", "jump", "health", "shots", "slide", "chargeShot", "chargeLevel2"]);
    expect(tool("set_hero_abilities").command).toMatchObject({ name: "setHeroAbilities", levelArg: false });
    expect(tool("fill_rect").command).toMatchObject({ levelArg: true });
    expect(AI_TOOLS.some((t) => /hero_(colours|pose|look)/.test(t.name))).toBe(false);
  });

  it("rejects input the command would not take", () => {
    expect(tool("place_thing").input.safeParse({ zone: "Zone 1", type: "walker", x: 1, y: 2 }).success).toBe(true);
    expect(tool("place_thing").input.safeParse({ zone: "Zone 1", type: "walker", x: 1, y: 2, levelId: "L1" }).success).toBe(false);
    expect(tool("fill_rect").input.safeParse({ zone: "Zone 1", x: 1.5, y: 2, w: 1, h: 1, tile: 1 }).success).toBe(false);
    expect(tool("get_zone").input.safeParse({}).success).toBe(false);
  });
});

describe("toolDefinitions", () => {
  it("gives Claude an object schema, a description and eager streaming for every tool", () => {
    const defs = toolDefinitions();
    expect(defs).toHaveLength(AI_TOOLS.length);
    for (const d of defs) {
      expect(d.input_schema.type).toBe("object");
      expect(d.input_schema.additionalProperties).toBe(false);
      expect(d.input_schema).not.toHaveProperty("$schema");
      expect(d.eager_input_streaming).toBe(true);
      expect(d.description!.length).toBeGreaterThan(20);
    }
  });

  it("marks optional arguments as optional", () => {
    const addZone = toolDefinitions().find((t) => t.name === "add_zone")!.input_schema;
    expect(addZone.required).toEqual(["name"]);
  });
});
