import type { DesignLook, EnemyDesign } from "@/model/designs";
import { ownType } from "@/model/gamePack";
import { PALETTE_8BIT } from "@/model/palette";
import { sprite, type Sprite } from "./art";

// A design's look as sprites. Pixels are colour slot digits, so the palette maps "1" to the first.
export type LookArt = { palette: Record<string, string>; frames: Sprite[] };

export function lookArt(look: DesignLook): LookArt {
  return {
    palette: Object.fromEntries(look.colours.map((colour, i) => [String(i + 1), PALETTE_8BIT[colour]])),
    frames: look.frames.map((rows) => sprite(rows)),
  };
}

export type OwnSkin = { art: LookArt; image: (s: Sprite, flip: boolean) => CanvasImageSource };

// Art for each of the kid's own enemies, keyed by thing type, each with its own image maker.
export function ownSkins(
  enemies: EnemyDesign[],
  imageFor: (palette: Record<string, string>) => (s: Sprite, flip: boolean) => CanvasImageSource,
): Record<string, OwnSkin> {
  return Object.fromEntries(
    enemies.map((enemy) => {
      const art = lookArt(enemy.look);
      return [ownType(enemy.id), { art, image: imageFor(art.palette) }];
    }),
  );
}
