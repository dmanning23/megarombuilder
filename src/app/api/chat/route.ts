import { streamMessage } from "@/ai/server/anthropic";
import { createChatHandler, DEFAULT_MODEL } from "@/ai/server/handler";
import { createChatLimiter } from "@/ai/server/rateLimit";

const allow = createChatLimiter();

export const POST = createChatHandler(() => ({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
  stream: streamMessage,
  allow,
}));
