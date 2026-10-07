import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { buildMessages, HISTORY_LIMIT, ModelError, OUT_OF_STEPS, runTurn, type TurnHooks, type TurnRequest } from "@/ai/turn";
import type { Command } from "@/commands/types";
import { SPIKE } from "@/content/snow/pack";
import type { ChatMessage } from "@/model/schema";
import { scriptedModel, say, useTools, waitForAbort, type Step } from "./fakeModel";
import { counter, game, pack, run } from "./helpers";

const spikes = ["fill_rect", { zone: "Zone 1", x: 3, y: 13, w: 2, h: 1, tile: SPIKE }] as [string, unknown];
const checkZone1 = ["check_zone", { zone: "Zone 1" }] as [string, unknown];

function setup(steps: Step[], request: Partial<TurnRequest> = {}) {
  const { model, requests } = scriptedModel(steps);
  const commands: Command[] = [];
  const drafts: string[] = [];
  const activity: string[] = [];
  const controller = new AbortController();
  const hooks: TurnHooks = {
    model,
    pack,
    makeId: counter(),
    signal: controller.signal,
    onDraft: (text) => drafts.push(text),
    onActivity: (line) => activity.push(line),
    onCommand: (command) => commands.push(command),
  };
  const turn = () =>
    runTurn({ project: game(), levelId: "L1", zoneId: "z1", history: [], text: "Add spikes", ...request }, hooks);
  return { turn, requests, commands, drafts, activity, controller };
}

const lastUser = (messages: Anthropic.MessageParam[]) => messages[messages.length - 1];
const toolResults = (message: Anthropic.MessageParam) => message.content as Anthropic.ToolResultBlockParam[];

describe("runTurn", () => {
  it("runs Claude's tools, replays each change, and returns the final reply", async () => {
    const { turn, requests, commands, activity } = setup([useTools(spikes), useTools(checkZone1), say("I added spikes to Zone 1.")]);
    const result = await turn();
    expect(result).toMatchObject({ ok: true, reply: "I added spikes to Zone 1." });
    if (!result.ok) throw new Error("unreachable");
    expect(result.project.levels[0].zones[0].tiles[13 * 16 + 4]).toBe(SPIKE);
    expect(commands).toEqual([{ name: "fillRect", args: { levelId: "L1", zoneId: "z1", x: 3, y: 13, w: 2, h: 1, tile: SPIKE } }]);
    expect(activity).toEqual(["Building Zone 1…", "Checking Zone 1…"]);
    expect(requests).toHaveLength(3);
    const results = toolResults(lastUser(requests[1]));
    expect(results[0]).toMatchObject({ type: "tool_result", content: "Done." });
    expect(results[0]).not.toHaveProperty("is_error");
    // The conversation only grows: Claude's tool-use turn is sent back exactly as it came.
    expect(requests[2].slice(0, requests[1].length)).toEqual(requests[1]);
  });

  it("sends earlier chat, the new message, and what the editor shows", async () => {
    const history: ChatMessage[] = [
      { role: "user", text: "Make it snowy", at: "t1" },
      { role: "assistant", text: "Done!", at: "t2" },
    ];
    const { turn, requests } = setup([say("Sure.")], { history });
    await turn();
    const [first, second, third] = requests[0];
    expect(first).toEqual({ role: "user", content: "Make it snowy" });
    expect(second).toEqual({ role: "assistant", content: "Done!" });
    const blocks = third.content as Anthropic.TextBlockParam[];
    expect(blocks[0]).toEqual({ type: "text", text: "Add spikes" });
    expect(blocks[1].text).toContain("From the editor, not the user");
    expect(blocks[1].text).toContain('Level "Snow Stage".');
    expect(blocks[1].text).toContain('Zone "Zone 1" (id z1)');
    expect(blocks[1].text).toContain("Your hero runs at normal speed");
  });

  it("streams the reply as it arrives", async () => {
    const { turn, drafts } = setup([say("Hello there.")]);
    await turn();
    expect(drafts).toEqual(["", "Hello there."]);
  });

  it("checks changed zones Claude did not check, once, before it finishes", async () => {
    const { turn, requests } = setup([useTools(spikes), say("Done."), say("All good, Zone 1 passes.")]);
    const result = await turn();
    expect(result).toMatchObject({ ok: true, reply: "All good, Zone 1 passes." });
    expect(requests).toHaveLength(3);
    const forced = lastUser(requests[2]);
    expect(forced.role).toBe("user");
    expect(forced.content).toContain('"Zone 1" passes');
  });

  it("never sends Claude an empty reply of its own when it forces the check round", async () => {
    const { turn, requests } = setup([useTools(spikes), { content: [], stop_reason: "end_turn" }, say("Checked.")]);
    expect(await turn()).toMatchObject({ ok: true, reply: "Checked." });
    const assistant = requests[2][requests[2].length - 2];
    expect(assistant.role).toBe("assistant");
    expect(assistant.content).not.toEqual([]);
  });

  it("forces the check round only once per turn", async () => {
    const { turn, requests } = setup([useTools(spikes), say("Done."), useTools(spikes), say("Finished.")]);
    expect(await turn()).toMatchObject({ ok: true, reply: "Finished." });
    expect(requests).toHaveLength(4);
  });

  it("sends a bad tool call back to Claude as an error and carries on", async () => {
    const { turn, requests } = setup([useTools(["get_zone", { zone: "Ice Cave" }]), say("Oops, there is no Ice Cave.")]);
    expect(await turn()).toMatchObject({ ok: true });
    expect(toolResults(lastUser(requests[1]))[0]).toMatchObject({
      is_error: true,
      content: expect.stringContaining('no zone called "Ice Cave"'),
    });
  });

  it("refuses tool calls past the step limit, then ends the turn if Claude keeps going", async () => {
    const many = Array.from({ length: 45 }, () => ["get_catalogue", {}] as [string, unknown]);
    const { turn, requests } = setup([useTools(...many), useTools(["get_catalogue", {}])]);
    const result = await turn();
    expect(result).toEqual({ ok: true, project: expect.anything(), reply: OUT_OF_STEPS });
    const results = toolResults(lastUser(requests[1]));
    expect(results.filter((r) => !r.is_error)).toHaveLength(40);
    expect(results.filter((r) => r.is_error)).toHaveLength(5);
    expect(results[44].content).toMatch(/used all 40 steps/);
  });

  it("lets Claude reply after reaching the step limit", async () => {
    const many = Array.from({ length: 41 }, () => ["get_catalogue", {}] as [string, unknown]);
    const { turn } = setup([useTools(...many), say("I ran out of steps; Zone 1 still needs work.")]);
    expect(await turn()).toMatchObject({ ok: true, reply: "I ran out of steps; Zone 1 still needs work." });
  });

  it("fails with a plain message when the assistant is unavailable", async () => {
    const { turn, commands } = setup([useTools(spikes), new ModelError("unavailable")]);
    const result = await turn();
    expect(result).toEqual({
      ok: false,
      reason: "unavailable",
      message: "The assistant isn't available right now. You can keep building by hand.",
    });
    // The change was already replayed; the editor rolls the turn back.
    expect(commands).toHaveLength(1);
  });

  it("fails on errors it does not know", async () => {
    const { turn } = setup([new Error("boom")]);
    expect(await turn()).toMatchObject({ ok: false, reason: "failed" });
  });

  it("asks again when a reply's tool input could not be read, but only twice in a row", async () => {
    const retried = setup([new ModelError("bad_tool_input"), new ModelError("bad_tool_input"), say("OK.")]);
    expect(await retried.turn()).toMatchObject({ ok: true, reply: "OK." });
    const gaveUp = setup([new ModelError("bad_tool_input"), new ModelError("bad_tool_input"), new ModelError("bad_tool_input")]);
    expect(await gaveUp.turn()).toMatchObject({ ok: false, reason: "failed" });
  });

  it("fails when Claude refuses or runs out of room", async () => {
    const refused = setup([{ ...say(""), stop_reason: "refusal" }]);
    expect(await refused.turn()).toMatchObject({ ok: false, reason: "refused" });
    const tooLong = setup([{ ...useTools(spikes), stop_reason: "max_tokens" }]);
    const result = await tooLong.turn();
    expect(result).toMatchObject({ ok: false, reason: "too_long" });
    expect(tooLong.commands).toEqual([]); // a cut-off tool call is never run
  });

  it("stops when the user presses stop", async () => {
    const { turn, controller } = setup([useTools(spikes), waitForAbort]);
    const pending = turn();
    setTimeout(() => controller.abort(), 0);
    expect(await pending).toEqual({ ok: false, reason: "stopped", message: "Stopped. Nothing was changed." });
  });

  it("says Done when Claude finishes without words", async () => {
    const { turn } = setup([say("   ")]);
    expect(await turn()).toMatchObject({ ok: true, reply: "Done." });
  });
});

describe("buildMessages", () => {
  const at = "t";

  it("starts with the user, merges messages from the same side, and keeps only recent ones", () => {
    const history: ChatMessage[] = [
      { role: "assistant", text: "Hi!", at },
      { role: "user", text: "one", at },
      { role: "user", text: "two", at },
      { role: "assistant", text: "three", at },
    ];
    const messages = buildMessages(history, "four", "context");
    expect(messages.slice(0, 2)).toEqual([
      { role: "user", content: "one\n\ntwo" },
      { role: "assistant", content: "three" },
    ]);
    expect(messages[2]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "four" },
        { type: "text", text: "context" },
      ],
    });
  });

  it("folds a trailing user message into the new one", () => {
    const messages = buildMessages([{ role: "user", text: "earlier", at }], "now", "context");
    expect(messages).toHaveLength(1);
    expect((messages[0].content as Anthropic.TextBlockParam[])[0].text).toBe("earlier\n\nnow");
  });

  it("sends at most the last HISTORY_LIMIT saved messages", () => {
    const history: ChatMessage[] = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      text: `m${i}`,
      at,
    }));
    const messages = buildMessages(history, "new", "context");
    expect(messages).toHaveLength(HISTORY_LIMIT + 1);
    expect(messages[0]).toEqual({ role: "user", content: "m30" });
  });
});

describe("the assistant and the hero", () => {
  it("gives the hero slide and builds a crawl space it can get through", async () => {
    const { turn, commands } = setup([
      useTools(["set_hero_abilities", { slide: true }]),
      useTools(["insert_piece", { zone: "Zone 1", pieceId: "crawl-space", x: 5, y: 0, settings: { length: 4 } }]),
      useTools(["check_level", {}]),
      say("Your hero can slide now, and Zone 1 has a crawl space."),
    ]);
    const result = await turn();
    expect(result).toMatchObject({ ok: true, reply: "Your hero can slide now, and Zone 1 has a crawl space." });
    if (!result.ok) throw new Error("unreachable");
    expect(result.project.hero.abilities.slide).toBe(true);
    expect(commands.map((c) => c.name)).toEqual(["setHeroAbilities", "insertPiece"]);
  });

  it("checks every zone when Claude changes the hero and doesn't check", async () => {
    const { turn, requests } = setup([useTools(["set_hero_abilities", { jump: "low" }]), say("Done."), say("All zones still pass.")]);
    expect(await turn()).toMatchObject({ ok: true, reply: "All zones still pass." });
    const forced = requests[2][requests[2].length - 1].content as string;
    for (const name of ['"Zone 1"', '"Boss Corridor"', '"Boss Room"']) expect(forced).toContain(name);
  });
});

describe("the assistant and the kid's own enemies", () => {
  function withFang() {
    return run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
  }

  it("sees them in the message, and places one by its type", async () => {
    const { turn, requests, commands } = setup(
      [
        useTools(["place_thing", { zone: "Zone 1", type: "own-e1", x: 8, y: 12 }]),
        useTools(["check_zone", { zone: "Zone 1" }]),
        say("Frost Fang now guards Zone 1."),
      ],
      { project: withFang(), text: "Build a level for my Frost Fang" },
    );
    expect(await turn()).toMatchObject({ ok: true, reply: "Frost Fang now guards Zone 1." });
    const context = (requests[0][0].content as Anthropic.TextBlockParam[])[1].text;
    expect(context).toContain("- own-e1: Frost Fang, a walker");
    expect(commands).toEqual([
      expect.objectContaining({ name: "placeThing", args: expect.objectContaining({ type: "own-e1", x: 8, y: 12 }) }),
    ]);
  });

  it("gets an error back, and changes nothing, when it tries to change an own enemy's settings", async () => {
    let project = withFang();
    project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 8, y: 12 });
    const { turn, requests, commands } = setup(
      [
        useTools(["set_thing_settings", { zone: "Zone 1", thingId: "t1", settings: { speed: 3 } }]),
        say("Frost Fang's speed is set on the Characters screen."),
      ],
      { project },
    );
    expect(await turn()).toMatchObject({ ok: true });
    const result = toolResults(lastUser(requests[1]))[0];
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("settings come from its design");
    expect(commands).toEqual([]);
  });

});
