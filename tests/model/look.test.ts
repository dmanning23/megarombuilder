import { describe, expect, it } from "vitest";
import { cutsDrawing, fitBody, KINDS, lookProblems, lookSchema, reframeRows, slotChar, slotOf, type Look } from "@/model/look";
import { heroLookFrom } from "@/model/lookUpgrade";
import { testOldHero } from "../fixtures/testPack";

const fill = (w: number, h: number, ch = "1") => Array.from({ length: h }, () => ch.repeat(w));
const walker = (): Look => ({
  colours: [13],
  animations: { walk: { frames: [fill(16, 16), fill(16, 16)], speed: "normal", size: { w: 16, h: 16 }, at: { x: 1, y: 2 } } },
  body: { w: 14, h: 14 },
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
    expect(lookSchema.safeParse({ ...walker(), animations: { walk: { ...walker().animations.walk, frames: [] } } }).success).toBe(false);
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
    look.animations.walk.size = { w: 34, h: 16 };
    look.animations.walk.frames = [fill(34, 16)];
    expect(lookProblems("walker", look, "Frost Fang")).toContain("Frost Fang's Walk is 34 by 16; it can be 8 to 32 wide and 8 to 32 tall.");
    look.animations.walk.size = { w: 15, h: 16 };
    look.animations.walk.frames = [fill(15, 16)];
    expect(lookProblems("walker", look, "Frost Fang")).toContain("Frost Fang's Walk is 15 by 16; its sides must be even.");
  });

  it("refuses a body outside its canvas, a shot point on a walker, and a hero too tall for the level pieces", () => {
    expect(lookProblems("walker", { ...walker(), animations: { walk: { ...walker().animations.walk, at: { x: 4, y: 4 } } } }, "Frost Fang")).toContain(
      "Frost Fang's Walk hitbox doesn't fit inside its picture.",
    );
    const shooting = walker();
    shooting.animations.walk.shotY = 3;
    expect(lookProblems("walker", shooting, "Frost Fang")).toContain("Frost Fang doesn't shoot, so it can't have a shot point.");
    expect(KINDS.hero.animations.stand.max.h).toBe(32);
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

describe("the hero's width", () => {
  it("is at most one tile standing; the sliding hitbox, whose width the game doesn't use, may be wider", () => {
    const hero = heroLookFrom(testOldHero);
    const standing = (look: Look, change: (a: Look["animations"][string]) => Look["animations"][string]): Look => ({
      ...look,
      animations: Object.fromEntries(Object.entries(look.animations).map(([name, a]) => [name, KINDS.hero.animations[name].body === "main" ? change(a) : a])),
    });
    expect(lookProblems("hero", { ...standing(hero, (a) => ({ ...a, at: { x: 0, y: 2 } })), body: { w: 16, h: 22 } }, "The hero")).toEqual([]);
    const widened = (rows: string[]) => rows.map((row) => `${row}..`);
    const wide = {
      ...standing(hero, (a) => ({ ...a, frames: a.frames.map(widened), size: { w: 18, h: 24 }, at: { x: 0, y: 2 } })),
      body: { w: 18, h: 22 },
    };
    expect(lookProblems("hero", wide, "The hero")).toContain("The hero's hitbox is 18 wide; at most 16, so it fits on a ladder beside a wall.");
    const wideSlide = { ...hero, slideBody: { w: 22, h: 14 }, animations: { ...hero.animations, slide: { ...hero.animations.slide, at: { x: 1, y: 2 } } } };
    expect(lookProblems("hero", wideSlide, "The hero")).toEqual([]);
  });
});

describe("resizing pictures", () => {
  it("pads evenly at the sides and on top, keeping the feet row", () => {
    expect(reframeRows(["11", "22"], 4, 3)).toEqual(["....", ".11.", ".22."]);
    expect(reframeRows(["1234", "5678"], 2, 1)).toEqual(["67"]);
  });

  it("knows when shrinking would cut off drawn pixels", () => {
    const look: Look = {
      colours: [13],
      animations: {
        walk: {
          frames: [Array.from({ length: 16 }, (_, y) => (y < 2 ? "................" : "....11111111....")), Array.from({ length: 16 }, () => "................")],
          speed: "normal",
          size: { w: 16, h: 16 },
          at: { x: 4, y: 2 },
        },
      },
      body: { w: 8, h: 14 },
    };
    expect(cutsDrawing(look, "walk", 8, 14)).toBe(false); // only empty columns and rows go
    expect(cutsDrawing(look, "walk", 6, 14)).toBe(true);
    expect(cutsDrawing(look, "walk", 16, 12)).toBe(true);
  });
});
