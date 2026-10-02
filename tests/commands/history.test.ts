import { describe, expect, it } from "vitest";
import {
  beginGroup,
  canRedo,
  canUndo,
  commitGroup,
  createHistory,
  redo,
  rollbackGroup,
  runCommand,
  undo,
  type History,
} from "@/commands/history";
import type { Command } from "@/commands/types";
import { baseProject, ctx } from "./helpers";

const rename = (name: string): Command => ({
  name: "renameZone",
  args: { levelId: "L1", zoneId: "z1", name },
});
const spike = (x: number): Command => ({
  name: "setTiles",
  args: { levelId: "L1", zoneId: "z1", cells: [{ x, y: 12, tile: 3 }] },
});
const bad: Command = { name: "renameZone", args: { levelId: "L1", zoneId: "zz", name: "X" } };

function apply(history: History, command: Command): History {
  const { history: next, result } = runCommand(history, command, ctx);
  if (!result.ok) throw new Error(result.error);
  return next;
}

const zoneName = (h: History) => h.project.levels[0].zones[0].name;

describe("single commands", () => {
  it("makes each command its own undo step", () => {
    const start = baseProject();
    let h = createHistory(start);
    expect(canUndo(h)).toBe(false);
    h = apply(h, rename("Snowy Path"));
    h = apply(h, rename("Icy Path"));
    expect(zoneName(h)).toBe("Icy Path");
    h = undo(h);
    expect(zoneName(h)).toBe("Snowy Path");
    h = undo(h);
    expect(h.project).toBe(start);
    expect(canUndo(h)).toBe(false);
  });

  it("redoes what was undone", () => {
    let h = apply(createHistory(baseProject()), rename("Snowy Path"));
    const after = h.project;
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.project).toBe(after);
    expect(canRedo(h)).toBe(false);
  });

  it("clears redo when a new command runs", () => {
    let h = apply(createHistory(baseProject()), rename("Snowy Path"));
    h = undo(h);
    h = apply(h, rename("Other"));
    expect(canRedo(h)).toBe(false);
  });

  it("adds no undo step and keeps redo when a command changes nothing", () => {
    let h = apply(createHistory(baseProject()), rename("Snowy Path"));
    h = undo(h);
    const { history: next, result } = runCommand(h, rename("Zone 1"), ctx);
    expect(result.ok).toBe(true);
    expect(next.undoStack).toEqual([]);
    expect(canRedo(next)).toBe(true);
    expect(next.project).toBe(h.project);
  });

  it("leaves history untouched when a command fails", () => {
    const h = createHistory(baseProject());
    const { history: next, result } = runCommand(h, bad, ctx);
    expect(result.ok).toBe(false);
    expect(next).toBe(h);
  });

  it("does not modify the history passed in", () => {
    const h = createHistory(baseProject());
    apply(h, rename("Snowy Path"));
    expect(zoneName(h)).toBe("Zone 1");
    expect(h.undoStack).toEqual([]);
  });
});

describe("groups", () => {
  it("turns several commands into one undo step", () => {
    const start = baseProject();
    let h = beginGroup(createHistory(start), "AI: add spikes");
    h = apply(h, spike(2));
    h = apply(h, spike(3));
    h = apply(h, rename("Spiky Path"));
    expect(zoneName(h)).toBe("Spiky Path");
    h = commitGroup(h);
    expect(h.undoStack).toHaveLength(1);
    expect(h.undoStack[0].label).toBe("AI: add spikes");
    h = undo(h);
    expect(h.project).toBe(start);
  });

  it("rolls back to the exact original project after a failure partway", () => {
    const start = baseProject();
    let h = beginGroup(createHistory(start), "AI turn");
    h = apply(h, spike(2));
    h = apply(h, spike(3));
    h = apply(h, rename("Spiky Path"));
    const failed = runCommand(h, bad, ctx);
    expect(failed.result.ok).toBe(false);
    h = rollbackGroup(failed.history);
    expect(h.project).toBe(start);
    expect(h.open).toBeNull();
    expect(h.undoStack).toEqual([]);
  });

  it("keeps earlier undo steps and redo when a group is rolled back", () => {
    let h = apply(createHistory(baseProject()), rename("Snowy Path"));
    h = apply(h, rename("Icy Path"));
    h = undo(h);
    h = beginGroup(h, "AI turn");
    h = apply(h, spike(2));
    h = rollbackGroup(h);
    expect(zoneName(h)).toBe("Snowy Path");
    expect(h.undoStack).toHaveLength(1);
    expect(canRedo(h)).toBe(true);
    expect(zoneName(redo(h))).toBe("Icy Path");
  });

  it("adds no undo step for a group whose commands changed nothing", () => {
    let h = beginGroup(createHistory(baseProject()), "AI turn");
    h = apply(h, rename("Zone 1"));
    h = commitGroup(h);
    expect(h.undoStack).toEqual([]);
  });

  it("adds no undo step for a group that changed nothing", () => {
    let h = beginGroup(createHistory(baseProject()), "AI turn");
    h = commitGroup(h);
    expect(h.undoStack).toEqual([]);
    expect(h.open).toBeNull();
  });

  it("throws on misuse", () => {
    const h = createHistory(baseProject());
    const open = beginGroup(h, "a");
    expect(() => beginGroup(open, "b")).toThrow(/already open/);
    expect(() => commitGroup(h)).toThrow(/no open group/);
    expect(() => rollbackGroup(h)).toThrow(/no open group/);
    expect(() => undo(open)).toThrow(/group is open/);
    expect(() => redo(open)).toThrow(/group is open/);
    expect(() => undo(h)).toThrow(/Nothing to undo/);
    expect(() => redo(h)).toThrow(/Nothing to redo/);
  });
});

describe("limits", () => {
  it("keeps at most 200 undo steps", () => {
    let h = createHistory(baseProject());
    for (let i = 0; i < 205; i++) h = apply(h, rename(`Name ${i}`));
    expect(h.undoStack).toHaveLength(200);
  });
});
