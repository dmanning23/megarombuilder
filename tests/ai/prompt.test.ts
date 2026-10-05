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
});
