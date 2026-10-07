import { describe, expect, it } from "vitest";
import { fitBody, KINDS, lookProblems, lookSchema, slotChar, slotOf, type Look } from "@/model/look";

const fill = (w: number, h: number, ch = "1") => Array.from({ length: h }, () => ch.repeat(w));
const walker = (): Look => ({
  colours: [13],
  canvases: { main: { w: 16, h: 16 } },
  animations: { walk: { frames: [fill(16, 16), fill(16, 16)], speed: "normal" } },
  body: { x: 1, y: 2, w: 14, h: 14 },
});

describe("pixels", () => {
  it("name 16 colour slots with one character each", () => {
    expect([1, 9, 10, 16].map(slotChar)).toEqual(["1", "9", "a", "g"]);
    expect(["1", "9", "a", "g", ".", "h"].map(slotOf)).toEqual([1, 9, 10, 16, 0, 0]);
  });
});

describe("lookProblems", () => {
  it("accepts a good look", () => {
    expect(lookSchema.safeParse(walker()).success).toBe(true);
    expect(lookProblems("walker", walker(), "Frost Fang")).toEqual([]);
  });

  it("refuses a 17th colour", () => {
    expect(lookSchema.safeParse({ ...walker(), colours: Array.from({ length: 17 }, () => 1) }).success).toBe(false);
  });

  it("refuses a missing, extra or empty animation", () => {
    expect(lookProblems("walker", { ...walker(), animations: {} }, "Frost Fang")).toContain("Frost Fang has no Walk animation.");
    const extra = { ...walker(), animations: { ...walker().animations, fly: walker().animations.walk } };
    expect(lookProblems("walker", extra, "Frost Fang")).toContain('Frost Fang has an animation "fly" it can\'t use.');
    expect(lookSchema.safeParse({ ...walker(), animations: { walk: { frames: [], speed: "normal" } } }).success).toBe(false);
  });

  it("refuses frames of the wrong size and pixels naming missing colours", () => {
    const look = walker();
    look.animations.walk.frames[1] = fill(15, 16);
    expect(lookProblems("walker", look, "Frost Fang")).toContain("Frost Fang's Walk frame 2 is not 16 by 16 pixels.");
    const colourful = walker();
    colourful.animations.walk.frames[0] = fill(16, 16, "a");
    expect(lookProblems("walker", colourful, "Frost Fang")).toContain(
      "Frost Fang's Walk frame 1 uses colour 10, but Frost Fang only has 1 colour.",
    );
  });

  it("refuses canvases outside the limits, or odd sizes", () => {
    const look = walker();
    look.canvases.main = { w: 34, h: 16 };
    look.animations.walk.frames = [fill(34, 16)];
    expect(lookProblems("walker", look, "Frost Fang")).toContain("Frost Fang's canvas is 34 by 16; it can be 8 to 32 wide and 8 to 32 tall.");
    look.canvases.main = { w: 15, h: 16 };
    look.animations.walk.frames = [fill(15, 16)];
    expect(lookProblems("walker", look, "Frost Fang")).toContain("Frost Fang's canvas is 15 by 16; its sides must be even.");
  });

  it("refuses a body outside its canvas, a shot point on a walker, and a hero too tall for the level pieces", () => {
    expect(lookProblems("walker", { ...walker(), body: { x: 4, y: 4, w: 14, h: 14 } }, "Frost Fang")).toContain(
      "Frost Fang's hitbox doesn't fit inside its canvas.",
    );
    expect(lookProblems("walker", { ...walker(), shotY: 3 }, "Frost Fang")).toContain("Frost Fang doesn't shoot, so it can't have a shot point.");
    expect(KINDS.hero.canvases.main.max.h).toBe(32);
  });
});

describe("fitBody", () => {
  it("fits the smallest box around the drawn pixels", () => {
    const rows = ["........", "..11....", "..11111.", "...1....", "...11...", "........"];
    expect(fitBody(rows, { w: 8, h: 6 }, null)).toEqual({ x: 2, y: 1, w: 5, h: 4 });
  });

  it("grows to 4 by 4 inside the canvas, and keeps the feet when too tall", () => {
    expect(fitBody(["......", "...1..", "......", "......"], { w: 6, h: 4 }, null)).toEqual({ x: 2, y: 0, w: 4, h: 4 });
    expect(fitBody(fill(4, 20), { w: 4, h: 20 }, 14)).toEqual({ x: 0, y: 6, w: 4, h: 14 });
  });

  it("takes the whole canvas when nothing is drawn", () => {
    expect(fitBody(fill(8, 8, "."), { w: 8, h: 8 }, 6)).toEqual({ x: 0, y: 2, w: 8, h: 6 });
  });
});
