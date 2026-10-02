import { describe, expect, it } from "vitest";
import { tileIndex } from "@/model/geometry";
import { baseProject, patchZone, run, runError, zoneOf } from "./helpers";

const L = "L1";
const size = { width: 16, height: 15 };

describe("setTiles", () => {
  it("sets individual cells", () => {
    const project = run(baseProject(), "setTiles", {
      levelId: L,
      zoneId: "z1",
      cells: [
        { x: 2, y: 3, tile: 3 },
        { x: 4, y: 5, tile: 2 },
      ],
    });
    const tiles = zoneOf(project, "z1").tiles;
    expect(tiles[tileIndex(size, 2, 3)]).toBe(3);
    expect(tiles[tileIndex(size, 4, 5)]).toBe(2);
  });

  it("does not modify the original project", () => {
    const original = baseProject();
    run(original, "setTiles", { levelId: L, zoneId: "z1", cells: [{ x: 0, y: 0, tile: 1 }] });
    expect(zoneOf(original, "z1").tiles[0]).toBe(0);
  });

  it("refuses a cell outside the zone and gives the zone's size", () => {
    const error = runError(baseProject(), "setTiles", {
      levelId: L,
      zoneId: "z1",
      cells: [{ x: 16, y: 0, tile: 1 }],
    });
    expect(error).toMatch(/\(16, 0\) is outside "Zone 1"/);
    expect(error).toMatch(/16 tiles wide and 15 tiles high/);
  });

  it("refuses an unknown tile", () => {
    expect(
      runError(baseProject(), "setTiles", {
        levelId: L,
        zoneId: "z1",
        cells: [{ x: 0, y: 0, tile: 99 }],
      }),
    ).toMatch(/no tile with id 99/);
  });

  it("refuses fractional coordinates", () => {
    expect(
      runError(baseProject(), "setTiles", {
        levelId: L,
        zoneId: "z1",
        cells: [{ x: 1.5, y: 0, tile: 1 }],
      }),
    ).toMatch(/Invalid arguments/);
  });

  it("refuses an empty cell list", () => {
    expect(runError(baseProject(), "setTiles", { levelId: L, zoneId: "z1", cells: [] })).toMatch(
      /Invalid arguments/,
    );
  });
});

describe("fillRect", () => {
  it("fills a rectangle", () => {
    const project = run(baseProject(), "fillRect", {
      levelId: L,
      zoneId: "z1",
      x: 2,
      y: 10,
      w: 3,
      h: 2,
      tile: 3,
    });
    const tiles = zoneOf(project, "z1").tiles;
    for (const [x, y] of [[2, 10], [4, 10], [2, 11], [4, 11]]) {
      expect(tiles[tileIndex(size, x, y)]).toBe(3);
    }
    expect(tiles[tileIndex(size, 5, 10)]).toBe(0);
    expect(tiles[tileIndex(size, 2, 12)]).toBe(0);
  });

  it("refuses a rectangle that is partly outside and changes nothing", () => {
    const project = baseProject();
    const error = runError(project, "fillRect", {
      levelId: L,
      zoneId: "z1",
      x: 14,
      y: 0,
      w: 4,
      h: 1,
      tile: 1,
    });
    expect(error).toMatch(/does not fit inside "Zone 1"/);
    expect(error).toMatch(/16 tiles wide and 15 tiles high/);
    expect(zoneOf(project, "z1").tiles[tileIndex(size, 14, 0)]).toBe(0);
  });

  it("refuses a zero-sized rectangle", () => {
    expect(
      runError(baseProject(), "fillRect", { levelId: L, zoneId: "z1", x: 0, y: 0, w: 0, h: 1, tile: 1 }),
    ).toMatch(/Invalid arguments/);
  });

  it("refuses an unknown tile", () => {
    expect(
      runError(baseProject(), "fillRect", { levelId: L, zoneId: "z1", x: 0, y: 0, w: 1, h: 1, tile: 42 }),
    ).toMatch(/no tile with id 42/);
  });
});

describe("clearRect", () => {
  it("empties tiles and removes the things inside", () => {
    let project = patchZone(baseProject(), "z1", {
      things: [
        { id: "in", type: "walker", x: 3, y: 12, settings: {} },
        { id: "out", type: "walker", x: 10, y: 12, settings: {} },
      ],
    });
    project = run(project, "clearRect", { levelId: L, zoneId: "z1", x: 0, y: 12, w: 5, h: 3 });
    const zone = zoneOf(project, "z1");
    expect(zone.tiles[tileIndex(size, 0, 13)]).toBe(0);
    expect(zone.tiles[tileIndex(size, 4, 14)]).toBe(0);
    expect(zone.tiles[tileIndex(size, 5, 14)]).toBe(1);
    expect(zone.things.map((t) => t.id)).toEqual(["out"]);
  });

  it("refuses a rectangle outside the zone", () => {
    expect(
      runError(baseProject(), "clearRect", { levelId: L, zoneId: "z1", x: 0, y: 14, w: 1, h: 2 }),
    ).toMatch(/does not fit inside "Zone 1"/);
  });
});
