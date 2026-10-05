import { describe, expect, it } from "vitest";
import { canUndo } from "@/commands/history";
import { snowPack } from "@/content/snow/pack";
import { newProject } from "@/editor/newProject";
import { editorReducer, initialEditor, MAX_CHAT, type EditorAction, type EditorState } from "@/editor/state";
import type { ChatMessage } from "@/model/schema";

const reduce = editorReducer({ pack: snowPack });
let n = 0;
const makeId = () => `id-${++n}`;
const start = () => initialEditor(newProject("Game", makeId), snowPack.groundTileId);
const said = (text: string): ChatMessage => ({ role: "user", text, at: "t" });
const apply = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(reduce, state);
const paint = (state: EditorState): EditorAction => ({
  type: "run",
  command: { name: "fillRect", args: { levelId: state.levelId, zoneId: state.zoneId, x: 0, y: 0, w: 1, h: 1, tile: 1 } },
});
const corner = (state: EditorState) => state.history.project.levels[0].zones[0].tiles[0];

describe("the chat in the editor", () => {
  it("adds messages without making an undo step", () => {
    const state = apply(start(), { type: "chat", messages: [said("hi"), said("there")] });
    expect(state.history.project.chat).toEqual([said("hi"), said("there")]);
    expect(canUndo(state.history)).toBe(false);
  });

  it("keeps the chat through undo and redo", () => {
    let state = start();
    state = apply(state, paint(state), { type: "chat", messages: [said("hi")] });
    state = apply(state, { type: "undo" });
    expect(corner(state)).toBe(0);
    expect(state.history.project.chat).toEqual([said("hi")]);
    state = apply(state, { type: "redo" });
    expect(corner(state)).toBe(1);
    expect(state.history.project.chat).toEqual([said("hi")]);
  });

  it("keeps the chat when a group is rolled back", () => {
    let state = apply(start(), { type: "begin", label: "Assistant" });
    state = apply(state, paint(state), { type: "chat", messages: [said("hi")] }, { type: "rollback" });
    expect(corner(state)).toBe(0);
    expect(state.history.project.chat).toEqual([said("hi")]);
  });

  it("keeps only the latest messages", () => {
    const many = Array.from({ length: MAX_CHAT + 5 }, (_, i) => said(`m${i}`));
    const state = apply(start(), { type: "chat", messages: many });
    expect(state.history.project.chat).toHaveLength(MAX_CHAT);
    expect(state.history.project.chat[0].text).toBe("m5");
  });
});
