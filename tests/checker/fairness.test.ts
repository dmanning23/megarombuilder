import { DEFAULT_PLAYER } from "@/model/schema";
import { describe, expect, it } from "vitest";
import { checkZone } from "@/checker/check";
import { findPassage, type Passage } from "@/checker/passage";
import type { Zone } from "@/model/schema";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith, type ZoneArt } from "../runtime/helpers";

const zoneOf = (art: ZoneArt): Zone => projectFromArt([art]).levels[0].zones[0];
const settings = DEFAULT_PLAYER;
const passage = (art: ZoneArt): Passage => findPassage(zoneOf(art), testPack, settings);

// Two screens: floor standing on row `near` before the gap and on row `far` after it.
function stepGap(start: number, width: number, near: number, far: number): ZoneArt {
  const top = (x: number) => (x < start ? near : x >= start + width ? far : 99);
  const art = Array.from({ length: 15 }, (_, y) =>
    Array.from({ length: 32 }, (_, x) => (y >= top(x) ? "#" : ".")).join(""),
  );
  return {
    art,
    entry: { edge: "left", from: near - 4, to: near - 1 },
    exit: { edge: "right", from: far - 4, to: far - 1 },
  };
}

describe("the checker's verdict does not depend on where a jump sits", () => {
  it("approves a three-tile gap up one tile wherever it is", () => {
    const failed = [];
    for (let c = 3; c <= 20; c++) if (!passage(stepGap(c, 3, 13, 12)).passable) failed.push(c);
    expect(failed).toEqual([]);
  });

  it("approves a four-tile gap jumped down from three tiles higher wherever it is", () => {
    const failed = [];
    for (let c = 3; c <= 20; c++) if (!passage(stepGap(c, 4, 10, 13)).passable) failed.push(c);
    expect(failed).toEqual([]);
  });

  it("still rejects a flat four-tile gap wherever it is", () => {
    const passed = [];
    for (let c = 3; c <= 20; c++) if (passage(stepGap(c, 4, 13, 13)).passable) passed.push(c);
    expect(passed).toEqual([]);
  });
});

describe("routes the checker used to miss", () => {
  it("jumps to grab a ladder that ends above the floor", () => {
    const overrides: Record<number, string> = {};
    for (let y = 0; y <= 11; y++) overrides[y] = rowWith({ 6: "H" });
    expect(passage({ art: flatArt(overrides), exit: { edge: "top", from: 6, to: 7 } }).passable).toBe(true);
  });

  it("follows a long drop down a deep shaft from a top entry", () => {
    for (const screens of [4, 6]) {
      const art = Array.from({ length: 15 * screens }, (_, y) => (y >= 15 * screens - 2 ? "#".repeat(16) : ".".repeat(16)));
      const found = passage({
        art,
        entry: { edge: "top", from: 7, to: 8 },
        exit: { edge: "right", from: 15 * screens - 6, to: 15 * screens - 3 },
      });
      expect(found.passable, `${screens} screens`).toBe(true);
    }
  });

  it("steers a fall from a top entry away from spikes", () => {
    const art = flatArt({ 13: "#####^^^^^^#####" });
    expect(passage({ art, entry: { edge: "top", from: 7, to: 7 } }).passable).toBe(true);
  });
});

describe("failure reasons point at the right place", () => {
  const check = (art: ZoneArt) => checkZone(projectFromArt([art]), "L1", "z1", testPack);

  it("measures a gap by the columns with nothing below them, however deep", () => {
    const art = Array.from({ length: 15 }, (_, y) =>
      Array.from({ length: 16 }, (_, x) => (x < 6 ? (y >= 10 ? "#" : ".") : x >= 11 ? (y >= 13 ? "#" : ".") : ".")).join(""),
    );
    const result = check({ art, entry: { edge: "left", from: 6, to: 9 } });
    expect(result.reason).toMatch(/a gap 5 tiles wide at column 6/);
  });

  it("states the longest gap the checker will accept", () => {
    const row = "######....######";
    expect(check({ art: flatArt({ 13: row, 14: row }) }).reason).toMatch(
      /the longest gap the player can clear on flat ground is about 3 tiles/,
    );
  });

  it("says where the player gets closest to a top exit", () => {
    const overrides: Record<number, string> = {};
    for (let y = 0; y <= 8; y++) overrides[y] = rowWith({ 6: "H" });
    const result = check({ art: flatArt(overrides), exit: { edge: "top", from: 6, to: 7 } });
    expect(result.passable).toBe(false);
    expect(result.reason).toMatch(/gets as far as column 6, row 12/);
  });

  it("says when the player dies as soon as they arrive", () => {
    const art = flatArt({ 11: "^^..............", 12: "^^.............." });
    const result = check({ art });
    expect(result.passable).toBe(false);
    expect(result.reason).toBe("The player dies as soon as they arrive: something deadly is at the entry.");
  });
});
