import { HERO_POSES, pictureRows, type HeroLook, type HeroPose } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import { sprite, type Sprite } from "./art";

// A hero's look as sprites. Its pixels are colour slot digits, so the palette maps "1" to the
// first slot's colour, and so on.
export type HeroArt = {
  palette: Record<string, string>;
  flashPalette: Record<string, string>;
  poses: Record<HeroPose, Sprite>;
  shot: Sprite;
  chargedShot: Sprite;
};

// A fully charged hero blinks as a white silhouette.
const FLASH_WHITE = "#fcfcfc";

export function heroArt(look: HeroLook): HeroArt {
  return {
    palette: Object.fromEntries(look.colours.map((colour, i) => [String(i + 1), PALETTE_8BIT[colour]])),
    flashPalette: Object.fromEntries(look.colours.map((_, i) => [String(i + 1), FLASH_WHITE])),
    poses: Object.fromEntries(HERO_POSES.map((pose) => [pose, sprite(pictureRows(look, pose))])) as Record<HeroPose, Sprite>,
    shot: sprite(pictureRows(look, "shot")),
    chargedShot: sprite(pictureRows(look, "chargedShot")),
  };
}
