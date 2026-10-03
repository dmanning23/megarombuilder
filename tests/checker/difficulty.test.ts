import { describe, expect, it } from "vitest";
import { difficulty } from "@/checker/difficulty";
import type { Zone } from "@/model/schema";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, thing, type ZoneArt } from "../runtime/helpers";

const zoneOf = (art: ZoneArt): Zone => projectFromArt([art]).levels[0].zones[0];
const score = (art: ZoneArt, jumps = 0) => difficulty(zoneOf(art), testPack, jumps);

describe("difficulty", () => {
  it("rates an empty flat zone 1", () => {
    expect(score({ art: flatArt() })).toBe(1);
  });

  it("rises with enemies, weighted by type", () => {
    const walkers = score({ art: flatArt(), things: [thing("walker", 4, 12), thing("walker", 8, 12)] });
    const shielded = score({ art: flatArt(), things: [thing("shielded", 4, 12), thing("shielded", 8, 12)] });
    expect(walkers).toBe(4);
    expect(shielded).toBe(7);
  });

  it("spreads enemies over the zone's screens", () => {
    const things = [thing("walker", 4, 12), thing("walker", 8, 12)];
    expect(score({ art: flatArt({}, 2), things })).toBe(3);
  });

  it("rises with spikes and pits", () => {
    expect(score({ art: flatArt({ 13: "####^^^^########" }) })).toBe(2);
    const row = "####....########";
    expect(score({ art: flatArt({ 13: row, 14: row }) })).toBe(5);
  });

  it("rises with the jumps the route needs", () => {
    expect(score({ art: flatArt() }, 4)).toBe(3);
  });

  it("falls with health pickups but never below 1", () => {
    expect(score({ art: flatArt(), things: [thing("walker", 4, 12), thing("health", 6, 12)] })).toBe(2);
    expect(score({ art: flatArt(), things: [thing("health", 6, 12)] })).toBe(1);
  });

  it("never goes above 10", () => {
    const things = Array.from({ length: 12 }, (_, i) => thing("shielded", i + 2, 12));
    expect(score({ art: flatArt(), things }, 20)).toBe(10);
  });
});
