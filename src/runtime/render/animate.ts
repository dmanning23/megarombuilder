import type { AnimationSpeed } from "@/model/look";
import { HURT_STEPS } from "../sim/constants";
import type { Entity } from "../sim/entities/types";
import type { Player } from "../sim/state";

// Which animation a character shows, and which of its frames, from the game's state alone.

export type Timing = { frames: number; speed: AnimationSpeed };
export type Shown = { animation: string; frame: number; flip: boolean };

const FACTOR: Record<AnimationSpeed, number> = { slow: 1.5, normal: 1, fast: 2 / 3 };
const RUN_BASE = 6; // the hero's run changes frame every 6 steps at normal speed
const BASE = 8; // everything else every 8
const CLIMB_PIXELS = 8; // a climb steps one frame every 8 pixels

export const baseFor = (animation: string): number => (animation === "run" || animation === "runShoot" ? RUN_BASE : BASE);

export const frameSteps = (base: number, speed: AnimationSpeed): number => Math.round(base * FACTOR[speed]);

export function pickFrame(timing: Timing, base: number, elapsed: number, loop: boolean): number {
  const n = Math.max(1, timing.frames);
  const i = Math.floor(Math.max(0, elapsed) / frameSteps(base, timing.speed));
  return loop ? i % n : Math.min(i, n - 1);
}

const ONE: Timing = { frames: 1, speed: "normal" };
const timingOf = (timings: Record<string, Timing>, animation: string) => timings[animation] ?? ONE;

export function heroShown(p: Player, steps: number, timings: Record<string, Timing>): Shown {
  const flip = p.facing < 0;
  const loop = (animation: string, base = BASE): Shown => ({ animation, frame: pickFrame(timingOf(timings, animation), base, steps, true), flip });
  const once = (animation: string, elapsed: number): Shown => ({ animation, frame: pickFrame(timingOf(timings, animation), BASE, elapsed, false), flip });

  if (p.h < p.standH) return loop("slide");
  if (p.hurt > 0) return once("hurt", HURT_STEPS - p.hurt);
  if (p.onLadder) {
    const n = timingOf(timings, "climb").frames;
    const rung = Math.floor(p.y / CLIMB_PIXELS);
    if (n <= 1) return { animation: "climb", frame: 0, flip: rung % 2 === 1 }; // mirrors, as it always has
    return { animation: "climb", frame: (((-rung) % n) + n) % n, flip: false }; // y falls going up: forwards
  }
  const shooting = p.shotTimer > 0;
  if (!p.onGround) return once(shooting ? "jumpShoot" : "jump", p.airSteps);
  if (p.vx !== 0) {
    const run = shooting ? "runShoot" : "run";
    return loop(run, baseFor(run));
  }
  return loop(shooting ? "standShoot" : "stand");
}

const BOSS_ATTACKS = new Set(["spread", "aimed", "rain", "big"]);

export function entityShown(e: Entity, steps: number, timings: Record<string, Timing>): Shown {
  const flip = e.facing < 0;
  const loop = (animation: string): Shown => ({ animation, frame: pickFrame(timingOf(timings, animation), BASE, steps, true), flip });
  const once = (animation: string): Shown => ({ animation, frame: pickFrame(timingOf(timings, animation), BASE, e.modeSteps, false), flip });
  switch (e.behaviour) {
    case "walker":
      return loop("walk");
    case "flyer":
      return loop("fly");
    case "turret":
      return loop("idle");
    case "jumper":
      return loop(e.onGround ? "ground" : "air");
    case "shielded":
      return loop(e.mode === "open" ? "open" : "closed");
    case "dropper":
      return loop(e.mode === "hang" ? "hang" : "fall");
    case "boss":
      if (e.mode === "jump") return once("jump");
      if (BOSS_ATTACKS.has(e.mode)) return once("attack");
      return loop("stand");
    default:
      return loop("walk");
  }
}
