import { describe, expect, it } from "vitest";
import { moveEdge, pickEdge, shotYAt } from "@/editor/hero/hitbox";

const body = { x: 2, y: 4, w: 10, h: 12 }; // columns 2..11, rows 4..15
const limits = { canvas: { w: 16, h: 20 }, maxW: null, maxH: null };

describe("pickEdge", () => {
  it("grabs the edge nearest the press", () => {
    expect(pickEdge(body, { x: 2, y: 9 })).toBe("left");
    expect(pickEdge(body, { x: 12, y: 9 })).toBe("right");
    expect(pickEdge(body, { x: 6, y: 3 })).toBe("top");
    expect(pickEdge(body, { x: 6, y: 15 })).toBe("bottom");
  });
});

describe("moveEdge", () => {
  it("moves one edge to the pixel, keeping the others", () => {
    expect(moveEdge(body, "right", { x: 13, y: 0 }, limits)).toEqual({ x: 2, y: 4, w: 12, h: 12 });
    expect(moveEdge(body, "top", { x: 0, y: 1 }, limits)).toEqual({ x: 2, y: 1, w: 10, h: 15 });
  });

  it("stops at the canvas and at four pixels across, never flipping", () => {
    expect(moveEdge(body, "left", { x: -5, y: 0 }, limits)).toEqual({ x: 0, y: 4, w: 12, h: 12 });
    expect(moveEdge(body, "left", { x: 15, y: 0 }, limits)).toEqual({ x: 8, y: 4, w: 4, h: 12 });
    expect(moveEdge(body, "bottom", { x: 0, y: 99 }, limits)).toEqual({ x: 2, y: 4, w: 10, h: 16 });
    expect(moveEdge(body, "bottom", { x: 0, y: 0 }, limits)).toEqual({ x: 2, y: 4, w: 10, h: 4 });
  });

  it("stops at the hero's limits", () => {
    const hero = { canvas: { w: 32, h: 32 }, maxW: 16, maxH: 30 };
    expect(moveEdge({ x: 4, y: 4, w: 14, h: 22 }, "top", { x: 0, y: 0 }, hero)).toEqual({ x: 4, y: 0, w: 14, h: 26 });
    expect(moveEdge({ x: 4, y: 2, w: 14, h: 26 }, "top", { x: 0, y: -9 }, { ...hero, canvas: { w: 32, h: 40 } }).h).toBeLessThanOrEqual(30);
    expect(moveEdge({ x: 4, y: 4, w: 14, h: 22 }, "right", { x: 31, y: 0 }, hero)).toEqual({ x: 4, y: 4, w: 16, h: 22 });
  });
});

describe("shotYAt", () => {
  it("puts the shot at the pressed row, inside the hitbox", () => {
    expect(shotYAt(body, { x: 0, y: 9 }, 4)).toBe(5);
    expect(shotYAt(body, { x: 0, y: 0 }, 4)).toBe(0);
    expect(shotYAt(body, { x: 0, y: 99 }, 4)).toBe(8); // 12 high, a 4-high shot: 8 at most
  });
});

describe("a hitbox for something that shoots", () => {
  it("never gets shorter than its shot", () => {
    const turret = { canvas: { w: 16, h: 16 }, maxW: null, maxH: null, minH: 6 };
    expect(moveEdge({ x: 1, y: 2, w: 14, h: 14 }, "top", { x: 0, y: 15 }, turret)).toEqual({ x: 1, y: 10, w: 14, h: 6 });
  });
});
