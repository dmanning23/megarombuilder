"use client";

import { useRef, useState } from "react";
import type { Level } from "@/model/schema";
import styles from "../editor.module.css";

type Props = {
  level: Level;
  selectedId: string;
  onSelect(id: string): void;
  onRename(id: string, name: string): void;
  onAdd(): void;
};

export function ZoneList({ level, selectedId, onSelect, onRename, onAdd }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  // Enter and Escape both leave the box; leaving it is the one place a rename is decided.
  const cancelled = useRef(false);

  return (
    <nav className={styles.side} aria-labelledby="zones-title">
      <h2 id="zones-title" className={styles.sideTitle}>
        Zones
      </h2>
      <ol className={styles.chain} aria-label="Zones">
        {level.zones.map((zone, i) => (
          <li key={zone.id}>
            {editing === zone.id ? (
              <input
                className={styles.rename}
                aria-label="Zone name"
                defaultValue={zone.name}
                maxLength={40}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelled.current = true;
                  if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  const save = !cancelled.current;
                  cancelled.current = false;
                  setEditing(null);
                  if (save) onRename(zone.id, e.currentTarget.value);
                }}
              />
            ) : (
              <button
                type="button"
                className={styles.zone}
                aria-current={zone.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(zone.id)}
                onDoubleClick={() => setEditing(zone.id)}
                onKeyDown={(e) => {
                  if (e.key === "F2") setEditing(zone.id);
                }}
              >
                <span className={styles.number}>{i + 1}</span>
                <span className={styles.zoneName}>{zone.name}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className={`${styles.button} ${styles.add}`} onClick={onAdd}>
        Add a zone
      </button>
    </nav>
  );
}
