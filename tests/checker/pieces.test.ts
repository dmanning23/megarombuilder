import { describe, expect, it } from "vitest";
import { checkZone } from "@/checker/check";
import { snowPack } from "@/content/snow/pack";
import { snowPieces } from "@/content/snow/pieces";
import { settingCombos, zoneWithPiece } from "./pieceHarness";

const EXPECTED = [
  "flat-run",
  "stairs-up",
  "stairs-down",
  "gap",
  "spike-pit",
  "spike-pit-platform",
  "ice-run",
  "ladder-climb",
  "ladder-turrets",
  "stepped-platforms",
  "enemy-gauntlet",
  "rest-area",
];

describe("snow pieces", () => {
  it("are the snow pack's pieces", () => {
    expect(snowPack.pieces).toBe(snowPieces);
    for (const id of EXPECTED) expect(snowPieces.map((p) => p.id)).toContain(id);
  });

  it("are 15 rows high, fill every cell, and place only known things", () => {
    for (const piece of snowPieces) {
      for (const settings of settingCombos(piece)) {
        const built = piece.build(settings);
        const where = `${piece.id} ${JSON.stringify(settings)}`;
        expect(built.height, where).toBe(15);
        expect(built.tiles, where).toHaveLength(built.width * 15);
        expect(built.tiles.every((t) => t >= 0), where).toBe(true);
        for (const t of built.things) {
          expect(snowPack.things.map((d) => d.type), where).toContain(t.type);
        }
      }
    }
  });

  it("has twelve pieces with different ids", () => {
    expect(snowPieces).toHaveLength(12);
    expect(new Set(snowPieces.map((p) => p.id)).size).toBe(12);
  });

  it("scale enemies with difficulty", () => {
    const gauntlet = snowPieces.find((p) => p.id === "enemy-gauntlet");
    const count = (difficulty: number) => gauntlet?.build({ width: 10, difficulty }).things.length ?? 0;
    expect(count(1)).toBeLessThan(count(2));
    expect(count(2)).toBeLessThan(count(3));
  });

  it("end ladder climbs higher by their height", () => {
    const climb = snowPieces.find((p) => p.id === "ladder-climb");
    expect(climb?.build({ height: 5 })).toMatchObject({ enterRow: 13, exitRow: 8 });
  });

  for (const piece of snowPieces) {
    it(`can be crossed: ${piece.id}, at every setting extreme`, () => {
      for (const settings of settingCombos(piece)) {
        const result = checkZone(zoneWithPiece(piece, settings), "L", "z", snowPack);
        expect(result.passable, `${piece.id} ${JSON.stringify(settings)}: ${result.reason}`).toBe(true);
      }
    });
  }

  it("say the right heights: stairs end higher, and a flat run does not", () => {
    const up = snowPieces.find((p) => p.id === "stairs-up");
    expect(up?.build({ steps: 3, rise: 2 })).toMatchObject({ enterRow: 13, exitRow: 7 });
    const down = snowPieces.find((p) => p.id === "stairs-down");
    expect(down?.build({ steps: 3, rise: 2 })).toMatchObject({ enterRow: 7, exitRow: 13 });
    expect(snowPieces.find((p) => p.id === "flat-run")?.build({ width: 6 })).toMatchObject({ enterRow: 13, exitRow: 13 });
  });
});
