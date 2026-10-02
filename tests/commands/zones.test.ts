import { describe, expect, it } from "vitest";
import { tileIndex } from "@/model/geometry";
import type { Project } from "@/model/schema";
import { baseProject, patchZone, run, runError, zoneOf } from "./helpers";

const L = "L1";

function withCave(): Project {
  return run(baseProject(), "addZone", { levelId: L, zoneId: "z2", name: "Ice Cave", screens: 3 });
}

describe("addZone", () => {
  it("inserts before the boss corridor by default", () => {
    const project = withCave();
    expect(project.levels[0].zones.map((z) => z.id)).toEqual(["z1", "z2", "corridor", "boss"]);
    expect(zoneOf(project, "z2").tiles).toHaveLength(48 * 15);
    expect(zoneOf(project, "z2").variant).toBe("outdoor");
  });

  it("inserts at a given position", () => {
    const project = run(baseProject(), "addZone", {
      levelId: L,
      zoneId: "z0",
      name: "Intro",
      index: 0,
    });
    expect(project.levels[0].zones.map((z) => z.id)).toEqual(["z0", "z1", "corridor", "boss"]);
  });

  it("refuses a position after the boss corridor", () => {
    expect(
      runError(baseProject(), "addZone", { levelId: L, zoneId: "z2", name: "Late", index: 2 }),
    ).toMatch(/before the boss corridor/);
  });

  it("refuses a name that differs only by case and spaces", () => {
    const error = runError(withCave(), "addZone", { levelId: L, zoneId: "z3", name: " ice CAVE " });
    expect(error).toMatch(/already a zone called "ice CAVE"/);
  });

  it("refuses a name that differs only by spaces inside it", () => {
    const error = runError(baseProject(), "addZone", { levelId: L, zoneId: "z2", name: "Zone  \t 1" });
    expect(error).toMatch(/already a zone called "Zone 1"/);
  });

  it("refuses a repeated zone id", () => {
    expect(runError(baseProject(), "addZone", { levelId: L, zoneId: "z1", name: "Dup" })).toMatch(
      /already exists/,
    );
  });

  it("refuses a vertical zone longer than six screens", () => {
    const error = runError(baseProject(), "addZone", {
      levelId: L,
      zoneId: "v",
      name: "Tower",
      scroll: "vertical",
      screens: 7,
    });
    expect(error).toMatch(/at most 6 screens/);
  });

  it("refuses an unknown variant and lists the real ones", () => {
    const error = runError(baseProject(), "addZone", {
      levelId: L,
      zoneId: "z2",
      name: "Lava",
      variant: "lava",
    });
    expect(error).toMatch(/Unknown variant "lava"/);
    expect(error).toMatch(/outdoor, cave/);
  });
});

describe("removeZone", () => {
  it("removes a zone and its checkpoints", () => {
    let project = withCave();
    project = {
      ...project,
      levels: [
        {
          ...project.levels[0],
          checkpoints: [
            { zoneId: "z2", x: 1, y: 12 },
            { zoneId: "z1", x: 1, y: 12 },
          ],
        },
      ],
    };
    project = run(project, "removeZone", { levelId: L, zoneId: "z2" });
    expect(project.levels[0].zones.map((z) => z.id)).toEqual(["z1", "corridor", "boss"]);
    expect(project.levels[0].checkpoints).toEqual([{ zoneId: "z1", x: 1, y: 12 }]);
  });

  it("refuses to remove a boss zone", () => {
    expect(runError(withCave(), "removeZone", { levelId: L, zoneId: "boss" })).toMatch(
      /boss corridor and boss room cannot be removed/,
    );
  });

  it("refuses to remove the last normal zone", () => {
    expect(runError(baseProject(), "removeZone", { levelId: L, zoneId: "z1" })).toMatch(
      /at least one zone before the boss corridor/,
    );
  });
});

describe("moveZone", () => {
  it("reorders normal zones", () => {
    const project = run(withCave(), "moveZone", { levelId: L, zoneId: "z2", toIndex: 0 });
    expect(project.levels[0].zones.map((z) => z.id)).toEqual(["z2", "z1", "corridor", "boss"]);
  });

  it("refuses to move a boss zone", () => {
    expect(runError(withCave(), "moveZone", { levelId: L, zoneId: "corridor", toIndex: 0 })).toMatch(
      /cannot be moved/,
    );
  });

  it("refuses a position among the boss zones", () => {
    expect(runError(withCave(), "moveZone", { levelId: L, zoneId: "z1", toIndex: 2 })).toMatch(
      /position 0 to 1/,
    );
  });
});

describe("renameZone", () => {
  it("renames and trims", () => {
    const project = run(baseProject(), "renameZone", { levelId: L, zoneId: "z1", name: " Snowy Path " });
    expect(zoneOf(project, "z1").name).toBe("Snowy Path");
  });

  it("collapses runs of spaces inside a name", () => {
    const project = run(baseProject(), "renameZone", { levelId: L, zoneId: "z1", name: "Ice \t  Cave" });
    expect(zoneOf(project, "z1").name).toBe("Ice Cave");
  });

  it("lets a zone keep its own name with different case", () => {
    const project = run(baseProject(), "renameZone", { levelId: L, zoneId: "z1", name: "ZONE 1" });
    expect(zoneOf(project, "z1").name).toBe("ZONE 1");
  });

  it("refuses another zone's name", () => {
    expect(
      runError(baseProject(), "renameZone", { levelId: L, zoneId: "z1", name: "boss room" }),
    ).toMatch(/already a zone called "boss room"/);
  });

  it("reports a missing zone", () => {
    expect(runError(baseProject(), "renameZone", { levelId: L, zoneId: "zz", name: "X" })).toMatch(
      /no zone with id "zz"/,
    );
  });
});

describe("resizeZone", () => {
  it("shrinks a horizontal zone, dropping things and checkpoints past the new edge", () => {
    let project = patchZone(withCave(), "z2", {
      things: [
        { id: "near", type: "walker", x: 5, y: 12, settings: {} },
        { id: "far", type: "walker", x: 40, y: 12, settings: {} },
      ],
    });
    project = {
      ...project,
      levels: [
        {
          ...project.levels[0],
          checkpoints: [
            { zoneId: "z2", x: 5, y: 12 },
            { zoneId: "z2", x: 40, y: 12 },
          ],
        },
      ],
    };
    project = run(project, "resizeZone", { levelId: L, zoneId: "z2", screens: 1 });
    const zone = zoneOf(project, "z2");
    expect(zone.screens).toBe(1);
    expect(zone.tiles).toHaveLength(240);
    expect(zone.things.map((t) => t.id)).toEqual(["near"]);
    expect(project.levels[0].checkpoints).toEqual([{ zoneId: "z2", x: 5, y: 12 }]);
    expect(zone.exit).toEqual({ edge: "right", from: 9, to: 12 });
  });

  it("slides a top opening back inside when a horizontal zone shrinks", () => {
    let project = patchZone(withCave(), "z2", { exit: { edge: "top", from: 44, to: 45 } });
    project = run(project, "resizeZone", { levelId: L, zoneId: "z2", screens: 2 });
    expect(zoneOf(project, "z2").exit).toEqual({ edge: "top", from: 30, to: 31 });
  });

  it("grows a horizontal zone with floor under the new columns", () => {
    const project = run(baseProject(), "resizeZone", { levelId: L, zoneId: "z1", screens: 2 });
    const zone = zoneOf(project, "z1");
    const size = { width: 32, height: 15 };
    expect(zone.tiles).toHaveLength(480);
    expect(zone.tiles[tileIndex(size, 20, 14)]).toBe(1);
    expect(zone.tiles[tileIndex(size, 20, 13)]).toBe(1);
    expect(zone.tiles[tileIndex(size, 20, 12)]).toBe(0);
  });

  it("grows a bottom-entry vertical zone at the top, shifting contents down", () => {
    let project = run(baseProject(), "addZone", {
      levelId: L,
      zoneId: "v",
      name: "Climb",
      scroll: "vertical",
      screens: 2,
    });
    const tiles = zoneOf(project, "v").tiles.slice();
    tiles[tileIndex({ width: 16, height: 30 }, 4, 29)] = 2;
    project = patchZone(project, "v", {
      tiles,
      things: [{ id: "t", type: "walker", x: 3, y: 29, settings: {} }],
    });
    project = run(project, "resizeZone", { levelId: L, zoneId: "v", screens: 3 });
    const zone = zoneOf(project, "v");
    expect(zone.things[0].y).toBe(44);
    expect(zone.tiles[tileIndex({ width: 16, height: 45 }, 4, 44)]).toBe(2);
    expect(zone.entry).toEqual({ edge: "bottom", from: 7, to: 8 });
  });

  it("shrinks a bottom-entry vertical zone from the top", () => {
    let project = run(baseProject(), "addZone", {
      levelId: L,
      zoneId: "v",
      name: "Climb",
      scroll: "vertical",
      screens: 2,
    });
    project = patchZone(project, "v", {
      things: [
        { id: "low", type: "walker", x: 3, y: 29, settings: {} },
        { id: "high", type: "walker", x: 3, y: 0, settings: {} },
      ],
    });
    project = run(project, "resizeZone", { levelId: L, zoneId: "v", screens: 1 });
    const zone = zoneOf(project, "v");
    expect(zone.things).toEqual([{ id: "low", type: "walker", x: 3, y: 14, settings: {} }]);
  });

  it("keeps the top of a top-entry vertical zone", () => {
    let project = run(baseProject(), "addZone", {
      levelId: L,
      zoneId: "v",
      name: "Drop",
      scroll: "vertical",
      screens: 2,
    });
    project = patchZone(project, "v", {
      entry: { edge: "top", from: 7, to: 8 },
      exit: { edge: "bottom", from: 7, to: 8 },
      things: [{ id: "high", type: "walker", x: 3, y: 2, settings: {} }],
    });
    project = run(project, "resizeZone", { levelId: L, zoneId: "v", screens: 3 });
    expect(zoneOf(project, "v").things[0].y).toBe(2);
  });

  it("refuses a shrink that would push the exit onto the entry", () => {
    const project = patchZone(withCave(), "z2", {
      entry: { edge: "top", from: 14, to: 15 },
      exit: { edge: "top", from: 40, to: 41 },
    });
    expect(runError(project, "resizeZone", { levelId: L, zoneId: "z2", screens: 1 })).toMatch(
      /entry and exit overlap/,
    );
  });

  it("refuses to resize a boss zone", () => {
    expect(runError(baseProject(), "resizeZone", { levelId: L, zoneId: "boss", screens: 2 })).toMatch(
      /always one screen/,
    );
  });

  it("refuses a size past the limit", () => {
    expect(runError(baseProject(), "resizeZone", { levelId: L, zoneId: "z1", screens: 9 })).toMatch(
      /Invalid arguments/,
    );
  });
});

describe("setZoneVariant and setZoneIntent", () => {
  it("sets the variant", () => {
    const project = run(baseProject(), "setZoneVariant", { levelId: L, zoneId: "z1", variant: "cave" });
    expect(zoneOf(project, "z1").variant).toBe("cave");
  });

  it("refuses an unknown variant", () => {
    expect(
      runError(baseProject(), "setZoneVariant", { levelId: L, zoneId: "z1", variant: "lava" }),
    ).toMatch(/Unknown variant "lava"/);
  });

  it("sets the intent", () => {
    const project = run(baseProject(), "setZoneIntent", {
      levelId: L,
      zoneId: "z1",
      intent: "First safe look at ice floors.",
    });
    expect(zoneOf(project, "z1").intent).toBe("First safe look at ice floors.");
  });
});

describe("setZoneOpenings", () => {
  it("sets the exit and leaves the entry alone", () => {
    const project = run(baseProject(), "setZoneOpenings", {
      levelId: L,
      zoneId: "z1",
      exit: { edge: "top", from: 7, to: 8 },
    });
    expect(zoneOf(project, "z1").exit).toEqual({ edge: "top", from: 7, to: 8 });
    expect(zoneOf(project, "z1").entry).toEqual({ edge: "left", from: 9, to: 12 });
  });

  it("refuses an exit on the left edge", () => {
    expect(
      runError(baseProject(), "setZoneOpenings", {
        levelId: L,
        zoneId: "z1",
        exit: { edge: "left", from: 9, to: 12 },
      }),
    ).toMatch(/exit cannot be on the left edge/);
  });

  it("refuses an opening that runs off the edge", () => {
    expect(
      runError(baseProject(), "setZoneOpenings", {
        levelId: L,
        zoneId: "z1",
        entry: { edge: "left", from: 12, to: 15 },
      }),
    ).toMatch(/only has positions 0 to 14/);
  });

  it("refuses an entry and exit that overlap on the same edge", () => {
    const error = runError(baseProject(), "setZoneOpenings", {
      levelId: L,
      zoneId: "z1",
      entry: { edge: "top", from: 3, to: 5 },
      exit: { edge: "top", from: 5, to: 6 },
    });
    expect(error).toMatch(/entry and exit overlap on the top edge/);
  });

  it("allows an entry and exit side by side on the same edge", () => {
    const project = run(baseProject(), "setZoneOpenings", {
      levelId: L,
      zoneId: "z1",
      entry: { edge: "top", from: 3, to: 4 },
      exit: { edge: "top", from: 5, to: 6 },
    });
    expect(zoneOf(project, "z1").exit).toEqual({ edge: "top", from: 5, to: 6 });
  });

  it("refuses an exit on the boss room", () => {
    expect(
      runError(baseProject(), "setZoneOpenings", {
        levelId: L,
        zoneId: "boss",
        exit: { edge: "right", from: 9, to: 12 },
      }),
    ).toMatch(/boss room has no exit/);
  });

  it("refuses a call with neither opening", () => {
    expect(runError(baseProject(), "setZoneOpenings", { levelId: L, zoneId: "z1" })).toMatch(
      /Give an entry, an exit, or both/,
    );
  });
});
