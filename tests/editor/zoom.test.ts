import { describe, expect, it } from "vitest";
import { chooseZoom, MAX_ZOOM, MIN_ZOOM } from "@/editor/hero/zoom";

describe("chooseZoom", () => {
  it("fills the space with whole screen pixels per picture pixel", () => {
    expect(chooseZoom({ w: 400, h: 600 }, { w: 16, h: 24 })).toBe(24); // 25 and 25, capped
    expect(chooseZoom({ w: 320, h: 600 }, { w: 16, h: 24 })).toBe(20);
    expect(chooseZoom({ w: 600, h: 300 }, { w: 16, h: 16 })).toBe(18); // the height decides
  });

  it("never goes below 12 (the canvas scrolls instead) or above 24 (small pictures stay sensible)", () => {
    expect(chooseZoom({ w: 300, h: 300 }, { w: 48, h: 48 })).toBe(MIN_ZOOM);
    expect(chooseZoom({ w: 2000, h: 2000 }, { w: 6, h: 4 })).toBe(MAX_ZOOM);
    expect(chooseZoom({ w: 0, h: 0 }, { w: 16, h: 24 })).toBe(MIN_ZOOM); // not measured yet
  });
});
