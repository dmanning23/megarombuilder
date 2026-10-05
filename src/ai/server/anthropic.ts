import Anthropic from "@anthropic-ai/sdk";
import type { StreamFn } from "./handler";

let client: Anthropic | null = null;

// The real call. The client reads ANTHROPIC_API_KEY from the environment.
export const streamMessage: StreamFn = (params, signal, onText) => {
  client ??= new Anthropic();
  const stream = client.messages.stream(params, { signal });
  stream.on("text", onText);
  return stream.finalMessage();
};
