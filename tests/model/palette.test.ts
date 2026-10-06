import { describe, expect, it } from "vitest";
import { nearestColour, PALETTE_8BIT } from "@/model/palette";

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
