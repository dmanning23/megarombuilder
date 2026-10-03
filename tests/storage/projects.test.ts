import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { getPack } from "@/content/packs";
import { newProject } from "@/editor/newProject";
import { deleteProject, listProjects, loadProject, saveProject } from "@/storage/projects";

let n = 0;
const makeId = () => `id-${++n}`;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("project storage", () => {
  it("starts empty", async () => {
    expect(await listProjects()).toEqual([]);
  });

  it("saves and loads a game", async () => {
    const project = newProject("Snow Fortress", makeId);
    await saveProject(project, 1000);
    expect(await loadProject(project.id, getPack)).toEqual({ ok: true, project });
  });

  it("lists games newest first", async () => {
    const a = newProject("Older", makeId);
    const b = newProject("Newer", makeId);
    await saveProject(a, 1000);
    await saveProject(b, 2000);
    expect(await listProjects()).toEqual([
      { id: b.id, name: "Newer", updatedAt: 2000 },
      { id: a.id, name: "Older", updatedAt: 1000 },
    ]);
  });

  it("replaces a game when it is saved again", async () => {
    const project = newProject("First name", makeId);
    await saveProject(project, 1000);
    await saveProject({ ...project, name: "Second name" }, 2000);
    expect(await listProjects()).toEqual([{ id: project.id, name: "Second name", updatedAt: 2000 }]);
  });

  it("reports a game that does not exist", async () => {
    expect(await loadProject("nope", getPack)).toBeNull();
  });

  it("reports a stored game that is damaged", async () => {
    const project = newProject("Broken", makeId);
    await saveProject({ ...project, formatVersion: 99 } as unknown as typeof project, 1000);
    const result = await loadProject(project.id, getPack);
    expect(result?.ok).toBe(false);
  });

  it("deletes a game", async () => {
    const project = newProject("Gone", makeId);
    await saveProject(project, 1000);
    await deleteProject(project.id);
    expect(await listProjects()).toEqual([]);
  });
});
