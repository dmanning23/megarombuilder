import type Anthropic from "@anthropic-ai/sdk";
import { createCheckCache, type CheckCache } from "@/checker/cache";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import type { ChatMessage, Project } from "@/model/schema";
import { describeLevel, describeZone } from "./describe";
import { checkUnchecked, executeTool, startTurn, type ToolContext, type TurnState } from "./execute";
import { MAX_TOOL_CALLS } from "./tools";

// One chat turn, run in the browser: send the conversation to Claude, run the tools it asks for,
// send the results back, and repeat until it replies.

export const HISTORY_LIMIT = 20;

export type ModelReply = { content: Anthropic.ContentBlock[]; stop_reason: Anthropic.StopReason | null };

export type ModelFn = (
  messages: Anthropic.MessageParam[],
  signal: AbortSignal,
  onText: (delta: string) => void,
) => Promise<ModelReply>;

export type ModelErrorKind = "unavailable" | "busy" | "failed" | "bad_tool_input";

export class ModelError extends Error {
  readonly kind: ModelErrorKind;
  constructor(kind: ModelErrorKind) {
    super(`The assistant request failed (${kind}).`);
    this.name = "ModelError";
    this.kind = kind;
  }
}

export type FailReason = "stopped" | "unavailable" | "busy" | "failed" | "refused" | "too_long";

export const FAILURE_TEXT: Record<FailReason, string> = {
  stopped: "Stopped. Nothing was changed.",
  unavailable: "The assistant isn't available right now. You can keep building by hand.",
  busy: "The assistant is busy. Wait a minute, then try again.",
  failed: "Something went wrong, so nothing was changed. Try again.",
  refused: "The assistant can't help with that. Ask it about your game.",
  too_long: "That was too much to do at once, so nothing was changed. Try asking for a smaller change.",
};

export const OUT_OF_STEPS =
  "I ran out of steps for this message, so I stopped. Any zone that still has a problem shows a warning in the zone list. Ask me to keep going!";

const STEP_LIMIT_TEXT = `You have used all ${MAX_TOOL_CALLS} steps for this message, so this tool did not run. Stop calling tools and tell the user what you finished, what is left, and which zones still fail the checker.`;

export type TurnRequest = { project: Project; levelId: string; zoneId: string; history: ChatMessage[]; text: string };

export type TurnHooks = {
  model: ModelFn;
  pack: ContentPack;
  makeId: () => string;
  signal: AbortSignal;
  onDraft(text: string): void; // the reply so far, while it streams; "" when a new request starts
  onActivity(line: string): void;
  onCommand(command: Command): void; // a change was made: replay it in the editor
};

export type TurnResult =
  | { ok: true; project: Project; reply: string }
  | { ok: false; reason: FailReason; message: string };

// The saved chat as plain text (no earlier tool calls), then the new message with what the editor
// shows attached. Starts with the user, and never has two messages from the same side in a row.
export function buildMessages(history: ChatMessage[], text: string, context: string): Anthropic.MessageParam[] {
  const turns: { role: "user" | "assistant"; text: string }[] = [];
  for (const message of history.slice(-HISTORY_LIMIT)) {
    const last = turns[turns.length - 1];
    if (!last && message.role === "assistant") continue;
    if (last && last.role === message.role) last.text += `\n\n${message.text}`;
    else turns.push({ role: message.role, text: message.text });
  }
  const earlier = turns[turns.length - 1]?.role === "user" ? `${turns.pop()!.text}\n\n` : "";
  return [
    ...turns.map((t): Anthropic.MessageParam => ({ role: t.role, content: t.text })),
    {
      role: "user",
      content: [
        { type: "text", text: earlier + text },
        { type: "text", text: context },
      ],
    },
  ];
}

function editorContext(request: TurnRequest, pack: ContentPack, checks: CheckCache): string {
  const level = request.project.levels.find((l) => l.id === request.levelId)!;
  const zone = level.zones.find((z) => z.id === request.zoneId) ?? level.zones[0];
  return [
    "From the editor, not the user: this is the level as it is now.",
    "",
    describeLevel(level, checks.level(request.project, request.levelId, pack)),
    "",
    "The zone the user has selected:",
    describeZone(level, zone, pack),
  ].join("\n");
}

function replyText(reply: ModelReply): string {
  const text = reply.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text || "Done.";
}

export async function runTurn(request: TurnRequest, hooks: TurnHooks): Promise<TurnResult> {
  const checks = createCheckCache();
  const ctx: ToolContext = { pack: hooks.pack, makeId: hooks.makeId, checks };
  const messages = buildMessages(request.history, request.text, editorContext(request, hooks.pack, checks));
  const fail = (reason: FailReason): TurnResult => ({ ok: false, reason, message: FAILURE_TEXT[reason] });

  let state: TurnState = startTurn(request.project, request.levelId);
  let calls = 0;
  let forcedCheck = false;
  let unreadable = 0; // replies in a row whose tool input could not be read
  let pastLimit = false; // Claude has been told it is out of steps

  while (true) {
    if (hooks.signal.aborted) return fail("stopped");
    let draft = "";
    hooks.onDraft("");
    let reply: ModelReply;
    try {
      reply = await hooks.model(messages, hooks.signal, (delta) => {
        draft += delta;
        hooks.onDraft(draft);
      });
    } catch (error) {
      if (hooks.signal.aborted) return fail("stopped");
      if (error instanceof ModelError && error.kind === "bad_tool_input" && ++unreadable <= 2) continue;
      if (error instanceof ModelError && error.kind !== "bad_tool_input") return fail(error.kind);
      return fail("failed");
    }
    unreadable = 0;
    if (hooks.signal.aborted) return fail("stopped");
    // A refusal or a reply cut off at the token limit can hold a half-written tool call: never run it.
    if (reply.stop_reason === "refusal") return fail("refused");
    if (reply.stop_reason === "max_tokens" || reply.stop_reason === "model_context_window_exceeded") {
      return fail("too_long");
    }

    const uses = reply.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    // The API refuses an empty assistant message anywhere but last, and the forced check round
    // continues after this one.
    messages.push({ role: "assistant", content: reply.content.length > 0 ? reply.content : [{ type: "text", text: "Done." }] });

    if (uses.length === 0) {
      const forced = forcedCheck ? null : checkUnchecked(state, ctx);
      if (forced) {
        forcedCheck = true;
        state = forced.state;
        hooks.onActivity("Checking the zones I changed…");
        messages.push({ role: "user", content: forced.text });
        continue;
      }
      return { ok: true, project: state.project, reply: replyText(reply) };
    }
    if (pastLimit) return { ok: true, project: state.project, reply: OUT_OF_STEPS };

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of uses) {
      if (hooks.signal.aborted) return fail("stopped");
      if (calls >= MAX_TOOL_CALLS) {
        pastLimit = true;
        results.push({ type: "tool_result", tool_use_id: use.id, content: STEP_LIMIT_TEXT, is_error: true });
        continue;
      }
      calls++;
      const outcome = executeTool(state, use.name, use.input, ctx);
      hooks.onActivity(outcome.activity);
      state = outcome.state;
      if (outcome.command) hooks.onCommand(outcome.command);
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: outcome.content,
        ...(outcome.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: "user", content: results });
  }
}
