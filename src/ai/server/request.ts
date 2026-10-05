import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const MAX_BODY_CHARS = 2_000_000;

// The browser sends only the conversation. The model, system prompt and tools are the server's.
// Only the kinds of block a chat turn uses are accepted (no documents or images for the server's key
// to pay for), and cache settings are the server's too.
function withoutCache<T extends Record<string, unknown>>(block: T): T {
  const copy = { ...block };
  delete copy.cache_control;
  return copy;
}
const text = z.looseObject({ type: z.literal("text"), text: z.string() }).transform(withoutCache);
const block = z
  .union([
    text,
    z.looseObject({ type: z.literal("tool_use"), id: z.string(), name: z.string(), input: z.unknown() }),
    z.looseObject({
      type: z.literal("tool_result"),
      tool_use_id: z.string(),
      content: z.union([z.string(), z.array(text).max(20)]),
      is_error: z.boolean().optional(),
    }),
    z.looseObject({ type: z.literal("thinking"), thinking: z.string(), signature: z.string() }),
    z.looseObject({ type: z.literal("redacted_thinking"), data: z.string() }),
  ])
  .transform(withoutCache);
const message = z.strictObject({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string(), z.array(block).max(200)]),
});
const chatRequest = z
  .strictObject({ messages: z.array(message).min(1).max(400) })
  .refine((r) => r.messages[0]?.role === "user" && r.messages[r.messages.length - 1]?.role === "user");

export function parseChatRequest(text: string): Anthropic.MessageParam[] | null {
  if (text.length > MAX_BODY_CHARS) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = chatRequest.safeParse(json);
  return parsed.success ? (parsed.data.messages as Anthropic.MessageParam[]) : null;
}
