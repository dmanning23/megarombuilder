import { describe, expect, it } from "vitest";
import { findPassage, type Passage } from "@/checker/passage";
import { createProbe, leftZone, reset } from "@/checker/probe";
import type { Zone } from "@/model/schema";
import { step } from "@/runtime/sim/step";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, type ZoneArt } from "../runtime/helpers";

const zoneOf = (art: ZoneArt): Zone => projectFromArt([art]).levels[0].zones[0];
const settings = projectFromArt([{ art: flatArt() }]).player;
const passage = (art: ZoneArt): Passage => findPassage(zoneOf(art), testPack, settings);

// Replays a passage's route in a fresh probe and reports whether it leaves by the exit.
function replays(art: ZoneArt, found: Passage): boolean {
  const probe = createProbe(zoneOf(art), testPack, settings);
  if (!found.start) return false;
  reset(probe, found.start);
  for (const input of found.route) {
    step(probe.sim, input);
    if (leftZone(probe.sim)) return true;
  }
  return false;
}

// A floor with the given columns removed (a pit).
const pit = (from: number, width: number, screens = 1) => {
  const row = [...("#".repeat(16 * screens))].map((c, x) => (x >= from && x < from + width ? "." : c)).join("");
  return flatArt({ 13: row, 14: row }, screens);
};

// A wall of the given height (in tiles) standing on the floor from column `from` to the end.
const wall = (from: number, height: number) => {
  const overrides: Record<number, string> = {};
  for (let y = 13 - height; y < 13; y++) overrides[y] = ".".repeat(from) + "#".repeat(16 - from);
  return overrides;
};

describe("findPassage on flat ground", () => {
  it("crosses an empty zone without jumping, with a route that replays", () => {
    const art = { art: flatArt() };
    const found = passage(art);
    expect(found.passable).toBe(true);
    expect(found.jumps).toBe(0);
    expect(found.route.length).toBeGreaterThan(0);
    expect(replays(art, found)).toBe(true);
  });

  it("crosses a long zone", () => {
    expect(passage({ art: flatArt({}, 3) }).passable).toBe(true);
  });

  it("crosses ice", () => {
    expect(passage({ art: flatArt({ 13: "~".repeat(16) }) }).passable).toBe(true);
  });
});

describe("findPassage over gaps", () => {
  it("jumps a three-tile gap, and the route replays", () => {
    const art = { art: pit(6, 3) };
    const found = passage(art);
    expect(found.passable).toBe(true);
    expect(found.jumps).toBe(1);
    expect(replays(art, found)).toBe(true);
  });

  it("cannot cross a four-tile gap", () => {
    const found = passage({ art: pit(6, 4) });
    expect(found.passable).toBe(false);
    expect(found.furthest?.x).toBeLessThan(6 * 16);
  });

  it("jumps a single spike tile but not a five-wide spike floor", () => {
    expect(passage({ art: flatArt({ 13: "######^#########" }) }).passable).toBe(true);
    expect(passage({ art: flatArt({ 13: "####^^^^^#######" }) }).passable).toBe(false);
  });
});

describe("findPassage over walls", () => {
  const exitAbove = { edge: "right" as const, from: 6, to: 9 };

  it("climbs a two-tile wall", () => {
    const art = { art: flatArt(wall(8, 2)), exit: { edge: "right" as const, from: 7, to: 10 } };
    const found = passage(art);
    expect(found.passable).toBe(true);
    expect(replays(art, found)).toBe(true);
  });

  it("cannot climb a three-tile wall", () => {
    expect(passage({ art: flatArt(wall(8, 3)), exit: exitAbove }).passable).toBe(false);
  });

  it("explores what it can reach and no more", () => {
    const found = passage({ art: flatArt(wall(8, 3)), exit: exitAbove });
    expect(found.explored).toBeGreaterThan(1);
    expect(found.explored).toBeLessThan(200);
  });
});
