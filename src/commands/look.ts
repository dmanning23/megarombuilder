import { z } from "zod";
import { tidyName, type Project } from "@/model/schema";
import {
  ANIMATION_NAMES,
  ANIMATION_SPEEDS,
  firstStanding,
  fitBody,
  HERO_BODY_MAX_H,
  HERO_BODY_MAX_W,
  KINDS,
  lookProblems,
  reframeRows,
  MAX_FRAMES,
  MAX_LOOK_COLOURS,
  SLIDE_BODY_MAX_H,
  slotChar,
  type Look,
  type LookKind,
} from "@/model/look";
import { PALETTE_8BIT } from "@/model/palette";
import { listNames } from "./helpers";
import { defineCommand, fail, idArg, ok, type CommandResult } from "./types";

const targetArg = z.union([z.literal("hero"), z.literal("boss"), z.strictObject({ enemy: idArg })]);
export type LookTarget = z.infer<typeof targetArg>;
const frameIndex = z.number().int().min(0).max(MAX_FRAMES - 1);
const animationArg = z.string().min(1).max(32);

type Found = { kind: LookKind; look: Look; name: string };

function find(project: Project, target: LookTarget): Found | string {
  if (target === "hero") return { kind: "hero", look: project.hero.look, name: "The hero" };
  if (target === "boss") {
    if (!project.boss) return "Your game has no boss of its own yet.";
    return { kind: "boss", look: project.boss.look, name: tidyName(project.boss.name) };
  }
  const enemy = project.enemies.find((e) => e.id === target.enemy);
  if (!enemy) return `There is no enemy with the id "${target.enemy}".`;
  return { kind: enemy.behaviour, look: enemy.look, name: tidyName(enemy.name) };
}

function put(project: Project, target: LookTarget, look: Look): Project {
  if (target === "hero") return { ...project, hero: { ...project.hero, look } };
  if (target === "boss") return { ...project, boss: { ...project.boss!, look } };
  return { ...project, enemies: project.enemies.map((e) => (e.id === target.enemy ? { ...e, look } : e)) };
}

// Finds the target, applies a change to its look, and keeps the result only if the look is valid.
function editLook(project: Project, target: LookTarget, change: (found: Found) => Look | string): CommandResult {
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

const withFrames = (look: Look, animation: string, frames: string[][]): Look => ({
  ...look,
  animations: { ...look.animations, [animation]: { ...look.animations[animation], frames } },
});

const setLookColours = defineCommand({
  name: "setLookColours",
  description: `Set a character's colour slots: 1 to ${MAX_LOOK_COLOURS} colours from the 8-bit palette. Pixels name slots ("1" to "9", then "a" to "g").`,
  args: z.strictObject({
    target: targetArg,
    colours: z.array(z.number().int().min(0).max(PALETTE_8BIT.length - 1)).min(1).max(MAX_LOOK_COLOURS),
  }),
  apply(project, args) {
    return editLook(project, args.target, ({ look }) => {
      for (let slot = args.colours.length + 1; slot <= look.colours.length; slot++) {
        const ch = slotChar(slot);
        const users = Object.entries(look.animations).flatMap(([name, anim]) =>
          anim.frames.flatMap((rows, i) => (rows.some((row) => row.includes(ch)) ? [`${ANIMATION_NAMES[name]} frame ${i + 1}`] : [])),
        );
        if (users.length > 0) return `Colour ${slot} is still used in ${listNames(users)}.`;
      }
      return { ...look, colours: args.colours };
    });
  },
});

const setFrame = defineCommand({
  name: "setFrame",
  description: "Replace one frame of a character's animation with rows of pixels.",
  args: z.strictObject({ target: targetArg, animation: animationArg, frame: frameIndex, rows: z.array(z.string()).min(1).max(64) }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      if (args.frame >= anim.frames.length) return `${ANIMATION_NAMES[args.animation]} has no frame ${args.frame + 1}.`;
      return withFrames(found.look, args.animation, anim.frames.map((f, i) => (i === args.frame ? args.rows : f)));
    });
  },
});

const addFrame = defineCommand({
  name: "addFrame",
  description: "Add a frame to a character's animation after frame `after`: blank, or a copy of frame `after`.",
  args: z.strictObject({ target: targetArg, animation: animationArg, after: frameIndex, copy: z.boolean().optional() }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      const label = ANIMATION_NAMES[args.animation];
      if (anim.frames.length >= MAX_FRAMES) return `${label} already has ${MAX_FRAMES} frames, the most.`;
      if (args.after >= anim.frames.length) return `${label} has no frame ${args.after + 1}.`;
      const canvas = found.look.canvases[KINDS[found.kind].animations[args.animation]];
      const added = args.copy ? anim.frames[args.after] : Array.from({ length: canvas.h }, () => ".".repeat(canvas.w));
      const frames = [...anim.frames.slice(0, args.after + 1), added, ...anim.frames.slice(args.after + 1)];
      return withFrames(found.look, args.animation, frames);
    });
  },
});

const removeFrame = defineCommand({
  name: "removeFrame",
  description: "Remove a frame from a character's animation. Every animation keeps at least one.",
  args: z.strictObject({ target: targetArg, animation: animationArg, frame: frameIndex }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      const label = ANIMATION_NAMES[args.animation];
      if (args.frame >= anim.frames.length) return `${label} has no frame ${args.frame + 1}.`;
      if (anim.frames.length === 1) return `${label} needs at least one frame.`;
      return withFrames(found.look, args.animation, anim.frames.filter((_, i) => i !== args.frame));
    });
  },
});

const moveFrame = defineCommand({
  name: "moveFrame",
  description: "Move a frame of a character's animation to a new place in the animation.",
  args: z.strictObject({ target: targetArg, animation: animationArg, from: frameIndex, to: frameIndex }),
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
  description: "Set how fast one of a character's animations plays: slow, normal or fast.",
  args: z.strictObject({ target: targetArg, animation: animationArg, speed: z.enum(ANIMATION_SPEEDS) }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      const anim = animationOf(found, args.animation);
      if (typeof anim === "string") return anim;
      return { ...found.look, animations: { ...found.look.animations, [args.animation]: { ...anim, speed: args.speed } } };
    });
  },
});

const bodyFor = (found: Found, look: Look, which: "main" | "slide") => {
  const animation = which === "slide" ? "slide" : firstStanding(found.kind);
  const maxH = found.kind !== "hero" ? null : which === "slide" ? SLIDE_BODY_MAX_H : HERO_BODY_MAX_H;
  const maxW = found.kind === "hero" && which === "main" ? HERO_BODY_MAX_W : null;
  return fitBody(look.animations[animation].frames[0], look.canvases[which], maxH, maxW);
};

// Keeps a shot point inside a new body.
function withShotInside(found: Found, look: Look): Look {
  const shotHeight = KINDS[found.kind].shotHeight;
  if (shotHeight === null || look.shotY === undefined) return look;
  return { ...look, shotY: Math.max(0, Math.min(look.shotY, look.body.h - shotHeight)) };
}

const resizeCanvas = defineCommand({
  name: "resizeCanvas",
  description:
    "Resize one of a character's canvases, padding or trimming every frame on it evenly at the sides and at the top (the feet stay on the bottom), and fitting its hitbox to the drawing.",
  args: z.strictObject({ target: targetArg, canvas: z.string().min(1).max(32), w: z.number().int().min(1).max(64), h: z.number().int().min(1).max(64) }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      if (!KINDS[found.kind].canvases[args.canvas]) return `${found.name} has no canvas called "${args.canvas}".`;
      const animations = Object.fromEntries(
        Object.entries(found.look.animations).map(([name, anim]) => [
          name,
          KINDS[found.kind].animations[name] === args.canvas ? { ...anim, frames: anim.frames.map((f) => reframeRows(f, args.w, args.h)) } : anim,
        ]),
      );
      let look: Look = { ...found.look, canvases: { ...found.look.canvases, [args.canvas]: { w: args.w, h: args.h } }, animations };
      // Check the size before fitting, so a size outside the limits gets its own message.
      const sizeProblem = lookProblems(found.kind, look, found.name).find((p) => /canvas (is|must)/.test(p));
      if (sizeProblem) return sizeProblem;
      if (args.canvas === "main") look = withShotInside(found, { ...look, body: bodyFor(found, look, "main") });
      if (args.canvas === "slide") look = { ...look, slideBody: bodyFor(found, look, "slide") };
      return look;
    });
  },
});

const whichArg = z.enum(["main", "slide"]).optional();
const boxArg = z.strictObject({ x: z.number().int(), y: z.number().int(), w: z.number().int().min(1), h: z.number().int().min(1) });

const setBody = defineCommand({
  name: "setBody",
  description: "Set a character's hitbox (or the hero's sliding hitbox, with which: \"slide\") in its canvas's pixels.",
  args: z.strictObject({ target: targetArg, which: whichArg, body: boxArg }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      if (args.which === "slide") return found.kind === "hero" ? { ...found.look, slideBody: args.body } : `${found.name} can't slide.`;
      return withShotInside(found, { ...found.look, body: args.body });
    });
  },
});

const fitBodyCommand = defineCommand({
  name: "fitBody",
  description: "Fit a character's hitbox (or the hero's sliding hitbox) to its drawing.",
  args: z.strictObject({ target: targetArg, which: whichArg }),
  apply(project, args) {
    return editLook(project, args.target, (found) => {
      if (args.which === "slide") return found.kind === "hero" ? { ...found.look, slideBody: bodyFor(found, found.look, "slide") } : `${found.name} can't slide.`;
      return withShotInside(found, { ...found.look, body: bodyFor(found, found.look, "main") });
    });
  },
});

const setShotY = defineCommand({
  name: "setShotY",
  description: "Set where a character's shots come out: pixels below the top of its hitbox.",
  args: z.strictObject({ target: targetArg, y: z.number().int().min(-64).max(64) }),
  apply(project, args) {
    return editLook(project, args.target, (found) => ({ ...found.look, shotY: args.y }));
  },
});

export const lookCommands = [
  setLookColours,
  setFrame,
  addFrame,
  removeFrame,
  moveFrame,
  setAnimationSpeed,
  resizeCanvas,
  setBody,
  fitBodyCommand,
  setShotY,
];
