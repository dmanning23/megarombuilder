import { describe, expect, it } from "vitest";
import { createHistory, runCommand, undo } from "@/commands/history";
import { DEFAULT_ABILITIES } from "@/model/hero";
import { testHero } from "../fixtures/testPack";
import { baseProject, ctx, run, runError } from "./helpers";

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

describe("resetHeroLook", () => {
  it("puts back the pack's hero and keeps the abilities", () => {
    let project = run(baseProject(), "setHeroAbilities", { speed: "fast" });
    project = run(project, "setLookColours", { target: "hero", colours: [21, 22] });
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

});
