import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { GROUND, snowPack } from "@/content/snow/pack";
import { artProblems } from "@/runtime/render/art";

describe("the snow art", () => {
  it("covers every tile, thing and pose in the snow pack, with no broken sprites", () => {
    expect(artProblems(snowArt, snowPack)).toEqual([]);
  });

  it("caps ground tiles in both looks", () => {
    expect(snowArt.tiles.outdoor[GROUND].top).toBeDefined();
    expect(snowArt.tiles.cave[GROUND].top).toBeDefined();
    expect(snowArt.tiles.outdoor[GROUND].top).not.toEqual(snowArt.tiles.outdoor[GROUND].fill);
  });

  it("animates walkers and flyers with two frames, and gives the boss three", () => {
    expect(snowArt.things.walker).toHaveLength(2);
    expect(snowArt.things.flyer).toHaveLength(2);
    expect(snowArt.things.boss).toHaveLength(3);
  });

  it("draws the boss at the size of its box", () => {
    for (const frame of snowArt.things.boss) expect([frame.w, frame.h]).toEqual([24, 28]);
  });

  it("gives every player pose something to see", () => {
    for (const pose of Object.values(snowArt.player)) {
      expect(pose.rows.join("").replace(/\./g, "").length).toBeGreaterThan(50);
    }
  });
});
