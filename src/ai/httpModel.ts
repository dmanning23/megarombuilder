import type { ChatLine } from "./protocol";
import { ModelError, type ModelErrorKind, type ModelFn } from "./turn";

const statusKind = (status: number): ModelErrorKind =>
  status === 503 ? "unavailable" : status === 429 ? "busy" : "failed";

// Talks to /api/chat: posts the conversation and reads the reply line by line as it streams.
export function createHttpModel(
  url = "/api/chat",
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): ModelFn {
  return async (messages, signal, onText) => {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ModelError("unavailable");
    }
    if (!response.ok || !response.body) throw new ModelError(statusKind(response.status));

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += value ?? "";
        if (done) buffer += "\n";
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) {
            const event = JSON.parse(line) as ChatLine;
            if (event.type === "text") onText(event.text);
            else if (event.type === "done") return { content: event.content, stop_reason: event.stop_reason };
            else if (event.type === "error") throw new ModelError(event.error);
          }
          newline = buffer.indexOf("\n");
        }
        if (done) break;
      }
    } catch (error) {
      if (signal.aborted || error instanceof ModelError) throw error;
      throw new ModelError("failed");
    }
    throw new ModelError("failed"); // the stream ended without an answer
  };
}
