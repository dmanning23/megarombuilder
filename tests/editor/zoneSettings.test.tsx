// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowPack } from "@/content/snow/pack";
import { ZoneSettings } from "@/editor/components/ZoneSettings";
import { newProject } from "@/editor/newProject";
import type { Level, Zone } from "@/model/schema";

afterEach(cleanup);

let n = 0;
const makeId = () => `id-${++n}`;
const base = newProject("Settings", makeId).levels[0];
// A level with two ordinary zones before the boss zones.
const second: Zone = { ...base.zones[0], id: "second", name: "Zone 2" };
const level: Level = { ...base, zones: [base.zones[0], second, base.zones[1], base.zones[2]] };

function setup(zone: Zone) {
  const onCommand = vi.fn();
  const onDelete = vi.fn();
  render(<ZoneSettings level={level} zone={zone} pack={snowPack} onCommand={onCommand} onDelete={onDelete} />);
  const ids = { levelId: level.id, zoneId: zone.id };
  return { onCommand, onDelete, ids };
}

describe("ZoneSettings", () => {
  it("changes the length", async () => {
    const { onCommand, ids } = setup(level.zones[0]);
    const length = screen.getByRole("combobox", { name: "Length" }) as HTMLSelectElement;
    expect(length.options).toHaveLength(8);
    await userEvent.selectOptions(length, "3");
    expect(onCommand).toHaveBeenCalledWith({ name: "resizeZone", args: { ...ids, screens: 3 } });
  });

  it("offers up to six screens for a climbing zone", () => {
    setup({ ...level.zones[0], scroll: "vertical", screens: 2 });
    expect((screen.getByRole("combobox", { name: "Length" }) as HTMLSelectElement).options).toHaveLength(6);
  });

  it("changes the look", async () => {
    const { onCommand, ids } = setup(level.zones[0]);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Look" }), "cave");
    expect(onCommand).toHaveBeenCalledWith({ name: "setZoneVariant", args: { ...ids, variant: "cave" } });
  });

  it("saves what the zone is for when you leave the box, if it changed", async () => {
    const { onCommand, ids } = setup(level.zones[0]);
    const box = screen.getByRole("textbox", { name: "What it's for" });
    await userEvent.click(box);
    await userEvent.tab();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.type(box, "Teach the ice floor");
    await userEvent.tab();
    expect(onCommand).toHaveBeenCalledWith({ name: "setZoneIntent", args: { ...ids, intent: "Teach the ice floor" } });
  });

  it("moves the way out to the top, starting in the middle", async () => {
    const { onCommand, ids } = setup(level.zones[0]);
    const side = screen.getByRole("combobox", { name: "Way out side" });
    expect([...(side as HTMLSelectElement).options].map((o) => o.text)).toEqual(["Right side", "Top", "Bottom"]);
    await userEvent.selectOptions(side, "top");
    expect(onCommand).toHaveBeenCalledWith({
      name: "setZoneOpenings",
      args: { ...ids, exit: { edge: "top", from: 7, to: 8 } },
    });
  });

  it("moves the way in along its side", async () => {
    const { onCommand, ids } = setup(level.zones[0]);
    const start = screen.getByRole("combobox", { name: "Way in starts at row" }) as HTMLSelectElement;
    expect(start.value).toBe("9");
    expect(start.options).toHaveLength(12);
    await userEvent.selectOptions(start, "5");
    expect(onCommand).toHaveBeenCalledWith({
      name: "setZoneOpenings",
      args: { ...ids, entry: { edge: "left", from: 5, to: 8 } },
    });
  });

  it("reorders zones, but not past the ends", async () => {
    const first = setup(level.zones[0]);
    expect((screen.getByRole("button", { name: "Move earlier" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Move later" }));
    expect(first.onCommand).toHaveBeenCalledWith({ name: "moveZone", args: { ...first.ids, toIndex: 1 } });
    cleanup();
    setup(second);
    expect((screen.getByRole("button", { name: "Move later" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("deletes through the editor", async () => {
    const { onDelete } = setup(level.zones[0]);
    await userEvent.click(screen.getByRole("button", { name: "Delete this zone" }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("keeps boss zones one screen with no way out of the boss room", () => {
    setup(level.zones[3]);
    expect(screen.getByText("Boss zones are always one screen.")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Length" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Way out side" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete this zone" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move later" })).toBeNull();
  });
});
