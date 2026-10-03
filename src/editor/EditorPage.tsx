"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPack } from "@/content/packs";
import type { ParseResult } from "@/model/parse";
import type { Project } from "@/model/schema";
import { loadProject, saveProject } from "@/storage/projects";
import { Editor } from "./Editor";
import styles from "./home.module.css";

export type ProjectStore = {
  load(id: string): Promise<ParseResult | null>;
  save(project: Project): Promise<void>;
};

const browserStore: ProjectStore = {
  load: (id) => loadProject(id, getPack),
  save: (project) => saveProject(project),
};

type Loaded = { kind: "loading" } | { kind: "missing" } | { kind: "broken"; error: string } | { kind: "ready"; project: Project };

export function EditorPage({ projectId, store = browserStore, home = "/" }: { projectId: string; store?: ProjectStore; home?: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    store.load(projectId).then(
      (result) => {
        if (!live) return;
        if (!result) setLoaded({ kind: "missing" });
        else if (!result.ok) setLoaded({ kind: "broken", error: result.error });
        else setLoaded({ kind: "ready", project: result.project });
      },
      (error: unknown) => live && setLoaded({ kind: "broken", error: String(error) }),
    );
    return () => {
      live = false;
    };
  }, [projectId, store]);

  if (loaded.kind === "ready") return <Editor initial={loaded.project} store={store} />;
  const message =
    loaded.kind === "loading"
      ? "Opening your game…"
      : loaded.kind === "missing"
        ? "This game isn't saved in this browser."
        : `This game can't be opened: ${loaded.error}`;
  return (
    <main className={styles.page}>
      <p className={styles.message}>{message}</p>
      {loaded.kind !== "loading" && (
        <Link className={styles.link} href={home}>
          Back to your games
        </Link>
      )}
    </main>
  );
}
