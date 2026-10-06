import { DEFAULT_PLAYER } from "@/model/schema";
import { describe, expect, it } from "vitest";
import { findPassage, type Passage } from "@/checker/passage";
import { createProbe, leftZone, reset } from "@/checker/probe";
import type { Zone } from "@/model/schema";
import { step } from "@/runtime/sim/step";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith, thing, type ZoneArt } from "../runtime/helpers";

const zoneOf = (art: ZoneArt): Zone => projectFromArt([art]).levels[0].zones[0];
const settings = DEFAULT_PLAYER;
const passage = (art: ZoneArt): Passage => findPassage(zoneOf(art), testPack, settings);

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

// A ladder in `col` from row `top` down to the floor.
function ladder(col: number, top: number) {
  const overrides: Record<number, string> = {};
  for (let y = top; y <= 12; y++) overrides[y] = rowWith({ [col]: "H" });
  return overrides;
}

describe("ladders", () => {
  it("climbs a ladder to a top exit, and the route replays", () => {
    const art = { art: flatArt(ladder(4, 0)), exit: { edge: "top" as const, from: 4, to: 5 } };
    const found = passage(art);
    expect(found.passable).toBe(true);
    expect(found.moves).toContain("climb up");
    expect(replays(art, found)).toBe(true);
  });

  it("cannot leave by the top without a ladder", () => {
    expect(passage({ art: flatArt(), exit: { edge: "top", from: 4, to: 5 } }).passable).toBe(false);
  });

  it("climbs a vertical shaft from a bottom entry to a right exit near the top", () => {
    const art = Array.from({ length: 30 }, (_, y) =>
      y === 4 ? "........########" : y > 4 ? rowWith({ 7: "H" }) : rowWith({}),
    );
    const found = passage({
      art,
      entry: { edge: "bottom", from: 7, to: 8 },
      exit: { edge: "right", from: 0, to: 3 },
    });
    expect(found.passable).toBe(true);
  });

  it("reports a bottom entry with nothing to stand on as impassable without a crash", () => {
    const art = Array.from({ length: 30 }, () => rowWith({}));
    const found = passage({ art, entry: { edge: "bottom", from: 7, to: 8 }, exit: { edge: "top", from: 7, to: 8 } });
    expect(found.passable).toBe(false);
    expect(found.furthest).toBeNull();
  });
});

describe("ledges and platforms", () => {
  // A wall four tiles high from column 8, too tall to jump straight up.
  const tall: Record<number, string> = {};
  for (let y = 9; y <= 12; y++) tall[y] = "........########";
  const exitAbove = { edge: "right" as const, from: 5, to: 8 };

  it("cannot climb a four-tile wall unaided", () => {
    expect(passage({ art: flatArt(tall), exit: exitAbove }).passable).toBe(false);
  });

  it("climbs it using a one-way ledge as a step", () => {
    const art = flatArt({ ...tall, 11: ".....==.########" });
    const found = passage({ art, exit: exitAbove });
    expect(found.passable).toBe(true);
    expect(replays({ art, exit: exitAbove }, found)).toBe(true);
  });

  it("treats a moving platform's path as somewhere to stand", () => {
    const row = "###......#######";
    const art = flatArt({ 13: row, 14: row });
    expect(passage({ art }).passable).toBe(false);
    const withPlatform = { art, things: [thing("platform", 3, 11, { axis: "x", distance: 4 })] };
    expect(passage(withPlatform).passable).toBe(true);
  });

  it("ignores enemies", () => {
    const things = [thing("walker", 5, 12), thing("turret", 8, 12), thing("boss", 11, 12)];
    expect(passage({ art: flatArt(), things }).passable).toBe(true);
  });
});

describe("other exits", () => {
  it("drops through a hole to a bottom exit", () => {
    const row = "#####..#########";
    const found = passage({
      art: flatArt({ 13: row, 14: row }),
      exit: { edge: "bottom", from: 5, to: 6 },
    });
    expect(found.passable).toBe(true);
  });

  it("counts a zone with no exit as passable when the player can stand at the start", () => {
    const found = passage({ art: flatArt(), exit: null });
    expect(found.passable).toBe(true);
  });

  it("reports a blocked right exit as impassable", () => {
    expect(passage({ art: flatArt(), exit: { edge: "right", from: 0, to: 3 } }).passable).toBe(false);
  });
});
