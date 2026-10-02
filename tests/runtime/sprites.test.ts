import { describe, expect, it } from "vitest";
import { sprite } from "@/runtime/render/art";
import { createSpriteCache, type CanvasLike } from "@/runtime/render/sprites";

type FakeCanvas = { id: number; pixels: Map<string, string> };

function fakeMaker() {
  let made = 0;
  const make = (): CanvasLike => {
    const canvas: FakeCanvas = { id: ++made, pixels: new Map() };
    const ctx = {
      fillStyle: "" as string,
      fillRect(x: number, y: number) {
        canvas.pixels.set(`${x},${y}`, this.fillStyle);
      },
    };
    return { canvas: canvas as unknown as CanvasImageSource, ctx };
  };
  return { make, count: () => made };
}

const palette = { r: "#ff0000", b: "#0000ff" };
const arrow = sprite(["r.", "rb"]);

describe("createSpriteCache", () => {
  it("paints each coloured pixel and skips transparent ones", () => {
    const { make } = fakeMaker();
    const image = createSpriteCache(palette, make)(arrow, false) as unknown as FakeCanvas;
    expect(Object.fromEntries(image.pixels)).toEqual({
      "0,0": "#ff0000",
      "0,1": "#ff0000",
      "1,1": "#0000ff",
    });
  });

  it("mirrors a flipped sprite", () => {
    const { make } = fakeMaker();
    const image = createSpriteCache(palette, make)(arrow, true) as unknown as FakeCanvas;
    expect(Object.fromEntries(image.pixels)).toEqual({
      "1,0": "#ff0000",
      "1,1": "#ff0000",
      "0,1": "#0000ff",
    });
  });

  it("paints each sprite once per direction", () => {
    const { make, count } = fakeMaker();
    const image = createSpriteCache(palette, make);
    const a = image(arrow, false);
    expect(image(arrow, false)).toBe(a);
    image(arrow, true);
    image(arrow, true);
    expect(count()).toBe(2);
  });
});
