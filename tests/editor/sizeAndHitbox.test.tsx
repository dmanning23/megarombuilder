// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZOOM } from "@/editor/hero/pixels";
import { poseBox, type Look } from "@/model/look";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

const box = (look: Look, animation = "stand") => poseBox(look, "hero", animation);
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
    expect(saved().hero.look.animations.stand.size).toEqual({ w: 18, h: 26 });
  });

  it("asks before cutting off drawing, and does nothing if the kid says no", async () => {
    const confirm = vi.fn(() => false);
    const { open, saved } = setupHero(undefined, confirm);
    await open();
    await chooseAnimation("Stand and shoot");
    await userEvent.click(sizeButton("Narrower")); // the snow hero's arm reaches the edge: this cuts
    expect(confirm).toHaveBeenCalledWith("This cuts off part of your drawing. You can undo it.");
    expect(saved().hero.look.animations.standShoot.size).toEqual({ w: 16, h: 24 });
  });

  it("doesn't ask when only empty space goes", async () => {
    const confirm = vi.fn(() => true);
    const { open, saved } = setupHero(undefined, confirm);
    await open();
    await userEvent.click(sizeButton("Taller"));
    await userEvent.click(sizeButton("Shorter")); // takes back the empty row it added
    expect(confirm).not.toHaveBeenCalledWith("This cuts off part of your drawing. You can undo it.");
    expect(saved().hero.look.animations.stand.size).toEqual({ w: 16, h: 24 });
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

  it("dims a step the hitbox can't fit into, saying why, but not a step at the size limit", async () => {
    const { open } = setupHero();
    await open();
    const note = () => within(size()).queryByText("The hitbox needs this much room.");
    expect(note()).toBeNull();
    await userEvent.click(sizeButton("Narrower")); // 16 → 14: the hitbox is 14 wide
    expect(sizeButton("Narrower")).toHaveProperty("disabled", true);
    expect(note()).toBeTruthy();
    expect(sizeButton("Shorter")).toHaveProperty("disabled", false); // 24 → 22 still fits a 22-tall hitbox
    await chooseAnimation("Slide");
    for (let i = 0; i < 4; i++) await userEvent.click(sizeButton("Wider")); // 24 → 32, the most
    expect(sizeButton("Wider")).toHaveProperty("disabled", true);
    expect(note()).toBeNull(); // Narrower still fits the 14-wide sliding hitbox
  });

  it("resizes and sets the shot point of the chosen pose only", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await chooseAnimation("Jump and shoot");
    await userEvent.click(sizeButton("Wider"));
    expect(within(size()).getByText("18 × 24")).toBeTruthy();
    await choose("Shot point");
    canvasPress("hero-canvas").drag([8, 14], [8, 16]); // row 16; the hitbox, moved with the pixels, still starts at row 2
    await chooseAnimation("Stand");
    expect(within(size()).getByText("16 × 24")).toBeTruthy();
    const look = saved().hero.look;
    expect(look.animations.jumpShoot.size).toEqual({ w: 18, h: 24 });
    expect(look.animations.stand.size).toEqual({ w: 16, h: 24 });
    expect(look.animations.jumpShoot.shotY).toBe(14);
    expect(look.animations.stand.shotY).toBe(8);
  });

});

function canvasPress(testId: string) {
  const el = () => {
    const c = screen.getByTestId(testId) as HTMLCanvasElement;
    c.getBoundingClientRect = () => ({ left: 0, top: 0, width: c.width, height: c.height, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    return c;
  };
  const at = (x: number, y: number) => ({ clientX: x * ZOOM + ZOOM / 2, clientY: y * ZOOM + ZOOM / 2, button: 0 });
  return {
    drag(from: [number, number], ...path: [number, number][]) {
      fireEvent.pointerDown(el(), at(...from));
      for (const p of path) fireEvent.pointerMove(el(), at(...p));
      const last = path.at(-1) ?? from;
      fireEvent.pointerUp(el(), at(...last));
    },
  };
}

describe("the Hitbox tool", () => {
  it("drags the nearest edge, saves it as one undo step, and stops at the limits", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    canvasPress("hero-canvas").drag([14, 12], [13, 12], [12, 12], [11, 12]); // the right edge, in by 3
    expect(box(saved().hero.look)).toEqual({ x: 1, y: 2, w: 11, h: 22 });
  });

  it("undoes a whole drag in one step", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    canvasPress("hero-canvas").drag([8, 2], [8, 3], [8, 4], [8, 5], [8, 6]); // the top edge, down by 4
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(box(saved().hero.look)).toEqual({ x: 1, y: 2, w: 14, h: 22 });
  });

  it("moves only the slide's top edge, on the slide's own canvas", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    await chooseAnimation("Slide");
    canvasPress("hero-canvas").drag([12, 2], [12, 6]);
    expect(box(saved().hero.look, "slide")).toEqual({ x: 5, y: 6, w: 14, h: 10 });
  });

  it("fits the hitbox to the drawing", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    canvasPress("hero-canvas").drag([14, 12], [8, 12]);
    await choose("Fit to drawing");
    expect(saved().hero.look.body.w).toBeGreaterThan(8);
  });

  it("offers Fit to drawing and Size in the picture bar under the canvas", async () => {
    const { open, choose } = setupHero();
    await open();
    const bar = () => screen.getByRole("group", { name: "Picture tools" });
    expect(within(bar()).getByRole("group", { name: "Size" })).toBeTruthy();
    expect(within(bar()).queryByRole("button", { name: "Fit to drawing" })).toBeNull();
    await choose("Hitbox");
    expect(within(bar()).getByRole("button", { name: "Fit to drawing" })).toBeTruthy();
  });
});

describe("the Shot point tool", () => {
  it("moves where shots come out, inside the hitbox", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Shot point");
    canvasPress("hero-canvas").drag([8, 14], [8, 16]);
    expect(saved().hero.look.animations.stand.shotY).toBe(14); // row 16, the hitbox starting at row 2
  });

  it("isn't offered on the slide or the shots", async () => {
    const { open } = setupHero();
    await open();
    await chooseAnimation("Slide");
    expect(screen.queryByRole("button", { name: "Shot point" })).toBeNull();
  });

  it("stays at the same place in the picture when the hitbox's top edge moves, in one undo step", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    canvasPress("hero-canvas").drag([8, 2], [8, 4], [8, 6]); // the top edge down by 4
    const look = saved().hero.look;
    expect(box(look)!.y).toBe(6);
    expect(box(look)!.y + look.animations.stand.shotY!).toBe(2 + 8); // still row 10 of the picture
  });

  it("undoes the hitbox and the shot point together", async () => {
    const { open, choose, saved } = setupHero();
    await open();
    await choose("Hitbox");
    canvasPress("hero-canvas").drag([8, 2], [8, 6]);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    const look = saved().hero.look;
    expect([box(look)!.y, look.animations.stand.shotY]).toEqual([2, 8]);
  });
});
