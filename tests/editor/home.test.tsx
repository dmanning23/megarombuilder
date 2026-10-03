// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectsHome } from "@/editor/ProjectsHome";
import type { Project } from "@/model/schema";

afterEach(cleanup);

function setup(games: { id: string; name: string; updatedAt: number }[] = []) {
  const store = {
    list: vi.fn(async () => games),
    save: vi.fn<(project: Project) => Promise<void>>(async () => {}),
    remove: vi.fn<(id: string) => Promise<void>>(async () => {}),
  };
  const navigate = vi.fn();
  let n = 0;
  const makeId = () => `id-${++n}`;
  return { store, navigate, makeId };
}

describe("ProjectsHome", () => {
  it("invites you to make a game when there are none", async () => {
    const { store, navigate, makeId } = setup();
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} />);
    expect(await screen.findByText("No games yet. Make one to start building.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Play the demo stage" }).getAttribute("href")).toBe("/play");
  });

  it("lists saved games with links to open them", async () => {
    const { store, navigate, makeId } = setup([{ id: "a", name: "Snow Fortress", updatedAt: Date.now() }]);
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} />);
    expect(await screen.findByText("Snow Fortress")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Snow Fortress" }).getAttribute("href")).toBe("/edit/a");
  });

  it("makes a new game, saves it and opens it", async () => {
    const { store, navigate, makeId } = setup();
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Game name" }), "Ice Palace");
    await userEvent.click(screen.getByRole("button", { name: "Make a new game" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/edit/id-1"));
    expect(store.save.mock.calls[0][0].name).toBe("Ice Palace");
  });

  it("starts from a copy of the demo", async () => {
    const { store, navigate, makeId } = setup();
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} />);
    await userEvent.click(screen.getByRole("button", { name: "Start from the demo stage" }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(store.save.mock.calls[0][0].name).toBe("Demo Stage");
  });

  it("deletes a game only after asking", async () => {
    const { store, navigate, makeId } = setup([{ id: "a", name: "Snow Fortress", updatedAt: 1 }]);
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<ProjectsHome store={store} navigate={navigate} makeId={makeId} confirm={confirm} />);
    const remove = await screen.findByRole("button", { name: "Delete Snow Fortress" });
    await userEvent.click(remove);
    expect(store.remove).not.toHaveBeenCalled();
    await userEvent.click(remove);
    expect(confirm).toHaveBeenLastCalledWith('Delete "Snow Fortress"? This can\'t be undone.');
    await waitFor(() => expect(store.remove).toHaveBeenCalledWith("a"));
  });
});
