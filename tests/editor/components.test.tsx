// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowArt } from "@/content/snow/art";
import { snowPack } from "@/content/snow/pack";
import { GROUND, SPIKE } from "@/content/snow/tiles";
import { Palette } from "@/editor/components/Palette";
import { Toolbar } from "@/editor/components/Toolbar";
import { ZoneCanvas } from "@/editor/components/ZoneCanvas";
import { ZoneList } from "@/editor/components/ZoneList";
import { newProject } from "@/editor/newProject";

afterEach(cleanup);

let n = 0;
const makeId = () => `id-${++n}`;
const level = newProject("Parts", makeId).levels[0];

describe("Palette", () => {
  function setup(tool: Parameters<typeof Palette>[0]["tool"] = { kind: "tile", tile: GROUND }) {
    const onTool = vi.fn();
    const view = render(<Palette pack={snowPack} art={snowArt} tool={tool} onTool={onTool} />);
    return { onTool, rerender: (t: typeof tool) => view.rerender(<Palette pack={snowPack} art={snowArt} tool={t} onTool={onTool} />) };
  }

  it("starts on the tiles, showing which is chosen", async () => {
    const { onTool } = setup();
    expect(screen.getByRole("tab", { name: "Tiles" }).getAttribute("aria-selected")).toBe("true");
    for (const name of ["Ground", "Ice", "Ladder", "Spike", "Ledge", "Erase"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Ground" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Spike" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "tile", tile: SPIKE });
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "erase" });
  });

  it("offers every enemy and item by name", async () => {
    const { onTool } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    for (const def of snowPack.things) expect(screen.getByRole("button", { name: def.name })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Snow Crawler" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "thing", type: "walker" });
    expect(screen.queryByRole("button", { name: "Ground" })).toBeNull();
  });

  it("offers every piece, chosen with its default settings", async () => {
    const { onTool } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Pieces" }));
    for (const piece of snowPack.pieces) expect(screen.getByRole("button", { name: piece.name })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Gap" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "piece", pieceId: "gap", settings: { width: 2 } });
  });

  it("lets a chosen piece's settings be changed", async () => {
    const { onTool, rerender } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Pieces" }));
    rerender({ kind: "piece", pieceId: "stairs-up", settings: { steps: 3, rise: 1 } });
    expect(screen.getByText(/Steps rising to the right/)).toBeTruthy();
    const steps = screen.getByRole("combobox", { name: "How many steps" }) as HTMLSelectElement;
    expect([...steps.options].map((o) => o.value)).toEqual(["1", "2", "3", "4"]);
    await userEvent.selectOptions(steps, "4");
    expect(onTool).toHaveBeenLastCalledWith({ kind: "piece", pieceId: "stairs-up", settings: { steps: 4, rise: 1 } });
  });
});

describe("ZoneList", () => {
  const props = () => ({
    level,
    selectedId: level.zones[0].id,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onAdd: vi.fn(),
  });

  it("lists the zones in order, numbered, marking the selected one", () => {
    render(<ZoneList {...props()} />);
    const list = screen.getByRole("list", { name: "Zones" });
    const buttons = list.querySelectorAll("button");
    expect([...buttons].map((b) => b.textContent)).toEqual([
      expect.stringContaining("1Zone 1"),
      expect.stringContaining("2Boss Corridor"),
      expect.stringContaining("3Boss Room"),
    ]);
    expect(buttons[0].getAttribute("aria-current")).toBe("true");
    expect(buttons[1].getAttribute("aria-current")).toBeNull();
  });

  it("selects a zone", async () => {
    const p = props();
    render(<ZoneList {...p} />);
    await userEvent.click(screen.getByRole("button", { name: /Boss Room/ }));
    expect(p.onSelect).toHaveBeenCalledWith(level.zones[2].id);
  });

  it("renames on Enter and cancels on Escape", async () => {
    const p = props();
    render(<ZoneList {...p} />);
    await userEvent.dblClick(screen.getByRole("button", { name: /Zone 1/ }));
    const box = screen.getByRole("textbox", { name: "Zone name" });
    await userEvent.clear(box);
    await userEvent.type(box, "Snowy Path{Enter}");
    expect(p.onRename).toHaveBeenCalledWith(level.zones[0].id, "Snowy Path");
    expect(screen.queryByRole("textbox", { name: "Zone name" })).toBeNull();

    await userEvent.dblClick(screen.getByRole("button", { name: /Zone 1/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "Zone name" }), "x{Escape}");
    expect(p.onRename).toHaveBeenCalledTimes(1);
  });

  it("renames from the keyboard with F2", async () => {
    render(<ZoneList {...props()} />);
    screen.getByRole("button", { name: /Zone 1/ }).focus();
    await userEvent.keyboard("{F2}");
    expect(screen.getByRole("textbox", { name: "Zone name" })).toBeTruthy();
  });

  it("adds a zone", async () => {
    const p = props();
    render(<ZoneList {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(p.onAdd).toHaveBeenCalled();
  });
});

describe("Toolbar", () => {
  const props = () => ({
    title: "Snow Fortress",
    saveState: "saved" as const,
    canUndo: false,
    canRedo: true,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onPlay: vi.fn(),
    onPlayFromZone: vi.fn(),
  });

  it("shows the name and save state, and disables what cannot happen", () => {
    render(<Toolbar {...props()} />);
    expect(screen.getByRole("heading", { name: "Snow Fortress" })).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("explains a failed save", () => {
    render(<Toolbar {...props()} saveState="error" />);
    expect(screen.getByText("Couldn't save. Keep this tab open.")).toBeTruthy();
  });

  it("starts playing from the start or from this zone", async () => {
    const p = props();
    render(<Toolbar {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    await userEvent.click(screen.getByRole("button", { name: "Play from this zone" }));
    expect(p.onPlay).toHaveBeenCalled();
    expect(p.onPlayFromZone).toHaveBeenCalled();
  });
});

describe("ZoneCanvas", () => {
  function setup() {
    const handlers = { onPress: vi.fn(), onDrag: vi.fn(), onRelease: vi.fn() };
    render(<ZoneCanvas zone={level.zones[0]} pack={snowPack} checkpoints={[]} zoom={2} {...handlers} />);
    const canvas = screen.getByTestId("zone-canvas");
    // jsdom does no layout, so give the canvas the size it would have on screen.
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 512, height: 480, right: 512, bottom: 480, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const at = (tx: number, ty: number) => ({ clientX: tx * 32 + 16, clientY: ty * 32 + 16 });
    return { handlers, canvas, at };
  }

  it("is named after the zone and sized to it at the zoom", () => {
    setup();
    const canvas = screen.getByLabelText("Zone 1, 1 screen") as HTMLCanvasElement;
    expect(canvas.width).toBe(256);
    expect(canvas.style.width).toBe("512px");
  });

  it("reports a press, each new tile dragged over, and the release", () => {
    const { handlers, canvas, at } = setup();
    fireEvent.pointerDown(canvas, { ...at(2, 3), button: 0 });
    expect(handlers.onPress).toHaveBeenCalledWith({ tile: { x: 2, y: 3 }, point: { x: 40, y: 56 } });
    fireEvent.pointerMove(canvas, at(2, 3));
    fireEvent.pointerMove(canvas, at(3, 3));
    fireEvent.pointerMove(canvas, at(3, 3));
    expect(handlers.onDrag).toHaveBeenCalledTimes(1);
    expect(handlers.onDrag).toHaveBeenCalledWith(expect.objectContaining({ tile: { x: 3, y: 3 } }));
    fireEvent.pointerUp(canvas, at(3, 3));
    expect(handlers.onRelease).toHaveBeenCalledWith(expect.objectContaining({ tile: { x: 3, y: 3 } }));
  });

  it("reports a release off the canvas as nowhere, and only once", () => {
    const { handlers, canvas, at } = setup();
    fireEvent.pointerDown(canvas, { ...at(2, 3), button: 0 });
    fireEvent.pointerUp(canvas, { clientX: 900, clientY: 900 });
    fireEvent.lostPointerCapture(canvas);
    expect(handlers.onRelease).toHaveBeenCalledTimes(1);
    expect(handlers.onRelease).toHaveBeenCalledWith(null);
  });

  it("ignores moves without a press, and right or middle clicks", () => {
    const { handlers, canvas, at } = setup();
    fireEvent.pointerMove(canvas, at(1, 1));
    fireEvent.pointerDown(canvas, { ...at(1, 1), button: 2 });
    fireEvent.pointerDown(canvas, { ...at(1, 1), button: 1 });
    fireEvent.pointerUp(canvas, at(1, 1));
    expect(handlers.onPress).not.toHaveBeenCalled();
    expect(handlers.onDrag).not.toHaveBeenCalled();
    expect(handlers.onRelease).not.toHaveBeenCalled();
  });
});
