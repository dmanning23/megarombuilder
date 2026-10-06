import { describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { HERO_POSES, PICTURE_SIZES } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import { heroArt } from "@/runtime/render/heroArt";

describe("heroArt", () => {
  const art = heroArt(snowHero);

  it("names each colour slot by its digit", () => {
    expect(art.palette).toEqual(
      Object.fromEntries(snowHero.colours.map((colour, i) => [String(i + 1), PALETTE_8BIT[colour]])),
    );
  });

  it("makes a sprite of every pose and both shots, at their sizes", () => {
    for (const pose of HERO_POSES) {
      expect(art.poses[pose].rows, pose).toEqual(snowHero.poses[pose]);
      expect([art.poses[pose].w, art.poses[pose].h]).toEqual([PICTURE_SIZES[pose].w, PICTURE_SIZES[pose].h]);
    }
    expect(art.shot.rows).toEqual(snowHero.shot);
    expect([art.chargedShot.w, art.chargedShot.h]).toEqual([12, 10]);
  });
});
