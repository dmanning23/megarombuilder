import { openDB } from "idb";
import type { ContentPack } from "@/model/contentPack";
import { parseProject, type ParseResult } from "@/model/parse";
import type { Project } from "@/model/schema";

const DB_NAME = "megarombuilder";
const STORE = "projects";

type Row = { id: string; name: string; updatedAt: number; project: Project };
export type ProjectSummary = { id: string; name: string; updatedAt: number };

const open = () =>
  openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: "id" });
    },
  });

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await open();
  try {
    const rows = (await db.getAll(STORE)) as Row[];
    return rows
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    db.close();
  }
}

export async function saveProject(project: Project, now = Date.now()): Promise<void> {
  const db = await open();
  try {
    const row: Row = { id: project.id, name: project.name, updatedAt: now, project };
    await db.put(STORE, row);
  } finally {
    db.close();
  }
}

// null when there is no such game; otherwise the result of checking what was stored.
export async function loadProject(
  id: string,
  getPack: (id: string) => ContentPack | undefined,
): Promise<ParseResult | null> {
  const db = await open();
  try {
    const row = (await db.get(STORE, id)) as Row | undefined;
    return row ? parseProject(row.project, getPack) : null;
  } finally {
    db.close();
  }
}

export async function deleteProject(id: string): Promise<void> {
  const db = await open();
  try {
    await db.delete(STORE, id);
  } finally {
    db.close();
  }
}
