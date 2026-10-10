import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { SNOW_PALETTE } from "@/content/snow/palette";
import { DESIGN_BODIES, designFrames, ENEMY_BEHAVIOURS, lettersToLook } from "@/model/designs";
import { HERO_PICTURE_SLOTS, HERO_POSES } from "@/model/hero";
import { lookProblems, shotPoints } from "@/model/look";
import { designLookFrom, heroLookFrom, lookFromFormat4, type Format4Look, type OldHeroLook } from "@/model/lookUpgrade";
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
    for (const a of ["stand", "standShoot", "run", "runShoot", "jump", "jumpShoot", "climb", "hurt"]) {
      expect(look.animations[a], a).toMatchObject({ size: { w: 16, h: 24 }, at: { x: 1, y: 2 }, shotY: 8 });
    }
    expect(look.animations.slide).toMatchObject({ size: { w: 24, h: 16 }, at: { x: 5, y: 2 } });
    expect(look.animations.slide.shotY).toBeUndefined();
    expect(look.animations.shot.size).toEqual({ w: 6, h: 4 });
    expect(look.animations.shot.at).toBeUndefined();
    expect(look.animations.chargedShot.size).toEqual({ w: 12, h: 10 });
    expect(look.body).toEqual({ w: 14, h: 22 });
    expect(look.slideBody).toEqual({ w: 14, h: 14 });
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

describe("lookFromFormat4", () => {
  it("gives every pose its old group's size, hitbox position and shot point", () => {
    const old: Format4Look = {
      colours: [13],
      canvases: { main: { w: 16, h: 16 } },
      animations: { idle: { frames: [fill(16, 16, "1")], speed: "fast" } },
      body: { x: 2, y: 4, w: 12, h: 12 },
      shotY: 3,
    };
    expect(lookFromFormat4("turret", old)).toEqual({
      colours: [13],
      animations: { idle: { frames: [fill(16, 16, "1")], speed: "fast", size: { w: 16, h: 16 }, at: { x: 2, y: 4 }, shotY: 3 } },
      body: { w: 12, h: 12 },
    });
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
    expect(shotPoints(look)).toEqual({ stand: 11, jump: 11, attack: 11 });
  });
});

describe("pictureRows on a hero whose run has one frame", () => {
  it("reads run2 as the run's only frame", async () => {
    const { pictureRows } = await import("@/model/hero");
    const look = heroLookFrom(oldHero());
    const oneFrame = { ...look, animations: { ...look.animations, run: { ...look.animations.run, frames: [look.animations.run.frames[0]] } } };
    expect(pictureRows(oneFrame, "run2")).toEqual(look.animations.run.frames[0]);
  });
});
