// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@/editor/Editor";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

let n = 0;
const makeId = () => `id-${++n}`;

// Renders the editor and returns helpers to press on tiles and to read the saved project.
function setup(confirm = () => true) {
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const view = render(
    <Editor initial={newProject("Tools", makeId)} store={{ save }} makeId={makeId} saveDelay={60_000} confirm={confirm} />,
  );
  const canvas = () => {
    const el = screen.getByTestId("zone-canvas");
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: el.offsetWidth || Number.parseInt(el.style.width), height: Number.parseInt(el.style.height), right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    return el;
  };
  const at = (tx: number, ty: number) => ({ clientX: tx * 32 + 16, clientY: ty * 32 + 16, button: 0 });
  const click = (tx: number, ty: number) => {
    const el = canvas();
    fireEvent.pointerDown(el, at(tx, ty));
    fireEvent.pointerUp(el, at(tx, ty));
  };
  const drag = (from: [number, number], to: [number, number]) => {
    const el = canvas();
    fireEvent.pointerDown(el, at(...from));
    fireEvent.pointerMove(el, at(...to));
    fireEvent.pointerUp(el, at(...to));
  };
  // Closing the editor saves at once, so the last saved project is what was built.
  const saved = (): Project => {
    view.unmount();
    return save.mock.calls[save.mock.calls.length - 1][0];
  };
  // Presses at an exact point in zone pixels (the canvas is shown at twice size here).
  const dragPoints = (from: [number, number], to: [number, number]) => {
    const el = canvas();
    const point = ([x, y]: [number, number]) => ({ clientX: x * 2, clientY: y * 2, button: 0 });
    fireEvent.pointerDown(el, point(from));
    fireEvent.pointerMove(el, point(to));
    fireEvent.pointerUp(el, point(to));
  };
  return { click, drag, dragPoints, saved, save };
}

const firstZone = (p: Project) => p.levels[0].zones[0];

describe("building with tools", () => {
  it("places an enemy where you click", async () => {
    const { click, saved } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    await userEvent.click(screen.getByRole("button", { name: "Snow Crawler" }));
    click(5, 12);
    expect(firstZone(saved()).things).toEqual([expect.objectContaining({ type: "walker", x: 5, y: 12 })]);
  });

  it("drags an enemy to a new tile", async () => {
    const { click, drag, saved } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    await userEvent.click(screen.getByRole("button", { name: "Snow Crawler" }));
    click(5, 12);
    drag([5, 12], [9, 12]);
    const things = firstZone(saved()).things;
    expect(things).toHaveLength(1);
    expect(things[0]).toMatchObject({ x: 9, y: 12 });
  });

  it("does not move a wide thing when it is just clicked, and keeps the grab point when dragged", async () => {
    const { click, dragPoints, saved } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    await userEvent.click(screen.getByRole("button", { name: "Moving Platform" }));
    click(5, 8);
    // The platform is 8 pixels tall along the top of row 8, two tiles wide: press its right half.
    dragPoints([104, 130], [104, 130]);
    dragPoints([104, 130], [152, 130]);
    const things = firstZone(saved()).things;
    expect(things).toHaveLength(1);
    expect(things[0]).toMatchObject({ type: "platform", x: 8, y: 8 });
  });

  it("does not move the boss into the air when its head is clicked", async () => {
    const { click, saved } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    await userEvent.click(screen.getByRole("button", { name: "Blizzard Bot" }));
    click(10, 12);
    click(10, 11);
    expect(firstZone(saved()).things.find((t) => t.type === "boss")).toMatchObject({ x: 10, y: 12 });
  });

  it("erases an enemy before the tile under it", async () => {
    const { click, saved } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    await userEvent.click(screen.getByRole("button", { name: "Snow Crawler" }));
    click(5, 12);
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    click(5, 12);
    const zone = firstZone(saved());
    expect(zone.things).toEqual([]);
    expect(zone.tiles[12 * 16 + 5]).toBe(0);
  });

  it("stamps a piece", async () => {
    const { click, saved } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Pieces" }));
    await userEvent.click(screen.getByRole("button", { name: "Gap" }));
    click(4, 5);
    const zone = firstZone(saved());
    expect(zone.tiles[13 * 16 + 6]).toBe(0); // the pit
    expect(zone.tiles[13 * 16 + 5]).toBe(1); // floor before it
  });

  it("shows the checker's verdict after a pause", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    expect(screen.getByText("Checking…")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("This zone can be crossed. Difficulty 1 of 10.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Zone 1.*difficulty 1/ })).toBeTruthy();
  });

  it("shows a way out that no longer lines up as a level problem", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Way out side" }), "top");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("heading", { name: "Level problems" })).toBeTruthy();
    expect(screen.getByText(/must be entered from its bottom edge/)).toBeTruthy();
  });

  it("adds a climbing zone and selects it", async () => {
    const { saved } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add a climbing zone" }));
    expect(screen.getByLabelText("Zone 2, 2 screens")).toBeTruthy();
    expect(saved().levels[0].zones[1]).toMatchObject({ scroll: "vertical", screens: 2 });
  });

  it("deletes a zone after asking, and not if you say no", async () => {
    const answers = [false, true];
    const confirm = vi.fn(() => answers.shift() ?? false);
    setup(confirm);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete this zone" }));
    expect(confirm).toHaveBeenCalledWith('Delete "Zone 2"? You can undo this.');
    expect(screen.getByRole("button", { name: /Zone 2/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Delete this zone" }));
    expect(screen.queryByRole("button", { name: /Zone 2/ })).toBeNull();
  });

  it("exports the game as a file named after it", async () => {
    setup();
    const createObjectURL = vi.fn(() => "blob:game");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    let downloaded = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(downloaded).toBe("tools.megarom.json");
    expect(createObjectURL).toHaveBeenCalled();
  });

  it("switches editing controls off while playing", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Add a zone" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("heading", { name: "This zone" })).toBeNull();
  });
});
