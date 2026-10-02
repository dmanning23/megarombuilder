import type { Project } from "@/model/schema";
import { applyCommand } from "./registry";
import type { Command, CommandContext, CommandResult } from "./types";

export type HistoryEntry = { label: string; before: Project; after: Project };

export type History = {
  project: Project;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  open: { label: string; before: Project } | null;
};

export const MAX_UNDO = 200;

export function createHistory(project: Project): History {
  return { project, undoStack: [], redoStack: [], open: null };
}

function pushEntry(history: History, entry: HistoryEntry): History {
  return {
    project: entry.after,
    undoStack: [...history.undoStack, entry].slice(-MAX_UNDO),
    redoStack: [],
    open: null,
  };
}

// Structural equality. Unchanged parts of a project are shared by reference, so this is cheap.
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) =>
    sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

export function runCommand(
  history: History,
  command: Command,
  ctx: CommandContext,
): { history: History; result: CommandResult } {
  const result = applyCommand(history.project, command, ctx);
  if (!result.ok) return { history, result };
  // A command that changed nothing is not an undo step.
  if (sameValue(history.project, result.project)) {
    return { history, result: { ok: true, project: history.project } };
  }
  if (history.open) return { history: { ...history, project: result.project }, result };
  const entry = { label: command.name, before: history.project, after: result.project };
  return { history: pushEntry(history, entry), result };
}

export function beginGroup(history: History, label: string): History {
  if (history.open) throw new Error("A command group is already open.");
  return { ...history, open: { label, before: history.project } };
}

export function commitGroup(history: History): History {
  if (!history.open) throw new Error("There is no open group to commit.");
  if (history.project === history.open.before) return { ...history, open: null };
  return pushEntry(history, {
    label: history.open.label,
    before: history.open.before,
    after: history.project,
  });
}

export function rollbackGroup(history: History): History {
  if (!history.open) throw new Error("There is no open group to roll back.");
  return { ...history, project: history.open.before, open: null };
}

export const canUndo = (history: History): boolean =>
  !history.open && history.undoStack.length > 0;

export const canRedo = (history: History): boolean =>
  !history.open && history.redoStack.length > 0;

export function undo(history: History): History {
  if (history.open) throw new Error("Cannot undo while a command group is open.");
  const entry = history.undoStack[history.undoStack.length - 1];
  if (!entry) throw new Error("Nothing to undo.");
  return {
    project: entry.before,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
    open: null,
  };
}

export function redo(history: History): History {
  if (history.open) throw new Error("Cannot redo while a command group is open.");
  const entry = history.redoStack[history.redoStack.length - 1];
  if (!entry) throw new Error("Nothing to redo.");
  return {
    project: entry.after,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
    open: null,
  };
}
