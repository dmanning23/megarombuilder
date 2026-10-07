import { describe, expect, it } from "vitest";
import { SNOW_HERO_PICTURES, snowHero } from "@/content/snow/hero";
import { snowPack } from "@/content/snow/pack";
import { HERO_PICTURES, HERO_POSES, pictureRows } from "@/model/hero";
import { lookProblems } from "@/model/look";
import { PALETTE_8BIT } from "@/model/palette";
import { testHero, testPack } from "../fixtures/testPack";

const LETTERS = ["k", "t", "T", "w", "o", "G", "y"];
const toLetters = (rows: string[]) =>
  rows.map((row) => [...row].map((ch) => (ch === "." ? "." : LETTERS[Number(ch) - 1])).join(""));

describe("the snow hero", () => {
  it("is a complete, valid hero look", () => {
    expect(lookProblems("hero", snowHero, "The hero")).toEqual([]);
  });

  it("is the snow pack's hero", () => {
    expect(snowPack.hero).toBe(snowHero);
  });

  it("keeps the snow hero's drawing, with its seven colours snapped to the 8-bit palette", () => {
    expect(snowHero.colours).toHaveLength(7);
    expect(PALETTE_8BIT[snowHero.colours[0]]).toBe("#000000"); // the outline
    expect(PALETTE_8BIT[snowHero.colours[3]]).toBe("#f8f8f8"); // the eyes
    for (const picture of HERO_PICTURES) {
      expect(toLetters(pictureRows(snowHero, picture)), picture).toEqual(SNOW_HERO_PICTURES[picture]);
    }
  });

  it("gives every pose something to see", () => {
    for (const pose of HERO_POSES) {
      expect(pictureRows(snowHero, pose).join("").replace(/\./g, "").length, pose).toBeGreaterThan(50);
    }
  });
});

describe("the test pack's hero", () => {
  it("is a valid hero look", () => {
    expect(lookProblems("hero", testHero, "The hero")).toEqual([]);
    expect(testPack.hero).toBe(testHero);
  });
});
