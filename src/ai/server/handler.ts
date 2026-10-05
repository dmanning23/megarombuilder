import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "../prompt";
import type { ChatErrorKind, ChatLine } from "../protocol";
import { toolDefinitions } from "../tools";
import { parseChatRequest } from "./request";

export const DEFAULT_MODEL = "claude-opus-5-5";
export const MAX_TOKENS = 32000;

export type StreamFn = (
  params: Anthropic.MessageStreamParams,
  signal: AbortSignal,
  onText: (delta: string) => void,
) => Promise<Anthropic.Message>;

export type ChatDeps = { apiKey: string | undefined; model: string; stream: StreamFn; allow(key: string): boolean };

const TOOLS = toolDefinitions();

export function errorKind(error: unknown): ChatErrorKind {
  if (error instanceof Anthropic.APIConnectionError) return "unavailable";
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "unavailable";
  }
  if (error instanceof Anthropic.RateLimitError) return "busy";
  if (error instanceof Anthropic.APIError) return error.status === 529 ? "busy" : "failed";
  // Anything else comes from reading the stream: a tool input that was not valid JSON.
  return "bad_tool_input";
}

const refuse = (status: number, error: ChatErrorKind) => Response.json({ error }, { status });

// Stateless: each request carries the whole conversation, and one Claude response streams back.
export function createChatHandler(getDeps: () => ChatDeps) {
  return async function POST(request: Request): Promise<Response> {
    const deps = getDeps();
    if (!deps.apiKey) return refuse(503, "unavailable");
    const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!deps.allow(address)) return refuse(429, "busy");
    const messages = parseChatRequest(await request.text());
    if (!messages) return refuse(400, "failed");

    const params: Anthropic.MessageStreamParams = {
      model: deps.model,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      cache_control: { type: "ephemeral" },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    };

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (line: ChatLine) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
          } catch {
            // The browser has gone; nothing to send to.
          }
        };
        try {
          const message = await deps.stream(params, request.signal, (text) => send({ type: "text", text }));
          send({ type: "done", content: message.content, stop_reason: message.stop_reason });
        } catch (error) {
          if (!request.signal.aborted) {
            console.error("The chat request failed:", error instanceof Error ? error.message : error);
            send({ type: "error", error: errorKind(error) });
          }
        }
        try {
          controller.close();
        } catch {
          // Already closed because the browser went away.
        }
      },
    });
    return new Response(body, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
    });
  };
}
