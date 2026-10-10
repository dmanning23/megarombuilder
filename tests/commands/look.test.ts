import { describe, expect, it } from "vitest";
import { createHistory, runCommand, undo } from "@/commands/history";
import { baseProject, ctx, run, runError } from "./helpers";

const fill = (w: number, h: number, ch: string) => Array.from({ length: h }, () => ch.repeat(w));
const hero = { target: "hero" };
const run2 = (p: ReturnType<typeof baseProject>) => p.hero.look.animations.run;

describe("frames", () => {
  it("adds a blank frame or a copy after the chosen one, and refuses a ninth", () => {
    let project = run(baseProject(), "addFrame", { ...hero, animation: "run", after: 0, copy: true });
    expect(run2(project).frames).toEqual([run2(baseProject()).frames[0], run2(baseProject()).frames[0], run2(baseProject()).frames[1]]);
    project = run(project, "addFrame", { ...hero, animation: "run", after: 2 });
    expect(run2(project).frames[3]).toEqual(fill(16, 24, "."));
    for (let i = 0; i < 4; i++) project = run(project, "addFrame", { ...hero, animation: "run", after: 0 });
    expect(run2(project).frames).toHaveLength(8);
    expect(runError(project, "addFrame", { ...hero, animation: "run", after: 0, copy: true })).toBe("Run already has 8 frames, the most.");
  });

  it("removes and moves frames, keeping at least one", () => {
    const start = run2(baseProject()).frames;
    let project = run(baseProject(), "moveFrame", { ...hero, animation: "run", from: 1, to: 0 });
    expect(run2(project).frames).toEqual([start[1], start[0]]);
    project = run(project, "removeFrame", { ...hero, animation: "run", frame: 0 });
    expect(run2(project).frames).toEqual([start[0]]);
    expect(runError(project, "removeFrame", { ...hero, animation: "run", frame: 0 })).toBe("Run needs at least one frame.");
    expect(runError(project, "removeFrame", { ...hero, animation: "run", frame: 4 })).toBe("Run has no frame 5.");
  });

  it("draws a frame, checking its size and colours", () => {
    const project = run(baseProject(), "setFrame", { ...hero, animation: "stand", frame: 0, rows: fill(16, 24, ".") });
    expect(project.hero.look.animations.stand.frames[0]).toEqual(fill(16, 24, "."));
    expect(runError(project, "setFrame", { ...hero, animation: "stand", frame: 0, rows: fill(15, 24, ".") })).toBe(
      "The hero's Stand frame 1 is not 16 by 24 pixels.",
    );
    expect(runError(project, "setFrame", { ...hero, animation: "walk", frame: 0, rows: fill(16, 24, ".") })).toBe(
      'The hero has no animation called "walk".',
    );
  });

  it("sets an animation's speed", () => {
    expect(run2(run(baseProject(), "setAnimationSpeed", { ...hero, animation: "run", speed: "fast" })).speed).toBe("fast");
  });
});

describe("colours", () => {
  it("refuses colours outside the palette, none, or more than sixteen", () => {
    expect(runError(baseProject(), "setLookColours", { ...hero, colours: [55] })).toMatch(/colours/);
    expect(runError(baseProject(), "setLookColours", { ...hero, colours: [] })).toMatch(/colours/);
    expect(runError(baseProject(), "setLookColours", { ...hero, colours: Array.from({ length: 17 }, (_, i) => i) })).toMatch(/colours/);
  });

  it("allows 16, and refuses removing one still in use, naming the frames", () => {
    const sixteen = Array.from({ length: 16 }, (_, i) => i);
    let project = run(baseProject(), "setLookColours", { ...hero, colours: sixteen });
    project = run(project, "setFrame", { ...hero, animation: "run", frame: 1, rows: fill(16, 24, "g") });
    expect(runError(project, "setLookColours", { ...hero, colours: sixteen.slice(0, 15) })).toBe("Colour 16 is still used in Run frame 2.");
  });
});

describe("a pose's size, hitbox and shot point", () => {
  it("resizes one pose, padding evenly at the sides and top, its hitbox moving with the pixels", () => {
    const project = run(baseProject(), "resizePose", { ...hero, animation: "jumpShoot", w: 20, h: 28 });
    const look = project.hero.look;
    expect(look.animations.jumpShoot.size).toEqual({ w: 20, h: 28 });
    const before = baseProject().hero.look.animations.jumpShoot.frames[0];
    expect(look.animations.jumpShoot.frames[0]).toEqual([...fill(20, 4, "."), ...before.map((row) => `..${row}..`)]);
    expect(look.animations.jumpShoot.at).toEqual({ x: 3, y: 6 });
    expect(look.animations.stand).toEqual(baseProject().hero.look.animations.stand);
    expect(look.body).toEqual(baseProject().hero.look.body);
  });

  it("trims one pose, and one undo puts it back", () => {
    const start = baseProject();
    const history = createHistory(start);
    const { history: shrunk } = runCommand(history, { name: "resizePose", args: { ...hero, animation: "stand", w: 14, h: 24 } }, ctx);
    expect(shrunk.project.hero.look.animations.stand.frames[0]).toEqual(start.hero.look.animations.stand.frames[0].map((row) => row.slice(1, 15)));
    expect(undo(shrunk).project).toBe(start);
  });

  it("refuses sizes outside the limits, or smaller than the hitbox", () => {
    expect(runError(baseProject(), "resizePose", { ...hero, animation: "run", w: 34, h: 24 })).toBe(
      "The hero's Run is 34 by 24; it can be 12 to 32 wide and 16 to 32 tall.",
    );
    expect(runError(baseProject(), "resizePose", { ...hero, animation: "shot", w: 8, h: 4 })).toBe("The hero's Shot must be 6 by 4.");
    expect(runError(baseProject(), "resizePose", { ...hero, animation: "jumpShoot", w: 12, h: 24 })).toBe(
      "The hero's Jump and shoot is 12 by 24; its hitbox needs 14 by 22.",
    );
  });

  it("moves the hitbox in one pose and resizes it in all, refusing a size a smaller pose can't hold", () => {
    let project = run(baseProject(), "setBody", { ...hero, animation: "jumpShoot", body: { x: 2, y: 4, w: 12, h: 20 } });
    expect(project.hero.look.body).toEqual({ w: 12, h: 20 });
    expect(project.hero.look.animations.jumpShoot.at).toEqual({ x: 2, y: 4 });
    expect(project.hero.look.animations.stand.at).toEqual({ x: 2, y: 4 }); // feet and centre kept: (1 + 1, 2 + 22 - 20)
    project = run(project, "resizePose", { ...hero, animation: "run", w: 12, h: 24 });
    expect(runError(project, "setBody", { ...hero, animation: "stand", body: { x: 1, y: 2, w: 14, h: 22 } })).toBe(
      "The hero's Run is 12 by 24; its hitbox needs 14 by 22.",
    );
    expect(runError(project, "setBody", { ...hero, animation: "shot", body: { x: 0, y: 0, w: 4, h: 4 } })).toBe("Shot has no hitbox.");
  });

  it("fits a pose's hitbox to that pose's drawing", () => {
    const wide = run(baseProject(), "resizePose", { ...hero, animation: "stand", w: 24, h: 24 });
    const filled = run(wide, "setFrame", { ...hero, animation: "stand", frame: 0, rows: fill(24, 24, "1") });
    const fitted = run(filled, "fitBody", { ...hero, animation: "stand" });
    expect(fitted.hero.look.animations.stand.at).toEqual({ x: 4, y: 0 });
    expect(fitted.hero.look.body).toEqual({ w: 16, h: 24 }); // at most 16 wide, around its middle
    const slid = run(baseProject(), "fitBody", { ...hero, animation: "slide" });
    expect(slid.hero.look.slideBody!.h).toBeLessThanOrEqual(14);
  });

  it("keeps a short shooter's fitted hitbox at least as tall as its shot", () => {
    let project = run(baseProject(), "addEnemy", { enemyId: "e1", name: "Ice Eye", behaviour: "turret" });
    const target = { enemy: "e1" };
    const flat = Array.from({ length: 16 }, (_, y) => (y >= 13 ? "1".repeat(16) : ".".repeat(16))); // 3 rows drawn
    project = run(project, "setFrame", { target, animation: "idle", frame: 0, rows: flat });
    project = run(project, "fitBody", { target, animation: "idle" });
    expect(project.enemies[0].look.body.h).toBeGreaterThanOrEqual(6);
  });

  it("sets one pose's shot point", () => {
    const project = run(baseProject(), "setShotY", { ...hero, animation: "jumpShoot", y: 12 });
    expect(project.hero.look.animations.jumpShoot.shotY).toBe(12);
    expect(project.hero.look.animations.standShoot.shotY).toBe(8);
    expect(runError(project, "setShotY", { ...hero, animation: "jumpShoot", y: 21 })).toBe("The hero's Jump and shoot shot point is outside its hitbox.");
    expect(runError(project, "setShotY", { ...hero, animation: "slide", y: 2 })).toBe("The hero's Slide can't have a shot point.");
  });

  it("aims at an enemy or the boss", () => {
    let project = run(baseProject(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    project = run(project, "addFrame", { target: { enemy: "e1" }, animation: "walk", after: 1 });
    expect(project.enemies[0].look.animations.walk.frames[2]).toEqual(fill(16, 16, "."));
    expect(runError(project, "setShotY", { target: { enemy: "e1" }, animation: "walk", y: 2 })).toBe("Frost Fang doesn't shoot, so it can't have a shot point.");
    expect(runError(project, "setFrame", { target: { enemy: "e9" }, animation: "walk", frame: 0, rows: ["1"] })).toBe(
      'There is no enemy with the id "e9".',
    );
    expect(runError(project, "setAnimationSpeed", { target: "boss", animation: "stand", speed: "slow" })).toBe(
      "Your game has no boss of its own yet.",
    );
  });
});

