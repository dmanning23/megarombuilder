import { designLook, type BossDesign, type DesignLook, type EnemyDesign } from "@/model/designs";
import { OWN_BOSS, ownType } from "@/model/gamePack";
import { slotChar } from "@/model/look";
import { PALETTE_8BIT } from "@/model/palette";
import { sprite, type Sprite } from "./art";

// A design's look as sprites. Pixels name colour slots ("1" to "9", then "a" to "g"), so the palette maps "1" to the first.
export type LookArt = { palette: Record<string, string>; frames: Sprite[] };

export function lookArt(look: DesignLook): LookArt {
  return {
    palette: Object.fromEntries(look.colours.map((colour, i) => [slotChar(i + 1), PALETTE_8BIT[colour]])),
    frames: look.frames.map((rows) => sprite(rows)),
  };
}

export type OwnSkin = { art: LookArt; image: (s: Sprite, flip: boolean) => CanvasImageSource };

// Art for each of the kid's own enemies and their boss, keyed by thing type, each with its own image maker.
export function ownSkins(
  enemies: EnemyDesign[],
  imageFor: (palette: Record<string, string>) => (s: Sprite, flip: boolean) => CanvasImageSource,
  boss: BossDesign | null = null,
): Record<string, OwnSkin> {
  const skin = (look: DesignLook): OwnSkin => {
    const art = lookArt(look);
    return { art, image: imageFor(art.palette) };
  };
  const skins: Record<string, OwnSkin> = Object.fromEntries(enemies.map((enemy) => [ownType(enemy.id), skin(designLook(enemy.behaviour, enemy.look))]));
  if (boss) skins[OWN_BOSS] = skin(designLook("boss", boss.look));
  return skins;
}
