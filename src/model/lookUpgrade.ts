import { DESIGN_BODIES, DESIGN_SHOT_Y, designFrameSlot, type EnemyBehaviour } from "./designs";
import { HERO_PICTURE_SLOTS, HERO_POSES, type HeroPicture, type HeroPose } from "./hero";
import { KINDS, type AnimationSpeed, type Look, type LookBox, type LookKind, type Size } from "./look";

// Turning the looks of older formats into today's, so upgraded games look and play as before.

export type Format4Look = {
  colours: number[];
  canvases: Record<string, Size>;
  animations: Record<string, { frames: string[][]; speed: AnimationSpeed }>;
  body: LookBox;
  slideBody?: LookBox;
  shotY?: number;
};

// Format 4 kept one canvas per group (the hero's standing poses shared "main"), one boxed hitbox
// and one shot point. Format 5 gives each pose its own: every pose starts with its group's.
const format4Group = (kind: LookKind, animation: string): string =>
  kind === "hero" && (animation === "slide" || animation === "shot" || animation === "chargedShot") ? animation : "main";

export function lookFromFormat4(kind: LookKind, old: Format4Look): Look {
  const shoots = KINDS[kind].shotHeight !== null;
  const animations = Object.fromEntries(
    Object.entries(old.animations).map(([name, anim]) => {
      const group = format4Group(kind, name);
      const box = group === "main" ? old.body : group === "slide" ? old.slideBody : undefined;
      return [
        name,
        {
          ...anim,
          size: old.canvases[group],
          ...(box ? { at: { x: box.x, y: box.y } } : {}),
          ...(shoots && group === "main" && old.shotY !== undefined ? { shotY: old.shotY } : {}),
        },
      ];
    }),
  );
  return {
    colours: old.colours,
    animations,
    body: { w: old.body.w, h: old.body.h },
    ...(old.slideBody ? { slideBody: { w: old.slideBody.w, h: old.slideBody.h } } : {}),
  };
}

// The pictures of format 3 and before, as format 4 looks with that format's sizes, bodies and shot
// points, then converted.
type OldAnimation = Format4Look["animations"][string];

export type OldHeroLook = { colours: number[]; poses: Record<HeroPose, string[]>; shot: string[]; chargedShot: string[] };
export type OldDesignLook = { colours: number[]; frames: string[][] };

const still = (frames: string[][]): OldAnimation => ({ frames, speed: "normal" });

export function heroLookFrom(old: OldHeroLook): Look {
  const picture = (p: HeroPicture) => (p === "shot" ? old.shot : p === "chargedShot" ? old.chargedShot : old.poses[p]);
  const animations: Record<string, OldAnimation> = {};
  for (const p of [...HERO_POSES, "shot", "chargedShot"] as HeroPicture[]) {
    const { animation, frame } = HERO_PICTURE_SLOTS[p];
    const frames = animations[animation]?.frames ?? [];
    frames[frame] = picture(p);
    animations[animation] = still(frames);
  }
  animations.runShoot = still([...animations.run.frames]); // today's running shot shows the run
  return lookFromFormat4("hero", {
    colours: old.colours,
    canvases: { main: { w: 16, h: 24 }, slide: { w: 24, h: 16 }, shot: { w: 6, h: 4 }, chargedShot: { w: 12, h: 10 } },
    animations,
    body: { x: 1, y: 2, w: 14, h: 22 },
    slideBody: { x: 5, y: 2, w: 14, h: 14 },
    shotY: 8,
  });
}

export function designLookFrom(kind: EnemyBehaviour | "boss", old: OldDesignLook): Look {
  const animations: Record<string, OldAnimation> = Object.fromEntries(Object.keys(KINDS[kind].animations).map((a) => [a, still([])]));
  old.frames.forEach((rows, i) => {
    const { animation, frame } = designFrameSlot(kind, i);
    animations[animation].frames[frame] = rows;
  });
  const shotY = DESIGN_SHOT_Y[kind];
  return lookFromFormat4(kind, {
    colours: old.colours,
    canvases: { main: kind === "boss" ? { w: 24, h: 28 } : { w: 16, h: 16 } },
    animations,
    body: DESIGN_BODIES[kind],
    ...(shotY === undefined ? {} : { shotY }),
  });
}
