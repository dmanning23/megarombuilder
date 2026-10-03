"use client";

import styles from "../editor.module.css";

type Props = {
  title: string;
  saveState: "saved" | "saving" | "error";
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  onPlay(): void;
  onPlayFromZone(): void;
};

const SAVE_TEXT = { saved: "Saved", saving: "Saving…", error: "Couldn't save. Keep this tab open." };

export function Toolbar({ title, saveState, canUndo, canRedo, onUndo, onRedo, onPlay, onPlayFromZone }: Props) {
  return (
    <header className={styles.toolbar}>
      <h1 className={styles.title}>{title}</h1>
      <span
        className={`${styles.saveState} ${saveState === "error" ? styles.saveError : ""}`}
        role="status"
      >
        {SAVE_TEXT[saveState]}
      </span>
      <button type="button" className={styles.button} disabled={!canUndo} onClick={onUndo}>
        Undo
      </button>
      <button type="button" className={styles.button} disabled={!canRedo} onClick={onRedo}>
        Redo
      </button>
      <button type="button" className={styles.button} onClick={onPlayFromZone}>
        Play from this zone
      </button>
      <button type="button" className={styles.primary} onClick={onPlay}>
        Play
      </button>
    </header>
  );
}
