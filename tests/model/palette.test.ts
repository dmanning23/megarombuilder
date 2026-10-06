import { describe, expect, it } from "vitest";
import { colourDistance, nearestColour, nearestIndex, PALETTE_8BIT, PALETTE_RGB } from "@/model/palette";

describe("PALETTE_8BIT", () => {
  it("has 55 different colours", () => {
    expect(PALETTE_8BIT).toHaveLength(55);
    expect(new Set(PALETTE_8BIT).size).toBe(55);
    for (const colour of PALETTE_8BIT) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("nearestColour", () => {
  it("finds a palette colour exactly", () => {
    PALETTE_8BIT.forEach((colour, i) => expect(nearestColour(colour)).toBe(i));
  });

  it("snaps other colours to the closest one", () => {
    expect(PALETTE_8BIT[nearestColour("#1a1c2c")]).toBe("#000000");
    expect(PALETTE_8BIT[nearestColour("#f4f4f4")]).toBe("#f8f8f8");
    expect(PALETTE_8BIT[nearestColour("#FF0000")]).toMatch(/^#[ef][0-9a-f]/); // a strong red
  });

  it("refuses something that is not a colour", () => {
    expect(() => nearestColour("red")).toThrow(/not a colour/);
  });
});

describe("nearestIndex and colourDistance", () => {
  it("agree with nearestColour", () => {
    expect(nearestIndex(0x1a, 0x1c, 0x2c)).toBe(nearestColour("#1a1c2c"));
    expect(PALETTE_RGB[nearestIndex(255, 0, 0)]).toEqual([...PALETTE_RGB[nearestColour("#ff0000")]]);
  });

  it("measure nothing between a colour and itself, and more for colours further apart", () => {
    expect(colourDistance([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(colourDistance([0, 0, 0], [255, 255, 255])).toBeGreaterThan(colourDistance([0, 0, 0], [40, 40, 40]));
  });
});
