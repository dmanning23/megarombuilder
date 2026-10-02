import { describe, expect, it } from "vitest";
import { tileIndex } from "@/model/geometry";
import { baseProject, run, runError, zoneOf } from "./helpers";

const L = "L1";
const size = { width: 16, height: 15 };

describe("insertPiece", () => {
  it("stamps the piece's tiles and things using default settings", () => {
    const project = run(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 4,
      y: 11,
      idPrefix: "p1",
    });
    const zone = zoneOf(project, "z1");
    // default step: 2 wide, 1 high, plus one kept row on top for the walker
    expect(zone.tiles[tileIndex(size, 4, 11)]).toBe(0);
    expect(zone.tiles[tileIndex(size, 4, 12)]).toBe(1);
    expect(zone.tiles[tileIndex(size, 5, 12)]).toBe(1);
    expect(zone.tiles[tileIndex(size, 6, 12)]).toBe(0);
    expect(zone.things).toEqual([
      { id: "p1-1", type: "walker", x: 4, y: 11, settings: { speed: 1 } },
    ]);
  });

  it("leaves existing tiles alone where the piece says keep", () => {
    let project = run(baseProject(), "setTiles", {
      levelId: L,
      zoneId: "z1",
      cells: [{ x: 4, y: 11, tile: 2 }],
    });
    project = run(project, "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 4,
      y: 11,
      idPrefix: "p1",
    });
    expect(zoneOf(project, "z1").tiles[tileIndex(size, 4, 11)]).toBe(2);
  });

  it("uses given settings", () => {
    const project = run(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 0,
      y: 9,
      settings: { width: 4, height: 3 },
      idPrefix: "p1",
    });
    const tiles = zoneOf(project, "z1").tiles;
    expect(tiles[tileIndex(size, 3, 10)]).toBe(1);
    expect(tiles[tileIndex(size, 3, 12)]).toBe(1);
    expect(tiles[tileIndex(size, 4, 10)]).toBe(0);
  });

  it("refuses an unknown piece and lists the real ones", () => {
    const error = runError(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "loop",
      x: 0,
      y: 0,
      idPrefix: "p1",
    });
    expect(error).toMatch(/no piece called "loop"/);
    expect(error).toMatch(/step/);
  });

  it("refuses a setting outside its range and gives the range", () => {
    const error = runError(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 0,
      y: 0,
      settings: { width: 9 },
      idPrefix: "p1",
    });
    expect(error).toMatch(/"width" must be a whole number from 1 to 4/);
  });

  it("refuses a fractional setting", () => {
    expect(
      runError(baseProject(), "insertPiece", {
        levelId: L,
        zoneId: "z1",
        pieceId: "step",
        x: 0,
        y: 0,
        settings: { width: 1.5 },
        idPrefix: "p1",
      }),
    ).toMatch(/"width" must be a whole number from 1 to 4/);
  });

  it("refuses an unknown setting and lists the real ones", () => {
    const error = runError(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 0,
      y: 0,
      settings: { depth: 2 },
      idPrefix: "p1",
    });
    expect(error).toMatch(/has no setting called "depth"/);
    expect(error).toMatch(/width, height/);
  });

  it("refuses a piece that does not fit and gives both sizes", () => {
    const error = runError(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 15,
      y: 11,
      idPrefix: "p1",
    });
    expect(error).toMatch(/is 2 tiles wide and 2 tiles high/);
    expect(error).toMatch(/does not fit at \(15, 11\)/);
    expect(error).toMatch(/16 tiles wide and 15 tiles high/);
  });

  it("refuses an id prefix that would repeat a thing id", () => {
    const project = run(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 4,
      y: 11,
      idPrefix: "p1",
    });
    expect(
      runError(project, "insertPiece", {
        levelId: L,
        zoneId: "z1",
        pieceId: "step",
        x: 8,
        y: 11,
        idPrefix: "p1",
      }),
    ).toMatch(/already a thing with id "p1-1"/);
  });
});
