// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { flipRows, ZOOM } from "@/editor/hero/pixels";
import { setupHero } from "./heroHelpers";
import { pictureRows } from "@/model/hero";
import { applyCommand } from "@/commands/registry";
import { snowPack } from "@/content/snow/pack";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(cleanup);

describe("the hero screen", () => {
  it("keeps Run and shoot in step with Run through a fill and its undo", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose(/^Run 1/);
    await choose("Fill");
    press(0, 0);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    const look = saved().hero.look;
    expect(look.animations.runShoot.frames).toEqual(look.animations.run.frames);
    expect(look.animations.run.frames[0][0][0]).toBe(".");
  });

  it("keeps Run and shoot in step with Run, in one undo step", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose(/^Run 2/);
    press(0, 0);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await choose(/^Run 1/);
    press(1, 0);
    const look = saved().hero.look;
    expect(look.animations.runShoot.frames).toEqual(look.animations.run.frames);
    expect(look.animations.run.frames[0][0][1]).toBe("1");
    expect(look.animations.run.frames[1][0][0]).toBe("."); // the undone stroke, gone from both
  });

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
    expect(pictureRows(saved().hero.look, "stand")[3][3]).toBe("1");
  });

  it("draws a whole stroke, with no gaps, as one undo step", async () => {
    const { open, drag, saved } = setupHero();
    await open();
    drag([2, 0], [8, 0]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(pictureRows(saved().hero.look, "stand")[0]).toBe("..1111111.......");
  });

  it("undoes a stroke in one step", async () => {
    const { open, drag, saved } = setupHero();
    await open();
    drag([2, 0], [8, 0]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(pictureRows(saved().hero.look, "stand")[0]).toBe("................");
  });

  it("erases", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Eraser");
    press(6, 3);
    expect(pictureRows(saved().hero.look, "stand")[3][6]).toBe(".");
  });

  it("fills the touching patch", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Fill");
    press(0, 0);
    expect(pictureRows(saved().hero.look, "stand")[0]).toBe("1111111111111111");
  });

  it("picks a colour from the picture", async () => {
    const { open, choose, press, saved } = setupHero();
    await open();
    await choose("Pick colour");
    press(7, 4); // the helmet: colour 2
    await choose("Pencil");
    press(0, 0);
    expect(pictureRows(saved().hero.look, "stand")[0][0]).toBe("2");
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
    expect(pictureRows(look, "slide")[15][22]).toBe("1");
  });

  it("copies, flips and clears a picture", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Run 1");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Copy from" }), "stand");
    await choose("Flip");
    expect(screen.getByRole("combobox", { name: "Copy from" })).toHaveProperty("value", "");
    const flipped = pictureRows(saved().hero.look, "run1");
    expect(flipped).toEqual(flipRows(pictureRows(snowHero, "stand")));
  });

  it("clears a picture", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Clear");
    expect(pictureRows(saved().hero.look, "stand").every((row) => /^\.+$/.test(row))).toBe(true);
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

describe("strokes in awkward places", () => {
  const at = (x: number, y: number, pointerId = 1) => ({ clientX: x * ZOOM + ZOOM / 2, clientY: y * ZOOM + ZOOM / 2, button: 0, pointerId });
  const canvas = () => {
    const el = screen.getByTestId("hero-canvas") as HTMLCanvasElement;
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: el.width, height: el.height, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    return el;
  };

  it("does not join the ends of a stroke that leaves the canvas and comes back", async () => {
    const { open, saved } = setupHero();
    await open();
    const el = canvas();
    fireEvent.pointerDown(el, at(5, 0));
    fireEvent.pointerMove(el, { ...at(5, 0), clientY: -20 });
    fireEvent.pointerMove(el, at(5, 23));
    fireEvent.pointerUp(el, at(5, 23));
    const stand = pictureRows(saved().hero.look, "stand");
    expect([stand[0][5], stand[23][5]]).toEqual(["1", "1"]);
    for (let y = 1; y < 23; y++) expect(stand[y][5], `row ${y}`).toBe(pictureRows(snowHero, "stand")[y][5]);
  });

  it("paints right up to the edge on a fast drag off the canvas", async () => {
    const { open, saved } = setupHero();
    await open();
    const el = canvas();
    fireEvent.pointerDown(el, at(8, 0));
    fireEvent.pointerMove(el, { ...at(8, 0), clientX: 16 * ZOOM + 40 });
    fireEvent.pointerUp(el, { ...at(8, 0), clientX: 16 * ZOOM + 40 });
    expect(pictureRows(saved().hero.look, "stand")[0]).toBe("........11111111");
  });

  it("ignores a second finger while one is drawing", async () => {
    const { open, saved } = setupHero();
    await open();
    const el = canvas();
    fireEvent.pointerDown(el, at(3, 0, 1));
    fireEvent.pointerDown(el, at(0, 10, 2));
    fireEvent.pointerMove(el, at(0, 12, 2));
    fireEvent.pointerUp(el, at(0, 12, 2));
    fireEvent.pointerUp(el, at(3, 0, 1));
    const stand = pictureRows(saved().hero.look, "stand");
    expect(stand[0][3]).toBe("1");
    expect(stand.slice(1).map((row) => row[0])).toEqual(pictureRows(snowHero, "stand").slice(1).map((row) => row[0]));
  });

  it("ends a stroke in its own picture when another picture is chosen", async () => {
    const { open, saved } = setupHero();
    await open();
    const el = canvas();
    fireEvent.pointerDown(el, at(3, 0));
    fireEvent.click(screen.getByRole("button", { name: "Run 1" }));
    fireEvent.pointerMove(canvas(), at(4, 0));
    fireEvent.pointerUp(canvas(), at(4, 0));
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", false);
    const look = saved().hero.look;
    expect(pictureRows(look, "stand")[0][3]).toBe("1");
    expect(pictureRows(look, "run1")).toEqual(pictureRows(snowHero, "run1"));
  });

  it("ends a stroke when the level is opened in the middle of it", async () => {
    const { open, saved } = setupHero();
    await open();
    fireEvent.pointerDown(canvas(), at(3, 0));
    fireEvent.click(screen.getByRole("button", { name: "Level" }));
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", false);
    expect(pictureRows(saved().hero.look, "stand")[0][3]).toBe("1");
  });
});

describe("looks the old screen can't make", () => {
  const counter = () => {
    let n = 0;
    return () => `id-${++n}`;
  };
  const withCommands = (project: Project, ...commands: [string, unknown][]) => {
    for (const [name, args] of commands) {
      const result = applyCommand(project, { name, args }, { pack: snowPack });
      if (!result.ok) throw new Error(result.error);
      project = result.project;
    }
    return project;
  };

  it("draws on Run 2 when the run has only one frame", async () => {
    const project = withCommands(newProject("One frame", counter()), ["removeFrame", { target: "hero", animation: "run", frame: 1 }]);
    const { open, choose, press, saved } = setupHero(project);
    await open();
    await choose(/^Run 2/);
    press(0, 0);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(saved().hero.look.animations.run.frames[0][0][0]).toBe("1");
  });

  it("draws and picks colours past nine with their letters", async () => {
    const colours = Array.from({ length: 10 }, (_, i) => i + 1);
    const project = withCommands(newProject("Ten", counter()), ["setLookColours", { target: "hero", colours }]);
    const { open, choose, press, saved } = setupHero(project);
    await open();
    await choose("Colour 10");
    press(0, 0);
    await choose("Colour 1");
    await choose("Pick colour");
    press(0, 0);
    expect(screen.getByRole("button", { name: "Colour 10" }).getAttribute("aria-pressed")).toBe("true");
    expect(pictureRows(saved().hero.look, "stand")[0][0]).toBe("a");
  });
});
