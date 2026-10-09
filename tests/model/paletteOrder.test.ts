import { describe, expect, it } from "vitest";
import { PALETTE_8BIT, sortedPalette } from "@/model/palette";

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lightness = (hex: string) => {
  const c = rgb(hex);
  return (Math.max(...c) + Math.min(...c)) / 2;
};

describe("sortedPalette", () => {
  const order = sortedPalette();

  it("holds every colour exactly once", () => {
    expect([...order].sort((a, b) => a - b)).toEqual(PALETTE_8BIT.map((_, i) => i));
  });

  it("starts with the greys, from black to white", () => {
    const greys = order.slice(0, 7).map((i) => PALETTE_8BIT[i]);
    expect(greys[0]).toBe("#000000");
    for (let i = 1; i < greys.length; i++) expect(lightness(greys[i])).toBeGreaterThanOrEqual(lightness(greys[i - 1]));
    expect(greys.every((hex) => new Set(rgb(hex).map((v) => Math.round(v * 20))).size === 1)).toBe(true);
  });

  it("then runs through the hues, each from dark to light", () => {
    const reds = order.slice(7, 12).map((i) => PALETTE_8BIT[i]);
    expect(reds).toContain("#a80020");
    for (let i = 1; i < reds.length; i++) expect(lightness(reds[i])).toBeGreaterThanOrEqual(lightness(reds[i - 1]));
    expect(PALETTE_8BIT[order[order.length - 1]]).toBe("#f8a4c0"); // the lightest pink ends it
  });
});
