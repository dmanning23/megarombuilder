// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowPack } from "@/content/snow/pack";
import { Editor } from "@/editor/Editor";
import { ZOOM } from "@/editor/hero/pixels";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(cleanup);

let n = 0;
const makeId = () => `id-${++n}`;

function setup(initial: Project = newProject("Boss", makeId), confirm = () => true) {
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const view = render(<Editor initial={initial} store={{ save }} makeId={makeId} saveDelay={60_000} confirm={confirm} />);
  const saved = (): Project => {
    view.unmount();
    return save.mock.calls.at(-1)?.[0] ?? initial;
  };
  const open = async () => {
    await userEvent.click(screen.getByRole("button", { name: "Characters" }));
    await userEvent.click(screen.getByRole("tab", { name: "Boss" }));
  };
  const group = (name: string) => screen.getByRole("group", { name });
  const press = (x: number, y: number) => {
    const el = screen.getByTestId("boss-canvas") as HTMLCanvasElement;
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: el.width, height: el.height, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const at = { clientX: x * ZOOM + ZOOM / 2, clientY: y * ZOOM + ZOOM / 2, button: 0 };
    fireEvent.pointerDown(el, at);
    fireEvent.pointerUp(el, at);
  };
  const make = () => userEvent.click(screen.getByRole("button", { name: "Make your own boss" }));
  const placedBoss = (project: Project) => project.levels[0].zones[2].things.map((t) => t.type);
  return { saved, open, group, press, make, placedBoss };
}

describe("the Boss tab", () => {
  it("makes a boss from the Blizzard Bot, and undo takes it away again", async () => {
    const { open, make } = setup();
    await open();
    expect(screen.getByText(/Make your own boss to fight in the boss room/)).toBeTruthy();
    await make();
    expect((screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("My Boss");
    expect(screen.getByRole("img", { name: "Stand, 24 by 28 pixels" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "My Boss fighting" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Make your own boss" })).toBeTruthy();
  });

  it("starts as a copy of the Blizzard Bot's drawing and attacks", async () => {
    const { open, make, saved } = setup();
    await open();
    await make();
    expect(saved().boss).toEqual({ name: "My Boss", fight: "normal", attacks: ["jump", "spread", "dash"], look: snowPack.bossLook });
  });

  it("renames it and sets its fight", async () => {
    const { open, make, group, saved } = setup();
    await open();
    await make();
    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Volt Viper{Enter}");
    await userEvent.click(within(group("Fight")).getByRole("button", { name: "Long" }));
    expect(within(group("Fight")).getByRole("button", { name: "Long" }).getAttribute("aria-pressed")).toBe("true");
    expect(saved().boss).toMatchObject({ name: "Volt Viper", fight: "long" });
  });

  it("chooses attacks in order, two or three, with what each does", async () => {
    const { open, make, saved } = setup();
    await open();
    await make();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Attack 3" }), "None");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Attack 1" }), "Rain");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Attack 2" }), "Big shot");
    expect(screen.getByText("Shots fall from above. Stand in a gap.")).toBeTruthy();
    expect(screen.getByText("A huge, slow shot. Jump over it or slide under.")).toBeTruthy();
    expect(within(screen.getByRole("combobox", { name: "Attack 1" })).queryByRole("option", { name: "None" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Attack 3" }), "Aimed shot");
    expect(saved().boss?.attacks).toEqual(["rain", "big", "aimed"]);
  });

  it("draws on the attack frame", async () => {
    const { open, make, press, saved } = setup();
    await open();
    await make();
    await userEvent.click(within(screen.getByRole("group", { name: "Frames" })).getByRole("button", { name: "Attack" }));
    expect(screen.getByRole("img", { name: "Attack, 24 by 28 pixels" })).toBeTruthy();
    expect(snowPack.bossLook.frames[2][0][0]).toBe(".");
    press(0, 0);
    expect(saved().boss?.look.frames[2][0][0]).toBe("1");
  });

  it("puts it in the boss room and back, and undo follows", async () => {
    const { open, make, group, saved, placedBoss } = setup();
    await open();
    await make();
    const use = (name: string) => within(group("Use in the boss room")).getByRole("button", { name });
    expect(use("Blizzard Bot").getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(use("Your boss"));
    expect(use("Your boss").getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(use("Blizzard Bot").getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(use("Your boss"));
    expect(placedBoss(saved())).toEqual(["own-boss"]);
  });

  it("says plainly when the boss room has no boss to swap", async () => {
    let project = newProject("Empty room", makeId);
    const room = project.levels[0].zones[2];
    project = { ...project, levels: [{ ...project.levels[0], zones: [...project.levels[0].zones.slice(0, 2), { ...room, things: [] }] }] };
    const { open, make, group } = setup(project);
    await open();
    await make();
    expect(within(group("Use in the boss room")).getByRole("button", { name: "Your boss" }).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(within(group("Use in the boss room")).getByRole("button", { name: "Your boss" }));
    expect((await screen.findByRole("alert")).textContent).toContain("There is no boss in a boss room to swap.");
  });

  it("won't delete the boss while it's in the boss room, and deletes it after asking otherwise", async () => {
    const confirm = vi.fn(() => true);
    const { open, make, group, saved } = setup(undefined, confirm);
    await open();
    await make();
    await userEvent.click(within(group("Use in the boss room")).getByRole("button", { name: "Your boss" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete boss" }));
    expect((await screen.findByRole("alert")).textContent).toContain("My Boss is in Boss Room. Put the Blizzard Bot back first.");
    await userEvent.click(within(group("Use in the boss room")).getByRole("button", { name: "Blizzard Bot" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete boss" }));
    expect(confirm).toHaveBeenLastCalledWith("Delete My Boss? You can undo this.");
    expect(screen.getByRole("button", { name: "Make your own boss" })).toBeTruthy();
    expect(saved().boss).toBeNull();
  });
});
