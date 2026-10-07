import { describe, expect, it } from "vitest";
import { entityShown, frameSteps, heroShown, pickFrame, type Timing } from "@/runtime/render/animate";
import type { Entity } from "@/runtime/sim/entities/types";
import type { Player } from "@/runtime/sim/state";

const player = (o: Partial<Player> = {}): Player => ({
  x: 0, y: 0, vx: 0, vy: 0, w: 14, h: 22, facing: 1, onGround: true, onIce: false, onLadder: false,
  health: 28, hurt: 0, invuln: 0, knockback: 1, ridingId: null, shotTimer: 0, slide: 0, charge: 0, airSteps: 0,
  ...o,
});
const entity = (o: Partial<Entity> = {}): Entity => ({
  x: 0, y: 0, w: 14, h: 14, vx: 0, vy: 0, onGround: true, onIce: false,
  id: "t", type: "own-e1", behaviour: "walker", facing: 1, health: 1, mode: "walk",
  timer: 0, attack: 0, homeX: 0, homeY: 0, dx: 0, dy: 0, flash: 0, modeSteps: 0, settings: {},
  ...o,
});
const t = (frames: number, speed: Timing["speed"] = "normal"): Timing => ({ frames, speed });
const heroTimings = (frames = 1): Record<string, Timing> =>
  Object.fromEntries(
    ["stand", "standShoot", "run", "runShoot", "jump", "jumpShoot", "climb", "hurt", "slide"].map((a) => [a, t(a === "run" || a === "runShoot" ? 2 : frames)]),
  );

describe("frame timing", () => {
  it("uses the spec's steps per frame", () => {
    expect([frameSteps(6, "slow"), frameSteps(6, "normal"), frameSteps(6, "fast")]).toEqual([9, 6, 4]);
    expect([frameSteps(8, "slow"), frameSteps(8, "normal"), frameSteps(8, "fast")]).toEqual([12, 8, 5]);
  });

  it("loops, or plays once and holds the last frame", () => {
    expect([0, 7, 8, 23, 24].map((e) => pickFrame(t(3), 8, e, true))).toEqual([0, 0, 1, 2, 0]);
    expect([0, 8, 16, 100].map((e) => pickFrame(t(3), 8, e, false))).toEqual([0, 1, 2, 2]);
  });

  it("always shows frame 0 of a one-frame animation", () => {
    for (const speed of ["slow", "normal", "fast"] as const) {
      for (const e of [0, 1, 5, 99, 12345]) {
        expect(pickFrame(t(1, speed), 8, e, true)).toBe(0);
        expect(pickFrame(t(1, speed), 8, e, false)).toBe(0);
      }
    }
  });
});

describe("heroShown", () => {
  it("picks today's poses, in today's order", () => {
    const timings = heroTimings();
    expect(heroShown(player({ h: 14, vx: 2.5 }), 0, timings)).toEqual({ animation: "slide", frame: 0, flip: false });
    expect(heroShown(player({ hurt: 3, onLadder: true, shotTimer: 4 }), 0, timings).animation).toBe("hurt");
    expect(heroShown(player({ facing: -1 }), 0, timings)).toEqual({ animation: "stand", frame: 0, flip: true });
    expect(heroShown(player({ shotTimer: 5 }), 0, timings).animation).toBe("standShoot");
    expect(heroShown(player({ shotTimer: 5, onGround: false }), 0, timings).animation).toBe("jumpShoot");
    expect(heroShown(player({ onGround: false }), 0, timings).animation).toBe("jump");
    expect(heroShown(player({ vx: 1.375, shotTimer: 3 }), 0, timings).animation).toBe("runShoot");
  });

  it("runs through its two frames every 6 steps, as today", () => {
    const shown = [0, 6, 12].map((steps) => heroShown(player({ vx: 1.375 }), steps, heroTimings()));
    expect(shown.map((s) => [s.animation, s.frame])).toEqual([["run", 0], ["run", 1], ["run", 0]]);
  });

  it("plays the jump once from take-off and holds its last frame", () => {
    const timings = { ...heroTimings(), jump: t(3) };
    const frames = [1, 8, 16, 200].map((airSteps) => heroShown(player({ onGround: false, airSteps }), 999, timings).frame);
    expect(frames).toEqual([0, 1, 2, 2]);
  });

  it("plays hurt once from the knock", () => {
    const timings = { ...heroTimings(), hurt: t(2) };
    expect(heroShown(player({ hurt: 16 }), 0, timings).frame).toBe(0); // HURT_STEPS: just hit
    expect(heroShown(player({ hurt: 1 }), 0, timings).frame).toBe(1);
  });

  it("climbs by distance: a one-frame climb mirrors every 8 pixels, more frames play forwards going up", () => {
    expect(heroShown(player({ onLadder: true, y: 0, facing: -1 }), 0, heroTimings())).toEqual({ animation: "climb", frame: 0, flip: false });
    expect(heroShown(player({ onLadder: true, y: 8 }), 0, heroTimings())).toEqual({ animation: "climb", frame: 0, flip: true });
    const timings = { ...heroTimings(), climb: t(3) };
    const up = [48, 40, 32, 24].map((y) => heroShown(player({ onLadder: true, y }), 0, timings));
    expect(up.map((s) => s.frame)).toEqual([0, 1, 2, 0]);
    expect(up.every((s) => !s.flip)).toBe(true);
    const down = [24, 32, 40].map((y) => heroShown(player({ onLadder: true, y }), 0, timings).frame);
    expect(down).toEqual([0, 2, 1]); // back down: the same frames the other way
  });
});

describe("entityShown", () => {
  it("picks each behaviour's animation from its state", () => {
    expect(entityShown(entity({ behaviour: "walker" }), 8, { walk: t(2) })).toEqual({ animation: "walk", frame: 1, flip: false });
    expect(entityShown(entity({ behaviour: "flyer", facing: -1 }), 0, { fly: t(2) })).toEqual({ animation: "fly", frame: 0, flip: true });
    expect(entityShown(entity({ behaviour: "turret" }), 0, { idle: t(1) }).animation).toBe("idle");
    expect(entityShown(entity({ behaviour: "jumper", onGround: false }), 0, { ground: t(1), air: t(1) }).animation).toBe("air");
    expect(entityShown(entity({ behaviour: "shielded", mode: "open" }), 0, { closed: t(1), open: t(1) }).animation).toBe("open");
    expect(entityShown(entity({ behaviour: "dropper", mode: "fall" }), 0, { hang: t(1), fall: t(1) }).animation).toBe("fall");
  });

  it("plays the boss's jump and attack once from when they start, and loops its stand", () => {
    const timings = { stand: t(2), jump: t(3), attack: t(3) };
    const boss = (mode: string, modeSteps: number) => entityShown(entity({ behaviour: "boss", type: "own-boss", mode, modeSteps }), 8, timings);
    expect(boss("idle", 0)).toMatchObject({ animation: "stand", frame: 1 });
    expect(boss("dash", 0).animation).toBe("stand");
    expect([0, 8, 16, 99].map((s) => boss("jump", s).frame)).toEqual([0, 1, 2, 2]);
    for (const mode of ["spread", "aimed", "rain", "big"]) expect(boss(mode, 8)).toMatchObject({ animation: "attack", frame: 1 });
  });
});
