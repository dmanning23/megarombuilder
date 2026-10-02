import { describe, expect, it } from "vitest";
import {
  createTileMap,
  firstTile,
  isPlatform,
  isSolid,
  ladderAtPx,
  lastTile,
  touchingLadder,
} from "@/runtime/sim/tilemap";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith } from "./helpers";

function mapOf(art: string[], exit?: { edge: "right" | "top" | "bottom"; from: number; to: number } | null) {
  const zone = projectFromArt([{ art, exit }]).levels[0].zones[0];
  return createTileMap(zone, testPack);
}

describe("createTileMap", () => {
  const map = mapOf(
    flatArt({ 5: rowWith({ 4: "H" }), 6: rowWith({ 4: "H", 8: "=" }), 12: rowWith({ 2: "^", 3: "~" }) }),
  );

  it("measures the zone", () => {
    expect(map.width).toBe(16);
    expect(map.height).toBe(15);
    expect(map.widthPx).toBe(256);
    expect(map.heightPx).toBe(240);
  });

  it("reads what each tile does", () => {
    expect(map.behaviourAt(0, 0)).toBe("empty");
    expect(map.behaviourAt(0, 13)).toBe("solid");
    expect(map.behaviourAt(4, 5)).toBe("ladder");
    expect(map.behaviourAt(2, 12)).toBe("spike");
    expect(map.behaviourAt(3, 12)).toBe("ice");
    expect(map.behaviourAt(8, 6)).toBe("oneWay");
  });

  it("walls off the left edge at every height", () => {
    expect(map.behaviourAt(-1, 5)).toBe("solid");
    expect(map.behaviourAt(-1, -3)).toBe("solid");
    expect(map.behaviourAt(-1, 20)).toBe("solid");
  });

  it("walls off the right edge except across the exit opening", () => {
    expect(map.behaviourAt(16, 8)).toBe("solid");
    expect(map.behaviourAt(16, 9)).toBe("empty");
    expect(map.behaviourAt(16, 12)).toBe("empty");
    expect(map.behaviourAt(16, 13)).toBe("solid");
  });

  it("walls off the whole right edge when the exit is elsewhere or missing", () => {
    expect(mapOf(flatArt(), { edge: "top", from: 4, to: 5 }).behaviourAt(16, 10)).toBe("solid");
    expect(mapOf(flatArt(), null).behaviourAt(16, 10)).toBe("solid");
  });

  it("is open above and below", () => {
    expect(map.behaviourAt(5, -1)).toBe("empty");
    expect(map.behaviourAt(5, 15)).toBe("empty");
  });

  it("treats solid and ice as solid", () => {
    expect(isSolid("solid")).toBe(true);
    expect(isSolid("ice")).toBe(true);
    expect(isSolid("ladder")).toBe(false);
    expect(isSolid("spike")).toBe(false);
    expect(isSolid("oneWay")).toBe(false);
    expect(isSolid("empty")).toBe(false);
  });

  it("treats one-way tiles and ladder tops as platforms", () => {
    expect(isPlatform(map, 8, 6)).toBe(true);
    expect(isPlatform(map, 4, 5)).toBe(true);
    expect(isPlatform(map, 4, 6)).toBe(false);
    expect(isPlatform(map, 0, 13)).toBe(false);
  });

  it("finds ladders by pixel and by box", () => {
    expect(ladderAtPx(map, 70, 85)).toBe(true);
    expect(ladderAtPx(map, 90, 85)).toBe(false);
    // centre in the ladder
    expect(touchingLadder(map, { x: 65, y: 80, w: 14, h: 22 })).toBe(true);
    // centre above the ladder, feet in it
    expect(touchingLadder(map, { x: 65, y: 62, w: 14, h: 22 })).toBe(true);
    // feet exactly on top of the ladder
    expect(touchingLadder(map, { x: 65, y: 58, w: 14, h: 22 })).toBe(false);
  });
});

describe("firstTile and lastTile", () => {
  it("give the tiles a span covers", () => {
    expect(firstTile(0)).toBe(0);
    expect(firstTile(15.9)).toBe(0);
    expect(firstTile(16)).toBe(1);
    expect(firstTile(-0.5)).toBe(-1);
    expect(lastTile(16)).toBe(0);
    expect(lastTile(16.25)).toBe(1);
    expect(lastTile(32)).toBe(1);
  });
});
