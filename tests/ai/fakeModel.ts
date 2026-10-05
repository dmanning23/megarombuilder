import type Anthropic from "@anthropic-ai/sdk";
import type { ModelFn, ModelReply } from "@/ai/turn";

// A step is a reply, a function that makes one (it may wait), or an error to throw.
export type Step =
  | ModelReply
  | Error
  | ((messages: Anthropic.MessageParam[], signal: AbortSignal) => ModelReply | Promise<ModelReply>);

let uses = 0;

export function say(text: string): ModelReply {
  return { content: [{ type: "text", text, citations: null } as Anthropic.ContentBlock], stop_reason: "end_turn" };
}

export function useTools(...calls: [string, unknown][]): ModelReply {
  return {
    content: calls.map(([name, input]) => ({ type: "tool_use", id: `tu-${++uses}`, name, input }) as Anthropic.ContentBlock),
    stop_reason: "tool_use",
  };
}

// A step that waits until the turn is stopped.
export const waitForAbort: Step = (_messages, signal) =>
  new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));

// Plays the steps in order, streaming each reply's text, and records every request.
export function scriptedModel(steps: Step[]): { model: ModelFn; requests: Anthropic.MessageParam[][] } {
  const requests: Anthropic.MessageParam[][] = [];
  const model: ModelFn = async (messages, signal, onText) => {
    requests.push(structuredClone(messages));
    const step = steps.shift();
    if (!step) throw new Error("The script has no more steps.");
    if (step instanceof Error) throw step;
    const reply = typeof step === "function" ? await step(messages, signal) : step;
    for (const block of reply.content) if (block.type === "text") onText(block.text);
    return reply;
  };
  return { model, requests };
}
