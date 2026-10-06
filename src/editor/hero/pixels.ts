import { PICTURE_SIZES, type HeroPicture } from "@/model/hero";
import { PLAYER_H, PLAYER_W, SLIDE_H } from "@/runtime/sim/constants";

// Pixel work for the hero screen. Pictures are rows of characters: "." is empty, a digit is a colour.

export type Pixel = { x: number; y: number };

export const ZOOM = 12; // screen pixels per picture pixel

export const blankRows = (w: number, h: number): string[] => Array.from({ length: h }, () => ".".repeat(w));

export function setPixels(rows: string[], pixels: Pixel[], ch: string): string[] {
  const grid = rows.map((row) => [...row]);
  for (const { x, y } of pixels) {
    if (y >= 0 && y < grid.length && x >= 0 && x < grid[y].length) grid[y][x] = ch;
  }
  return grid.map((row) => row.join(""));
}

// Every pixel on the straight line from a to b, both ends included, so a fast drag leaves no gaps.
export function linePixels(a: Pixel, b: Pixel): Pixel[] {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  const pixels: Pixel[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    pixels.push({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) });
  }
  return pixels;
}

// Fills the patch of one colour touching `start` (side to side and up and down) with `ch`.
export function floodFill(rows: string[], start: Pixel, ch: string): string[] {
  const grid = rows.map((row) => [...row]);
  const target = grid[start.y]?.[start.x];
  if (target === undefined || target === ch) return rows;
  const stack: Pixel[] = [start];
  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    if (grid[y]?.[x] !== target) continue;
    grid[y][x] = ch;
    stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
  }
  return grid.map((row) => row.join(""));
}

export const flipRows = (rows: string[]): string[] => rows.map((row) => [...row].reverse().join(""));

export function pixelFromPointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  w: number,
  h: number,
): Pixel | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * w);
  const y = Math.floor(((clientY - rect.top) / rect.height) * h);
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  return { x, y };
}

// The nearest pixel on the picture's edge to a pointer outside it.
export function edgePixel(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  w: number,
  h: number,
): Pixel {
  const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));
  return {
    x: clamp(Math.floor(((clientX - rect.left) / rect.width) * w), w - 1),
    y: clamp(Math.floor(((clientY - rect.top) / rect.height) * h), h - 1),
  };
}

// Where the game's body sits in a picture: what counts as the hero for walls and hits. Poses are
// drawn bottom-centred on the body; a shot's picture is its whole box.
export function bodyBox(picture: HeroPicture): { x: number; y: number; w: number; h: number } {
  const { w, h } = PICTURE_SIZES[picture];
  if (picture === "shot" || picture === "chargedShot") return { x: 0, y: 0, w, h };
  const bodyH = picture === "slide" ? SLIDE_H : PLAYER_H;
  return { x: Math.round(w / 2 - PLAYER_W / 2), y: h - bodyH, w: PLAYER_W, h: bodyH };
}

export type PixelCtx = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">;

const BACKGROUND = "#e9eef5";
const GRID = "#c9d3e0";
const OUTLINE = "#ff2d95";
const FEET = "#2ec4b6";

// Draws a picture big, with a light grid, the body's outline and, on poses, the feet line.
export function drawPicture(ctx: PixelCtx, rows: string[], palette: Record<string, string>, picture: HeroPicture): void {
  const { w, h } = PICTURE_SIZES[picture];
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, w * ZOOM, h * ZOOM);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const colour = palette[ch];
      if (!colour) return;
      ctx.fillStyle = colour;
      ctx.fillRect(x * ZOOM, y * ZOOM, ZOOM, ZOOM);
    }),
  );
  ctx.fillStyle = GRID;
  for (let x = 1; x < w; x++) ctx.fillRect(x * ZOOM, 0, 1, h * ZOOM);
  for (let y = 1; y < h; y++) ctx.fillRect(0, y * ZOOM, w * ZOOM, 1);

  const body = bodyBox(picture);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(body.x * ZOOM, body.y * ZOOM, 2, body.h * ZOOM);
  ctx.fillRect((body.x + body.w) * ZOOM - 2, body.y * ZOOM, 2, body.h * ZOOM);
  ctx.fillRect(body.x * ZOOM, body.y * ZOOM, body.w * ZOOM, 2);
  if (picture !== "shot" && picture !== "chargedShot") {
    ctx.fillStyle = FEET;
    ctx.fillRect(0, h * ZOOM - 3, w * ZOOM, 3);
  } else {
    ctx.fillRect(body.x * ZOOM, (body.y + body.h) * ZOOM - 2, body.w * ZOOM, 2);
  }
}
