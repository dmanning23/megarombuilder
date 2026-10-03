// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditError from "@/app/edit/[id]/error";
import { Editor } from "@/editor/Editor";
import { EditorPage } from "@/editor/EditorPage";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let n = 0;
const makeId = () => `id-${++n}`;
const saver = () => vi.fn<(project: Project) => Promise<void>>(async () => {});

describe("saving never loses the last change", () => {
  it("saves at once when the editor closes with a change waiting", async () => {
    const save = saver();
    const { unmount } = render(<Editor initial={newProject("Game", makeId)} store={{ save }} makeId={makeId} saveDelay={10_000} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(save).not.toHaveBeenCalled();
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].levels[0].zones).toHaveLength(4);
  });

  it("saves at once when the page is hidden", async () => {
    const save = saver();
    render(<Editor initial={newProject("Game", makeId)} store={{ save }} makeId={makeId} saveDelay={10_000} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not save when nothing changed", () => {
    const save = saver();
    const { unmount } = render(<Editor initial={newProject("Game", makeId)} store={{ save }} />);
    unmount();
    expect(save).not.toHaveBeenCalled();
  });
});

describe("the save status tells the truth", () => {
  it("goes back to Saved when a change is undone before it is saved", async () => {
    const save = saver();
    render(<Editor initial={newProject("Game", makeId)} store={{ save }} makeId={makeId} saveDelay={10_000} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(screen.getByText("Saving…")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("does not say Saved while a newer change is still waiting", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let finish: () => void = () => {};
    const save = vi.fn<(project: Project) => Promise<void>>(() => new Promise((resolve) => (finish = resolve)));
    render(<Editor initial={newProject("Game", makeId)} store={{ save }} makeId={makeId} saveDelay={500} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(save).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await act(async () => finish());
    expect(screen.getByText("Saving…")).toBeTruthy();
  });
});

describe("one game, one tab", () => {
  it("stops saving in the older tab when the game is opened in another, and says so", async () => {
    const saveA = saver();
    const game = newProject("Game", makeId);
    render(<Editor initial={game} store={{ save: saveA }} makeId={makeId} saveDelay={10_000} />);
    render(<Editor initial={game} store={{ save: saver() }} makeId={makeId} saveDelay={10_000} />);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/open in another tab/),
    );
    const [olderAdd] = screen.getAllByRole("button", { name: "Add a zone" });
    await userEvent.click(olderAdd);
    cleanup();
    expect(saveA).not.toHaveBeenCalled();
  });
});

describe("games that cannot be opened", () => {
  it("explains a stored game with no levels instead of crashing", async () => {
    const game = { ...newProject("Empty", makeId), levels: [] };
    const store = { load: vi.fn(async () => ({ ok: true as const, project: game })), save: saver() };
    render(<EditorPage projectId={game.id} store={store} />);
    expect(await screen.findByText("This game can't be opened: it has no levels.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to your games" })).toBeTruthy();
  });

  it("shows a way home if the editor breaks", () => {
    render(<EditError error={new Error("boom")} reset={() => {}} />);
    expect(screen.getByText("Something went wrong in the editor.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to your games" }).getAttribute("href")).toBe("/");
  });
});
