import type { Sprite } from "./art";

export type CanvasLike = {
  canvas: CanvasImageSource;
  ctx: Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">;
};
export type MakeCanvas = (w: number, h: number) => CanvasLike;

// Paints each sprite onto its own small canvas the first time it is needed, once per direction.
export function createSpriteCache(
  palette: Record<string, string>,
  make: MakeCanvas,
): (s: Sprite, flip: boolean) => CanvasImageSource {
  const painted = new WeakMap<Sprite, { normal?: CanvasImageSource; flipped?: CanvasImageSource }>();
  return (s, flip) => {
    let entry = painted.get(s);
    if (!entry) {
      entry = {};
      painted.set(s, entry);
    }
    const key = flip ? "flipped" : "normal";
    const found = entry[key];
    if (found) return found;
    const { canvas, ctx } = make(s.w, s.h);
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const colour = palette[s.rows[y][flip ? s.w - 1 - x : x]];
        if (!colour) continue; // "." and anything unknown stay transparent
        ctx.fillStyle = colour;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    entry[key] = canvas;
    return canvas;
  };
}

export const browserCanvas: MakeCanvas = (w, h) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw on a canvas.");
  return { canvas, ctx };
};
