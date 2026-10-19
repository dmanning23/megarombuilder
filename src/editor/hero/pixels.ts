// Pixel work for the Characters screen. Pictures are rows of characters: "." is empty, and "1" to
// "9" then "a" to "g" name colour slots.

export type Pixel = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

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

export type ShiftDirection = "left" | "right" | "up" | "down";

// Moves every pixel one step, bringing in empty space from the other side. Pixels pushed past the
// edge would be lost, so the editor checks canShift first.
export function shiftRows(rows: string[], direction: ShiftDirection): string[] {
  const blank = ".".repeat(rows[0]?.length ?? 0);
  if (direction === "left") return rows.map((row) => row.slice(1) + ".");
  if (direction === "right") return rows.map((row) => "." + row.slice(0, -1));
  if (direction === "up") return [...rows.slice(1), blank];
  return [blank, ...rows.slice(0, -1)];
}

// Whether a shift keeps every drawn pixel: something is drawn, and none of it touches that edge.
export function canShift(rows: string[], direction: ShiftDirection): boolean {
  if (rows.every((row) => /^\.*$/.test(row))) return false;
  if (direction === "left") return rows.every((row) => row[0] === ".");
  if (direction === "right") return rows.every((row) => row[row.length - 1] === ".");
  if (direction === "up") return /^\.*$/.test(rows[0]);
  return /^\.*$/.test(rows[rows.length - 1]);
}

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

export type PixelCtx = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect" | "globalAlpha">;

// How strongly the onion skin (the frame before) shows under the drawing.
export const ONION_ALPHA = 1 / 3;
// The line shots come out of, drawn across the picture.
export const SHOT_LINE = "#ffd400";

const BACKGROUND = "#e9eef5";
const GRID = "#c9d3e0";
const OUTLINE = "#ff2d95";
const FEET = "#2ec4b6";

// Draws a picture big, with a light grid, the body's outline (if it has one), the feet line or the box's
// bottom edge, and faintly underneath, the onion skin: another frame to line this one up with.
export function drawPixels(
  ctx: PixelCtx,
  rows: string[],
  palette: Record<string, string>,
  size: { w: number; h: number },
  body: Box | null,
  feet: boolean,
  extras: { under?: string[]; shot?: { y: number; h: number } } = {},
  zoom = ZOOM,
): void {
  const { under, shot } = extras;
  const { w, h } = size;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, w * zoom, h * zoom);
  if (under) {
    ctx.globalAlpha = ONION_ALPHA;
    under.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const colour = palette[ch];
        if (!colour) return;
        ctx.fillStyle = colour;
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      }),
    );
    ctx.globalAlpha = 1;
  }
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const colour = palette[ch];
      if (!colour) return;
      ctx.fillStyle = colour;
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }),
  );
  ctx.fillStyle = GRID;
  for (let x = 1; x < w; x++) ctx.fillRect(x * zoom, 0, 1, h * zoom);
  for (let y = 1; y < h; y++) ctx.fillRect(0, y * zoom, w * zoom, 1);

  if (shot) {
    ctx.fillStyle = SHOT_LINE;
    ctx.fillRect(0, shot.y * zoom, w * zoom, 2);
    ctx.fillRect(0, (shot.y + shot.h) * zoom - 2, w * zoom, 2);
  }
  if (!body) {
    if (feet) {
      ctx.fillStyle = FEET;
      ctx.fillRect(0, h * zoom - 3, w * zoom, 3);
    }
    return;
  }
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(body.x * zoom, body.y * zoom, 2, body.h * zoom);
  ctx.fillRect((body.x + body.w) * zoom - 2, body.y * zoom, 2, body.h * zoom);
  ctx.fillRect(body.x * zoom, body.y * zoom, body.w * zoom, 2);
  if (feet) {
    ctx.fillStyle = FEET;
    ctx.fillRect(0, h * zoom - 3, w * zoom, 3);
  } else {
    ctx.fillRect(body.x * zoom, (body.y + body.h) * zoom - 2, body.w * zoom, 2);
  }
}

