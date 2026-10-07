"use client";

import styles from "../editor.module.css";

type Props = {
  title: string;
  saveState: "saved" | "saving" | "error" | "elsewhere";
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  onPlay(): void;
  onPlayFromZone(): void;
  playing: boolean;
  onExport(): void;
  screen: "level" | "characters";
  onScreen(screen: "level" | "characters"): void;
  busy?: boolean;
};

const SAVE_TEXT = {
  saved: "Saved",
  saving: "Saving…",
  error: "Couldn't save. Keep this tab open.",
  elsewhere: "Not saving: open in another tab",
};

export function Toolbar({
  title,
  saveState,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPlay,
  onPlayFromZone,
  playing,
  onExport,
  screen,
  onScreen,
  busy = false,
}: Props) {
  return (
    <header className={styles.toolbar}>
      <h1 className={styles.title}>{title}</h1>
      <span
        className={`${styles.saveState} ${saveState === "error" || saveState === "elsewhere" ? styles.saveError : ""}`}
        role="status"
      >
        {SAVE_TEXT[saveState]}
      </span>
      <button
        type="button"
        className={styles.button}
        disabled={playing}
        onClick={() => onScreen(screen === "level" ? "characters" : "level")}
      >
        {screen === "level" ? "Characters" : "Level"}
      </button>
      <button type="button" className={styles.button} disabled={busy} onClick={onExport}>
        Export
      </button>
      <button type="button" className={styles.button} disabled={!canUndo || playing} onClick={onUndo}>
        Undo
      </button>
      <button type="button" className={styles.button} disabled={!canRedo || playing} onClick={onRedo}>
        Redo
      </button>
      <button type="button" className={styles.button} disabled={playing || busy} onClick={onPlayFromZone}>
        Play from this zone
      </button>
      <button type="button" className={styles.primary} disabled={playing || busy} onClick={onPlay}>
        Play
      </button>
    </header>
  );
}
