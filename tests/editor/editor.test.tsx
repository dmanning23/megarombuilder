// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@/editor/Editor";
import { EditorPage, type ProjectStore } from "@/editor/EditorPage";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let n = 0;
const makeId = () => `id-${++n}`;

describe("Editor", () => {
  it("shows the game, its zones and the palette", () => {
    render(<Editor initial={newProject("Snow Fortress", makeId)} store={{ save: vi.fn() }} />);
    expect(screen.getByRole("heading", { name: "Snow Fortress" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Zones" })).toBeTruthy();
    expect(screen.getByRole("toolbar", { name: "Tiles" })).toBeTruthy();
    expect(screen.getByLabelText("Zone 1, 1 screen")).toBeTruthy();
  });

  it("selects a zone and shows it", async () => {
    render(<Editor initial={newProject("Game", makeId)} store={{ save: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: /Boss Room/ }));
    expect(screen.getByLabelText("Boss Room, 1 screen")).toBeTruthy();
  });

  it("adds a zone, selects it, and can undo it", async () => {
    render(<Editor initial={newProject("Game", makeId)} store={{ save: vi.fn() }} makeId={makeId} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(screen.getByLabelText("Zone 2, 1 screen")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.queryByRole("button", { name: /Zone 2/ })).toBeNull();
    expect(screen.getByLabelText("Zone 1, 1 screen")).toBeTruthy();
  });

  it("renames a zone, and explains a name that is taken", async () => {
    render(<Editor initial={newProject("Game", makeId)} store={{ save: vi.fn() }} />);
    await userEvent.dblClick(screen.getByRole("button", { name: /Zone 1/ }));
    const box = screen.getByRole("textbox", { name: "Zone name" });
    await userEvent.clear(box);
    await userEvent.type(box, "Boss Room{Enter}");
    expect(screen.getByRole("alert").textContent).toMatch(/already a zone called "Boss Room"/);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("undoes and redoes with the keyboard, but not while typing", async () => {
    render(<Editor initial={newProject("Game", makeId)} store={{ save: vi.fn() }} makeId={makeId} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(screen.queryByRole("button", { name: /Zone 2/ })).toBeNull();
    await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(screen.getByRole("button", { name: /Zone 2/ })).toBeTruthy();

    await userEvent.dblClick(screen.getByRole("button", { name: /Zone 1/ }));
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(screen.getByRole("button", { name: /Zone 2/ })).toBeTruthy();
  });

  it("saves a little while after a change, and says so", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
    render(<Editor initial={newProject("Game", makeId)} store={{ save }} makeId={makeId} saveDelay={500} />);
    expect(screen.getByText("Saved")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(screen.getByText("Saving…")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].levels[0].zones).toHaveLength(4);
  });

  it("saves again after undoing back to how the game was opened", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
    const initial = newProject("Game", makeId);
    render(<Editor initial={initial} store={{ save }} makeId={makeId} saveDelay={500} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][0]).toBe(initial);
  });

  it("keeps working and says so when saving fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const save = vi.fn(async () => {
      throw new Error("QuotaExceededError");
    });
    render(<Editor initial={newProject("Game", makeId)} store={{ save }} makeId={makeId} saveDelay={500} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await waitFor(() => expect(screen.getByText("Couldn't save. Keep this tab open.")).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(screen.getByRole("button", { name: /Zone 3/ })).toBeTruthy();
  });

  it("plays and stops with the button or Escape", async () => {
    render(<Editor initial={newProject("Game", makeId)} store={{ save: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Stop playing" })).toBeTruthy();
    expect(screen.queryByTestId("zone-canvas")).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("zone-canvas")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Play from this zone" }));
    await userEvent.click(screen.getByRole("button", { name: "Stop playing" }));
    expect(screen.getByTestId("zone-canvas")).toBeTruthy();
  });
});

describe("EditorPage", () => {
  const store = (result: Awaited<ReturnType<ProjectStore["load"]>>): ProjectStore => ({
    load: vi.fn(async () => result),
    save: vi.fn(async () => {}),
  });

  it("opens a saved game", async () => {
    const project = newProject("Saved Game", makeId);
    render(<EditorPage projectId={project.id} store={store({ ok: true, project })} />);
    expect(screen.getByText("Opening your game…")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Saved Game" })).toBeTruthy();
  });

  it("explains a game that is not saved here", async () => {
    render(<EditorPage projectId="nope" store={store(null)} />);
    expect(await screen.findByText("This game isn't saved in this browser.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to your games" }).getAttribute("href")).toBe("/");
  });

  it("explains a game that cannot be read", async () => {
    render(<EditorPage projectId="bad" store={store({ ok: false, error: "This project file is damaged." })} />);
    expect(await screen.findByText("This game can't be opened: This project file is damaged.")).toBeTruthy();
  });
});
