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
import type { Command, CommandContext } from "@/commands/types";
import { tidyName, type Level, type Project, type Zone } from "@/model/schema";

export type Tool = { kind: "tile"; tile: number } | { kind: "erase" };

export type EditorState = {
  history: History;
  levelId: string;
  zoneId: string;
  tool: Tool;
  error: string | null;
  playing: { fromZoneId: string | null } | null;
};

export type EditorAction =
  | { type: "run"; command: Command }
  | { type: "begin"; label: string }
  | { type: "commit" }
  | { type: "rollback" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "selectZone"; zoneId: string }
  | { type: "tool"; tool: Tool }
  | { type: "play"; fromZoneId: string | null }
  | { type: "stopPlaying" }
  | { type: "dismissError" };

export function initialEditor(project: Project, tile: number): EditorState {
  const level = project.levels[0];
  if (!level) throw new Error("This game has no levels.");
  return {
    history: createHistory(project),
    levelId: level.id,
    zoneId: level.zones[0].id,
    tool: { kind: "tile", tile },
    error: null,
    playing: null,
  };
}

export function currentLevel(state: EditorState): Level {
  const levels = state.history.project.levels;
  return levels.find((l) => l.id === state.levelId) ?? levels[0];
}

export function currentZone(state: EditorState): Zone {
  const level = currentLevel(state);
  return level.zones.find((z) => z.id === state.zoneId) ?? level.zones[0];
}

// "Zone N" with the smallest N that no zone in the level is called.
export function nextZoneName(level: Level): string {
  const taken = new Set(level.zones.map((z) => tidyName(z.name).toLowerCase()));
  for (let n = 1; ; n++) if (!taken.has(`zone ${n}`)) return `Zone ${n}`;
}

// Keeps the selection on a zone that exists, after undo, redo or a command removed it.
function settle(state: EditorState): EditorState {
  const zone = currentZone(state);
  return zone.id === state.zoneId ? state : { ...state, zoneId: zone.id };
}

export function editorReducer(ctx: CommandContext) {
  return (state: EditorState, action: EditorAction): EditorState => {
    switch (action.type) {
      case "run": {
        const { history, result } = runCommand(state.history, action.command, ctx);
        if (!result.ok) return { ...state, error: result.error };
        return settle({ ...state, history, error: null });
      }
      case "begin":
        return state.history.open ? state : { ...state, history: beginGroup(state.history, action.label) };
      case "commit":
        return state.history.open ? settle({ ...state, history: commitGroup(state.history) }) : state;
      case "rollback":
        return state.history.open ? settle({ ...state, history: rollbackGroup(state.history) }) : state;
      case "undo":
        return canUndo(state.history) ? settle({ ...state, history: undo(state.history), error: null }) : state;
      case "redo":
        return canRedo(state.history) ? settle({ ...state, history: redo(state.history), error: null }) : state;
      case "selectZone":
        return currentLevel(state).zones.some((z) => z.id === action.zoneId)
          ? { ...state, zoneId: action.zoneId }
          : state;
      case "tool":
        return { ...state, tool: action.tool };
      case "play":
        return state.history.open ? state : { ...state, playing: { fromZoneId: action.fromZoneId } };
      case "stopPlaying":
        return { ...state, playing: null };
      case "dismissError":
        return { ...state, error: null };
    }
  };
}
