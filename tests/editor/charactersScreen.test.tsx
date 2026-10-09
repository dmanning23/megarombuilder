// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { Editor } from "@/editor/Editor";
import { newProject } from "@/editor/newProject";
import { scriptedModel, waitForAbort } from "../ai/fakeModel";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

let n = 0;
const makeId = () => `c-${++n}`;

describe("the Characters screen", () => {
  it("opens on the Hero tab, and switches to Enemies and back", async () => {
    const { open } = setupHero();
    await open();
    expect(screen.getByRole("tab", { name: "Hero" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("img", { name: "Stand frame 1, 16 by 24 pixels" })).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies" }));
    expect(screen.getByRole("tab", { name: "Enemies" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("img", { name: "Stand frame 1, 16 by 24 pixels" })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Hero" }));
    expect(screen.getByRole("img", { name: "Stand frame 1, 16 by 24 pixels" })).toBeTruthy();
  });

  it("goes back to the level with the Level button", async () => {
    const { open } = setupHero();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Level" }));
    expect(screen.getByTestId("zone-canvas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Characters" })).toBeTruthy();
  });

  it("has a Boss tab", async () => {
    const { open } = setupHero();
    await open();
    await userEvent.click(screen.getByRole("tab", { name: "Boss" }));
    expect(screen.getByRole("tab", { name: "Boss" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "Make your own boss" })).toBeTruthy();
  });

  it("uses the whole window: no zone list and no assistant", async () => {
    const { open } = setupHero();
    await open();
    expect(screen.queryByRole("navigation", { name: "Zones" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Message" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Level" }));
    expect(screen.getByRole("navigation", { name: "Zones" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeTruthy();
  });

  it("keeps what was typed in the chat while the Characters screen shows", async () => {
    const { open } = setupHero();
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "add spikes");
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Level" }));
    expect((screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement).value).toBe("add spikes");
  });

  it("plays full width and comes back to the Characters screen", async () => {
    const { open } = setupHero();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.queryByRole("navigation", { name: "Zones" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Stop playing" }));
    expect(screen.getByRole("tab", { name: "Hero" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Zones" })).toBeNull();
  });

  it("keeps the hero's abilities in the How it plays drawer, closed at first", async () => {
    const { open } = setupHero();
    await open();
    const button = screen.getByRole("button", { name: "How it plays" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Jump" })).toBeNull();
    await userEvent.click(button);
    const drawer = screen.getByRole("complementary", { name: "How it plays" });
    expect(within(drawer).getByRole("group", { name: "Jump" })).toBeTruthy();
    expect(within(drawer).getByRole("button", { name: /Start from/ })).toBeTruthy();
    await userEvent.click(within(drawer).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("complementary", { name: "How it plays" })).toBeNull();
    const look = screen.getByRole("region", { name: "Look" });
    expect(within(look).getByRole("img", { name: "Your hero in action" })).toBeTruthy();
  });

  it("closes the drawer with Escape", async () => {
    const { open } = setupHero();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "How it plays" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "How it plays" })).toBeNull();
  });

  it("says when the assistant is working, and can stop it, while the chat is hidden", async () => {
    const { model } = scriptedModel([waitForAbort]);
    render(<Editor initial={newProject("Busy", makeId)} store={{ save: async () => {} }} makeId={makeId} saveDelay={60_000} model={model} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(screen.getByRole("button", { name: "Characters" }));
    expect(screen.getByRole("status", { name: "Assistant" }).textContent).toContain("The assistant is changing your game");
    await userEvent.click(within(screen.getByRole("status", { name: "Assistant" })).getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pencil" }).matches(":disabled")).toBe(false));
  });

  it("shows the assistant's trouble on the Characters screen too", async () => {
    const { model } = scriptedModel([new Error("boom")]);
    render(<Editor initial={newProject("Trouble", makeId)} store={{ save: async () => {} }} makeId={makeId} saveDelay={60_000} model={model} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(screen.getByRole("button", { name: "Characters" }));
    await waitFor(() => expect(screen.getByRole("status", { name: "Assistant" }).textContent).not.toBe(""));
    await userEvent.click(within(screen.getByRole("status", { name: "Assistant" })).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status", { name: "Assistant" })).toBeNull();
  });
});
