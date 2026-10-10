import { describe, expect, it } from "vitest";
import { createDemoProject, DEMO_LEVEL_ID } from "@/content/demo";
import { snowArt } from "@/content/snow/art";
import { GROUND, snowPack } from "@/content/snow/pack";
import type { Sprite } from "@/runtime/render/art";
import type { Skin } from "@/runtime/render/draw";
import { createSim, step } from "@/runtime/sim";
import { kill } from "@/runtime/sim/hazards";
import {
  BACKGROUNDS,
  BOSS_BAR_COLOUR,
  draw,
  ENEMY_SHOT_COLOUR,
  ENTITY_COLOURS,
  PLAYER_COLOUR,
  SHOT_COLOUR,
} from "@/runtime/render/draw";
import { heroArt } from "@/runtime/render/heroArt";
import { createKeyboard } from "@/runtime/render/keyboard";
import { MAX_STEPS_PER_FRAME, STEP_MS, stepsFor } from "@/runtime/render/loop";
import { NO_INPUT } from "@/runtime/sim/state";
import { applyCommand } from "@/commands";
import { ownSkins } from "@/runtime/render/lookArt";
import { game, run as runCommand } from "../ai/helpers";
import { flatArt, thing } from "./helpers";
import { makeSim, run, runUntil } from "./simHelpers";

type Call = { colour: string; x: number; y: number; w: number; h: number };

function fakeContext() {
  const calls: Call[] = [];
  const texts: string[] = [];
  return {
    calls,
    texts,
    fillStyle: "" as string,
    font: "",
    textAlign: "start" as CanvasTextAlign,
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ colour: this.fillStyle, x, y, w, h });
    },
    fillText(text: string) {
      texts.push(text);
    },
    images: [] as { sprite: Sprite; flip: boolean; x: number; y: number }[],
    drawImage(image: CanvasImageSource, x: number, y: number) {
      const { sprite, flip } = image as unknown as { sprite: Sprite; flip: boolean };
      this.images.push({ sprite, flip, x, y });
    },
  };
}

describe("draw", () => {
  it("draws the background, the floor, the player and the health bar", () => {
    const sim = makeSim([{ art: flatArt() }]);
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls).toContainEqual({ colour: BACKGROUNDS.outdoor, x: 0, y: 0, w: 256, h: 240 });
    expect(ctx.calls).toContainEqual({ colour: PLAYER_COLOUR, x: 2, y: 186, w: 14, h: 22 });
    // 16 columns by 2 rows of floor
    expect(ctx.calls.filter((c) => c.w === 16 && c.h === 16)).toHaveLength(32);
    // one tick per point of health
    expect(ctx.calls.filter((c) => c.w === 6 && c.h === 1)).toHaveLength(28);
  });

  it("draws only the tiles on screen, offset by the camera", () => {
    const sim = makeSim([{ art: flatArt({}, 3) }]);
    sim.player.x = 400;
    const ctx = fakeContext();
    draw(ctx, sim);
    const tiles = ctx.calls.filter((c) => c.w === 16 && c.h === 16);
    // camera x is 279, so columns 17 to 33 show: 17 columns by 2 rows
    expect(tiles).toHaveLength(34);
    expect(Math.min(...tiles.map((t) => t.x))).toBe(17 * 16 - 279);
    expect(ctx.calls).toContainEqual({ colour: PLAYER_COLOUR, x: 400 - 279, y: 186, w: 14, h: 22 });
  });

  it("draws shots", () => {
    const sim = makeSim([{ art: flatArt() }]);
    run(sim, { shoot: true }, 1);
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls.filter((c) => c.colour === SHOT_COLOUR)).toHaveLength(1);
  });

  it("does not draw the player while dead", () => {
    const sim = makeSim([{ art: flatArt() }]);
    kill(sim);
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls.filter((c) => c.colour === PLAYER_COLOUR)).toHaveLength(0);
  });

  it("draws both zones during a transition", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt() }]);
    runUntil(sim, { right: true }, (s) => s.zoneIndex === 1);
    run(sim, {}, 24);
    const ctx = fakeContext();
    draw(ctx, sim);
    const backgrounds = ctx.calls.filter((c) => c.w === 256 && c.h === 240 && c.colour !== "#000000");
    expect(backgrounds.map((b) => b.x).sort((a, b) => a - b)).toEqual([-128, 128]);
  });
});

describe("drawing things", () => {
  it("draws enemies in their colour", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("walker", 10, 12)] }]);
    run(sim, {}, 1);
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls.filter((c) => c.colour === ENTITY_COLOURS.walker)).toHaveLength(1);
  });

  it("draws enemy shots", () => {
    const sim = makeSim([{ art: flatArt() }]);
    sim.enemyShots.push({ x: 100, y: 100, vx: -2, vy: 0, damage: 2 });
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls).toContainEqual({ colour: ENEMY_SHOT_COLOUR, x: 100, y: 100, w: 6, h: 6 });
  });

  it("blinks the player while invulnerable", () => {
    const sim = makeSim([{ art: flatArt() }]);
    const playerDrawn = () => {
      const ctx = fakeContext();
      draw(ctx, sim);
      return ctx.calls.some((c) => c.colour === PLAYER_COLOUR);
    };
    sim.player.invuln = 4;
    expect(playerDrawn()).toBe(false);
    sim.player.invuln = 8;
    expect(playerDrawn()).toBe(true);
  });

  it("shows the boss's health bar", () => {
    const sim = makeSim([{ art: flatArt(), things: [thing("boss", 12, 12)] }]);
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.calls.filter((c) => c.colour === BOSS_BAR_COLOUR)).toHaveLength(28);
  });

  it("announces a won stage", () => {
    const sim = makeSim([{ art: flatArt() }]);
    sim.phase = "won";
    const ctx = fakeContext();
    draw(ctx, sim);
    expect(ctx.texts).toEqual(["STAGE CLEAR"]);
  });
});

function key(type: string, code: string) {
  return Object.assign(new Event(type, { cancelable: true }), { code });
}

describe("createKeyboard", () => {
  it("ignores keys typed into a text box", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    const typed = key("keydown", "KeyZ");
    Object.defineProperty(typed, "target", { value: { tagName: "INPUT" } });
    target.dispatchEvent(typed);
    expect(keyboard.read()).toEqual(NO_INPUT);
    expect(typed.defaultPrevented).toBe(false);
  });

  it("ignores shortcuts made with Cmd, Ctrl or Alt", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    for (const modifier of ["metaKey", "ctrlKey", "altKey"]) {
      const event = Object.assign(key("keydown", "KeyZ"), { [modifier]: true });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(keyboard.read()).toEqual(NO_INPUT);
  });

  it("still releases a key whose release happens in a text box", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    target.dispatchEvent(key("keydown", "ArrowRight"));
    const release = key("keyup", "ArrowRight");
    Object.defineProperty(release, "target", { value: { tagName: "TEXTAREA" } });
    target.dispatchEvent(release);
    expect(keyboard.read()).toEqual(NO_INPUT);
  });
  it("reports held keys", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    expect(keyboard.read()).toEqual(NO_INPUT);
    target.dispatchEvent(key("keydown", "ArrowRight"));
    target.dispatchEvent(key("keydown", "KeyZ"));
    expect(keyboard.read()).toEqual({ ...NO_INPUT, right: true, jump: true });
    target.dispatchEvent(key("keyup", "ArrowRight"));
    expect(keyboard.read()).toEqual({ ...NO_INPUT, jump: true });
  });

  it("maps every control", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "KeyX"]) {
      target.dispatchEvent(key("keydown", code));
    }
    expect(keyboard.read()).toEqual({
      left: true,
      right: true,
      up: true,
      down: true,
      jump: true,
      shoot: true,
    });
  });

  it("stops mapped keys scrolling the page and leaves other keys alone", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    const arrow = key("keydown", "ArrowDown");
    const other = key("keydown", "KeyQ");
    target.dispatchEvent(arrow);
    target.dispatchEvent(other);
    expect(arrow.defaultPrevented).toBe(true);
    expect(other.defaultPrevented).toBe(false);
    expect(keyboard.read()).toEqual({ ...NO_INPUT, down: true });
  });

  it("releases every key when the window loses focus", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    target.dispatchEvent(key("keydown", "ArrowRight"));
    target.dispatchEvent(new Event("blur"));
    expect(keyboard.read()).toEqual(NO_INPUT);
  });

  it("returns a copy, so a caller cannot change the held keys", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    keyboard.read().jump = true;
    expect(keyboard.read().jump).toBe(false);
  });

  it("stops listening when disposed", () => {
    const target = new EventTarget();
    const keyboard = createKeyboard(target);
    keyboard.dispose();
    target.dispatchEvent(key("keydown", "ArrowRight"));
    expect(keyboard.read()).toEqual(NO_INPUT);
  });
});

describe("stepsFor", () => {
  it("runs one step per sixtieth of a second and keeps the remainder", () => {
    const result = stepsFor(0, 17);
    expect(result.steps).toBe(1);
    expect(result.accumulator).toBeCloseTo(17 - STEP_MS);
  });

  it("waits when not enough time has passed", () => {
    expect(stepsFor(0, 8)).toEqual({ steps: 0, accumulator: 8 });
    expect(stepsFor(10, 8).steps).toBe(1);
  });

  it("runs several steps to catch up", () => {
    expect(stepsFor(0, 50).steps).toBe(3);
  });

  it("caps a long frame and drops the rest", () => {
    expect(stepsFor(0, 5000)).toEqual({ steps: MAX_STEPS_PER_FRAME, accumulator: 0 });
  });

  it("ignores negative time", () => {
    expect(stepsFor(3, -100)).toEqual({ steps: 0, accumulator: 3 });
  });
});

// A skin whose "images" are just the sprite and direction, so tests can see what was drawn.
const fakeImage = (sprite: Sprite, flip: boolean) => ({ sprite, flip }) as unknown as CanvasImageSource;
const hero = heroArt(createDemoProject().hero.look);
const skin = (set = snowArt): Skin => ({ set, image: fakeImage, hero: { art: hero, image: fakeImage } });

function demoSim(startZoneId?: string) {
  const sim = createSim(createDemoProject(), DEMO_LEVEL_ID, snowPack, { startZoneId });
  step(sim, { left: false, right: false, up: false, down: false, jump: false, shoot: false });
  return sim;
}

describe("drawing with sprites", () => {
  const ground = snowArt.tiles.outdoor[GROUND];

  it("uses the art's background colour", () => {
    const ctx = fakeContext();
    draw(ctx, demoSim(), skin({ ...snowArt, backgrounds: { outdoor: "#123456", cave: "#000000" } }));
    expect(ctx.calls[1]).toEqual({ colour: "#123456", x: 0, y: 0, w: 256, h: 240 });
  });

  it("caps the top of the ground and fills below it", () => {
    const ctx = fakeContext();
    draw(ctx, demoSim(), skin());
    expect(ctx.images).toContainEqual({ sprite: ground.top, flip: false, x: 0, y: 208 });
    expect(ctx.images).toContainEqual({ sprite: ground.fill, flip: false, x: 0, y: 224 });
    // the one-tile step at column 10 covers the floor below it
    expect(ctx.images).toContainEqual({ sprite: ground.top, flip: false, x: 160, y: 192 });
    expect(ctx.images).toContainEqual({ sprite: ground.fill, flip: false, x: 160, y: 208 });
  });

  it("caps ground in the top row of a zone", () => {
    const sim = demoSim();
    sim.map.zone.tiles[0] = GROUND;
    const ctx = fakeContext();
    draw(ctx, sim, skin());
    expect(ctx.images).toContainEqual({ sprite: ground.top, flip: false, x: 0, y: 0 });
  });

  it("draws the hero standing, bottom-centred on the player's box", () => {
    const ctx = fakeContext();
    draw(ctx, demoSim(), skin());
    expect(ctx.images).toContainEqual({ sprite: hero.poses.stand, flip: false, x: 1, y: 184 });
    expect(ctx.calls.filter((c) => c.colour === PLAYER_COLOUR)).toEqual([]);
  });

  it("mirrors the hero when facing left", () => {
    const sim = demoSim();
    sim.player.facing = -1;
    const ctx = fakeContext();
    draw(ctx, sim, skin());
    expect(ctx.images).toContainEqual({ sprite: hero.poses.stand, flip: true, x: 1, y: 184 });
  });

  it("draws the game's own hero, recoloured", () => {
    const project = createDemoProject();
    const look = { ...project.hero.look, colours: [...project.hero.look.colours].reverse() };
    const sim = createSim({ ...project, hero: { ...project.hero, look } }, DEMO_LEVEL_ID, snowPack);
    step(sim, NO_INPUT);
    const own = heroArt(look);
    const ctx = fakeContext();
    draw(ctx, sim, { set: snowArt, image: fakeImage, hero: { art: own, image: fakeImage } });
    expect(ctx.images).toContainEqual({ sprite: own.poses.stand, flip: false, x: 1, y: 184 });
    expect(own.palette["1"]).not.toBe(hero.palette["1"]);
  });

  it("draws things with their frames", () => {
    const sim = demoSim("boss");
    const ctx = fakeContext();
    draw(ctx, sim, skin());
    const boss = sim.slots[0].entity;
    expect(ctx.images).toContainEqual({
      sprite: snowArt.things.boss[0],
      flip: true,
      x: Math.round(boss?.x ?? 0),
      y: Math.round(boss?.y ?? 0),
    });
  });

  it("falls back to rectangles for tiles and things with no art", () => {
    const sim = demoSim("boss");
    const ctx = fakeContext();
    draw(ctx, sim, skin({ ...snowArt, tiles: {}, things: {} }));
    expect(ctx.calls.filter((c) => c.w === 16 && c.h === 16)).toHaveLength(32);
    expect(ctx.calls.filter((c) => c.colour === ENTITY_COLOURS.boss)).toHaveLength(1);
  });

  it("skips a flashing enemy on its blink steps", () => {
    const sim = demoSim("boss");
    const boss = sim.slots[0].entity;
    if (!boss) throw new Error("no boss");
    boss.flash = 1;
    const ctx = fakeContext();
    draw(ctx, sim, skin());
    expect(ctx.images.some((i) => snowArt.things.boss.includes(i.sprite))).toBe(false);
  });

  it("draws shots as sprites", () => {
    const sim = demoSim();
    sim.shots.push({ x: 50, y: 190, vx: -4 });
    sim.enemyShots.push({ x: 90, y: 100, vx: 2, vy: 0, damage: 2 });
    const ctx = fakeContext();
    draw(ctx, sim, skin());
    expect(ctx.images).toContainEqual({ sprite: hero.shot, flip: true, x: 50, y: 190 });
    expect(ctx.images).toContainEqual({ sprite: snowArt.enemyShot, flip: false, x: 90, y: 100 });
  });
});

describe("animations in the game", () => {
  // A walker of the kid's whose walk has four frames, each a different solid colour slot, played fast.
  function fourFrameWalker() {
    let project = runCommand(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    const target = { enemy: "e1" };
    const solid = (ch: string) => Array.from({ length: 16 }, () => ch.repeat(16));
    project = runCommand(project, "setFrame", { target, animation: "walk", frame: 0, rows: solid("1") });
    project = runCommand(project, "setFrame", { target, animation: "walk", frame: 1, rows: solid("2") });
    project = runCommand(project, "addFrame", { target, animation: "walk", after: 1 });
    project = runCommand(project, "setFrame", { target, animation: "walk", frame: 2, rows: solid("3") });
    project = runCommand(project, "addFrame", { target, animation: "walk", after: 2 });
    project = runCommand(project, "setFrame", { target, animation: "walk", frame: 3, rows: solid("4") });
    project = runCommand(project, "setLookColours", { target, colours: [1, 2, 3, 4] });
    project = runCommand(project, "setAnimationSpeed", { target, animation: "walk", speed: "fast" });
    return runCommand(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 8, y: 12 });
  }

  it("cycles a kid's enemy through all its frames at its speed", () => {
    const project = fourFrameWalker();
    const own = ownSkins(project.enemies, () => fakeImage);
    const walk = own["own-e1"].animations.walk.frames;
    const sim = createSim(project, "L1", snowPack);
    sim.player.invuln = 1_000_000;
    const seen = new Set<Sprite>();
    for (let i = 0; i < 20; i++) {
      step(sim, NO_INPUT);
      const ctx = fakeContext();
      draw(ctx, sim, { set: snowArt, image: fakeImage, own });
      const shown = ctx.images.find((img) => walk.includes(img.sprite));
      if (shown) seen.add(shown.sprite);
    }
    expect(seen.size).toBe(4); // fast: 5 steps a frame, so 20 steps show all four
  });

  it("still blinks a kid's enemy after a hit", () => {
    const project = fourFrameWalker();
    const own = ownSkins(project.enemies, () => fakeImage);
    const sim = createSim(project, "L1", snowPack);
    step(sim, NO_INPUT);
    const fang = sim.slots.find((s) => s.thing.type === "own-e1")!.entity!;
    fang.flash = 1; // flash % 4 < 2: hidden on this draw
    const ctx = fakeContext();
    draw(ctx, sim, { set: snowArt, image: fakeImage, own });
    const walk = own["own-e1"].animations.walk.frames;
    expect(ctx.images.some((img) => walk.includes(img.sprite))).toBe(false);
  });

  it("draws an upgraded hero exactly as before at every step of a run", () => {
    const project = game();
    const art = heroArt(project.hero.look);
    const sim = createSim(project, "L1", snowPack);
    for (let i = 0; i < 24; i++) {
      step(sim, { ...NO_INPUT, right: true });
      if (!sim.player.onGround) continue;
      const ctx = fakeContext();
      draw(ctx, sim, { set: snowArt, image: fakeImage, hero: { art, image: fakeImage } });
      const expected = sim.player.vx === 0 ? art.poses.stand : Math.floor(sim.steps / 6) % 2 === 0 ? art.poses.run1 : art.poses.run2;
      expect(ctx.images.map((img) => img.sprite)).toContain(expected);
    }
  });

  it("lines the hero's picture up on its hitbox, facing either way", () => {
    let project = game();
    const result = applyCommand(project, { name: "setBody", args: { target: "hero", animation: "stand", body: { x: 0, y: 2, w: 12, h: 22 } } }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
    const art = heroArt(project.hero.look);
    const sim = createSim(project, "L1", snowPack);
    for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
    const at = (facing: 1 | -1) => {
      sim.player.facing = facing;
      const ctx = fakeContext();
      draw(ctx, sim, { set: snowArt, image: fakeImage, hero: { art, image: fakeImage } });
      return ctx.images.find((img) => img.sprite === art.poses.stand)!;
    };
    const right = at(1);
    const left = at(-1);
    // Facing right the hitbox is the picture's left 12 columns; mirrored, its right 12: 4 pixels along.
    expect(right.x - left.x).toBe(4);
  });
});
