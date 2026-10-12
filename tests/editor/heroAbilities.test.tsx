// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand } from "@/commands/registry";
import { snowHero } from "@/content/snow/hero";
import { snowPack } from "@/content/snow/pack";
import { Editor } from "@/editor/Editor";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";
import { scriptedModel, say } from "../ai/fakeModel";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

// The abilities live in the "How it plays" drawer: open it.
const settings = () => userEvent.click(screen.getByRole("button", { name: "How it plays" }));


let n = 100;
const makeId = () => `id-${++n}`;

// A new game whose Zone 1 has a wall three tiles high, and a hero who jumps high enough for it.
function walledGame(): Project {
  let project = newProject("Walls", makeId);
  const level = project.levels[0];
  const apply = (name: string, args: unknown) => {
    const result = applyCommand(project, { name, args }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
  };
  apply("fillRect", { levelId: level.id, zoneId: level.zones[0].id, x: 8, y: 10, w: 2, h: 3, tile: 1 });
  apply("setHeroAbilities", { jump: "high" });
  return project;
}

const group = (name: string) => screen.getByRole("group", { name });

describe("hero abilities", () => {
  it("changes an ability with a step button", async () => {
    const { open, saved } = setupHero();
    await open();
    await settings();
    expect(within(group("Jump")).getByRole("button", { name: "Normal" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(within(group("Jump")).getByRole("button", { name: "Very high" }));
    await userEvent.click(within(group("Slide")).getByRole("button", { name: "On" }));
    expect(within(group("Jump")).getByRole("button", { name: "Very high" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^Slide/ }).textContent).not.toContain("needs slide");
    expect(saved().hero.abilities).toMatchObject({ jump: "veryHigh", slide: true });
  });

  it("says which zones the hero can no longer finish, and opens one", async () => {
    const { open } = setupHero(walledGame());
    await open();
    await settings();
    expect(await screen.findByText("All zones can still be finished.", undefined, { timeout: 3000 })).toBeTruthy();
    await userEvent.click(within(group("Jump")).getByRole("button", { name: "Normal" }));
    const note = await screen.findByText(/1 zone can't be finished with this hero/, undefined, { timeout: 3000 });
    await userEvent.click(within(note).getByRole("button", { name: "Zone 1" }));
    expect(screen.getByLabelText("Zone 1, 1 screen")).toBeTruthy();
  });

  it("puts things back with one undo", async () => {
    const { open } = setupHero(walledGame());
    await open();
    await settings();
    await userEvent.click(within(group("Jump")).getByRole("button", { name: "Normal" }));
    await screen.findByText(/1 zone can't be finished/, undefined, { timeout: 3000 });
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("All zones can still be finished.", undefined, { timeout: 3000 })).toBeTruthy();
  });

  it("starts again from the snow hero's look, after asking", async () => {
    const confirm = vi.fn(() => true);
    const { open, press, choose, saved } = setupHero(undefined, confirm);
    await open();
    await settings();
    await userEvent.click(within(group("Speed")).getByRole("button", { name: "Fast" }));
    press(0, 0);
    await choose("Start from the snow hero");
    expect(confirm).toHaveBeenCalledWith("Start again from the snow hero's look? You can undo this.");
    const hero = saved().hero;
    expect(hero.look).toEqual(snowHero);
    expect(hero.abilities.speed).toBe("fast");
  });

  it("sets the charge shot to Off, On or Level 2, and notes the Level 2 shot picture until it's on", async () => {
    const { open, saved } = setupHero();
    await open();
    await settings();
    const charge = () => within(group("Charge shot"));
    expect(charge().getAllByRole("button").map((b) => b.textContent)).toEqual(["Off", "On", "Level 2"]);
    const picture = () => screen.getByRole("button", { name: /^Level 2 shot,/ });
    expect(picture().textContent).toContain("(needs level 2)");
    await userEvent.click(charge().getByRole("button", { name: "Level 2" }));
    expect(charge().getByRole("button", { name: "Level 2" }).getAttribute("aria-pressed")).toBe("true");
    expect(picture().textContent).not.toContain("(needs level 2)");
    await userEvent.click(charge().getByRole("button", { name: "Off" }));
    expect(charge().getByRole("button", { name: "Off" }).getAttribute("aria-pressed")).toBe("true");
    expect(saved().hero.abilities).toMatchObject({ chargeShot: false, chargeLevel2: false });
  });

  it("is locked while the assistant works", async () => {
    let finish = () => {};
    const waiting = new Promise<void>((resolve) => (finish = resolve));
    const { model } = scriptedModel([async () => (await waiting, say("Done."))]);
    const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
    const view = render(
      <Editor initial={newProject("Busy", makeId)} store={{ save }} makeId={makeId} saveDelay={60_000} model={model} />,
    );
    // The chat is on the Level screen: ask there, then open the hero while the assistant works.
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(screen.getByRole("button", { name: "Characters" }));
    // Disabled through the hero screen's fieldset, which the button's own property doesn't show.
    await waitFor(() => expect(screen.getByRole("button", { name: "Pencil" }).matches(":disabled")).toBe(true));
    expect(screen.getByRole("button", { name: "How it plays" }).matches(":disabled")).toBe(true); // the abilities can't be opened
    await act(async () => finish());
    await waitFor(() => expect(screen.getByRole("button", { name: "Pencil" }).matches(":disabled")).toBe(false));
    view.unmount();
  });
});
