// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

const size = () => screen.getByRole("group", { name: "Size" });
const sizeButton = (name: string) => within(size()).getByRole("button", { name });
const chooseAnimation = (name: string) =>
  userEvent.click(within(screen.getByRole("group", { name: "Animations" })).getByRole("button", { name: new RegExp(`^${name},`) }));

describe("the Size control", () => {
  it("grows the canvas two pixels at a time, and the hitbox follows the drawing", async () => {
    const { open, saved } = setupHero();
    await open();
    expect(within(size()).getByText("16 × 24")).toBeTruthy();
    await userEvent.click(sizeButton("Taller"));
    await userEvent.click(sizeButton("Wider"));
    expect(within(size()).getByText("18 × 26")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Stand frame 1, 18 by 26 pixels" })).toBeTruthy();
    expect(saved().hero.look.canvases.main).toEqual({ w: 18, h: 26 });
  });

  it("asks before cutting off drawing, and does nothing if the kid says no", async () => {
    const confirm = vi.fn(() => false);
    const { open, saved } = setupHero(undefined, confirm);
    await open();
    await userEvent.click(sizeButton("Narrower")); // the snow hero fills its width: this cuts
    expect(confirm).toHaveBeenCalledWith("This cuts off part of your drawing. You can undo it.");
    expect(saved().hero.look.canvases.main).toEqual({ w: 16, h: 24 });
  });

  it("doesn't ask when only empty space goes", async () => {
    const confirm = vi.fn(() => true);
    const { open, saved } = setupHero(undefined, confirm);
    await open();
    await userEvent.click(sizeButton("Taller"));
    await userEvent.click(sizeButton("Shorter")); // takes back the empty row it added
    expect(confirm).not.toHaveBeenCalledWith("This cuts off part of your drawing. You can undo it.");
    expect(saved().hero.look.canvases.main).toEqual({ w: 16, h: 24 });
  });

  it("stops at the limits, sizes the slide on its own canvas, and has no Size for the shots", async () => {
    const { open } = setupHero();
    await open();
    for (let i = 0; i < 4; i++) await userEvent.click(sizeButton("Taller"));
    expect(sizeButton("Taller")).toHaveProperty("disabled", true); // 32 is the most
    await chooseAnimation("Slide");
    expect(within(size()).getByText("24 × 16")).toBeTruthy();
    expect(sizeButton("Taller")).toHaveProperty("disabled", true); // a slide is 16 high at most
    await chooseAnimation("Shot");
    expect(screen.queryByRole("group", { name: "Size" })).toBeNull();
  });
});
