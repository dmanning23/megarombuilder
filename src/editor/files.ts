import type { ContentPack } from "@/model/contentPack";
import { parseProject, type ParseResult } from "@/model/parse";
import type { Project } from "@/model/schema";

export const FILE_EXTENSION = ".megarom.json";

export function exportFileName(project: Project): string {
  const slug = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "game"}${FILE_EXTENSION}`;
}

export const projectToJson = (project: Project): string => JSON.stringify(project, null, 2);

// Reads a game file. An imported game always gets a new id, so it can't overwrite a saved one.
export function readProjectText(
  text: string,
  getPack: (id: string) => ContentPack | undefined,
  makeId: () => string,
): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't a MegaRomBuilder game." };
  }
  const result = parseProject(raw, getPack);
  return result.ok ? { ok: true, project: { ...result.project, id: makeId() } } : result;
}

export function downloadProject(project: Project): void {
  const url = URL.createObjectURL(new Blob([projectToJson(project)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(project);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
