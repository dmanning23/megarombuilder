import { describe, expect, it } from "vitest";
import { checkLevel } from "@/checker/check";
import { DEFAULT_PACK, getArt, getPack } from "@/content/packs";
import { snowArt } from "@/content/snow/art";
import { snowPack } from "@/content/snow/pack";
import { copyOfDemo, newProject } from "@/editor/newProject";
import { structureProblems } from "@/model/validate";

let n = 0;
const makeId = () => `id-${++n}`;

describe("packs", () => {
  it("find the snow pack and its art by id", () => {
    expect(getPack("snow")).toBe(snowPack);
    expect(getArt("snow")).toBe(snowArt);
    expect(getPack("lava")).toBeUndefined();
    expect(DEFAULT_PACK).toBe(snowPack);
  });
});

describe("newProject", () => {
  it("makes a valid game with one level ready to build and win", () => {
    const project = newProject("  Snow Fortress ", makeId);
    expect(project.name).toBe("Snow Fortress");
    expect(structureProblems(project, snowPack)).toEqual([]);
    expect(project.levels).toHaveLength(1);
    const level = project.levels[0];
    expect(level.zones.map((z) => z.name)).toEqual(["Zone 1", "Boss Corridor", "Boss Room"]);
    const check = checkLevel(project, level.id, snowPack);
    expect(check.problems).toEqual([]);
    expect(check.zones.every((z) => z.passable)).toBe(true);
  });

  it("names an unnamed game", () => {
    expect(newProject("   ", makeId).name).toBe("My game");
  });

  it("uses fresh ids", () => {
    expect(newProject("A", makeId).id).not.toBe(newProject("B", makeId).id);
  });
});

describe("copyOfDemo", () => {
  it("is the demo stage under a new id", () => {
    const project = copyOfDemo(makeId);
    expect(project.name).toBe("Demo Stage");
    expect(project.id).toMatch(/^id-/);
    expect(project.levels[0].zones[0].name).toBe("Snowy Path");
  });
});
