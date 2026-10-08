import { describe, expect, it } from "vitest";
import {
  blankRows,
  bodyBox,
  drawPicture,
  drawPixels,
  enemyBody,
  flipRows,
  floodFill,
  linePixels,
  pixelFromPointer,
  setPixels,
  ONION_ALPHA,
  ZOOM,
} from "@/editor/hero/pixels";

describe("pixel helpers", () => {
  it("make blank pictures", () => {
    expect(blankRows(3, 2)).toEqual(["...", "..."]);
  });

  it("set pixels, ignoring any outside the picture", () => {
    expect(setPixels(["...", "..."], [{ x: 1, y: 0 }, { x: 5, y: 5 }, { x: -1, y: 1 }], "2")).toEqual([".2.", "..."]);
  });

  it("join a fast drag with a line, both ends included", () => {
    expect(linePixels({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(linePixels({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([{ x: 2, y: 2 }]);
    expect(linePixels({ x: 0, y: 0 }, { x: 2, y: 4 })).toHaveLength(5);
  });

  it("fill the touching patch of one colour, not diagonally", () => {
    const rows = ["..1.", "111.", "1..."];
    expect(floodFill(rows, { x: 0, y: 0 }, "2")).toEqual(["221.", "111.", "1..."]);
    expect(floodFill(rows, { x: 3, y: 0 }, "2")).toEqual(["..12", "1112", "1222"]);
    expect(floodFill(rows, { x: 0, y: 1 }, "1")).toBe(rows); // already that colour
  });

  it("flip left to right", () => {
    expect(flipRows(["12.", ".3."])).toEqual([".21", ".3."]);
  });

  it("map a pointer to a pixel, or nothing outside", () => {
    const rect = { left: 10, top: 20, width: 16 * ZOOM, height: 24 * ZOOM };
    expect(pixelFromPointer(10 + 3 * ZOOM + 1, 20 + 5 * ZOOM + 1, rect, 16, 24)).toEqual({ x: 3, y: 5 });
    expect(pixelFromPointer(5, 25, rect, 16, 24)).toBeNull();
    expect(pixelFromPointer(10 + 16 * ZOOM, 30, rect, 16, 24)).toBeNull();
  });

  it("know where the game's body sits in each picture", () => {
    expect(bodyBox("stand")).toEqual({ x: 1, y: 2, w: 14, h: 22 });
    expect(bodyBox("slide")).toEqual({ x: 5, y: 2, w: 14, h: 14 });
    expect(bodyBox("chargedShot")).toEqual({ x: 0, y: 0, w: 12, h: 10 });
  });
});

describe("drawPicture", () => {
  function fake() {
    const rects: { colour: string; x: number; y: number; w: number; h: number }[] = [];
    return {
      rects,
      fillStyle: "" as string,
      globalAlpha: 1,
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ colour: this.fillStyle, x, y, w, h });
      },
    };
  }

  it("draws each coloured pixel big, and leaves empty ones", () => {
    const rows = blankRows(6, 4);
    rows[1] = "..1...";
    const ctx = fake();
    drawPicture(ctx, rows, { "1": "#ff0000" }, "shot");
    expect(ctx.rects).toContainEqual({ colour: "#ff0000", x: 2 * ZOOM, y: 1 * ZOOM, w: ZOOM, h: ZOOM });
    expect(ctx.rects.filter((r) => r.colour === "#ff0000")).toHaveLength(1);
  });

  it("outlines the body and draws the feet line on poses", () => {
    const ctx = fake();
    drawPicture(ctx, blankRows(16, 24), {}, "stand");
    const outline = ctx.rects.filter((r) => r.colour === "#ff2d95");
    expect(outline.some((r) => r.x === 1 * ZOOM && r.y === 2 * ZOOM && r.h === 22 * ZOOM)).toBe(true); // left side
    expect(ctx.rects.some((r) => r.colour === "#2ec4b6" && r.y === 24 * ZOOM - 3 && r.w === 16 * ZOOM)).toBe(true);
  });
});

describe("enemy pictures", () => {
  it("know where each behaviour's body sits in a 16 by 16 frame", () => {
    expect(enemyBody("walker")).toEqual({ x: 1, y: 2, w: 14, h: 14 });
    expect(enemyBody("flyer")).toEqual({ x: 1, y: 4, w: 14, h: 12 });
    expect(enemyBody("shielded")).toEqual({ x: 1, y: 0, w: 14, h: 16 });
  });

  it("are drawn at any size, with the body outline and feet line", () => {
    const rects: { colour: string; x: number; y: number; w: number; h: number }[] = [];
    const ctx = {
      fillStyle: "" as string,
      globalAlpha: 1,
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ colour: this.fillStyle, x, y, w, h });
      },
    };
    drawPixels(ctx, blankRows(16, 16), {}, { w: 16, h: 16 }, enemyBody("walker"), true);
    expect(rects.some((r) => r.colour === "#ff2d95" && r.x === 1 * ZOOM && r.y === 2 * ZOOM && r.h === 14 * ZOOM)).toBe(true);
    expect(rects.some((r) => r.colour === "#2ec4b6" && r.y === 16 * ZOOM - 3)).toBe(true);
  });
});

describe("the onion skin", () => {
  it("draws the frame underneath faintly, and the frame itself at full strength", () => {
    const fills: { colour: string; alpha: number; x: number; y: number }[] = [];
    const ctx = {
      fillStyle: "",
      globalAlpha: 1,
      fillRect(x: number, y: number) {
        fills.push({ colour: String(this.fillStyle), alpha: this.globalAlpha, x, y });
      },
    };
    drawPixels(ctx, ["1.", ".."], { "1": "#ff0000", "2": "#00ff00" }, { w: 2, h: 2 }, null, false, ["..", ".2"]);
    expect(fills).toContainEqual({ colour: "#00ff00", alpha: ONION_ALPHA, x: ZOOM, y: ZOOM });
    expect(fills).toContainEqual({ colour: "#ff0000", alpha: 1, x: 0, y: 0 });
    expect(ctx.globalAlpha).toBe(1); // put back
  });
});
