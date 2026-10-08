// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { setupHero } from "./heroHelpers";

afterEach(cleanup);

const animations = () => screen.getByRole("group", { name: "Animations" });
const frames = () => screen.getByRole("group", { name: "Frames" });
const chooseAnimation = (name: string) => userEvent.click(within(animations()).getByRole("button", { name: new RegExp(`^${name},`) }));
const frameButton = (n: number) => within(frames()).getByRole("button", { name: `Frame ${n}` });

describe("the animation editor", () => {
  it("lists every animation with its frame count, and shows the chosen one's frames", async () => {
    const { open } = setupHero();
    await open();
    const names = within(animations()).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names).toContain("Run, 2 frames");
    expect(names).toContain("Stand, 1 frame");
    expect(names).toContain("Run and shoot, 2 frames");
    await chooseAnimation("Run");
    expect(frameButton(2)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Run frame 1, 16 by 24 pixels" })).toBeTruthy();
  });

  it("adds a blank frame after the chosen one, chooses it, and one undo takes it away", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Run");
    await userEvent.click(frameButton(2));
    await userEvent.click(screen.getByRole("button", { name: "Add frame" }));
    expect(frameButton(3).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("img", { name: "Run frame 3, 16 by 24 pixels" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(within(frames()).queryByRole("button", { name: "Frame 3" })).toBeNull();
    expect(screen.getByRole("img", { name: "Run frame 2, 16 by 24 pixels" })).toBeTruthy(); // a frame that exists
    expect(saved().hero.look.animations.run.frames).toHaveLength(2);
  });

  it("copies, moves and deletes frames, with the chosen frame following", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Run");
    await userEvent.click(screen.getByRole("button", { name: "Copy frame" })); // frame 1 copied to frame 2
    expect(frameButton(2).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Move right" }));
    expect(frameButton(3).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Delete frame" }));
    expect(frameButton(2).getAttribute("aria-pressed")).toBe("true"); // the last one now
    const run = saved().hero.look.animations.run.frames;
    expect(run).toHaveLength(2);
    expect(run[0]).toEqual(snowHero.animations.run.frames[0]);
  });

  it("reorders by dragging one frame onto another", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Run");
    fireEvent.dragStart(frameButton(2));
    fireEvent.dragOver(frameButton(1));
    fireEvent.drop(frameButton(1));
    expect(saved().hero.look.animations.run.frames).toEqual([...snowHero.animations.run.frames].reverse());
  });

  it("turns off Add and Copy at eight frames and Delete at one", async () => {
    const { open } = setupHero();
    await open();
    await chooseAnimation("Stand");
    expect(screen.getByRole("button", { name: "Delete frame" })).toHaveProperty("disabled", true);
    for (let i = 0; i < 7; i++) await userEvent.click(screen.getByRole("button", { name: "Add frame" }));
    expect(screen.getByRole("button", { name: "Add frame" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Copy frame" })).toHaveProperty("disabled", true);
    expect(screen.getByText("8 frames is the most.")).toBeTruthy();
  });

  it("sets the speed, plays and stops, and turns the onion skin on", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Run");
    const speed = screen.getByRole("group", { name: "Animation speed" });
    await userEvent.click(within(speed).getByRole("button", { name: "Fast" }));
    expect(within(speed).getByRole("button", { name: "Fast" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Play animation" }));
    expect(screen.getByRole("button", { name: "Stop animation" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Stop animation" }));
    const onion = screen.getByRole("button", { name: "Onion skin" });
    expect(onion.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(onion);
    expect(onion.getAttribute("aria-pressed")).toBe("true");
    expect(saved().hero.look.animations.run.speed).toBe("fast");
  });

  it("copies a frame from another animation on the same canvas", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Hurt");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Copy from" }), "Stand frame 1");
    expect(saved().hero.look.animations.hurt.frames[0]).toEqual(snowHero.animations.stand.frames[0]);
  });

  it("labels the animation's speed on screen, apart from the hero's own speed", async () => {
    const { open } = setupHero();
    await open();
    const group = screen.getByRole("group", { name: "Animation speed" });
    expect(within(group).getByText("Animation speed")).toBeTruthy();
  });

  it("ignores a drop that didn't start from a frame, and a drag that ended elsewhere", async () => {
    const { open, saved } = setupHero();
    await open();
    await chooseAnimation("Run");
    fireEvent.dragStart(frameButton(2));
    fireEvent.dragEnd(frameButton(2)); // dropped outside the strip
    fireEvent.dragOver(frameButton(1));
    fireEvent.drop(frameButton(1)); // a file dragged in from outside, say
    expect(saved().hero.look.animations.run.frames).toEqual(snowHero.animations.run.frames);
  });
});
