import { describe, expect, it } from "vitest";
import { snowPack } from "@/content/snow/pack";
import { GROUND, SPIKE } from "@/content/snow/tiles";
import { newProject } from "@/editor/newProject";
import {
  currentZone,
  editorReducer,
  initialEditor,
  nextZoneName,
  type EditorAction,
  type EditorState,
} from "@/editor/state";

let n = 0;
const makeId = () => `id-${++n}`;
const reduce = editorReducer({ pack: snowPack });
const apply = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(reduce, state);

function start() {
  const state = initialEditor(newProject("Test", makeId), GROUND);
  const level = state.history.project.levels[0];
  const paint = (x: number, y: number, tile = SPIKE): EditorAction => ({
    type: "run",
    command: { name: "setTiles", args: { levelId: level.id, zoneId: state.zoneId, cells: [{ x, y, tile }] } },
  });
  return { state, level, paint };
}

describe("initialEditor", () => {
  it("selects the first zone of the first level and the given tile", () => {
    const { state, level } = start();
    expect(state.levelId).toBe(level.id);
    expect(state.zoneId).toBe(level.zones[0].id);
    expect(state.tool).toEqual({ kind: "tile", tile: GROUND });
    expect(state.error).toBeNull();
    expect(state.playing).toBeNull();
  });
});

describe("editorReducer", () => {
  it("runs commands and undoes them", () => {
    const { state, paint } = start();
    const painted = apply(state, paint(3, 5));
    expect(currentZone(painted).tiles[5 * 16 + 3]).toBe(SPIKE);
    const undone = apply(painted, { type: "undo" });
    expect(currentZone(undone).tiles[5 * 16 + 3]).toBe(0);
    expect(currentZone(apply(undone, { type: "redo" })).tiles[5 * 16 + 3]).toBe(SPIKE);
  });

  it("keeps a failed command's message and leaves the game alone", () => {
    const { state, paint } = start();
    const failed = apply(state, paint(99, 0));
    expect(failed.error).toMatch(/outside "Zone 1"/);
    expect(failed.history).toBe(state.history);
    expect(apply(failed, paint(1, 1)).error).toBeNull();
    expect(apply(failed, { type: "dismissError" }).error).toBeNull();
  });

  it("turns a paint stroke into one undo step", () => {
    const { state, paint } = start();
    const stroke = apply(state, { type: "begin", label: "Paint" }, paint(1, 5), paint(2, 5), paint(3, 5), { type: "commit" });
    expect(stroke.history.undoStack).toHaveLength(1);
    expect(currentZone(apply(stroke, { type: "undo" })).tiles.slice(5 * 16, 5 * 16 + 4)).toEqual([0, 0, 0, 0]);
  });

  it("does not undo, redo or start playing in the middle of a stroke", () => {
    const { state, paint } = start();
    const mid = apply(state, paint(1, 1), { type: "begin", label: "Paint" }, paint(2, 2));
    expect(apply(mid, { type: "undo" })).toBe(mid);
    expect(apply(mid, { type: "play", fromZoneId: null }).playing).toBeNull();
  });

  it("rolls back an interrupted stroke", () => {
    const { state, paint } = start();
    const rolled = apply(state, { type: "begin", label: "Paint" }, paint(2, 2), { type: "rollback" });
    expect(rolled.history.project).toBe(state.history.project);
    expect(rolled.history.open).toBeNull();
  });

  it("ignores commit and rollback when no stroke is open", () => {
    const { state } = start();
    expect(apply(state, { type: "commit" })).toBe(state);
    expect(apply(state, { type: "rollback" })).toBe(state);
  });

  it("selects zones that exist and ignores ones that do not", () => {
    const { state, level } = start();
    expect(apply(state, { type: "selectZone", zoneId: level.zones[2].id }).zoneId).toBe(level.zones[2].id);
    expect(apply(state, { type: "selectZone", zoneId: "nope" })).toBe(state);
  });

  it("falls back to the first zone when undo removes the selected one", () => {
    const { state, level } = start();
    const added = apply(
      state,
      { type: "run", command: { name: "addZone", args: { levelId: level.id, zoneId: "new", name: "Zone 2" } } },
      { type: "selectZone", zoneId: "new" },
    );
    expect(added.zoneId).toBe("new");
    const undone = apply(added, { type: "undo" });
    expect(undone.zoneId).toBe(level.zones[0].id);
    expect(currentZone(undone).id).toBe(level.zones[0].id);
  });

  it("starts and stops playing", () => {
    const { state, level } = start();
    const playing = apply(state, { type: "play", fromZoneId: level.zones[1].id });
    expect(playing.playing).toEqual({ fromZoneId: level.zones[1].id });
    expect(apply(playing, { type: "stopPlaying" }).playing).toBeNull();
  });

  it("changes the tool", () => {
    const { state } = start();
    expect(apply(state, { type: "tool", tool: { kind: "erase" } }).tool).toEqual({ kind: "erase" });
  });
});

describe("nextZoneName", () => {
  it("uses the smallest free number", () => {
    const { level } = start();
    expect(nextZoneName(level)).toBe("Zone 2");
    const renamed = { ...level, zones: level.zones.map((z, i) => (i === 0 ? { ...z, name: "Zone 2" } : z)) };
    expect(nextZoneName(renamed)).toBe("Zone 1");
  });
});
