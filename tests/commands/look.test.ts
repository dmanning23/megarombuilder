import { describe, expect, it } from "vitest";
import { createHistory, runCommand, undo } from "@/commands/history";
import { lookProblems } from "@/model/look";
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

describe("the canvas, body and shot point", () => {
  it("grows evenly at the sides and top, keeping the feet row, and refits the body", () => {
    const project = run(baseProject(), "resizeCanvas", { ...hero, canvas: "main", w: 20, h: 28 });
    const look = project.hero.look;
    expect(look.canvases.main).toEqual({ w: 20, h: 28 });
    const before = baseProject().hero.look.animations.stand.frames[0];
    expect(look.animations.stand.frames[0]).toEqual([...fill(20, 4, "."), ...before.map((row) => `..${row}..`)]);
    expect(look.body).toEqual({ x: 2, y: 4, w: 16, h: 24 }); // the test hero's solid picture
    expect(lookProblems("hero", look, "The hero")).toEqual([]);
  });

  it("trims evenly when shrinking, and one undo puts it all back", () => {
    const start = baseProject();
    const history = createHistory(start);
    const { history: shrunk } = runCommand(history, { name: "resizeCanvas", args: { ...hero, canvas: "main", w: 12, h: 20 } }, ctx);
    const look = shrunk.project.hero.look;
    expect(look.animations.stand.frames[0]).toEqual(start.hero.look.animations.stand.frames[0].slice(4).map((row) => row.slice(2, 14)));
    expect(look.body.h).toBeLessThanOrEqual(20);
    expect(undo(shrunk).project).toBe(start);
  });

  it("refuses sizes outside the limits", () => {
    expect(runError(baseProject(), "resizeCanvas", { ...hero, canvas: "main", w: 34, h: 24 })).toBe(
      "The hero's canvas is 34 by 24; it can be 12 to 32 wide and 16 to 32 tall.",
    );
    expect(runError(baseProject(), "resizeCanvas", { ...hero, canvas: "shot", w: 8, h: 4 })).toBe("The hero's shot canvas must be 6 by 4.");
  });

  it("sets and fits the hitbox, and moves the shot point within it", () => {
    let project = run(baseProject(), "setBody", { ...hero, body: { x: 2, y: 4, w: 12, h: 20 } });
    expect(project.hero.look.body).toEqual({ x: 2, y: 4, w: 12, h: 20 });
    expect(runError(project, "setBody", { ...hero, body: { x: 2, y: 0, w: 12, h: 31 } })).toMatch(/hitbox/);
    project = run(project, "fitBody", { ...hero });
    expect(project.hero.look.body).toEqual({ x: 0, y: 0, w: 16, h: 24 }); // the test hero's pictures are solid
    project = run(project, "setShotY", { ...hero, y: 12 });
    expect(project.hero.look.shotY).toBe(12);
    expect(runError(project, "setShotY", { ...hero, y: 21 })).toBe("The hero's shot point is outside its hitbox.");
  });

  it("aims at an enemy or the boss", () => {
    let project = run(baseProject(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    project = run(project, "addFrame", { target: { enemy: "e1" }, animation: "walk", after: 1, copy: true });
    expect(project.enemies[0].look.animations.walk.frames).toHaveLength(3);
    expect(runError(project, "setShotY", { target: { enemy: "e1" }, y: 2 })).toBe("Frost Fang doesn't shoot, so it can't have a shot point.");
    expect(runError(project, "setFrame", { target: { enemy: "e9" }, animation: "walk", frame: 0, rows: ["1"] })).toBe(
      'There is no enemy with the id "e9".',
    );
    expect(runError(project, "setAnimationSpeed", { target: "boss", animation: "stand", speed: "slow" })).toBe(
      "Your game has no boss of its own yet.",
    );
  });
});

describe("fitting the hero's hitboxes to wide drawings", () => {
  it("fits the slide to the drawing, and keeps a standing hitbox at most 16 wide around its middle", () => {
    const project = run(baseProject(), "fitBody", { target: "hero", which: "slide" });
    expect(project.hero.look.slideBody!.h).toBeLessThanOrEqual(14);
    const wide = run(baseProject(), "resizeCanvas", { target: "hero", canvas: "main", w: 24, h: 24 });
    const filled = run(wide, "setFrame", { target: "hero", animation: "stand", frame: 0, rows: Array.from({ length: 24 }, () => "1".repeat(24)) });
    const fitted = run(filled, "fitBody", { target: "hero" });
    expect(fitted.hero.look.body).toEqual({ x: 4, y: 0, w: 16, h: 24 });
  });
});

describe("fitting a short shooter", () => {
  it("keeps its hitbox at least as tall as its shot", () => {
    let project = run(baseProject(), "addEnemy", { enemyId: "e1", name: "Ice Eye", behaviour: "turret" });
    const target = { enemy: "e1" };
    const flat = Array.from({ length: 16 }, (_, y) => (y >= 13 ? "1".repeat(16) : ".".repeat(16))); // 3 rows drawn
    project = run(project, "setFrame", { target, animation: "idle", frame: 0, rows: flat });
    project = run(project, "fitBody", { target });
    expect(project.enemies[0].look.body.h).toBeGreaterThanOrEqual(6);
  });
});
