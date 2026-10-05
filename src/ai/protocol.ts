import type Anthropic from "@anthropic-ai/sdk";

// What /api/chat streams back: one JSON object per line.
export type ChatErrorKind = "unavailable" | "busy" | "failed" | "bad_tool_input";

export type ChatLine =
  | { type: "text"; text: string }
  | { type: "done"; content: Anthropic.ContentBlock[]; stop_reason: Anthropic.StopReason | null }
  | { type: "error"; error: ChatErrorKind };
