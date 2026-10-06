import { HERO_POSES, type HeroLook, type HeroPose } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import { sprite, type Sprite } from "./art";

// A hero's look as sprites. Its pixels are colour slot digits, so the palette maps "1" to the
// first slot's colour, and so on.
export type HeroArt = {
  palette: Record<string, string>;
  poses: Record<HeroPose, Sprite>;
  shot: Sprite;
  chargedShot: Sprite;
};

export function heroArt(look: HeroLook): HeroArt {
  return {
    palette: Object.fromEntries(look.colours.map((colour, i) => [String(i + 1), PALETTE_8BIT[colour]])),
    poses: Object.fromEntries(HERO_POSES.map((pose) => [pose, sprite(look.poses[pose])])) as Record<HeroPose, Sprite>,
    shot: sprite(look.shot),
    chargedShot: sprite(look.chargedShot),
  };
}
