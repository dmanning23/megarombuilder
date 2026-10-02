import { describe, expect, it } from "vitest";
import { baseProject, run, runError } from "./helpers";

describe("applyCommand", () => {
  it("refuses an unknown command", () => {
    expect(runError(baseProject(), "explode", {})).toMatch(/Unknown command "explode"/);
  });

  it("refuses arguments of the wrong shape and names the field", () => {
    const error = runError(baseProject(), "renameLevel", { levelId: "L1", name: 7 });
    expect(error).toMatch(/Invalid arguments for renameLevel/);
    expect(error).toMatch(/name/);
  });

  it("refuses an argument it does not know, so a misspelling is not silently ignored", () => {
    const error = runError(baseProject(), "renameLevel", { levelId: "L1", name: "X", nmae: "Y" });
    expect(error).toMatch(/Invalid arguments for renameLevel/);
    expect(error).toMatch(/nmae/);
  });

  it("refuses an unknown key inside a nested argument", () => {
    const error = runError(baseProject(), "setTiles", {
      levelId: "L1",
      zoneId: "z1",
      cells: [{ x: 0, y: 0, tile: 1, tiel: 2 }],
    });
    expect(error).toMatch(/tiel/);
  });

  it("does not change the project when a command fails", () => {
    const project = baseProject();
    const before = JSON.stringify(project);
    runError(project, "renameLevel", { levelId: "nope", name: "X" });
    expect(JSON.stringify(project)).toBe(before);
  });
});

describe("createLevel", () => {
  it("adds a level with three zones", () => {
    const project = run(baseProject(), "createLevel", {
      levelId: "L2",
      name: "  Ice Stage ",
      zoneIds: ["a", "b", "c"],
    });
    expect(project.levels).toHaveLength(2);
    expect(project.levels[1].name).toBe("Ice Stage");
    expect(project.levels[1].zones.map((z) => z.id)).toEqual(["a", "b", "c"]);
  });

  it("refuses a level id that is already used", () => {
    const error = runError(baseProject(), "createLevel", {
      levelId: "L1",
      name: "Again",
      zoneIds: ["a", "b", "c"],
    });
    expect(error).toMatch(/already exists/);
  });

  it("refuses repeated zone ids", () => {
    const error = runError(baseProject(), "createLevel", {
      levelId: "L2",
      name: "Ice",
      zoneIds: ["a", "a", "c"],
    });
    expect(error).toMatch(/must be different/);
  });
});

describe("renameLevel, setLevelBrief, deleteLevel", () => {
  it("renames a level", () => {
    const project = run(baseProject(), "renameLevel", { levelId: "L1", name: "Frost Peak" });
    expect(project.levels[0].name).toBe("Frost Peak");
  });

  it("refuses an empty name", () => {
    expect(runError(baseProject(), "renameLevel", { levelId: "L1", name: "   " })).toMatch(
      /Invalid arguments/,
    );
  });

  it("sets the brief", () => {
    const project = run(baseProject(), "setLevelBrief", {
      levelId: "L1",
      brief: "Teach ice floors early.",
    });
    expect(project.levels[0].brief).toBe("Teach ice floors early.");
  });

  it("deletes a level", () => {
    const project = run(baseProject(), "deleteLevel", { levelId: "L1" });
    expect(project.levels).toEqual([]);
  });

  it("reports a missing level", () => {
    expect(runError(baseProject(), "deleteLevel", { levelId: "nope" })).toMatch(
      /no level with id "nope"/,
    );
  });
});
