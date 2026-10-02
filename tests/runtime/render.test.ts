import { describe, expect, it } from "vitest";
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
import { createKeyboard } from "@/runtime/render/keyboard";
import { MAX_STEPS_PER_FRAME, STEP_MS, stepsFor } from "@/runtime/render/loop";
import { NO_INPUT } from "@/runtime/sim/state";
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
