import { describe, expect, it } from "vitest";
import type { Project } from "@/model/schema";
import { baseProject, run, runError, zoneOf } from "./helpers";

const L = "L1";

function withWalker(): Project {
  return run(baseProject(), "placeThing", {
    levelId: L,
    zoneId: "z1",
    thingId: "w1",
    type: "walker",
    x: 5,
    y: 12,
  });
}

describe("placeThing", () => {
  it("places a thing with the pack's default settings", () => {
    expect(zoneOf(withWalker(), "z1").things).toEqual([
      { id: "w1", type: "walker", x: 5, y: 12, settings: { speed: 1 } },
    ]);
  });

  it("overlays given settings on the defaults", () => {
    const project = run(baseProject(), "placeThing", {
      levelId: L,
      zoneId: "z1",
      thingId: "w1",
      type: "walker",
      x: 5,
      y: 12,
      settings: { speed: 2, facing: "left" },
    });
    expect(zoneOf(project, "z1").things[0].settings).toEqual({ speed: 2, facing: "left" });
  });

  it("refuses an unknown type and lists the real ones", () => {
    const error = runError(baseProject(), "placeThing", {
      levelId: L,
      zoneId: "z1",
      thingId: "d1",
      type: "dragon",
      x: 1,
      y: 1,
    });
    expect(error).toMatch(/no thing called "dragon"/);
    expect(error).toMatch(/walker, health/);
  });

  it("refuses a position outside the zone and gives the zone's size", () => {
    const error = runError(baseProject(), "placeThing", {
      levelId: L,
      zoneId: "z1",
      thingId: "w1",
      type: "walker",
      x: 5,
      y: 15,
    });
    expect(error).toMatch(/\(5, 15\) is outside "Zone 1"/);
    expect(error).toMatch(/16 tiles wide and 15 tiles high/);
  });

  it("refuses a fractional position", () => {
    expect(
      runError(baseProject(), "placeThing", {
        levelId: L,
        zoneId: "z1",
        thingId: "w1",
        type: "walker",
        x: 5.5,
        y: 12,
      }),
    ).toMatch(/Invalid arguments/);
  });

  it("refuses a repeated thing id", () => {
    expect(
      runError(withWalker(), "placeThing", {
        levelId: L,
        zoneId: "z1",
        thingId: "w1",
        type: "health",
        x: 1,
        y: 1,
      }),
    ).toMatch(/already a thing with id "w1"/);
  });
});

describe("moveThing, removeThing, setThingSettings", () => {
  it("moves a thing", () => {
    const project = run(withWalker(), "moveThing", { levelId: L, zoneId: "z1", thingId: "w1", x: 9, y: 4 });
    expect(zoneOf(project, "z1").things[0]).toMatchObject({ x: 9, y: 4 });
  });

  it("refuses to move a thing outside the zone", () => {
    expect(
      runError(withWalker(), "moveThing", { levelId: L, zoneId: "z1", thingId: "w1", x: -1, y: 4 }),
    ).toMatch(/is outside "Zone 1"/);
  });

  it("removes a thing", () => {
    const project = run(withWalker(), "removeThing", { levelId: L, zoneId: "z1", thingId: "w1" });
    expect(zoneOf(project, "z1").things).toEqual([]);
  });

  it("merges settings", () => {
    const project = run(withWalker(), "setThingSettings", {
      levelId: L,
      zoneId: "z1",
      thingId: "w1",
      settings: { facing: "left" },
    });
    expect(zoneOf(project, "z1").things[0].settings).toEqual({ speed: 1, facing: "left" });
  });

  it("reports a missing thing", () => {
    for (const [name, extra] of [
      ["moveThing", { x: 1, y: 1 }],
      ["removeThing", {}],
      ["setThingSettings", { settings: {} }],
    ] as const) {
      expect(
        runError(withWalker(), name, { levelId: L, zoneId: "z1", thingId: "zz", ...extra }),
      ).toMatch(/no thing with id "zz"/);
    }
  });
});

describe("checkpoints", () => {
  it("adds and removes a checkpoint", () => {
    let project = run(baseProject(), "addCheckpoint", { levelId: L, zoneId: "z1", x: 8, y: 12 });
    expect(project.levels[0].checkpoints).toEqual([{ zoneId: "z1", x: 8, y: 12 }]);
    project = run(project, "removeCheckpoint", { levelId: L, zoneId: "z1", x: 8, y: 12 });
    expect(project.levels[0].checkpoints).toEqual([]);
  });

  it("refuses a checkpoint outside the zone", () => {
    expect(
      runError(baseProject(), "addCheckpoint", { levelId: L, zoneId: "z1", x: 16, y: 12 }),
    ).toMatch(/\(16, 12\) is outside "Zone 1"/);
  });

  it("refuses a checkpoint in a missing zone", () => {
    expect(
      runError(baseProject(), "addCheckpoint", { levelId: L, zoneId: "zz", x: 1, y: 1 }),
    ).toMatch(/no zone with id "zz"/);
  });

  it("refuses a second checkpoint in the same place", () => {
    const project = run(baseProject(), "addCheckpoint", { levelId: L, zoneId: "z1", x: 8, y: 12 });
    expect(runError(project, "addCheckpoint", { levelId: L, zoneId: "z1", x: 8, y: 12 })).toMatch(
      /already a checkpoint/,
    );
  });

  it("reports a checkpoint that is not there", () => {
    expect(
      runError(baseProject(), "removeCheckpoint", { levelId: L, zoneId: "z1", x: 8, y: 12 }),
    ).toMatch(/no checkpoint at \(8, 12\)/);
  });
});
