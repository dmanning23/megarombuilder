// The 8-bit palette: the colours a hero can be drawn in, in the order the colour picker shows
// them. These are the classic NES console's colours, without its repeated blacks.
export const PALETTE_8BIT: readonly string[] = [
  "#7c7c7c", "#0000fc", "#0000bc", "#4428bc", "#940084", "#a80020", "#a81000",
  "#881400", "#503000", "#007800", "#006800", "#005800", "#004058", "#000000",
  "#bcbcbc", "#0078f8", "#0058f8", "#6844fc", "#d800cc", "#e40058", "#f83800",
  "#e45c10", "#ac7c00", "#00b800", "#00a800", "#00a844", "#008888",
  "#f8f8f8", "#3cbcfc", "#6888fc", "#9878f8", "#f878f8", "#f85898", "#f87858",
  "#fca044", "#f8b800", "#b8f818", "#58d854", "#58f898", "#00e8d8", "#787878",
  "#fcfcfc", "#a4e4fc", "#b8b8f8", "#d8b8f8", "#f8b8f8", "#f8a4c0", "#f0d0b0",
  "#fce0a8", "#f8d878", "#d8f878", "#b8f8b8", "#b8f8d8", "#00fcfc", "#d8d8d8",
];

function channels(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`"${hex}" is not a colour.`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const PALETTE_RGB: readonly [number, number, number][] = PALETTE_8BIT.map(channels);

// How different two colours look, by the "redmean" approximation of how eyes see colour.
export function colourDistance(a: [number, number, number], b: [number, number, number]): number {
  const mean = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
}

// The palette colour that looks closest.
export function nearestIndex(r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Infinity;
  PALETTE_RGB.forEach((colour, i) => {
    const distance = colourDistance([r, g, b], colour);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

export function nearestColour(hex: string): number {
  const [r, g, b] = channels(hex);
  return nearestIndex(r, g, b);
}
