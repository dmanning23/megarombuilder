// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    expect(canvas.width).toBe(16 * 24); // 500 / 16 and 600 / 24 both allow the most, 24
  });

  it("stays at the smallest zoom in a small area", async () => {
    reported = { width: 100, height: 100 };
    const { open } = setupHero();
    await open();
    expect((screen.getByTestId("hero-canvas") as HTMLCanvasElement).width).toBe(16 * 12);
  });
});
