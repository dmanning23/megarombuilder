import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const MAX_BODY_CHARS = 2_000_000;

// The browser sends only the conversation. The model, system prompt and tools are the server's.
const block = z.looseObject({ type: z.string() });
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
