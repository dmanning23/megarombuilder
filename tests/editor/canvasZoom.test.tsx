// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyCommand } from "@/commands";
import { snowPack } from "@/content/snow/pack";
import { newProject } from "@/editor/newProject";
import { setupHero } from "./heroHelpers";

// jsdom has no ResizeObserver: stand in one that reports the drawing area's own size.
let reported = { width: 500, height: 600 };
class FakeResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe() {
    this.callback([{ contentRect: reported } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
});
afterEach(() => {
  cleanup();
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
});

describe("the canvas's zoom", () => {
  it("fills the drawing area it is given, measured from that area", async () => {
    reported = { width: 500, height: 600 };
    const { open } = setupHero();
    await open();
    const canvas = screen.getByTestId("hero-canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(16 * 20); // fitting the hero's largest picture, 24 by 24 (Slide is 24 wide): 500 / 24 = 20
  });

  it("stays at the smallest zoom in a small area", async () => {
    reported = { width: 100, height: 100 };
    const { open } = setupHero();
    await open();
    expect((screen.getByTestId("hero-canvas") as HTMLCanvasElement).width).toBe(16 * 12);
  });

  it("fits the character's largest pose, so pixels stay the same size between poses", async () => {
    reported = { width: 500, height: 600 };
    let n = 0;
    const result = applyCommand(
      newProject("Big", () => `id-${++n}`),
      { name: "resizePose", args: { target: "hero", animation: "jumpShoot", w: 32, h: 32 } },
      { pack: snowPack },
    );
    if (!result.ok) throw new Error(result.error);
    const { open } = setupHero(result.project);
    await open();
    expect((screen.getByTestId("hero-canvas") as HTMLCanvasElement).width).toBe(16 * 15); // 500 / 32 = 15, 600 / 32 = 18
    await userEvent.click(screen.getByRole("button", { name: /^Jump and shoot,/ }));
    expect((screen.getByTestId("hero-canvas") as HTMLCanvasElement).width).toBe(32 * 15);
  });
});
