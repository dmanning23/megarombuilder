import { describe, expect, it } from "vitest";
import { cutsDrawing, KINDS, lookForKind, lookProblems, poseBox, shotPoints, type Animation, type Look, type Point } from "@/model/look";
import { fittedPoseBody, resizePose, setPoseBody } from "@/model/poses";

const fill = (w: number, h: number, ch = "1") => Array.from({ length: h }, () => ch.repeat(w));
const pose = (w: number, h: number, at?: Point, shotY?: number): Animation => ({
  frames: [fill(w, h)],
  speed: "normal",
  size: { w, h },
  ...(at ? { at } : {}),
  ...(shotY === undefined ? {} : { shotY }),
});

// Today's hero, in format 5: every standing pose 16 by 24 with the hitbox at (1, 2), shooting from 8.
function heroLook(): Look {
  const main = () => pose(16, 24, { x: 1, y: 2 }, 8);
  return {
    colours: [13],
    animations: {
      stand: main(), standShoot: main(), run: main(), runShoot: main(), jump: main(), jumpShoot: main(), climb: main(), hurt: main(),
      slide: pose(24, 16, { x: 5, y: 2 }),
      shot: pose(6, 4),
      chargedShot: pose(12, 10),
    },
    body: { w: 14, h: 22 },
    slideBody: { w: 14, h: 14 },
  };
}
const walker = (): Look => ({ colours: [13], animations: { walk: pose(16, 16, { x: 1, y: 2 }) }, body: { w: 14, h: 14 } });
const problems = (look: Look) => lookProblems("hero", look, "The hero");

describe("a look with poses", () => {
  it("accepts today's hero and a walker", () => {
    expect(problems(heroLook())).toEqual([]);
    expect(lookProblems("walker", walker(), "Frost Fang")).toEqual([]);
  });

  it("knows each pose's hitbox box and shot points", () => {
    const look = heroLook();
    expect(poseBox(look, "hero", "jumpShoot")).toEqual({ x: 1, y: 2, w: 14, h: 22 });
    expect(poseBox(look, "hero", "slide")).toEqual({ x: 5, y: 2, w: 14, h: 14 });
    expect(poseBox(look, "hero", "shot")).toBeNull();
    expect(Object.keys(shotPoints(look)).sort()).toEqual(["climb", "hurt", "jump", "jumpShoot", "run", "runShoot", "stand", "standShoot"]);
    expect(KINDS.hero.animations.stand).toEqual({ body: "main", min: { w: 12, h: 16 }, max: { w: 32, h: 32 } });
  });

  it("names the pose in every size, hitbox and shot point message", () => {
    const look = heroLook();
    look.animations.jumpShoot = { ...pose(34, 24, { x: 1, y: 2 }, 8) };
    expect(problems(look)).toContain("The hero's Jump and shoot is 34 by 24; it can be 12 to 32 wide and 16 to 32 tall.");
    look.animations.jumpShoot = pose(15, 24, { x: 1, y: 2 }, 8);
    expect(problems(look)).toContain("The hero's Jump and shoot is 15 by 24; its sides must be even.");
    look.animations.jumpShoot = pose(12, 16, { x: 0, y: 0 }, 8);
    expect(problems(look)).toContain("The hero's Jump and shoot is 12 by 16; its hitbox needs 14 by 22.");
    look.animations.jumpShoot = pose(16, 24, { x: 3, y: 2 }, 8);
    expect(problems(look)).toContain("The hero's Jump and shoot hitbox doesn't fit inside its picture.");
    look.animations.jumpShoot = pose(16, 24, { x: 1, y: 2 }, 19);
    expect(problems(look)).toContain("The hero's Jump and shoot shot point is outside its hitbox.");
    look.animations.shot = pose(8, 4);
    expect(problems(look)).toContain("The hero's Shot must be 6 by 4.");
    look.animations.shot = pose(6, 4, { x: 0, y: 0 });
    expect(problems(look)).toContain("The hero's Shot can't have a hitbox.");
    look.animations.slide = pose(24, 16, { x: 5, y: 2 }, 4);
    expect(problems(look)).toContain("The hero's Slide can't have a shot point.");
    look.animations.run = pose(16, 24);
    expect(problems(look)).toEqual(expect.arrayContaining(["The hero's Run has no hitbox position.", "The hero's Run has no shot point."]));
  });

  it("says once that a walker doesn't shoot", () => {
    const look = walker();
    look.animations.walk.shotY = 3;
    expect(lookProblems("walker", look, "Frost Fang").filter((p) => p.includes("doesn't shoot"))).toEqual([
      "Frost Fang doesn't shoot, so it can't have a shot point.",
    ]);
  });
});

describe("resizing one pose", () => {
  it("changes only that pose, moving its hitbox with the pixels", () => {
    const look = resizePose(heroLook(), "hero", "jumpShoot", 24, 24);
    expect(look.animations.stand).toEqual(heroLook().animations.stand);
    expect(look.animations.jumpShoot.size).toEqual({ w: 24, h: 24 });
    expect(look.animations.jumpShoot.frames[0][0]).toBe(`....${"1".repeat(16)}....`);
    expect(look.animations.jumpShoot.at).toEqual({ x: 5, y: 2 });
    expect(look.animations.jumpShoot.shotY).toBe(8);
    expect(problems(look)).toEqual([]);
  });

  it("nudges a hitbox a trim left poking out back inside", () => {
    const start = heroLook();
    start.animations.stand.at = { x: 2, y: 2 };
    const look = resizePose(start, "hero", "stand", 14, 24);
    expect(look.animations.stand.at).toEqual({ x: 0, y: 2 });
    expect(problems(look)).toEqual([]);
  });

  it("can't be smaller than the hitbox", () => {
    expect(problems(resizePose(heroLook(), "hero", "stand", 12, 24))).toContain("The hero's Stand is 12 by 24; its hitbox needs 14 by 22.");
  });

  it("knows when it would cut off drawing", () => {
    expect(cutsDrawing(heroLook(), "stand", 14, 24)).toBe(true);
    expect(cutsDrawing(heroLook(), "stand", 18, 24)).toBe(false);
    expect(cutsDrawing(resizePose(heroLook(), "hero", "jump", 20, 24), "stand", 14, 24)).toBe(true); // reads the named pose only
  });
});

describe("setting a pose's hitbox", () => {
  it("moves it in that pose and resizes it everywhere, keeping each pose's feet, centre and shot row", () => {
    const wide = resizePose(heroLook(), "hero", "jumpShoot", 24, 24); // its hitbox at (5, 2)
    const look = setPoseBody(wide, "hero", "stand", { x: 2, y: 4, w: 12, h: 20 });
    expect(look.body).toEqual({ w: 12, h: 20 });
    expect(look.animations.stand.at).toEqual({ x: 2, y: 4 });
    expect(look.animations.jumpShoot.at).toEqual({ x: 6, y: 4 }); // bottom 24 and centre 12 kept
    expect(look.animations.run.at).toEqual({ x: 2, y: 4 });
    expect(look.animations.stand.shotY).toBe(6); // the same picture row: 2 + 8 = 4 + 6
    expect(look.animations.slide).toEqual(wide.animations.slide);
    expect(problems(look)).toEqual([]);
  });

  it("puts every other pose's box back exactly when an edge is dragged in and out again", () => {
    let look = heroLook();
    for (let i = 0; i < 3; i++) {
      look = setPoseBody(look, "hero", "stand", { x: 1, y: 2, w: 13, h: 22 }); // the right edge in by 1
      look = setPoseBody(look, "hero", "stand", { x: 1, y: 2, w: 14, h: 22 }); // and out again
    }
    look = setPoseBody(look, "hero", "stand", { x: 1, y: 2, w: 11, h: 22 }); // in by 3
    look = setPoseBody(look, "hero", "stand", { x: 1, y: 2, w: 14, h: 22 }); // and out again
    expect(look.animations.jump.at).toEqual({ x: 1, y: 2 });
    expect(look).toEqual(heroLook());
  });

  it("sets the sliding hitbox from Slide, leaving the standing poses alone", () => {
    const look = setPoseBody(heroLook(), "hero", "slide", { x: 4, y: 4, w: 16, h: 12 });
    expect(look.slideBody).toEqual({ w: 16, h: 12 });
    expect(look.animations.slide.at).toEqual({ x: 4, y: 4 });
    expect(look.body).toEqual(heroLook().body);
    expect(look.animations.stand).toEqual(heroLook().animations.stand);
  });

  it("is refused by the smallest pose when it grows too big for it", () => {
    const narrow = resizePose(heroLook(), "hero", "stand", 14, 24);
    const look = setPoseBody(narrow, "hero", "jump", { x: 0, y: 2, w: 16, h: 22 });
    expect(problems(look)[0]).toBe("The hero's Stand is 14 by 24; its hitbox needs 16 by 22.");
  });

  it("fits a hitbox no bigger than the smallest pose that shares it", () => {
    const look = resizePose(heroLook(), "hero", "run", 14, 24); // Run is the narrowest; Stand is drawn 16 wide
    const fitted = fittedPoseBody(look, "hero", "stand");
    expect(fitted).toEqual({ x: 1, y: 0, w: 14, h: 24 });
    expect(problems(setPoseBody(look, "hero", "stand", fitted))).toEqual([]);
  });

  it("fits a pose's hitbox to that pose's drawing", () => {
    const look = heroLook();
    look.animations.jumpShoot = { ...look.animations.jumpShoot, frames: [fill(16, 24, ".").map((row, y) => (y >= 8 ? "..1111111111...." : row))] };
    expect(fittedPoseBody(look, "hero", "jumpShoot")).toEqual({ x: 2, y: 8, w: 10, h: 16 });
  });
});

describe("changing an enemy's behaviour", () => {
  it("gives a new shooter a shot point in each pose, and merges poses of different sizes", () => {
    const turret = lookForKind(walker(), "walker", "turret");
    expect(turret.animations.idle.shotY).toBe(4); // the middle of a 14-tall hitbox, for a 6-tall shot
    expect(lookProblems("turret", turret, "Ice Eye")).toEqual([]);
    const jumper: Look = {
      colours: [13],
      animations: { ground: pose(16, 16, { x: 1, y: 2 }), air: pose(20, 16, { x: 3, y: 2 }) },
      body: { w: 14, h: 14 },
    };
    const merged = lookForKind(jumper, "jumper", "walker");
    expect(merged.animations.walk.frames).toHaveLength(2);
    expect(merged.animations.walk.frames.every((rows) => rows.length === 16 && rows[0].length === 16)).toBe(true);
    expect(lookProblems("walker", merged, "Frost Fang")).toEqual([]);
  });
});
