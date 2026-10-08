// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

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
});
