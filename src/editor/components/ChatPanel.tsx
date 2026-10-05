"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/model/schema";
import styles from "../editor.module.css";

type Props = {
  messages: ChatMessage[];
  asking: string | null; // the message being answered right now
  draft: string; // the reply so far, while it streams
  activity: string | null;
  notice: string | null;
  busy: boolean;
  canSend: boolean;
  text: string;
  onText(text: string): void;
  onSend(): void;
  onStop(): void;
};

export function ChatPanel({ messages, asking, draft, activity, notice, busy, canSend, text, onText, onSend, onStop }: Props) {
  const log = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, asking, draft]);

  const ready = canSend && text.trim().length > 0;
  const send = () => {
    if (ready) onSend();
  };

  return (
    <aside className={styles.chat} aria-label="Assistant">
      <h2 className={styles.sideTitle}>Assistant</h2>
      <ol className={styles.chatLog} ref={log}>
        {messages.length === 0 && !asking && (
          <li className={styles.chatHint}>
            Ask for a change, like &ldquo;add spikes to Zone 1&rdquo; or &ldquo;build me a snowy level with a
            boss at the end&rdquo;.
          </li>
        )}
        {messages.map((message, i) => (
          <li key={i} className={message.role === "user" ? styles.fromUser : styles.fromAssistant}>
            {message.text}
          </li>
        ))}
        {asking && <li className={styles.fromUser}>{asking}</li>}
        {busy && draft && <li className={styles.fromAssistant}>{draft}</li>}
      </ol>
      {busy && (
        <p className={styles.activity} role="status">
          {activity ?? "Thinking…"}
        </p>
      )}
      {notice && (
        <p className={styles.alert} role="alert">
          {notice}
        </p>
      )}
      <form
        className={styles.chatForm}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          aria-label="Message"
          rows={3}
          maxLength={2000}
          value={text}
          disabled={busy}
          placeholder="Ask the assistant"
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        {busy ? (
          <button type="button" className={styles.button} onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className={styles.primary} disabled={!ready}>
            Send
          </button>
        )}
      </form>
    </aside>
  );
}
