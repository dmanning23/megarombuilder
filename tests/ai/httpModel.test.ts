import { describe, expect, it } from "vitest";
import { createHttpModel } from "@/ai/httpModel";
import { ModelError } from "@/ai/turn";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function fakeFetch(answer: Response | Error) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    if (answer instanceof Error) throw answer;
    return answer;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const messages = [{ role: "user" as const, content: "Add spikes" }];
const signal = () => new AbortController().signal;

describe("createHttpModel", () => {
  it("posts the conversation and returns Claude's message, streaming its text, even across split lines", async () => {
    const { fetchImpl, calls } = fakeFetch(
      new Response(
        streamOf([
          '{"type":"text","te',
          'xt":"Hi"}\n{"type":"text","text":" there"}\n{"type":"do',
          'ne","content":[{"type":"text","text":"Hi there"}],"stop_reason":"end_turn"}\n',
        ]),
      ),
    );
    const texts: string[] = [];
    const reply = await createHttpModel("/api/chat", fetchImpl)(messages, signal(), (t) => texts.push(t));
    expect(reply).toEqual({ content: [{ type: "text", text: "Hi there" }], stop_reason: "end_turn" });
    expect(texts).toEqual(["Hi", " there"]);
    expect(calls[0].url).toBe("/api/chat");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ messages });
  });

  it("reads a last line that has no newline", async () => {
    const { fetchImpl } = fakeFetch(new Response(streamOf(['{"type":"done","content":[],"stop_reason":"end_turn"}'])));
    expect(await createHttpModel("/api/chat", fetchImpl)(messages, signal(), () => {})).toEqual({
      content: [],
      stop_reason: "end_turn",
    });
  });

  it("turns an error line into a ModelError", async () => {
    const { fetchImpl } = fakeFetch(new Response(streamOf(['{"type":"text","text":"Hm"}\n{"type":"error","error":"busy"}\n'])));
    await expect(createHttpModel("/api/chat", fetchImpl)(messages, signal(), () => {})).rejects.toMatchObject({
      kind: "busy",
    });
  });

  it("turns refused requests into ModelErrors by status", async () => {
    for (const [status, kind] of [
      [503, "unavailable"],
      [429, "busy"],
      [400, "failed"],
      [500, "failed"],
    ] as const) {
      const { fetchImpl } = fakeFetch(new Response(JSON.stringify({ error: "x" }), { status }));
      const failure = createHttpModel("/api/chat", fetchImpl)(messages, signal(), () => {});
      await expect(failure).rejects.toBeInstanceOf(ModelError);
      await expect(failure).rejects.toMatchObject({ kind });
    }
  });

  it("says unavailable when the network fails, and passes a stop through", async () => {
    const offline = fakeFetch(new TypeError("fetch failed"));
    await expect(createHttpModel("/api/chat", offline.fetchImpl)(messages, signal(), () => {})).rejects.toMatchObject({
      kind: "unavailable",
    });
    const controller = new AbortController();
    controller.abort();
    const stopped = fakeFetch(new DOMException("Aborted", "AbortError"));
    await expect(createHttpModel("/api/chat", stopped.fetchImpl)(messages, controller.signal, () => {})).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("fails when the stream ends without an answer", async () => {
    const { fetchImpl } = fakeFetch(new Response(streamOf(['{"type":"text","text":"Hi"}\n'])));
    await expect(createHttpModel("/api/chat", fetchImpl)(messages, signal(), () => {})).rejects.toMatchObject({
      kind: "failed",
    });
  });
});
