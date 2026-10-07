import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { drawZoneView } from "@/editor/zoneView";
import { PALETTE_8BIT } from "@/model/palette";
import type { Sprite } from "@/runtime/render/art";
import { draw } from "@/runtime/render/draw";
import { lookArt, ownSkins } from "@/runtime/render/lookArt";
import { createSim, NO_INPUT } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { game, pack, run } from "../ai/helpers";

const fake = (sprite: Sprite, flip: boolean) => ({ sprite, flip }) as unknown as CanvasImageSource;

function fangGame() {
  let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
  project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 6, y: 12 });
  return project;
}

function recorder() {
  const images: { sprite: Sprite; flip: boolean }[] = [];
  return {
    images,
    fillStyle: "",
    font: "",
    textAlign: "start" as CanvasTextAlign,
    fillRect: () => {},
    fillText: () => {},
    drawImage: (image: CanvasImageSource) => images.push(image as unknown as { sprite: Sprite; flip: boolean }),
  };
}

describe("lookArt", () => {
  it("makes sprites of a look's frames, with its colours by slot digit", () => {
    const art = lookArt({ colours: [13, 20], frames: [["12"], ["21"]] });
    expect(art.palette).toEqual({ "1": PALETTE_8BIT[13], "2": PALETTE_8BIT[20] });
    expect(art.frames.map((f) => f.rows)).toEqual([["12"], ["21"]]);
  });

  it("makes a skin for each of the kid's enemies, keyed by thing type", () => {
    const skins = ownSkins(fangGame().enemies, () => fake);
    expect(Object.keys(skins)).toEqual(["own-e1"]);
    expect(skins["own-e1"].art.frames).toHaveLength(2);
  });
});

describe("drawing the kid's enemies", () => {
  it("draws them in the game from their own frames", () => {
    const project = fangGame();
    const sim = createSim(project, "L1", pack);
    step(sim, NO_INPUT);
    const own = ownSkins(project.enemies, () => fake);
    const ctx = recorder();
    draw(ctx, sim, { set: snowArt, image: fake, own });
    expect(ctx.images.some((i) => own["own-e1"].art.frames.includes(i.sprite))).toBe(true);
  });

  it("draws them on the zone canvas from their first frame", () => {
    const project = fangGame();
    const own = ownSkins(project.enemies, () => fake);
    const ctx = recorder();
    const zone = project.levels[0].zones[0];
    drawZoneView(ctx, zone, { ...pack, things: [{ ...pack.things[0], type: "own-e1", own: true }, ...pack.things] }, { set: snowArt, image: fake, own }, []);
    expect(ctx.images.some((i) => i.sprite === own["own-e1"].art.frames[0])).toBe(true);
  });
});

describe("the kid's boss", () => {
  it("includes the kid's boss when there is one", () => {
    let project = run(game(), "createBoss", { name: "Volt Viper" });
    project = run(project, "useBoss", { boss: "yours" });
    const skins = ownSkins(project.enemies, () => fake, project.boss);
    expect(skins["own-boss"].art.frames).toHaveLength(3);
    // Start the game in the boss room so the boss is on screen.
    const sim = createSim(project, "L1", pack, { startZoneId: "boss" });
    step(sim, NO_INPUT);
    const ctx = recorder();
    draw(ctx, sim, { set: snowArt, image: fake, own: skins });
    expect(ctx.images.some((i) => skins["own-boss"].art.frames.includes(i.sprite))).toBe(true);
  });
});

describe("looks with more than nine colours", () => {
  it("name slots 10 to 16 by their letters", () => {
    const colours = Array.from({ length: 16 }, (_, i) => i);
    const art = lookArt({ colours, frames: [["9ag"]] });
    expect(art.palette["9"]).toBe(PALETTE_8BIT[8]);
    expect(art.palette.a).toBe(PALETTE_8BIT[9]);
    expect(art.palette.g).toBe(PALETTE_8BIT[15]);
  });
});
