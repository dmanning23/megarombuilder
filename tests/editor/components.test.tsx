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
  it("offers every tile and erase, showing which is chosen", async () => {
    const onTool = vi.fn();
    render(<Palette pack={snowPack} art={snowArt} tool={{ kind: "tile", tile: GROUND }} onTool={onTool} />);
    for (const name of ["Ground", "Ice", "Ladder", "Spike", "Ledge", "Erase"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Ground" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Spike" }).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(screen.getByRole("button", { name: "Spike" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "tile", tile: SPIKE });
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect(onTool).toHaveBeenCalledWith({ kind: "erase" });
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
  it("is named after the zone and sized to it at the zoom", () => {
    render(
      <ZoneCanvas
        zone={level.zones[0]}
        pack={snowPack}
        checkpoints={[]}
        zoom={2}
        onStrokeStart={vi.fn()}
        onPaint={vi.fn()}
        onStrokeEnd={vi.fn()}
      />,
    );
    const canvas = screen.getByLabelText("Zone 1, 1 screen") as HTMLCanvasElement;
    expect(canvas.width).toBe(256);
    expect(canvas.style.width).toBe("512px");
  });

  it("starts and ends a stroke even when the pointer is somewhere it cannot paint", () => {
    const onStrokeStart = vi.fn();
    const onPaint = vi.fn();
    const onStrokeEnd = vi.fn();
    render(
      <ZoneCanvas
        zone={level.zones[0]}
        pack={snowPack}
        checkpoints={[]}
        zoom={2}
        onStrokeStart={onStrokeStart}
        onPaint={onPaint}
        onStrokeEnd={onStrokeEnd}
      />,
    );
    const canvas = screen.getByTestId("zone-canvas");
    fireEvent.pointerDown(canvas);
    fireEvent.pointerUp(canvas);
    expect(onStrokeStart).toHaveBeenCalledTimes(1);
    expect(onPaint).not.toHaveBeenCalled(); // jsdom gives the canvas no size
    expect(onStrokeEnd).toHaveBeenCalledTimes(1);
  });
});
