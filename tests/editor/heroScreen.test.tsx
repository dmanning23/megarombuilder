// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { flipRows } from "@/editor/hero/pixels";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

describe("the hero screen", () => {
  it("swaps in for the level, and back", async () => {
    const { open } = setupHero();
    await open();
    expect(screen.getByRole("img", { name: "Stand, 16 by 24 pixels" })).toBeTruthy();
    expect(screen.queryByTestId("zone-canvas")).toBeNull();
    expect(screen.getByRole("img", { name: "Your hero in action" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Level" }));
    expect(screen.getByTestId("zone-canvas")).toBeTruthy();
  });

  it("draws a pixel with the pencil in colour 1", async () => {
    const { open, press, saved } = setupHero();
    await open();
    press(3, 3);
    expect(saved().hero.look.poses.stand[3][3]).toBe("1");
  });

  it("draws a whole stroke, with no gaps, as one undo step", async () => {
    const { open, drag, saved } = setupHero();
    await open();
    drag([2, 0], [8, 0]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(saved().hero.look.poses.stand[0]).toBe("..1111111.......");
  });

  it("undoes a stroke in one step", async () => {
    const { open, drag, saved } = setupHero();
    await open();
    drag([2, 0], [8, 0]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().hero.look.poses.stand[0]).toBe("................");
  });

  it("erases", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Eraser");
    press(6, 3);
    expect(saved().hero.look.poses.stand[3][6]).toBe(".");
  });

  it("fills the touching patch", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Fill");
    press(0, 0);
    expect(saved().hero.look.poses.stand[0]).toBe("1111111111111111");
  });

  it("picks a colour from the picture", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Pick colour");
    press(7, 4); // the helmet: colour 2
    await choose("Pencil");
    press(0, 0);
    expect(saved().hero.look.poses.stand[0][0]).toBe("2");
  });

  it("draws on any picture, at its own size", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose(/^Slide/);
    expect(screen.getByRole("img", { name: "Slide, 24 by 16 pixels" })).toBeTruthy();
    press(22, 15);
    await choose("Charged shot");
    expect(screen.getByRole("img", { name: "Charged shot, 12 by 10 pixels" })).toBeTruthy();
    const look = saved().hero.look;
    expect(look.poses.slide[15][22]).toBe("1");
  });

  it("copies, flips and clears a picture", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Run 1");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Copy from" }), "stand");
    await choose("Flip");
    expect(screen.getByRole("combobox", { name: "Copy from" })).toHaveProperty("value", "");
    const flipped = saved().hero.look.poses.run1;
    expect(flipped).toEqual(flipRows(snowHero.poses.stand));
  });

  it("clears a picture", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Clear");
    expect(saved().hero.look.poses.stand.every((row) => /^\.+$/.test(row))).toBe(true);
  });

  it("only offers to copy pictures of the same size", async () => {
    const { open, choose } = setupHero();
    await open();
    const options = () =>
      [...(screen.getByRole("combobox", { name: "Copy from" }) as HTMLSelectElement).options].map((o) => o.value);
    expect(options()).toEqual(["", "standShoot", "run1", "run2", "jump", "jumpShoot", "climb", "hurt"]);
    await choose(/^Slide/);
    expect(screen.queryByRole("combobox", { name: "Copy from" })).toBeNull();
  });
});
