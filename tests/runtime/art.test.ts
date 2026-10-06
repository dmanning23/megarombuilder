import { describe, expect, it } from "vitest";
import {
  artProblems,
  sprite,
  spriteProblems,
  type ArtSet,
  type Sprite,
  playerPose,
  thingFrame,
} from "@/runtime/render/art";
import type { Entity } from "@/runtime/sim/entities/types";
import type { Player } from "@/runtime/sim/state";
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
    things: Object.fromEntries(testPack.things.map((t) => [t.type, [square(14)]])),
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

  it("reports a missing background or thing", () => {
    const art = fullArt();
    art.backgrounds = { outdoor: "#9bd4ff" };
    art.things = { ...art.things, boss: [] };
    const problems = artProblems(art, testPack);
    expect(problems).toContain('No background colour for variant "cave".');
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

const player = (overrides: Partial<Player> = {}): Player => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  w: 14,
  h: 22,
  facing: 1,
  onGround: true,
  onIce: false,
  onLadder: false,
  health: 28,
  hurt: 0,
  invuln: 0,
  knockback: 1,
  ridingId: null,
  shotTimer: 0,
  ...overrides,
});

describe("playerPose", () => {
  it("stands, and mirrors when facing left", () => {
    expect(playerPose(player(), 0)).toEqual({ pose: "stand", flip: false });
    expect(playerPose(player({ facing: -1 }), 0)).toEqual({ pose: "stand", flip: true });
  });

  it("shows shooting poses while the shot timer runs", () => {
    expect(playerPose(player({ shotTimer: 5 }), 0).pose).toBe("standShoot");
    expect(playerPose(player({ shotTimer: 5, onGround: false }), 0).pose).toBe("jumpShoot");
  });

  it("alternates run frames every 6 steps", () => {
    expect(playerPose(player({ vx: 1.375 }), 0).pose).toBe("run1");
    expect(playerPose(player({ vx: 1.375 }), 6).pose).toBe("run2");
    expect(playerPose(player({ vx: 1.375 }), 12).pose).toBe("run1");
  });

  it("jumps in the air", () => {
    expect(playerPose(player({ onGround: false }), 0).pose).toBe("jump");
  });

  it("climbs, mirroring every 8 pixels whichever way the player faces", () => {
    expect(playerPose(player({ onLadder: true, y: 0, facing: -1 }), 0)).toEqual({ pose: "climb", flip: false });
    expect(playerPose(player({ onLadder: true, y: 8 }), 0)).toEqual({ pose: "climb", flip: true });
  });

  it("shows the hurt pose above everything else", () => {
    expect(playerPose(player({ hurt: 3, onLadder: true, shotTimer: 4 }), 0).pose).toBe("hurt");
  });
});

describe("thingFrame", () => {
  const thing = (overrides: Partial<Entity>): Entity => ({
    x: 0, y: 0, w: 14, h: 14, vx: 0, vy: 0, onGround: true, onIce: false,
    id: "t", type: "walker", behaviour: "walker", facing: 1, health: 1, mode: "walk",
    timer: 0, attack: 0, homeX: 0, homeY: 0, dx: 0, dy: 0, flash: 0, settings: {},
    ...overrides,
  });

  it("cycles ordinary things every 8 steps", () => {
    expect(thingFrame(thing({}), 0, 2)).toBe(0);
    expect(thingFrame(thing({}), 8, 2)).toBe(1);
    expect(thingFrame(thing({}), 16, 2)).toBe(0);
    expect(thingFrame(thing({}), 99, 1)).toBe(0);
  });

  it("follows the state of shielded, dropping and jumping enemies", () => {
    expect(thingFrame(thing({ behaviour: "shielded", mode: "open" }), 0, 2)).toBe(1);
    expect(thingFrame(thing({ behaviour: "shielded", mode: "walk" }), 8, 2)).toBe(0);
    expect(thingFrame(thing({ behaviour: "dropper", mode: "hang" }), 8, 2)).toBe(0);
    expect(thingFrame(thing({ behaviour: "dropper", mode: "walk" }), 0, 2)).toBe(1);
    expect(thingFrame(thing({ behaviour: "jumper", onGround: false }), 0, 2)).toBe(1);
  });

  it("shows the boss's attack", () => {
    expect(thingFrame(thing({ behaviour: "boss", mode: "jump" }), 0, 3)).toBe(1);
    expect(thingFrame(thing({ behaviour: "boss", mode: "shot" }), 0, 3)).toBe(2);
    expect(thingFrame(thing({ behaviour: "boss", mode: "dash" }), 8, 3)).toBe(0);
  });

  it("never picks a frame that does not exist", () => {
    expect(thingFrame(thing({ behaviour: "boss", mode: "shot" }), 0, 1)).toBe(0);
  });
});
