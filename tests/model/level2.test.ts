import { describe, expect, it } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { DEFAULT_ABILITIES } from "@/model/hero";
import { ANIMATION_NAMES, KINDS, lookProblems } from "@/model/look";
import { centreRows, heroLookFrom, withLevel2Shot } from "@/model/lookUpgrade";
import { testOldHero } from "../fixtures/testPack";

describe("the level 2 shot in the model", () => {
  it("is off for a new hero, and has its own fixed picture", () => {
    expect(DEFAULT_ABILITIES.chargeLevel2).toBe(false);
    expect(KINDS.hero.animations.chargedShot2).toEqual({ body: null, min: { w: 16, h: 12 }, max: { w: 16, h: 12 } });
    expect(ANIMATION_NAMES.chargedShot2).toBe("Level 2 shot");
    expect(Object.keys(KINDS.hero.animations).slice(-2)).toEqual(["chargedShot", "chargedShot2"]);
  });

  it("centres a picture on a bigger canvas", () => {
    expect(centreRows(["11", "22"], 4, 4)).toEqual(["....", ".11.", ".22.", "...."]);
    expect(centreRows(["1"], 4, 3)).toEqual(["....", ".1..", "...."]);
  });

  it("starts an older hero's Level 2 shot as its own Charged shot, centred, exactly once", () => {
    const look = heroLookFrom(testOldHero);
    const charged = look.animations.chargedShot;
    expect(look.animations.chargedShot2).toEqual({
      frames: charged.frames.map((rows) => centreRows(rows, 16, 12)),
      speed: charged.speed,
      size: { w: 16, h: 12 },
    });
    expect(withLevel2Shot(look)).toBe(look); // already there: left alone
    expect(lookProblems("hero", look, "The hero")).toEqual([]);
  });

  it("gives the snow hero a drawn Level 2 shot of its own", () => {
    expect(snowHero.animations.chargedShot2.frames[0]).not.toEqual(centreRows(snowHero.animations.chargedShot.frames[0], 16, 12));
    expect(lookProblems("hero", snowHero, "The hero")).toEqual([]);
  });
});
