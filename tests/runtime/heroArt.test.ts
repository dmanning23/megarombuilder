import { describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { HERO_POSES, PICTURE_SIZES, pictureRows } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import { sprite } from "@/runtime/render/art";
import { heroArt } from "@/runtime/render/heroArt";
import { heroLookFrom } from "@/model/lookUpgrade";
import { testOldHero } from "../fixtures/testPack";

describe("heroArt", () => {
  const art = heroArt(snowHero);

  it("names each colour slot by its digit", () => {
    expect(art.palette).toEqual(
      Object.fromEntries(snowHero.colours.map((colour, i) => [String(i + 1), PALETTE_8BIT[colour]])),
    );
  });

  it("makes a sprite of every pose and both shots, at their sizes", () => {
    for (const pose of HERO_POSES) {
      expect(art.poses[pose].rows, pose).toEqual(pictureRows(snowHero, pose));
      expect([art.poses[pose].w, art.poses[pose].h]).toEqual([PICTURE_SIZES[pose].w, PICTURE_SIZES[pose].h]);
    }
    expect(art.shot.rows).toEqual(pictureRows(snowHero, "shot"));
    expect([art.chargedShot.w, art.chargedShot.h]).toEqual([12, 10]);
  });

  it("has a white flash palette for every colour", () => {
    expect(Object.keys(art.flashPalette)).toEqual(Object.keys(art.palette));
    expect(new Set(Object.values(art.flashPalette))).toEqual(new Set(["#fcfcfc"]));
  });
  it("draws an upgraded hero exactly as the old pictures", () => {
    const art = heroArt(heroLookFrom(testOldHero));
    for (const pose of HERO_POSES) expect(art.poses[pose], pose).toEqual(sprite(testOldHero.poses[pose]));
    expect(art.shot).toEqual(sprite(testOldHero.shot));
    expect(art.chargedShot).toEqual(sprite(testOldHero.chargedShot));
  });

  it("names hero colour slots 10 to 16 by their letters", () => {
    const art16 = heroArt({ ...snowHero, colours: Array.from({ length: 16 }, (_, i) => i) });
    expect(art16.palette.a).toBe(PALETTE_8BIT[9]);
    expect(art16.flashPalette.g).toBeDefined();
  });
});
