import { DESIGN_BODIES, DESIGN_SHOT_Y, designFrameSlot, type EnemyBehaviour } from "./designs";
import { HERO_PICTURE_SLOTS, HERO_POSES, type HeroPicture, type HeroPose } from "./hero";
import { KINDS, type Animation, type Look } from "./look";

// Turning the pictures of format 3 and before into looks, with today's sizes, bodies and shot
// points, so upgraded games look and play as before.

export type OldHeroLook = { colours: number[]; poses: Record<HeroPose, string[]>; shot: string[]; chargedShot: string[] };
export type OldDesignLook = { colours: number[]; frames: string[][] };

const still = (frames: string[][]): Animation => ({ frames, speed: "normal" });

export function heroLookFrom(old: OldHeroLook): Look {
  const picture = (p: HeroPicture) => (p === "shot" ? old.shot : p === "chargedShot" ? old.chargedShot : old.poses[p]);
  const animations: Record<string, Animation> = {};
  for (const p of [...HERO_POSES, "shot", "chargedShot"] as HeroPicture[]) {
    const { animation, frame } = HERO_PICTURE_SLOTS[p];
    const frames = animations[animation]?.frames ?? [];
    frames[frame] = picture(p);
    animations[animation] = still(frames);
  }
  animations.runShoot = still([...animations.run.frames]); // today's running shot shows the run
  return {
    colours: old.colours,
    canvases: { main: { w: 16, h: 24 }, slide: { w: 24, h: 16 }, shot: { w: 6, h: 4 }, chargedShot: { w: 12, h: 10 } },
    animations,
    body: { x: 1, y: 2, w: 14, h: 22 },
    slideBody: { x: 5, y: 2, w: 14, h: 14 },
    shotY: 8,
  };
}

export function designLookFrom(kind: EnemyBehaviour | "boss", old: OldDesignLook): Look {
  const animations: Record<string, Animation> = Object.fromEntries(Object.keys(KINDS[kind].animations).map((a) => [a, still([])]));
  old.frames.forEach((rows, i) => {
    const { animation, frame } = designFrameSlot(kind, i);
    animations[animation].frames[frame] = rows;
  });
  const shotY = DESIGN_SHOT_Y[kind];
  return {
    colours: old.colours,
    canvases: { main: kind === "boss" ? { w: 24, h: 28 } : { w: 16, h: 16 } },
    animations,
    body: DESIGN_BODIES[kind],
    ...(shotY === undefined ? {} : { shotY }),
  };
}
