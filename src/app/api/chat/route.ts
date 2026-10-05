import { streamMessage } from "@/ai/server/anthropic";
import { createChatHandler, DEFAULT_MODEL } from "@/ai/server/handler";
import { createRateLimiter } from "@/ai/server/rateLimit";

const allow = createRateLimiter(20, 60_000);

export const POST = createChatHandler(() => ({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
  stream: streamMessage,
  allow,
}));
