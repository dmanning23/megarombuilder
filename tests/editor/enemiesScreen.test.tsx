// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand } from "@/commands/registry";
import { snowPack } from "@/content/snow/pack";
import { Editor } from "@/editor/Editor";
import { ZOOM } from "@/editor/hero/pixels";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";
import { designFrames } from "@/model/designs";

afterEach(cleanup);

// The settings live in the "How it plays" drawer: open it.
const settings = () => userEvent.click(screen.getByRole("button", { name: "How it plays" }));


let n = 0;
const makeId = () => `id-${++n}`;

function withCommands(project: Project, ...commands: [string, unknown][]): Project {
  for (const [name, args] of commands) {
    const result = applyCommand(project, { name, args }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
  }
  return project;
}

function setup(initial: Project = newProject("Enemies", makeId), confirm = () => true) {
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const view = render(<Editor initial={initial} store={{ save }} makeId={makeId} saveDelay={60_000} confirm={confirm} />);
  const saved = (): Project => {
    view.unmount();
    return save.mock.calls.at(-1)?.[0] ?? initial;
  };
  const open = async () => {
    await userEvent.click(screen.getByRole("button", { name: "Characters" }));
    await userEvent.click(screen.getByRole("tab", { name: "Enemies" }));
  };
  const group = (name: string) => screen.getByRole("group", { name });
  const press = (x: number, y: number) => {
    const el = screen.getByTestId("enemy-canvas") as HTMLCanvasElement;
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: el.width, height: el.height, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const at = { clientX: x * ZOOM + ZOOM / 2, clientY: y * ZOOM + ZOOM / 2, button: 0 };
    fireEvent.pointerDown(el, at);
    fireEvent.pointerUp(el, at);
  };
  return { saved, open, group, press };
}

async function make(name: string, behaviour: string) {
  await userEvent.click(screen.getByRole("button", { name: "New enemy" }));
  if (name) await userEvent.type(screen.getByRole("textbox", { name: "Enemy name" }), name);
  await userEvent.click(within(screen.getByRole("group", { name: "Choose how it behaves" })).getByRole("button", { name: behaviour }));
}

describe("the Enemies tab", () => {
  it("invites the kid to make an enemy", async () => {
    const { open } = setup();
    await open();
    expect(screen.getByText("Make your own enemies to fight. Start with New enemy.")).toBeTruthy();
  });

  it("makes an enemy from the snow drawing for its behaviour, and selects it", async () => {
    const { open, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    expect(screen.getByRole("button", { name: /^Frost Fang/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("img", { name: "Walk frame 1, 16 by 16 pixels" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Frost Fang in action" })).toBeTruthy();
    const enemy = saved().enemies[0];
    expect(enemy).toMatchObject({ name: "Frost Fang", behaviour: "walker", look: snowPack.enemyLooks.walker });
  });

  it("names a nameless enemy Enemy 1, Enemy 2…", async () => {
    const { open, saved } = setup();
    await open();
    await make("", "Flyer");
    await make("", "Turret");
    expect(saved().enemies.map((e) => e.name)).toEqual(["Enemy 1", "Enemy 2"]);
  });

  it("shows only the tuning its behaviour uses, and tunes it", async () => {
    const { open, group, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    await settings();
    expect(screen.queryByRole("group", { name: "Shoots" })).toBeNull();
    await userEvent.click(within(group("Speed")).getByRole("button", { name: "Fast" }));
    await userEvent.click(within(group("Health")).getByRole("button", { name: "5 hits" }));
    await userEvent.click(within(group("Behaviour")).getByRole("button", { name: "Turret" }));
    expect(screen.getByRole("group", { name: "Shoots" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Speed" })).toBeNull();
    const enemy = saved().enemies[0];
    expect(enemy.behaviour).toBe("turret");
    expect(enemy.tuning).toMatchObject({ speed: "fast", health: 5 });
    expect(designFrames("turret", enemy.look)).toEqual(designFrames("walker", snowPack.enemyLooks.walker)); // the drawing stays
  });

  it("renames, and shows a clashing name's message", async () => {
    const { open, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    await make("Ice Bat", "Flyer");
    await settings();
    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "frost fang{Enter}");
    expect((await screen.findByRole("alert")).textContent).toContain('There is already an enemy called "Frost Fang".');
    await userEvent.clear(name);
    await userEvent.type(name, "Snow Bat{Enter}");
    expect(saved().enemies.map((e) => e.name)).toEqual(["Frost Fang", "Snow Bat"]);
  });

  it("keeps the name box in step with undo, so leaving it changes nothing", async () => {
    const { open, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    await settings();
    const name = () => screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
    await userEvent.clear(name());
    await userEvent.type(name(), "Snow Bat{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(name().value).toBe("Frost Fang");
    await userEvent.click(name());
    await userEvent.tab();
    expect(saved().enemies[0].name).toBe("Frost Fang");
  });

  it("puts the name back after a refused rename", async () => {
    const { open } = setup();
    await open();
    await make("Frost Fang", "Walker");
    await make("Ice Bat", "Flyer");
    await settings();
    const name = screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
    await userEvent.clear(name);
    await userEvent.type(name, "frost fang{Enter}");
    expect((await screen.findByRole("alert")).textContent).toContain('There is already an enemy called "Frost Fang".');
    expect((screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Ice Bat");
  });

  it("keeps the New enemy form open, and the selection, when the name is taken", async () => {
    const { open, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    await make("Ice Bat", "Flyer");
    await make("frost fang", "Turret");
    expect(screen.getByText('There is already an enemy called "Frost Fang".')).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Enemy name" }) as HTMLInputElement).value).toBe("frost fang");
    expect(screen.getByRole("button", { name: /^Ice Bat/ }).getAttribute("aria-pressed")).toBe("true");
    expect(saved().enemies.map((e) => e.name)).toEqual(["Frost Fang", "Ice Bat"]);
  });

  it("draws on either frame", async () => {
    const { open, press, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    await userEvent.click(screen.getByRole("button", { name: "Frame 2" }));
    expect(screen.getByRole("img", { name: "Walk frame 2, 16 by 16 pixels" })).toBeTruthy();
    press(0, 0);
    expect(designFrames("walker", saved().enemies[0].look)[1][0][0]).toBe("1");
  });

  it("deletes an enemy after asking, and selects another", async () => {
    const confirm = vi.fn(() => true);
    const { open, saved } = setup(undefined, confirm);
    await open();
    await make("Frost Fang", "Walker");
    await make("Ice Bat", "Flyer");
    await settings();
    await userEvent.click(screen.getByRole("button", { name: "Delete enemy" }));
    expect(confirm).toHaveBeenCalledWith("Delete Ice Bat? You can undo this.");
    expect(screen.getByRole("button", { name: /^Frost Fang/ }).getAttribute("aria-pressed")).toBe("true");
    expect(saved().enemies.map((e) => e.name)).toEqual(["Frost Fang"]);
  });

  it("says plainly why a placed enemy can't be deleted", async () => {
    let project = newProject("Placed", makeId);
    const level = project.levels[0];
    project = withCommands(
      project,
      ["addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" }],
      ["placeThing", { levelId: level.id, zoneId: level.zones[0].id, thingId: "t1", type: "own-e1", x: 6, y: 12 }],
    );
    const { open } = setup(project);
    await open();
    await settings();
    await userEvent.click(screen.getByRole("button", { name: "Delete enemy" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Frost Fang is used in Zone 1.");
  });

  it("turns New enemy off at twelve", async () => {
    let project = newProject("Many", makeId);
    for (let i = 0; i < 12; i++) project = withCommands(project, ["addEnemy", { enemyId: `e${i}`, name: `Enemy ${i}`, behaviour: "walker" }]);
    const { open } = setup(project);
    await open();
    expect(screen.getByRole("button", { name: "New enemy" })).toHaveProperty("disabled", true);
    expect(screen.getByText("12 is the most.")).toBeTruthy();
  });

  it("adds walk frames to an enemy and speeds them up", async () => {
    const { open, saved } = setup();
    await open();
    await make("Frost Fang", "Walker");
    const frames = screen.getByRole("group", { name: "Frames" });
    await userEvent.click(within(frames).getByRole("button", { name: "Frame 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy frame" }));
    await userEvent.click(screen.getByRole("button", { name: "Add frame" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Animation speed" })).getByRole("button", { name: "Fast" }));
    const walk = saved().enemies[0].look.animations.walk;
    expect(walk.frames).toHaveLength(4);
    expect(walk.speed).toBe("fast");
  });

  it("starts on the first animation again when the behaviour changes", async () => {
    const { open, group } = setup();
    await open();
    await make("Frost Fang", "Walker");
    await settings();
    await userEvent.click(screen.getByRole("button", { name: "Add frame" }));
    await userEvent.click(screen.getByRole("button", { name: "Add frame" }));
    await userEvent.click(within(group("Behaviour")).getByRole("button", { name: "Hopper" }));
    expect(screen.getByRole("img", { name: "On the ground frame 1, 16 by 16 pixels" })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Animations" })).getByRole("button", { name: "In the air, 3 frames" })).toBeTruthy();
  });

  it("offers the Shot point tool only to enemies that shoot", async () => {
    const { open } = setup();
    await open();
    await make("Frost Fang", "Walker");
    expect(screen.queryByRole("button", { name: "Shot point" })).toBeNull();
    await make("Ice Eye", "Turret");
    expect(screen.getByRole("button", { name: "Shot point" })).toBeTruthy();
  });

  it("keeps the enemies in the tab's top row and their settings in the How it plays drawer", async () => {
    const { open } = setup();
    await open();
    expect(screen.getByRole("button", { name: "New enemy" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "How it plays" })).toBeNull(); // nothing to set yet
    await make("Frost Fang", "Walker");
    expect(screen.getByRole("button", { name: /^Frost Fang/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "How it plays" }));
    const drawer = screen.getByRole("complementary", { name: "How it plays" });
    expect(within(drawer).getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(within(drawer).getByRole("group", { name: "Behaviour" })).toBeTruthy();
    expect(within(drawer).getByRole("group", { name: "Speed" })).toBeTruthy();
    expect(within(drawer).getByRole("button", { name: "Delete enemy" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Look" })).getByRole("img", { name: "Frost Fang in action" })).toBeTruthy();
  });
});
