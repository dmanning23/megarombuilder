import { describe, expect, it } from "vitest";
import {
  artProblems,
  PLAYER_POSES,
  sprite,
  spriteProblems,
  type ArtSet,
  type Sprite,
} from "@/runtime/render/art";
import { testPack } from "../fixtures/testPack";

const palette = { k: "#000000", w: "#ffffff" };
const square = (size: number): Sprite => sprite(Array.from({ length: size }, () => "k".repeat(size)));

// A complete art set for the test pack, every sprite a solid square.
function fullArt(): ArtSet {
  const tiles = Object.fromEntries(testPack.tiles.map((t) => [t.id, { fill: square(16) }]));
  return {
    palette,
    backgrounds: { outdoor: "#9bd4ff", cave: "#1c2740" },
    tiles: { outdoor: tiles, cave: tiles },
    player: Object.fromEntries(PLAYER_POSES.map((p) => [p, sprite(Array(24).fill("k".repeat(16)))])) as ArtSet["player"],
    things: Object.fromEntries(testPack.things.map((t) => [t.type, [square(14)]])),
    playerShot: square(4),
    enemyShot: square(6),
  };
}

describe("sprite", () => {
  it("measures its rows", () => {
    expect(sprite(["k.k", ".w."])).toEqual({ w: 3, h: 2, rows: ["k.k", ".w."] });
  });
});

describe("spriteProblems", () => {
  it("accepts a good sprite", () => {
    expect(spriteProblems("Dot", sprite(["k.", ".w"]), palette)).toEqual([]);
  });

  it("reports a row of the wrong width", () => {
    expect(spriteProblems("Dot", sprite(["kk", "k"]), palette)).toEqual([
      "Dot row 1 is 1 wide, not 2.",
    ]);
  });

  it("reports a colour that is not in the palette", () => {
    expect(spriteProblems("Dot", sprite(["kz"]), palette)).toEqual([
      'Dot row 0 uses "z", which is not in the palette.',
    ]);
  });

  it("reports an empty sprite", () => {
    expect(spriteProblems("Dot", sprite([]), palette)).toEqual(["Dot has no rows."]);
  });
});

describe("artProblems", () => {
  it("finds nothing wrong with complete art", () => {
    expect(artProblems(fullArt(), testPack)).toEqual([]);
  });

  it("reports a tile with no art in a variant", () => {
    const art = fullArt();
    art.tiles = { ...art.tiles, cave: {} };
    expect(artProblems(art, testPack)).toContain('No art for tile "ground" in variant "cave".');
  });

  it("reports a tile sprite that is not 16 by 16", () => {
    const art = fullArt();
    art.tiles = { ...art.tiles, outdoor: { ...art.tiles.outdoor, 1: { fill: square(8) } } };
    expect(artProblems(art, testPack)).toContain('Tile "ground" (outdoor) is 8 by 8, not 16 by 16.');
  });

  it("reports a missing background, player pose or thing", () => {
    const art = fullArt();
    art.backgrounds = { outdoor: "#9bd4ff" };
    art.player = { ...art.player, hurt: square(16) };
    art.things = { ...art.things, boss: [] };
    const problems = artProblems(art, testPack);
    expect(problems).toContain('No background colour for variant "cave".');
    expect(problems).toContain("Player hurt is 16 by 16, not 16 by 24.");
    expect(problems).toContain('No art for thing "boss".');
  });

  it("reports a broken sprite anywhere in the set", () => {
    const art = fullArt();
    art.enemyShot = sprite(["kk", "kq"]);
    expect(artProblems(art, testPack)).toContain(
      'Enemy shot row 1 uses "q", which is not in the palette.',
    );
  });
});
