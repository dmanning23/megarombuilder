import { describe, expect, it } from "vitest";
import {
  abilitiesFromSettings,
  abilitiesSchema,
  DEFAULT_ABILITIES,
  HERO_PICTURES,
  heroPhysics,
  PICTURE_SIZES,
  pictureProblems,
  pictureRows,
  withPicture,
  type HeroLook,
} from "@/model/hero";
import { lookProblems as anyLookProblems, lookSchema as heroLookSchema } from "@/model/look";
import { heroLookFrom } from "@/model/lookUpgrade";
import { DEFAULT_PLAYER } from "@/model/schema";

const lookProblems = (look: HeroLook) => anyLookProblems("hero", look, "The hero");

const solid = (w: number, h: number, ch = "1") => Array.from({ length: h }, () => ch.repeat(w));

function look(): HeroLook {
  const rows = (p: (typeof HERO_PICTURES)[number]) => solid(PICTURE_SIZES[p].w, PICTURE_SIZES[p].h);
  return heroLookFrom({
    colours: [13, 27],
    poses: {
      stand: rows("stand"), standShoot: rows("standShoot"), run1: rows("run1"), run2: rows("run2"),
      jump: rows("jump"), jumpShoot: rows("jumpShoot"), climb: rows("climb"), hurt: rows("hurt"),
      slide: rows("slide"),
    },
    shot: rows("shot"),
    chargedShot: rows("chargedShot"),
  });
}

describe("heroPhysics", () => {
  it("gives milestone 1's numbers for normal abilities", () => {
    expect(heroPhysics(DEFAULT_ABILITIES)).toEqual(DEFAULT_PLAYER);
  });

  it("turns each step into its value", () => {
    const at = (changes: Partial<typeof DEFAULT_ABILITIES>) => heroPhysics({ ...DEFAULT_ABILITIES, ...changes });
    expect([at({ speed: "fast" }).runSpeed, at({ speed: "veryFast" }).runSpeed]).toEqual([1.625, 1.875]);
    expect([at({ jump: "low" }), at({ jump: "high" }), at({ jump: "veryHigh" })].map((p) => p.jumpVelocity)).toEqual([
      4.375, 5.375, 6.125,
    ]);
    expect([at({ health: "fragile" }).maxHealth, at({ health: "tough" }).maxHealth]).toEqual([20, 40]);
    expect([1, 2, 5].map((shots) => at({ shots: shots as 1 | 2 | 5 }).maxShots)).toEqual([1, 2, 5]);
  });

  it("keeps gravity, falling and climbing as they were", () => {
    const fast = heroPhysics({ ...DEFAULT_ABILITIES, speed: "veryFast", jump: "veryHigh" });
    expect([fast.gravity, fast.maxFallSpeed, fast.ladderSpeed]).toEqual([0.25, 7, 1.25]);
  });
});

describe("abilitiesSchema", () => {
  it("accepts only the named steps", () => {
    expect(abilitiesSchema.safeParse(DEFAULT_ABILITIES).success).toBe(true);
    expect(abilitiesSchema.safeParse({ ...DEFAULT_ABILITIES, jump: "huge" }).success).toBe(false);
    expect(abilitiesSchema.safeParse({ ...DEFAULT_ABILITIES, shots: 4 }).success).toBe(false);
  });
});

describe("abilitiesFromSettings", () => {
  it("maps milestone 1's numbers to normal", () => {
    expect(abilitiesFromSettings(DEFAULT_PLAYER)).toEqual(DEFAULT_ABILITIES);
  });

  it("maps other numbers to the nearest step, and anything unreadable to normal", () => {
    expect(abilitiesFromSettings({ ...DEFAULT_PLAYER, runSpeed: 2, jumpVelocity: 6, maxHealth: 35, maxShots: 5 })).toEqual({
      ...DEFAULT_ABILITIES,
      speed: "veryFast",
      jump: "veryHigh",
      health: "tough",
      shots: 5,
    });
    expect(abilitiesFromSettings(undefined)).toEqual(DEFAULT_ABILITIES);
    expect(abilitiesFromSettings({ runSpeed: "fast" })).toEqual(DEFAULT_ABILITIES);
  });
});

describe("hero looks", () => {
  it("accepts a complete look", () => {
    expect(heroLookSchema.safeParse(look()).success).toBe(true);
    expect(lookProblems(look())).toEqual([]);
  });

  it("refuses colours outside the palette, and too many colours", () => {
    expect(heroLookSchema.safeParse({ ...look(), colours: [55] }).success).toBe(false);
    expect(heroLookSchema.safeParse({ ...look(), colours: Array.from({ length: 17 }, (_, i) => i) }).success).toBe(false);
    expect(heroLookSchema.safeParse({ ...look(), colours: [] }).success).toBe(false);
  });

  it("names pictures of the wrong size", () => {
    const bad = withPicture(look(), "run1", solid(16, 23));
    expect(lookProblems(bad)).toEqual(["The hero's Run frame 1 is not 16 by 24 pixels."]);
    const ragged = withPicture(look(), "shot", ["111111", "11111", "111111", "111111"]);
    expect(lookProblems(ragged)).toEqual(["The hero's Shot frame 1 is not 6 by 4 pixels."]);
  });

  it("names pixels that use a colour the hero does not have", () => {
    const bad = withPicture(look(), "slide", solid(24, 16, "3"));
    expect(lookProblems(bad)).toEqual(["The hero's Slide frame 1 uses colour 3, but the hero only has 2 colours."]);
    const odd = withPicture(look(), "stand", solid(16, 24, "x"));
    expect(lookProblems(odd)).toEqual(['The hero\'s Stand frame 1 has a pixel "x" that is not a colour.']);
  });

  it("checks one picture on its own", () => {
    const bad = withPicture(withPicture(look(), "standShoot", solid(16, 23)), "stand", solid(16, 24));
    expect(pictureProblems(bad, "stand")).toEqual([]);
    expect(pictureProblems(bad, "standShoot")).toEqual(["Stand and shoot is 16 by 23 pixels, not 16 by 24."]);
  });

  it("reads and replaces any picture", () => {
    const changed = withPicture(look(), "chargedShot", solid(12, 10, "2"));
    expect(pictureRows(changed, "chargedShot")[0]).toBe("222222222222");
    expect(pictureRows(changed, "stand")).toEqual(pictureRows(look(), "stand"));
    expect(pictureRows(withPicture(look(), "climb", solid(16, 24, ".")), "climb")[0]).toBe("................");
  });
});
