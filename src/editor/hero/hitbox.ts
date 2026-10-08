import { BODY_MIN, type LookBox } from "@/model/look";
import type { Pixel } from "./pixels";

// The maths of the Hitbox and Shot point tools: which edge a press grabs, where a drag puts it, and
// which row a shot comes out of. Plain code, so it can be tested without a canvas.

export type Edge = "left" | "right" | "top" | "bottom";
export type HitboxLimits = { canvas: { w: number; h: number }; maxW: number | null; maxH: number | null };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function pickEdge(body: LookBox, p: Pixel): Edge {
  const right = body.x + body.w - 1;
  const bottom = body.y + body.h - 1;
  const distances: [Edge, number][] = [
    ["left", Math.abs(p.x - body.x)],
    ["right", Math.abs(p.x - right)],
    ["top", Math.abs(p.y - body.y)],
    ["bottom", Math.abs(p.y - bottom)],
  ];
  return distances.reduce((best, d) => (d[1] < best[1] ? d : best))[0];
}

// Moves one edge of the hitbox to the pixel, keeping it on the canvas, at least BODY_MIN across, and
// within the hero's limits.
export function moveEdge(body: LookBox, edge: Edge, p: Pixel, limits: HitboxLimits): LookBox {
  const right = body.x + body.w - 1;
  const bottom = body.y + body.h - 1;
  const maxW = limits.maxW ?? limits.canvas.w;
  const maxH = limits.maxH ?? limits.canvas.h;
  if (edge === "left") {
    const x = clamp(p.x, Math.max(0, right - maxW + 1), right - BODY_MIN + 1);
    return { ...body, x, w: right - x + 1 };
  }
  if (edge === "right") {
    const r = clamp(p.x, body.x + BODY_MIN - 1, Math.min(limits.canvas.w - 1, body.x + maxW - 1));
    return { ...body, w: r - body.x + 1 };
  }
  if (edge === "top") {
    const y = clamp(p.y, Math.max(0, bottom - maxH + 1), bottom - BODY_MIN + 1);
    return { ...body, y, h: bottom - y + 1 };
  }
  const b = clamp(p.y, body.y + BODY_MIN - 1, Math.min(limits.canvas.h - 1, body.y + maxH - 1));
  return { ...body, h: b - body.y + 1 };
}

export const shotYAt = (body: LookBox, p: Pixel, shotHeight: number): number =>
  clamp(p.y - body.y, 0, Math.max(0, body.h - shotHeight));
