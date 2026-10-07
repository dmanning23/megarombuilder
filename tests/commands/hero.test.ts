import { applyCommand } from "@/commands/registry";
import { describe, expect, it } from "vitest";
import { createHistory, runCommand, undo } from "@/commands/history";
import { DEFAULT_ABILITIES, PICTURE_SIZES, pictureRows, withPicture } from "@/model/hero";
import { testHero } from "../fixtures/testPack";
import { baseProject, ctx, run, runError } from "./helpers";

const solid = (w: number, h: number, ch: string) => Array.from({ length: h }, () => ch.repeat(w));

describe("setHeroAbilities", () => {
  it("changes only the abilities it is given", () => {
    const project = run(baseProject(), "setHeroAbilities", { jump: "high", slide: true });
    expect(project.hero.abilities).toEqual({ ...DEFAULT_ABILITIES, jump: "high", slide: true });
    expect(project.hero.look).toBe(baseProject().hero.look);
  });

  it("refuses steps that do not exist, and an empty change", () => {
    expect(runError(baseProject(), "setHeroAbilities", { jump: "huge" })).toMatch(/jump/);
    expect(runError(baseProject(), "setHeroAbilities", { shots: 4 })).toMatch(/shots/);
    expect(runError(baseProject(), "setHeroAbilities", {})).toBe("Give at least one ability to change.");
  });

  it("undoes exactly", () => {
    const history = createHistory(baseProject());
    const { history: changed } = runCommand(history, { name: "setHeroAbilities", args: { speed: "fast" } }, ctx);
    expect(undo(changed).project).toBe(history.project);
  });
});

describe("setHeroColours", () => {
  it("recolours the hero", () => {
    const project = run(baseProject(), "setHeroColours", { colours: [21] });
    expect(project.hero.look.colours).toEqual([21]);
  });

  it("adds colour slots", () => {
    expect(run(baseProject(), "setHeroColours", { colours: [13, 27, 0] }).hero.look.colours).toEqual([13, 27, 0]);
  });

  it("refuses to remove a colour that pixels still use", () => {
    let project = run(baseProject(), "setHeroColours", { colours: [13, 27, 0] });
    project = run(project, "setHeroPose", { picture: "stand", rows: solid(16, 24, "3") });
    project = run(project, "setHeroPose", { picture: "run1", rows: solid(16, 24, "3") });
    expect(runError(project, "setHeroColours", { colours: [13, 27] })).toBe("Colour 3 is still used in Stand and Run 1.");
    expect(run(project, "setHeroColours", { colours: [13, 27, 5] }).hero.look.colours).toEqual([13, 27, 5]);
  });

  it("refuses colours outside the palette, and more than sixteen", () => {
    expect(runError(baseProject(), "setHeroColours", { colours: [55] })).toMatch(/colours/);
    expect(runError(baseProject(), "setHeroColours", { colours: Array.from({ length: 17 }, (_, i) => i) })).toMatch(/colours/);
    expect(runError(baseProject(), "setHeroColours", { colours: [] })).toMatch(/colours/);
  });
});

describe("setHeroPose", () => {
  it("replaces one picture", () => {
    const rows = solid(PICTURE_SIZES.slide.w, PICTURE_SIZES.slide.h, ".");
    const project = run(baseProject(), "setHeroPose", { picture: "slide", rows });
    expect(pictureRows(project.hero.look, "slide")).toEqual(rows);
    expect(pictureRows(project.hero.look, "stand")).toEqual(pictureRows(testHero, "stand"));
  });

  it("replaces the shots too", () => {
    const project = run(baseProject(), "setHeroPose", { picture: "chargedShot", rows: solid(12, 10, ".") });
    expect(pictureRows(project.hero.look, "chargedShot")[0]).toBe("............");
  });

  it("refuses a picture of the wrong size, or with a colour the hero lacks", () => {
    expect(runError(baseProject(), "setHeroPose", { picture: "stand", rows: solid(16, 23, "1") })).toBe(
      "Stand is 16 by 23 pixels, not 16 by 24.",
    );
    expect(runError(baseProject(), "setHeroPose", { picture: "shot", rows: solid(6, 4, "2") })).toBe(
      "Shot uses colour 2, but the hero only has 1 colour.",
    );
    expect(runError(baseProject(), "setHeroPose", { picture: "cape", rows: ["1"] })).toMatch(/picture/);
  });
});

describe("resetHeroLook", () => {
  it("puts back the pack's hero and keeps the abilities", () => {
    let project = run(baseProject(), "setHeroAbilities", { speed: "fast" });
    project = run(project, "setHeroColours", { colours: [21, 22] });
    project = run(project, "resetHeroLook", {});
    expect(project.hero.look).toBe(testHero);
    expect(project.hero.abilities.speed).toBe("fast");
  });
});

describe("hero commands and review fixes", () => {
  it("setHeroAbilities ignores abilities given as undefined", () => {
    const project = run(baseProject(), "setHeroAbilities", { jump: undefined, speed: "fast" });
    expect(project.hero.abilities).toEqual({ ...DEFAULT_ABILITIES, speed: "fast" });
    expect(runError(baseProject(), "setHeroAbilities", { jump: undefined })).toBe("Give at least one ability to change.");
  });

  it("setHeroPose is not blocked by a problem in a similarly named picture", () => {
    const project = baseProject();
    const broken = {
      ...project,
      hero: { ...project.hero, look: withPicture(project.hero.look, "standShoot", ["1"]) },
    };
    const result = applyCommand(broken, { name: "setHeroPose", args: { picture: "stand", rows: solid(16, 24, ".") } }, ctx);
    expect(result.ok).toBe(true);
  });
});
