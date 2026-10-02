export const TILE_SIZE = 16;
export const SCREEN_TILES_W = 16;
export const SCREEN_TILES_H = 15;
export const MAX_SCREENS = { horizontal: 8, vertical: 6 } as const;

export type Scroll = "horizontal" | "vertical";
export type Edge = "left" | "right" | "top" | "bottom";
export type Size = { width: number; height: number };
export type Opening = { edge: Edge; from: number; to: number };

export function zoneSize(scroll: Scroll, screens: number): Size {
  return scroll === "horizontal"
    ? { width: screens * SCREEN_TILES_W, height: SCREEN_TILES_H }
    : { width: SCREEN_TILES_W, height: screens * SCREEN_TILES_H };
}

export function tileIndex(size: Size, x: number, y: number): number {
  return y * size.width + x;
}

export function inBounds(size: Size, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < size.width &&
    y < size.height
  );
}

export function rectInBounds(size: Size, x: number, y: number, w: number, h: number): boolean {
  return w >= 1 && h >= 1 && inBounds(size, x, y) && inBounds(size, x + w - 1, y + h - 1);
}

export function edgeLength(size: Size, edge: Edge): number {
  return edge === "left" || edge === "right" ? size.height : size.width;
}

// Slides an opening along its edge until it fits, keeping its length where possible.
export function clampOpening(opening: Opening, length: number): Opening {
  const span = Math.min(opening.to - opening.from, length - 1);
  const from = Math.min(Math.max(opening.from, 0), length - 1 - span);
  return { edge: opening.edge, from, to: from + span };
}
