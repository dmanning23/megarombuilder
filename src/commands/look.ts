import { z } from "zod";
import { tidyName, type Project } from "@/model/schema";
import {
  ANIMATION_NAMES,
  ANIMATION_SPEEDS,
  KINDS,
  lookProblems,
  MAX_FRAMES,
  MAX_LOOK_COLOURS,
  slotChar,
  type Look,
  type LookKind,
} from "@/model/look";
import { fittedPoseBody, resizePose, setPoseBody } from "@/model/poses";
import { PALETTE_8BIT } from "@/model/palette";
import { listNames } from "./helpers";
import { defineCommand, fail, idArg, ok, type CommandResult } from "./types";

const targetArg = z.union([
  z.literal("hero"),
  z.literal("boss"),
  z.strictObject({ enemy: idArg }),
]);
export type LookTarget = z.infer<typeof targetArg>;
const frameIndex = z
  .number()
  .int()
  .min(0)
  .max(MAX_FRAMES - 1);
const animationArg = z.string().min(1).max(32);

type Found = { kind: LookKind; look: Look; name: string };

function find(project: Project, target: LookTarget): Found | string {
  if (target === "hero")
    return { kind: "hero", look: project.hero.look, name: "The hero" };
  if (target === "boss") {
    if (!project.boss) return "Your game has no boss of its own yet.";
    return {
      kind: "boss",
      look: project.boss.look,
      name: tidyName(project.boss.name),
    };
  }
  const enemy = project.enemies.find((e) => e.id === target.enemy);
  if (!enemy) return `There is no enemy with the id "${target.enemy}".`;
  return {
    kind: enemy.behaviour,
    look: enemy.look,
    name: tidyName(enemy.name),
  };
}

function put(project: Project, target: LookTarget, look: Look): Project {
  if (target === "hero") return { ...project, hero: { ...project.hero, look } };
  if (target === "boss")
    return { ...project, boss: { ...project.boss!, look } };
  return {
    ...project,
    enemies: project.enemies.map((e) =>
      e.id === target.enemy ? { ...e, look } : e,
    ),
  };
}

// Finds the target, applies a change to its look, and keeps the result only if the look is valid.
function editLook(
  project: Project,
  target: LookTarget,
  change: (found: Found) => Look | string,
): CommandResult {
  const found = find(project, target);
  if (typeof found === "string") return fail(found);
  const next = change(found);
  if (typeof next === "string") return fail(next);
  const problem = lookProblems(found.kind, next, found.name)[0];
  if (problem) return fail(problem);
  return ok(put(project, target, next));
}

function animationOf(found: Found, animation: string) {
  if (!KINDS[found.kind].animations[animation]) {
    const who = found.kind === "hero" ? "The hero" : found.name;
    return `${who} has no animation called "${animation}".`;
  }
  return found.look.animations[animation];
}

const withFrames = (
  look: Look,
  animation: string,
  frames: string[][],
): Look => ({
  ...look,
  animations: {
    ...look.animations,
    [animation]: { ...look.animations[animation], frames },
  },
});

const setLookColours = defineCommand({
  name: "setLookColours",
  description: `Set a character's colour slots: 1 to ${MAX_LOOK_COLOURS} colours from the 8-bit palette. Pixels name slots ("1" to "9", then "a" to "g").`,
  args: z.strictObject({
    target: targetArg,
    colours: z
      .array(
        z
          .number()
          .int()
          .min(0)
          .max(PALETTE_8BIT.length - 1),
      )
      .min(1)
      .max(MAX_LOOK_COLOURS),
  }),
  apply(project, args) {
    return editLook(project, args.target, ({ look }) => {
      for (
        let slot = args.colours.length + 1;
        slot <= look.colours.length;
        slot++
      ) {
        const ch = slotChar(slot);
        const users = Object.entries(look.animations).flatMap(([name, anim]) =>
          anim.frames.flatMap((rows, i) =>
            rows.some((row) => row.includes(ch))
              ? [`${ANIMATION_NAMES[name]} frame ${i + 1}`]
              : [],
          ),
        );
        if (users.length > 0)
          return `Colour ${slot} is still used in ${listNames(users)}.`;
      }
      return { ...look, colours: args.colours };
    });
  },
});

const setFrame = defineCommand({
  name: "setFrame",
  description:
    "Replace one frame of a character's animation with rows of pixels.",
  args: z.strictObject({
    target: targetArg,
    animation: animationArg,
    frame: frameIndex,
    rows: z.array(z.string()).min(1).max(64),
  }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      if (args.frame >= anim.frames.length)
        return `${ANIMATION_NAMES[args.animation]} has no frame ${args.frame + 1}.`;
      return withFrames(
        found.look,
        args.animation,
        anim.frames.map((f, i) => (i === args.frame ? args.rows : f)),
      );
    });
  },
});

const addFrame = defineCommand({
  name: "addFrame",
  description:
    "Add a frame to a character's animation after frame `after`: blank, or a copy of frame `after`.",
  args: z.strictObject({
    target: targetArg,
    animation: animationArg,
    after: frameIndex,
    copy: z.boolean().optional(),
  }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      const label = ANIMATION_NAMES[args.animation];
      if (anim.frames.length >= MAX_FRAMES)
        return `${label} already has ${MAX_FRAMES} frames, the most.`;
      if (args.after >= anim.frames.length)
        return `${label} has no frame ${args.after + 1}.`;
      const added = args.copy
        ? anim.frames[args.after]
        : Array.from({ length: anim.size.h }, () => ".".repeat(anim.size.w));
      const frames = [
        ...anim.frames.slice(0, args.after + 1),
        added,
        ...anim.frames.slice(args.after + 1),
      ];
      return withFrames(found.look, args.animation, frames);
    });
  },
});

const removeFrame = defineCommand({
  name: "removeFrame",
  description:
    "Remove a frame from a character's animation. Every animation keeps at least one.",
  args: z.strictObject({
    target: targetArg,
    animation: animationArg,
    frame: frameIndex,
  }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      const label = ANIMATION_NAMES[args.animation];
      if (args.frame >= anim.frames.length)
        return `${label} has no frame ${args.frame + 1}.`;
      if (anim.frames.length === 1) return `${label} needs at least one frame.`;
      return withFrames(
        found.look,
        args.animation,
        anim.frames.filter((_, i) => i !== args.frame),
      );
    });
  },
});

const moveFrame = defineCommand({
  name: "moveFrame",
  description:
    "Move a frame of a character's animation to a new place in the animation.",
  args: z.strictObject({
    target: targetArg,
    animation: animationArg,
    from: frameIndex,
    to: frameIndex,
  }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      const label = ANIMATION_NAMES[args.animation];
      const missing = [args.from, args.to].find((i) => i >= anim.frames.length);
      if (missing !== undefined) return `${label} has no frame ${missing + 1}.`;
      const frames = anim.frames.filter((_, i) => i !== args.from);
      frames.splice(args.to, 0, anim.frames[args.from]);
      return withFrames(found.look, args.animation, frames);
    });
  },
});

const setAnimationSpeed = defineCommand({
  name: "setAnimationSpeed",
  description:
    "Set how fast one of a character's animations plays: slow, normal or fast.",
  args: z.strictObject({
    target: targetArg,
    animation: animationArg,
    speed: z.enum(ANIMATION_SPEEDS),
  }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      return {
        ...found.look,
        animations: {
          ...found.look.animations,
          [args.animation]: { ...anim, speed: args.speed },
        },
      };
    });
  },
});

// A pose that carries a hitbox, or a message naming the one that doesn't.
function poseWithBody(found: Found, animation: string): string | null {
  const anim = animationOf(found, animation);
  if (typeof anim === "string") return anim;
  return KINDS[found.kind].animations[animation].body === null
    ? `${ANIMATION_NAMES[animation]} has no hitbox.`
    : null;
}

const resizePoseCommand = defineCommand({
  name: "resizePose",
  description:
    "Resize one of a character's poses (animations): every frame padded or trimmed evenly at the sides and at the top (the feet stay on the bottom), its hitbox moving with the drawing.",
  args: z.strictObject({
    target: targetArg,
    animation: animationArg,
    w: z.number().int().min(1).max(64),
    h: z.number().int().min(1).max(64),
  }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      return resizePose(found.look, found.kind, args.animation, args.w, args.h);
    });
  },
});

const boxArg = z.strictObject({
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});

const setBody = defineCommand({
  name: "setBody",
  description:
    "Set a character's hitbox in one pose's pixels: its position in that pose, and its size in every pose (the hero's Slide has a sliding hitbox of its own).",
  args: z.strictObject({ target: targetArg, animation: animationArg, body: boxArg }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const problem = poseWithBody(found, args.animation);
      return problem ?? setPoseBody(found.look, found.kind, args.animation, args.body);
    });
  },
});

const fitBodyCommand = defineCommand({
  name: "fitBody",
  description:
    "Fit a character's hitbox to one pose's drawing: its position in that pose, and its size in every pose.",
  args: z.strictObject({ target: targetArg, animation: animationArg }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const problem = poseWithBody(found, args.animation);
      return (
        problem ??
        setPoseBody(found.look, found.kind, args.animation, fittedPoseBody(found.look, found.kind, args.animation))
      );
    });
  },
});

const setShotY = defineCommand({
  name: "setShotY",
  description:
    "Set where shots come out in one of a character's poses: pixels below the top of its hitbox.",
  args: z.strictObject({
    target: targetArg,
    animation: animationArg,
    y: z.number().int().min(-64).max(64),
  }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      return {
        ...found.look,
        animations: { ...found.look.animations, [args.animation]: { ...anim, shotY: args.y } },
      };
    });
  },
});

export const lookCommands = [
  setLookColours,
  setFrame,
  addFrame,
  removeFrame,
  moveFrame,
  setAnimationSpeed,
  resizePoseCommand,
  setBody,
  fitBodyCommand,
  setShotY,
];
