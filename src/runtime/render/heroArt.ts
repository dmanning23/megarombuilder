import { heroPictureSlot, HERO_POSES, type HeroLook, type HeroPicture, type HeroPose } from "@/model/hero";
import { slotChar } from "@/model/look";
import { PALETTE_8BIT } from "@/model/palette";
import type { Sprite } from "./art";
import { lookSprites, type AnimSprites } from "./lookArt";

// A hero's look as sprites. Its pixels name colour slots ("1" to "9", then "a" to "g"), so the
// palette maps "1" to the first slot's colour, and so on. `poses` and the shots are the old
// pictures, for the hero screen's picture buttons: the very same sprites as in `animations`.
export type HeroArt = {
  palette: Record<string, string>;
  flashPalette: Record<string, string>;
  poses: Record<HeroPose, Sprite>;
  shot: Sprite;
  chargedShot: Sprite;
  animations: Record<string, AnimSprites>;
};

// A fully charged hero blinks as a white silhouette.
const FLASH_WHITE = "#fcfcfc";

export function heroArt(look: HeroLook): HeroArt {
  const animations = lookSprites(look, "hero");
  const picture = (p: HeroPicture) => {
    const { animation, frame } = heroPictureSlot(look, p);
    return animations[animation].frames[frame];
  };
  return {
    palette: Object.fromEntries(look.colours.map((colour, i) => [slotChar(i + 1), PALETTE_8BIT[colour]])),
    flashPalette: Object.fromEntries(look.colours.map((_, i) => [slotChar(i + 1), FLASH_WHITE])),
    poses: Object.fromEntries(HERO_POSES.map((pose) => [pose, picture(pose)])) as Record<HeroPose, Sprite>,
    shot: picture("shot"),
    chargedShot: picture("chargedShot"),
    animations,
  };
}
