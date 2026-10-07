import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { SNOW_PALETTE } from "@/content/snow/palette";
import { DESIGN_BODIES, designFrames, ENEMY_BEHAVIOURS, lettersToLook } from "@/model/designs";
import { HERO_PICTURE_SLOTS, HERO_POSES } from "@/model/hero";
import { lookProblems } from "@/model/look";
import { designLookFrom, heroLookFrom, type OldHeroLook } from "@/model/lookUpgrade";
import { bodySize } from "@/runtime/sim/entities/spawn";

const fill = (w: number, h: number, ch: string) => Array.from({ length: h }, () => ch.repeat(w));

function oldHero(): OldHeroLook {
  const poses = Object.fromEntries(HERO_POSES.map((pose, i) => [pose, pose === "slide" ? fill(24, 16, "1") : fill(16, 24, String((i % 8) + 1))]));
  return { colours: [0, 1, 2, 3, 4, 5, 6, 7], poses: poses as OldHeroLook["poses"], shot: fill(6, 4, "1"), chargedShot: fill(12, 10, "2") };
}

describe("heroLookFrom", () => {
  it("makes a valid hero look with today's sizes, bodies and shot point", () => {
    const look = heroLookFrom(oldHero());
    expect(lookProblems("hero", look, "The hero")).toEqual([]);
    expect(look.canvases).toEqual({ main: { w: 16, h: 24 }, slide: { w: 24, h: 16 }, shot: { w: 6, h: 4 }, chargedShot: { w: 12, h: 10 } });
    expect(look.body).toEqual({ x: 1, y: 2, w: 14, h: 22 });
    expect(look.slideBody).toEqual({ x: 5, y: 2, w: 14, h: 14 });
    expect(look.shotY).toBe(8);
  });

  it("puts each old picture where the hero's pictures are read from", () => {
    const old = oldHero();
    const look = heroLookFrom(old);
    expect(look.animations.run.frames).toEqual([old.poses.run1, old.poses.run2]);
    expect(look.animations.runShoot.frames).toEqual([old.poses.run1, old.poses.run2]);
    for (const [picture, slot] of Object.entries(HERO_PICTURE_SLOTS)) {
      const expected = picture === "shot" ? old.shot : picture === "chargedShot" ? old.chargedShot : old.poses[picture as keyof OldHeroLook["poses"]];
      expect(look.animations[slot.animation].frames[slot.frame], picture).toEqual(expected);
      expect(look.animations[slot.animation].speed).toBe("normal");
    }
  });
});

describe("designLookFrom", () => {
  it("gives every behaviour a valid look whose frames read back in the old order", () => {
    for (const behaviour of ENEMY_BEHAVIOURS) {
      const old = { colours: [13], frames: [fill(16, 16, "1"), fill(16, 16, ".")] };
      const look = designLookFrom(behaviour, old);
      expect(lookProblems(behaviour, look, behaviour), behaviour).toEqual([]);
      expect(designFrames(behaviour, look), behaviour).toEqual(old.frames);
    }
  });

  it("gives bodies the game's sizes for each behaviour, centred with their feet on the bottom", () => {
    for (const behaviour of ENEMY_BEHAVIOURS) {
      const { w, h } = bodySize(behaviour);
      expect(DESIGN_BODIES[behaviour], behaviour).toEqual({ x: (16 - w) / 2, y: 16 - h, w, h });
    }
    expect(DESIGN_BODIES.boss).toEqual({ x: 0, y: 0, w: 24, h: 28 });
  });

  it("turns the Blizzard Bot into a boss look with stand, jump and attack", () => {
    const old = lettersToLook(snowArt.things.boss.map((s) => s.rows), SNOW_PALETTE);
    const look = designLookFrom("boss", old);
    expect(lookProblems("boss", look, "Blizzard Bot")).toEqual([]);
    expect(designFrames("boss", look)).toEqual(old.frames);
    expect(look.shotY).toBe(11);
  });
});

describe("pictureRows on a hero whose run has one frame", () => {
  it("reads run2 as the run's only frame", async () => {
    const { pictureRows } = await import("@/model/hero");
    const look = heroLookFrom(oldHero());
    const oneFrame = { ...look, animations: { ...look.animations, run: { frames: [look.animations.run.frames[0]], speed: "normal" as const } } };
    expect(pictureRows(oneFrame, "run2")).toEqual(look.animations.run.frames[0]);
  });
});
