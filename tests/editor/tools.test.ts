import { describe, expect, it } from "vitest";
import { snowPack } from "@/content/snow/pack";
import { SPIKE } from "@/content/snow/tiles";
import { newProject } from "@/editor/newProject";
import { paintCommand, placeCommand, thingAt } from "@/editor/tools";
import { spotFromPointer } from "@/editor/zoneView";
import type { Zone } from "@/model/schema";

let n = 0;
const makeId = () => `id-${++n}`;
const level = newProject("Tools", makeId).levels[0];
const first = level.zones[0];
const walker = (id: string, x: number, y: number) => ({ id, type: "walker", x, y, settings: {} });
const spot = (tx: number, ty: number, px = tx * 16 + 8, py = ty * 16 + 8) => ({
  tile: { x: tx, y: ty },
  point: { x: px, y: py },
});

describe("spotFromPointer", () => {
  it("gives the tile and the point in zone pixels", () => {
    const rect = { left: 0, top: 0, width: 512, height: 480 };
    expect(spotFromPointer(5 * 32 + 10, 12 * 32 + 20, rect, first)).toEqual({
      tile: { x: 5, y: 12 },
      point: { x: 85, y: 202 },
    });
    expect(spotFromPointer(-1, 0, rect, first)).toBeNull();
  });
});

describe("thingAt", () => {
  const zone: Zone = { ...first, things: [walker("a", 5, 12), walker("b", 5, 12), walker("c", 9, 12)] };

  it("finds the thing under a point, the last placed one first", () => {
    expect(thingAt(zone, snowPack, { x: 88, y: 200 })?.id).toBe("b");
    expect(thingAt(zone, snowPack, { x: 152, y: 200 })?.id).toBe("c");
  });

  it("finds nothing in empty space or for unknown types", () => {
    expect(thingAt(zone, snowPack, { x: 30, y: 30 })).toBeNull();
    const odd: Zone = { ...first, things: [{ id: "x", type: "dragon", x: 1, y: 1, settings: {} }] };
    expect(thingAt(odd, snowPack, { x: 24, y: 24 })).toBeNull();
  });
});

describe("paintCommand", () => {
  it("paints the tile under the press", () => {
    expect(paintCommand({ kind: "tile", tile: SPIKE }, level.id, first, snowPack, spot(3, 4))).toEqual({
      name: "setTiles",
      args: { levelId: level.id, zoneId: first.id, cells: [{ x: 3, y: 4, tile: SPIKE }] },
    });
  });

  it("erases a thing under the press before a tile", () => {
    const zone: Zone = { ...first, things: [walker("a", 5, 12)] };
    expect(paintCommand({ kind: "erase" }, level.id, zone, snowPack, spot(5, 12, 88, 200))).toEqual({
      name: "removeThing",
      args: { levelId: level.id, zoneId: first.id, thingId: "a" },
    });
    expect(paintCommand({ kind: "erase" }, level.id, zone, snowPack, spot(2, 13))).toEqual({
      name: "setTiles",
      args: { levelId: level.id, zoneId: first.id, cells: [{ x: 2, y: 13, tile: 0 }] },
    });
  });
});

describe("placeCommand", () => {
  it("places a thing on the pressed tile with a new id", () => {
    expect(placeCommand({ kind: "thing", type: "walker" }, level.id, first, spot(5, 12), () => "new")).toEqual({
      name: "placeThing",
      args: { levelId: level.id, zoneId: first.id, thingId: "new", type: "walker", x: 5, y: 12 },
    });
  });

  it("stamps a piece from the pressed column, at the top of a sideways zone", () => {
    const tool = { kind: "piece" as const, pieceId: "gap", settings: { width: 2 } };
    expect(placeCommand(tool, level.id, first, spot(4, 9), () => "p")).toEqual({
      name: "insertPiece",
      args: { levelId: level.id, zoneId: first.id, pieceId: "gap", x: 4, y: 0, settings: { width: 2 }, idPrefix: "p" },
    });
  });

  it("stamps a piece at the pressed row of a climbing zone, kept inside it", () => {
    const climb: Zone = { ...first, scroll: "vertical", screens: 2 };
    const tool = { kind: "piece" as const, pieceId: "gap", settings: { width: 2 } };
    expect(placeCommand(tool, level.id, climb, spot(4, 6), () => "p").args).toMatchObject({ y: 6 });
    expect(placeCommand(tool, level.id, climb, spot(4, 25), () => "p").args).toMatchObject({ y: 15 });
  });
});
