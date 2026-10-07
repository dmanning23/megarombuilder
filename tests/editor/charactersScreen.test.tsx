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
    expect(screen.getByRole("img", { name: "Stand, 16 by 24 pixels" })).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Enemies" }));
    expect(screen.getByRole("tab", { name: "Enemies" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("img", { name: "Stand, 16 by 24 pixels" })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Hero" }));
    expect(screen.getByRole("img", { name: "Stand, 16 by 24 pixels" })).toBeTruthy();
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
});
