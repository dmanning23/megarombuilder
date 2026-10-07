import { MAX_COLOURS, PICTURE_SIZES, type HeroPicture } from "@/model/hero";
import { colourDistance, nearestIndex, PALETTE_RGB } from "@/model/palette";

// Turning a picture into a hero picture: fit it, keep its see-through parts, snap it to the 8-bit
// palette and fit it into the hero's colours. Plain code on RGBA pixels, so it can be tested
// without a browser.

export type RawImage = { width: number; height: number; data: ArrayLike<number> }; // RGBA, row by row
export type Imported = { rows: string[]; colours: number[] };

type Rgb = [number, number, number];

const OPAQUE = 128; // alpha at or above this is a pixel; below it is see-through
const SAME = 24; // colours within this (channels summed) count as one background
const CLOSE = 2000; // a palette colour this close to a hero colour reuses it

function pixel(image: RawImage, x: number, y: number): [number, number, number, number] {
  const i = (y * image.width + x) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
}

const near = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= SAME;

export function hasTransparency(image: RawImage): boolean {
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i] < OPAQUE) return true;
  return false;
}

// The background colour, when the picture has no see-through pixels and its four corners share a colour.
export function backgroundOf(image: RawImage): Rgb | null {
  if (image.width === 0 || image.height === 0 || hasTransparency(image)) return null;
  const { width: w, height: h } = image;
  const corners = [pixel(image, 0, 0), pixel(image, w - 1, 0), pixel(image, 0, h - 1), pixel(image, w - 1, h - 1)];
  if (!corners.every((c) => near(c, corners[0]))) return null;
  return [corners[0][0], corners[0][1], corners[0][2]];
}

// Where an imported picture goes: one of the hero's pictures, or a frame of a size that stands on
// the feet line (or is centred).
export type ImportTarget = HeroPicture | { w: number; h: number; stand: boolean };

function frameOf(target: ImportTarget): { w: number; h: number; stand: boolean } {
  if (typeof target !== "string") return target;
  return { ...PICTURE_SIZES[target], stand: target !== "shot" && target !== "chargedShot" };
}

export function importPicture(image: RawImage, target: ImportTarget, colours: number[], removeBackground: boolean): Imported {
  const { w, h, stand } = frameOf(target);
  const scale = Math.min(w / image.width, h / image.height);
  const tw = Math.max(1, Math.min(w, Math.round(image.width * scale)));
  const th = Math.max(1, Math.min(h, Math.round(image.height * scale)));
  const left = Math.floor((w - tw) / 2);
  const top = stand ? h - th : Math.floor((h - th) / 2); // poses stand on the feet line
  const key = removeBackground ? backgroundOf(image) : null;

  // Each frame pixel takes the palette colour most of its block of source pixels snaps to.
  const snapped = new Map<number, number>();
  const snap = (r: number, g: number, b: number) => {
    const k = (r << 16) | (g << 8) | b;
    let index = snapped.get(k);
    if (index === undefined) {
      index = nearestIndex(r, g, b);
      snapped.set(k, index);
    }
    return index;
  };
  const grid: (number | null)[][] = Array.from({ length: h }, () => new Array<number | null>(w).fill(null));
  const counts = new Map<number, number>();
  for (let ty = 0; ty < th; ty++) {
    const sy0 = Math.floor((ty * image.height) / th);
    const sy1 = Math.max(sy0 + 1, Math.floor(((ty + 1) * image.height) / th));
    for (let tx = 0; tx < tw; tx++) {
      const sx0 = Math.floor((tx * image.width) / tw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((tx + 1) * image.width) / tw));
      const votes = new Map<number, number>(); // palette index, or -1 for empty
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const p = pixel(image, sx, sy);
          const vote = p[3] < OPAQUE || (key && near(p, key)) ? -1 : snap(p[0], p[1], p[2]);
          votes.set(vote, (votes.get(vote) ?? 0) + 1);
        }
      }
      let winner = -1;
      let most = 0;
      for (const [vote, count] of votes) {
        if (count > most) {
          most = count;
          winner = vote;
        }
      }
      if (winner < 0) continue;
      grid[top + ty][left + tx] = winner;
      counts.set(winner, (counts.get(winner) ?? 0) + 1);
    }
  }

  // Fit the picture's colours into the hero's: reuse, add up to eight, then merge.
  const next = [...colours];
  const slotOf = new Map<number, number>();
  const used = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([index]) => index);
  for (const index of used) {
    let slot = next.indexOf(index);
    if (slot < 0) {
      let nearest = 0;
      let distance = Infinity;
      next.forEach((colour, s) => {
        const d = colourDistance(PALETTE_RGB[colour], PALETTE_RGB[index]);
        if (d < distance) {
          distance = d;
          nearest = s;
        }
      });
      if (distance <= CLOSE || next.length >= MAX_COLOURS) slot = nearest;
      else {
        next.push(index);
        slot = next.length - 1;
      }
    }
    slotOf.set(index, slot);
  }

  return {
    rows: grid.map((row) => row.map((c) => (c === null ? "." : String(slotOf.get(c)! + 1))).join("")),
    colours: next,
  };
}
