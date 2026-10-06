import { describe, expect, it } from "vitest";
import { backgroundOf, hasTransparency, importPicture, type RawImage } from "@/editor/hero/importPicture";
import { nearestColour, PALETTE_8BIT } from "@/model/palette";

type Rgba = [number, number, number, number];
const RED: Rgba = [248, 56, 0, 255]; // exactly an 8-bit colour
const BLUE: Rgba = [0, 88, 248, 255];
const WHITE: Rgba = [248, 248, 248, 255];
const CLEAR: Rgba = [0, 0, 0, 0];

// A picture from letters: each letter is a colour, "." is see-through.
function image(art: string[], colours: Record<string, Rgba> = { r: RED, b: BLUE, w: WHITE }): RawImage {
  const height = art.length;
  const width = art[0].length;
  const data: number[] = [];
  for (const row of art) for (const ch of row) data.push(...(ch === "." ? CLEAR : colours[ch]));
  return { width, height, data };
}

const solid = (w: number, h: number, ch: string) => Array.from({ length: h }, () => ch.repeat(w));
const red = nearestColour("#f83800");
const blue = nearestColour("#0058f8");
const white = nearestColour("#f8f8f8");

describe("importPicture", () => {
  it("keeps a picture the frame's size pixel for pixel, adding its colour as a new slot", () => {
    const art = solid(16, 24, ".");
    art[3] = "...rrrr.........";
    const result = importPicture(image(art), "stand", [13], false);
    expect(result.colours).toEqual([13, red]);
    expect(result.rows[3]).toBe("...2222.........");
    expect(result.rows.filter((row, y) => y !== 3).every((row) => row === "................")).toBe(true);
  });

  it("shrinks a big picture to fit, keeping its shape, with its bottom on the feet line", () => {
    const result = importPicture(image(solid(32, 32, "r")), "stand", [13], false);
    expect(result.rows.slice(0, 8).every((row) => row === "................")).toBe(true);
    expect(result.rows.slice(8).every((row) => row === "2222222222222222")).toBe(true);
    expect(result.rows).toHaveLength(24);
  });

  it("grows a small picture to fit, keeping it crisp", () => {
    const result = importPicture(image(["rr", "rb"]), "stand", [13], false);
    // 2x2 grows by 8 to 16x16, sitting on the feet line; red is used most, so it gets the first new slot
    expect(result.colours).toEqual([13, red, blue]);
    expect(result.rows[8]).toBe("2222222222222222");
    expect(result.rows[23]).toBe("2222222233333333");
  });

  it("centres a shot", () => {
    const result = importPicture(image(solid(4, 4, "r")), "shot", [13], false);
    expect(result.rows).toEqual([".2222.", ".2222.", ".2222.", ".2222."]);
  });

  it("fits a very wide picture across the frame, centred low", () => {
    const result = importPicture(image(solid(64, 4, "r")), "stand", [13], false);
    expect(result.rows.slice(0, 23).every((row) => row === "................")).toBe(true);
    expect(result.rows[23]).toBe("2222222222222222");
  });

  it("gives each pixel the colour most of its block snaps to", () => {
    const blocks = Array.from({ length: 48 }, (_, y) => (y % 2 === 0 ? "rb" : "rr").repeat(16));
    const result = importPicture(image(blocks), "stand", [13], false);
    expect(result.rows.every((row) => row === "2222222222222222")).toBe(true);
  });

  it("leaves see-through and nearly see-through pixels empty", () => {
    const art = solid(16, 24, "r");
    art[0] = "................";
    const picture = image(art, { r: RED });
    const faint = { ...picture, data: Array.from(picture.data) };
    faint.data[(1 * 16 + 0) * 4 + 3] = 100; // pixel (0, 1) is faint
    const result = importPicture(faint, "stand", [13], false);
    expect(result.rows[0]).toBe("................");
    expect(result.rows[1][0]).toBe(".");
    expect(result.rows[1][1]).toBe("2");
  });

  it("snaps colours to the nearest 8-bit colour", () => {
    const result = importPicture(image(solid(16, 24, "x"), { x: [247, 58, 2, 255] }), "stand", [13], false);
    expect(result.colours).toEqual([13, red]);
  });

  it("reuses a hero colour that is close enough", () => {
    const nearWhite = nearestColour("#fcfcfc");
    const result = importPicture(image(solid(16, 24, "w")), "stand", [13, nearWhite], false);
    expect(result.colours).toEqual([13, nearWhite]);
    expect(result.rows[0]).toBe("2222222222222222");
    expect(white).not.toBe(nearWhite);
  });

  it("never goes past eight colours, merging the rest into the nearest", () => {
    const seven = [13, 0, 1, 9, 22, 30, 40];
    const art = solid(16, 24, ".");
    art[0] = "rrrrrrrrrrrr....";
    art[1] = "bbbbbbbb........";
    art[2] = "wwww............";
    const result = importPicture(image(art), "stand", seven, false);
    expect(result.colours).toHaveLength(8);
    expect(result.colours.slice(0, 7)).toEqual(seven);
    expect(result.colours[7]).toBe(red); // the most-used new colour gets the last slot
    const used = new Set(result.rows.join("").replace(/\./g, ""));
    for (const ch of used) expect(Number(ch)).toBeLessThanOrEqual(8);
    expect(PALETTE_8BIT[result.colours[Number(result.rows[1][0]) - 1]]).toBeDefined();
  });
});

describe("backgrounds", () => {
  const framed = ["wwww", "wrrw", "wrrw", "wwww"];

  it("finds a plain background on a picture with no see-through pixels", () => {
    expect(backgroundOf(image(framed))).toEqual([248, 248, 248]);
    expect(hasTransparency(image(framed))).toBe(false);
  });

  it("finds none when corners differ, or when the picture already has see-through pixels", () => {
    expect(backgroundOf(image(["wwwr", "wrrw", "wrrw", "wwww"]))).toBeNull();
    expect(backgroundOf(image(["w..w", "wrrw", "wrrw", "wwww"]))).toBeNull();
    expect(hasTransparency(image(["w..w"]))).toBe(true);
  });

  it("removes the background when asked, and keeps it when not", () => {
    const removed = importPicture(image(framed), "shot", [13], true);
    expect(removed.rows).toEqual(["..22..", "..22..", "..22..", "..22.."].map((row, y) => (y === 0 || y === 3 ? "......" : row)));
    const kept = importPicture(image(framed), "shot", [13], false);
    expect(kept.rows[0]).toBe(".2222.");
    expect(kept.colours).toEqual([13, white, red]);
  });
});
