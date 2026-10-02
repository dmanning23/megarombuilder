import { describe, expect, it } from "vitest";
import {
  clampOpening,
  edgeLength,
  inBounds,
  rectInBounds,
  tileIndex,
  zoneSize,
} from "@/model/geometry";

describe("zoneSize", () => {
  it("makes horizontal zones 16 tiles wide per screen and 15 high", () => {
    expect(zoneSize("horizontal", 3)).toEqual({ width: 48, height: 15 });
  });

  it("makes vertical zones 16 wide and 15 tiles high per screen", () => {
    expect(zoneSize("vertical", 2)).toEqual({ width: 16, height: 30 });
  });
});

describe("bounds", () => {
  const size = { width: 16, height: 15 };

  it("accepts corners and rejects cells outside", () => {
    expect(inBounds(size, 0, 0)).toBe(true);
    expect(inBounds(size, 15, 14)).toBe(true);
    expect(inBounds(size, 16, 0)).toBe(false);
    expect(inBounds(size, 0, 15)).toBe(false);
    expect(inBounds(size, -1, 0)).toBe(false);
  });

  it("rejects fractional coordinates", () => {
    expect(inBounds(size, 1.5, 2)).toBe(false);
  });

  it("checks whole rectangles", () => {
    expect(rectInBounds(size, 14, 13, 2, 2)).toBe(true);
    expect(rectInBounds(size, 14, 13, 3, 2)).toBe(false);
    expect(rectInBounds(size, 0, 0, 0, 1)).toBe(false);
  });

  it("indexes tiles row by row", () => {
    expect(tileIndex(size, 3, 2)).toBe(35);
  });

  it("measures left and right edges by height, top and bottom by width", () => {
    const wide = { width: 48, height: 15 };
    expect(edgeLength(wide, "left")).toBe(15);
    expect(edgeLength(wide, "right")).toBe(15);
    expect(edgeLength(wide, "top")).toBe(48);
    expect(edgeLength(wide, "bottom")).toBe(48);
  });
});

describe("clampOpening", () => {
  it("leaves an opening that already fits", () => {
    expect(clampOpening({ edge: "left", from: 9, to: 12 }, 15)).toEqual({
      edge: "left",
      from: 9,
      to: 12,
    });
  });

  it("slides an opening back inside a shorter edge, keeping its length", () => {
    expect(clampOpening({ edge: "top", from: 40, to: 43 }, 32)).toEqual({
      edge: "top",
      from: 28,
      to: 31,
    });
  });

  it("slides an opening up from negative positions", () => {
    expect(clampOpening({ edge: "left", from: -3, to: 0 }, 15)).toEqual({
      edge: "left",
      from: 0,
      to: 3,
    });
  });
});
