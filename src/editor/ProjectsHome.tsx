"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPack } from "@/content/packs";
import type { Project } from "@/model/schema";
import { deleteProject, listProjects, saveProject, type ProjectSummary } from "@/storage/projects";
import styles from "./home.module.css";
import { readProjectText } from "./files";
import { copyOfDemo, newProject } from "./newProject";

type Store = {
  list(): Promise<ProjectSummary[]>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
};

const browserStore: Store = { list: listProjects, save: (p) => saveProject(p), remove: deleteProject };

const when = (time: number) =>
  new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

type Props = {
  navigate(href: string): void;
  store?: Store;
  makeId?: () => string;
  confirm?: (message: string) => boolean;
};

export function ProjectsHome({
  navigate,
  store = browserStore,
  makeId = () => crypto.randomUUID(),
  confirm = (message) => window.confirm(message),
}: Props) {
  const [games, setGames] = useState<ProjectSummary[] | null>(null);
  const [name, setName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    store.list().then(setGames, () => setGames([]));
  }, [store]);

  const open = async (project: Project) => {
    await store.save(project);
    navigate(`/edit/${project.id}`);
  };

  const remove = async (game: ProjectSummary) => {
    if (!confirm(`Delete "${game.name}"? This can't be undone.`)) return;
    await store.remove(game.id);
    setGames((list) => list?.filter((g) => g.id !== game.id) ?? null);
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Your games</h1>
      <form
        className={styles.make}
        onSubmit={(e) => {
          e.preventDefault();
          void open(newProject(name, makeId));
        }}
      >
        <label htmlFor="game-name">Game name</label>
        <input id="game-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className={styles.primary}>
          Make a new game
        </button>
        <button type="button" className={styles.secondary} onClick={() => void open(copyOfDemo(makeId))}>
          Start from the demo stage
        </button>
        <label className={styles.secondary}>
          Import a game file
          <input
            type="file"
            accept=".json,application/json"
            className={styles.hiddenInput}
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              const result = readProjectText(await file.text(), getPack, makeId);
              input.value = "";
              if (!result.ok) {
                setImportError(result.error);
                return;
              }
              setImportError(null);
              await open(result.project);
            }}
          />
        </label>
      </form>

      {importError && (
        <p className={styles.alert} role="alert">
          That file can&apos;t be opened. {importError}
        </p>
      )}

      {games && games.length === 0 && <p>No games yet. Make one to start building.</p>}
      {games && games.length > 0 && (
        <ul className={styles.games}>
          {games.map((game) => (
            <li key={game.id} className={styles.game}>
              <span className={styles.gameName}>{game.name}</span>
              <span className={styles.when}>Changed {when(game.updatedAt)}</span>
              <Link className={styles.link} href={`/edit/${game.id}`} aria-label={`Open ${game.name}`}>
                Open
              </Link>
              <button
                type="button"
                className={styles.secondary}
                aria-label={`Delete ${game.name}`}
                onClick={() => void remove(game)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <p>
        <Link className={styles.link} href="/play">
          Play the demo stage
        </Link>
      </p>
    </main>
  );
}
