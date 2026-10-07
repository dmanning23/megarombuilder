"use client";

import { useState, type ComponentProps } from "react";
import styles from "../editor.module.css";
import { EnemiesScreen } from "./EnemiesScreen";
import { HeroScreen } from "./HeroScreen";

type Tab = "hero" | "enemies";

const TABS: { id: Tab; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "enemies", label: "Enemies" },
];

type Props = ComponentProps<typeof HeroScreen> & { makeId(): string };

// The kid's characters: their hero, and their own enemies.
export function CharactersScreen({ makeId, ...props }: Props) {
  const [tab, setTab] = useState<Tab>("hero");
  return (
    <div className={styles.characters}>
      <div className={styles.tabs} role="tablist" aria-label="Characters">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`characters-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`characters-panel-${t.id}`}
            className={styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`characters-panel-${tab}`} aria-labelledby={`characters-${tab}`}>
        {tab === "hero" ? (
          <HeroScreen {...props} />
        ) : (
          <EnemiesScreen
            project={props.project}
            pack={props.pack}
            art={props.art}
            locked={props.locked}
            error={props.error}
            onDismissError={props.onDismissError}
            onCommand={props.onCommand}
            onBegin={props.onBegin}
            onCommit={props.onCommit}
            confirm={props.confirm}
            makeId={makeId}
            readPicture={props.readPicture}
          />
        )}
      </div>
    </div>
  );
}
