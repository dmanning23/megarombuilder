import { DEFAULT_PLAYER } from "@/model/schema";
import { describe, expect, it } from "vitest";
import { findPassage } from "@/checker/passage";
import { createProbe } from "@/checker/probe";
import { jumpReach, stuckReason } from "@/checker/reasons";
import type { Zone } from "@/model/schema";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, type ZoneArt } from "../runtime/helpers";

const zoneOf = (art: ZoneArt): Zone => projectFromArt([art]).levels[0].zones[0];
const settings = DEFAULT_PLAYER;

function reasonFor(art: ZoneArt): string {
  const zone = zoneOf(art);
  const found = findPassage(zone, testPack, settings);
  if (found.passable || !found.furthest) throw new Error("expected a zone the player gets stuck in");
  return stuckReason(createProbe(zone, testPack, settings), found.furthest, settings);
}

describe("jumpReach", () => {
  it("matches the default player's jump", () => {
    expect(jumpReach(settings)).toEqual({ height: 45.125, distance: 52.25 });
  });

  it("follows the settings", () => {
    expect(jumpReach({ ...settings, jumpVelocity: 6.875 }).height).toBeGreaterThan(80);
  });
});

describe("stuckReason", () => {
  it("names a gap, where it is, and how far the player can jump", () => {
    const row = "######....######";
    expect(reasonFor({ art: flatArt({ 13: row, 14: row }) })).toBe(
      "Cannot get past column 5: a gap 4 tiles wide at column 6, and the longest gap the player can clear on flat ground is about 3 tiles.",
    );
  });

  it("calls a pit full of spikes a spike pit", () => {
    expect(reasonFor({ art: flatArt({ 13: "####^^^^^#######" }) })).toBe(
      "Cannot get past column 3: a spike pit 5 tiles wide at column 4, and the longest gap the player can clear on flat ground is about 3 tiles.",
    );
  });

  it("names a wall and how high the player can jump", () => {
    const wall: Record<number, string> = {};
    for (let y = 10; y <= 12; y++) wall[y] = "........########";
    expect(reasonFor({ art: flatArt(wall), exit: { edge: "right", from: 6, to: 9 } })).toBe(
      "Cannot get past column 7: a wall 3 tiles high at column 8, and the highest jump is about 2 tiles.",
    );
  });

  it("says how far the player gets toward a top exit", () => {
    expect(reasonFor({ art: flatArt(), exit: { edge: "top", from: 4, to: 5 } })).toMatch(
      /^Cannot reach the exit at the top\. The player gets as far as column \d+, row 12\.$/,
    );
  });
});
