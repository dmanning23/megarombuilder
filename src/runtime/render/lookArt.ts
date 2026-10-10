import { designLook, designSlot, type BossDesign, type DesignLook, type EnemyDesign } from "@/model/designs";
import { OWN_BOSS, ownType } from "@/model/gamePack";
import { firstStanding, poseBox, slotChar, type AnimationSpeed, type Look, type LookBox, type LookKind, type Size } from "@/model/look";
import { PALETTE_8BIT } from "@/model/palette";
import type { Timing } from "./animate";
import { sprite, type Sprite } from "./art";

// A design's look as sprites. Pixels name colour slots ("1" to "9", then "a" to "g"), so the palette maps "1" to the first.
export type LookArt = { palette: Record<string, string>; frames: Sprite[] };

export const paletteOf = (colours: number[]): Record<string, string> =>
  Object.fromEntries(colours.map((colour, i) => [slotChar(i + 1), PALETTE_8BIT[colour]]));

export function lookArt(look: DesignLook): LookArt {
  return {
    palette: paletteOf(look.colours),
    frames: look.frames.map((rows) => sprite(rows)),
  };
}

export type AnimSprites = { frames: Sprite[]; speed: AnimationSpeed; size: Size; box: LookBox | null };

// Every pose of a look as sprites, with its picture size and its hitbox in that picture.
export function lookSprites(look: Look, kind: LookKind): Record<string, AnimSprites> {
  return Object.fromEntries(
    Object.entries(look.animations).map(([name, anim]) => [
      name,
      { frames: anim.frames.map((rows) => sprite(rows)), speed: anim.speed, size: anim.size, box: poseBox(look, kind, name) },
    ]),
  );
}

export const timingsOf = (animations: Record<string, AnimSprites>): Record<string, Timing> =>
  Object.fromEntries(Object.entries(animations).map(([name, a]) => [name, { frames: a.frames.length, speed: a.speed }]));

// `art` is the first frames in the old order, for palette swatches and the zone view.
export type OwnSkin = {
  art: LookArt;
  animations: Record<string, AnimSprites>;
  body: LookBox; // the first pose's hitbox, in its picture, for the zone view (the game draws each pose's own)
  canvas: Size; // the first pose's picture size
  image: (s: Sprite, flip: boolean) => CanvasImageSource;
};

// Art for each of the kid's own enemies and their boss, keyed by thing type, each with its own image maker.
export function ownSkins(
  enemies: EnemyDesign[],
  imageFor: (palette: Record<string, string>) => (s: Sprite, flip: boolean) => CanvasImageSource,
  boss: BossDesign | null = null,
): Record<string, OwnSkin> {
  const skin = (kind: EnemyDesign["behaviour"] | "boss", look: Look): OwnSkin => {
    const animations = lookSprites(look, kind);
    // The first frames in the old order: the very same sprites as in `animations`.
    const frames = designLook(kind, look).frames.map((_, i) => {
      const { animation, frame } = designSlot(kind, look, i);
      return animations[animation].frames[frame];
    });
    const art = { palette: paletteOf(look.colours), frames };
    const first = animations[firstStanding(kind)];
    return { art, animations, body: first.box!, canvas: first.size, image: imageFor(art.palette) };
  };
  const skins: Record<string, OwnSkin> = Object.fromEntries(enemies.map((enemy) => [ownType(enemy.id), skin(enemy.behaviour, enemy.look)]));
  if (boss) skins[OWN_BOSS] = skin("boss", boss.look);
  return skins;
}
