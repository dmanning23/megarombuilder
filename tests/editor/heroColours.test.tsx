// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setupHero } from "./heroHelpers";
import { pictureRows } from "@/model/hero";

afterEach(cleanup);

describe("hero colours", () => {
  it("shows the hero's colours, with colour 1 chosen", async () => {
    const { open } = setupHero();
    await open();
    const slots = within(screen.getByRole("group", { name: "Your colours" })).getAllByRole("button", { name: /^Colour/ });
    expect(slots).toHaveLength(7);
    expect(slots[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("recolours a colour everywhere from the 8-bit palette", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Colour 2");
    await choose("8-bit colour 22");
    expect(saved().hero.look.colours[1]).toBe(21);
  });

  it("adds a colour, chooses it, and draws with it", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Add a colour");
    expect(screen.getByRole("button", { name: "Colour 8" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Add a colour" })).toBeNull(); // eight is the most
    press(0, 0);
    const look = saved().hero.look;
    expect(look.colours).toHaveLength(8);
    expect(look.colours[7]).toBe(27);
    expect(pictureRows(look, "stand")[0][0]).toBe("8");
  });

  it("refuses to remove a colour that is still used, and says where", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Remove colour 7");
    expect((await screen.findByRole("alert")).textContent).toContain("Colour 7 is still used in Shot frame 1 and Charged shot frame 1.");
    expect(saved().hero.look.colours).toHaveLength(7);
  });

  it("falls back to the last colour when the chosen one is removed", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Add a colour");
    await choose("Remove colour 8");
    press(0, 0);
    const look = saved().hero.look;
    expect(look.colours).toHaveLength(7);
    expect(pictureRows(look, "stand")[0][0]).toBe("7");
  });
});
