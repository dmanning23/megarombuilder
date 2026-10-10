import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { snowPack } from "@/content/snow/pack";
import { newProject } from "@/editor/newProject";
import {
  CHECKPOINT_COLOUR,
  drawZoneView,
  ENTRY_COLOUR,
  EXIT_COLOUR,
  GRID_COLOUR,
  MARKER_COLOUR,
  SCREEN_LINE_COLOUR,
  tileFromPointer,
  zonePixels,
} from "@/editor/zoneView";
import type { Sprite } from "@/runtime/render/art";
import { ENTITY_COLOURS, type Skin } from "@/runtime/render/draw";
import { gamePack } from "@/model/gamePack";
import { ownSkins } from "@/runtime/render/lookArt";
import { game, run } from "../ai/helpers";

let n = 0;
const makeId = () => `id-${++n}`;

function fakeContext() {
  const calls: { colour: string; x: number; y: number; w: number; h: number }[] = [];
  const images: { sprite: Sprite; x: number; y: number }[] = [];
  return {
    calls,
    images,
    fillStyle: "" as string,
    font: "",
    textAlign: "start" as CanvasTextAlign,
    fillText() {},
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ colour: this.fillStyle, x, y, w, h });
    },
    drawImage(image: CanvasImageSource, x: number, y: number) {
      images.push({ sprite: (image as unknown as { sprite: Sprite }).sprite, x, y });
    },
  };
}

const skin: Skin = { set: snowArt, image: (sprite) => ({ sprite }) as unknown as CanvasImageSource };
const project = newProject("View", makeId);
const level = project.levels[0];
const [first, , bossRoom] = level.zones;

// The first zone widened to two screens, each row repeated side by side.
const wide = {
  ...first,
  screens: 2,
  tiles: Array.from({ length: 15 }, (_, y) => first.tiles.slice(y * 16, y * 16 + 16))
    .flatMap((row) => [...row, ...row]),
};

describe("zonePixels", () => {
  it("measures a zone in pixels", () => {
    expect(zonePixels(first)).toEqual({ width: 256, height: 240 });
    expect(zonePixels({ ...first, screens: 3 })).toEqual({ width: 768, height: 240 });
  });
});

describe("drawZoneView", () => {
  it("frames a marked tile", () => {
    const ctx = fakeContext();
    drawZoneView(ctx, first, snowPack, skin, [], { x: 5, y: 12 });
    expect(ctx.calls.filter((c) => c.colour === MARKER_COLOUR)).toEqual([
      { colour: MARKER_COLOUR, x: 78, y: 190, w: 20, h: 2 },
      { colour: MARKER_COLOUR, x: 78, y: 208, w: 20, h: 2 },
      { colour: MARKER_COLOUR, x: 78, y: 192, w: 2, h: 16 },
      { colour: MARKER_COLOUR, x: 96, y: 192, w: 2, h: 16 },
    ]);
  });
  it("draws the background over the whole zone and the floor with the art", () => {
    const ctx = fakeContext();
    drawZoneView(ctx, wide, snowPack, skin, []);
    expect(ctx.calls[0]).toEqual({ colour: snowArt.backgrounds.outdoor, x: 0, y: 0, w: 512, h: 240 });
    expect(ctx.images.filter((i) => i.y === 208)).toHaveLength(32);
  });

  it("draws a faint line between tiles and a stronger one between screens", () => {
    const ctx = fakeContext();
    drawZoneView(ctx, wide, snowPack, skin, []);
    const vertical = ctx.calls.filter((c) => c.w === 1 && c.h === 240);
    expect(vertical.filter((c) => c.colour === GRID_COLOUR)).toHaveLength(30);
    expect(vertical.filter((c) => c.colour === SCREEN_LINE_COLOUR).map((c) => c.x)).toEqual([256]);
  });

  it("marks the entry and the exit", () => {
    const ctx = fakeContext();
    drawZoneView(ctx, first, snowPack, skin, []);
    expect(ctx.calls).toContainEqual({ colour: ENTRY_COLOUR, x: 0, y: 144, w: 3, h: 64 });
    expect(ctx.calls).toContainEqual({ colour: EXIT_COLOUR, x: 253, y: 144, w: 3, h: 64 });
  });

  it("marks checkpoints in this zone only", () => {
    const ctx = fakeContext();
    drawZoneView(ctx, first, snowPack, skin, [
      { zoneId: first.id, x: 5, y: 12 },
      { zoneId: "elsewhere", x: 6, y: 12 },
    ]);
    expect(ctx.calls.filter((c) => c.colour === CHECKPOINT_COLOUR)).toEqual([
      { colour: CHECKPOINT_COLOUR, x: 86, y: 198, w: 4, h: 10 },
    ]);
  });

  it("draws things with their first frame, or as rectangles without art", () => {
    const withArt = fakeContext();
    drawZoneView(withArt, bossRoom, snowPack, skin, []);
    expect(withArt.images.some((i) => i.sprite === snowArt.things.boss[0])).toBe(true);
    const without = fakeContext();
    drawZoneView(without, bossRoom, snowPack, undefined, []);
    expect(without.calls.some((c) => c.colour === ENTITY_COLOURS.boss)).toBe(true);
  });

  it("draws the kid's own enemies lined up on their hitboxes, as the game does", () => {
    // A walker of the kid's on a 24 by 24 canvas, its hitbox at the canvas's left: placed at tile (6, 12).
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    project = run(project, "resizePose", { target: { enemy: "e1" }, animation: "walk", w: 24, h: 24 });
    project = run(project, "setBody", { target: { enemy: "e1" }, animation: "walk", body: { x: 0, y: 10, w: 14, h: 14 } });
    project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 6, y: 12 });
    const fakeImage = (s: Sprite) => ({ sprite: s }) as unknown as CanvasImageSource;
    const own = ownSkins(project.enemies, () => fakeImage);
    const ctx = fakeContext();
    drawZoneView(ctx, project.levels[0].zones[0], gamePack(project, snowPack), { set: snowArt, image: fakeImage, own }, []);
    const drawn = ctx.images.find((i) => i.sprite === own["own-e1"].art.frames[0])!;
    // The hitbox is 14 wide centred on the 16-wide tile (left 97) and 14 high on the tile's floor (top 194):
    // the picture's left is the hitbox's left, and its top is 10 above the hitbox's top.
    expect(drawn.x).toBe(6 * 16 + 1);
    expect(drawn.y).toBe(12 * 16 + 2 - 10);
  });
});

describe("tileFromPointer", () => {
  const rect = { left: 100, top: 50, width: 512, height: 480 }; // a one-screen zone shown at twice size

  it("finds the tile under the pointer at any display size", () => {
    expect(tileFromPointer(100, 50, rect, first)).toEqual({ x: 0, y: 0 });
    expect(tileFromPointer(100 + 5 * 32 + 10, 50 + 10 * 32 + 31, rect, first)).toEqual({ x: 5, y: 10 });
    expect(tileFromPointer(611, 529, rect, first)).toEqual({ x: 15, y: 14 });
  });

  it("returns null outside the zone or for an unmeasured canvas", () => {
    expect(tileFromPointer(99, 60, rect, first)).toBeNull();
    expect(tileFromPointer(612, 60, rect, first)).toBeNull();
    expect(tileFromPointer(200, 530, rect, first)).toBeNull();
    expect(tileFromPointer(0, 0, { left: 0, top: 0, width: 0, height: 0 }, first)).toBeNull();
  });
});
