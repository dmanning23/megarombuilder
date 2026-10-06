import { describe, expect, it } from "vitest";
import { findPassage, type Passage } from "@/checker/passage";
import { createProbe, leftZone, reset } from "@/checker/probe";
import { stuckReason } from "@/checker/reasons";
import { DEFAULT_PLAYER, type PlayerSettings, type Zone } from "@/model/schema";
import { step } from "@/runtime/sim/step";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith } from "../runtime/helpers";

// A floor with a tunnel one tile high under solid ground in columns 6 to 9.
const cells = Object.fromEntries([6, 7, 8, 9].map((c) => [c, "#"]));
const art = flatArt(Object.fromEntries(Array.from({ length: 12 }, (_, y) => [y, rowWith(cells)])));
const zone: Zone = projectFromArt([{ art }]).levels[0].zones[0];
const withSlide: PlayerSettings = { ...DEFAULT_PLAYER, slide: true };

function replays(found: Passage, settings: PlayerSettings): boolean {
  const probe = createProbe(zone, testPack, settings);
  if (!found.start) return false;
  reset(probe, found.start);
  for (const input of found.route) {
    step(probe.sim, input);
    if (leftZone(probe.sim)) return true;
  }
  return false;
}

describe("the checker and slide", () => {
  it("finds a way through a crawl space only when the hero can slide", () => {
    expect(findPassage(zone, testPack, DEFAULT_PLAYER).passable).toBe(false);
    const found = findPassage(zone, testPack, withSlide);
    expect(found.passable).toBe(true);
    expect(found.moves.some((m) => m.startsWith("slide"))).toBe(true);
  });

  it("does not count a slide as a jump", () => {
    expect(findPassage(zone, testPack, withSlide).jumps).toBe(0);
  });

  it("finds a route that replays in the game", () => {
    const found = findPassage(zone, testPack, withSlide);
    expect(replays(found, withSlide)).toBe(true);
  });

  it("says why a hero without slide is stuck, and what to do", () => {
    const found = findPassage(zone, testPack, DEFAULT_PLAYER);
    const reason = stuckReason(createProbe(zone, testPack, DEFAULT_PLAYER), found.furthest!, DEFAULT_PLAYER);
    expect(reason).toBe(
      "Cannot get past column 5: the gap at column 6 is too low to walk through. Give your hero slide, or make the gap taller.",
    );
  });

  it("does not suggest slide to a hero who has it", () => {
    const blocked = flatArt({
      ...Object.fromEntries(Array.from({ length: 12 }, (_, y) => [y, rowWith(cells)])),
      12: rowWith({ 8: "#" }), // the tunnel is blocked inside
    });
    const shut: Zone = projectFromArt([{ art: blocked }]).levels[0].zones[0];
    const found = findPassage(shut, testPack, withSlide);
    expect(found.passable).toBe(false);
    const reason = stuckReason(createProbe(shut, testPack, withSlide), found.furthest!, withSlide);
    expect(reason).not.toMatch(/Give your hero slide/);
  });
});
