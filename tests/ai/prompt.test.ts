import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "@/ai/prompt";
import { AI_TOOLS, MAX_TOOL_CALLS } from "@/ai/tools";

describe("SYSTEM_PROMPT", () => {
  it("names only tools that exist", () => {
    const named = SYSTEM_PROMPT.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? [];
    const real = new Set(AI_TOOLS.map((t) => t.name));
    expect(named.length).toBeGreaterThan(5);
    expect(named.filter((name) => !real.has(name))).toEqual([]);
  });

  it("states the step limit and asks for every changed zone to be checked", () => {
    expect(SYSTEM_PROMPT).toContain(`${MAX_TOOL_CALLS} tool calls`);
    expect(SYSTEM_PROMPT).toContain("call check_zone on it");
  });

  it("keeps the assistant on making the game, in plain words for young users", () => {
    expect(SYSTEM_PROMPT).toMatch(/young players/);
    expect(SYSTEM_PROMPT).toMatch(/you can only help with making their game/);
    expect(SYSTEM_PROMPT).toMatch(/Never ask for personal information/);
  });

  it("tells the assistant how to build around the hero", () => {
    expect(SYSTEM_PROMPT).toContain("Only build crawl spaces for a hero that can slide");
    expect(SYSTEM_PROMPT).toContain("Never change the hero's abilities unless the user asks");
    expect(SYSTEM_PROMPT).toContain("You can't draw or recolour the hero");
    expect(SYSTEM_PROMPT).toMatch(/charge shot/);
  });

  it("tells the assistant to build around the kid's own enemies and boss, and leave them alone", () => {
    expect(SYSTEM_PROMPT).toContain("make it the star of the level");
    expect(SYSTEM_PROMPT).toContain("Build the boss room for the boss's attacks");
    expect(SYSTEM_PROMPT).toContain("Never change, rename or delete their enemies or boss");
    expect(SYSTEM_PROMPT).toContain("Characters screen");
    expect(SYSTEM_PROMPT).not.toContain("Hero button");
  });
});
