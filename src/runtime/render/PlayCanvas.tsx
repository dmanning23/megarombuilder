"use client";

import { useEffect, useRef } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { Project } from "@/model/schema";
import { createSim, SCREEN_H, SCREEN_W, step } from "@/runtime/sim";
import { draw } from "./draw";
import { createKeyboard } from "./keyboard";
import { stepsFor } from "./loop";

type Props = {
  project: Project;
  levelId: string;
  pack: ContentPack;
  startZoneId?: string;
  scale?: number;
};

// Runs a level on a canvas until unmounted.
export function PlayCanvas({ project, levelId, pack, startZoneId, scale = 3 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const sim = createSim(project, levelId, pack, { startZoneId });
    const keyboard = createKeyboard(window);
    let accumulator = 0;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const due = stepsFor(accumulator, now - last);
      last = now;
      accumulator = due.accumulator;
      for (let i = 0; i < due.steps; i++) step(sim, keyboard.read());
      draw(ctx, sim);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      keyboard.dispose();
    };
  }, [project, levelId, pack, startZoneId]);

  return (
    <canvas
      ref={canvasRef}
      width={SCREEN_W}
      height={SCREEN_H}
      style={{ width: SCREEN_W * scale, height: SCREEN_H * scale, imageRendering: "pixelated" }}
    />
  );
}
