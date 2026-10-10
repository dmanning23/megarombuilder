"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LookTarget } from "@/commands/look";
import type { Command } from "@/commands/types";
import {
  ANIMATION_NAMES,
  ANIMATION_SPEEDS,
  cutsDrawing,
  cutsRows,
  firesFrom,
  hasShotPoint,
  HERO_BODY_MAX_H,
  HERO_BODY_MAX_W,
  isFixed,
  KINDS,
  MAX_FRAMES,
  poseBox,
  reframeRows,
  type AnimationSpeed,
  type Look,
  type LookBox,
  type LookKind,
  SLIDE_BODY_MAX_H,
} from "@/model/look";
import { baseFor, frameSteps } from "@/runtime/render/animate";
import { lookSprites, paletteOf } from "@/runtime/render/lookArt";
import styles from "../editor.module.css";
import {
  moveBox,
  moveEdge,
  pickGrip,
  shotYAt,
  type Grip,
  type HitboxLimits,
} from "../hero/hitbox";
import type { RawImage } from "../hero/importPicture";
import type { Pixel } from "../hero/pixels";
import { Colours } from "./Colours";
import { SpriteSwatch } from "./Palette";
import { PictureEditor, type DrawTool, type ExtraTool } from "./PictureEditor";

const SPEED_NAMES: Record<AnimationSpeed, string> = {
  slow: "Slow",
  normal: "Normal",
  fast: "Fast",
};
const frameCount = (n: number) => (n === 1 ? "1 frame" : `${n} frames`);

type Props = {
  kind: LookKind;
  look: Look;
  target: LookTarget;
  testId: string; // the drawing canvas's test id: "hero-canvas", "enemy-canvas", "boss-canvas"
  notes?: Record<string, string>; // shown after an animation's name, such as "(needs slide)"
  locked: boolean;
  onCommand(command: Command): void;
  onBegin(label: string): void;
  onCommit(): void;
  readPicture(file: File): Promise<RawImage>;
  confirm(message: string): boolean;
  preview?: ReactNode; // the live game preview, shown beside the drawing
};

// Loops an animation's frames in a small box at its speed, while playing.
function Player({
  frames,
  palette,
  size,
  speed,
  base,
}: {
  frames: string[][];
  palette: Record<string, string>;
  size: { w: number; h: number };
  speed: AnimationSpeed;
  base: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let step = 0;
    const steps = frameSteps(base, speed);
    const draw = () => {
      const ctx = ref.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, size.w, size.h);
      const rows = frames[Math.floor(step / steps) % frames.length];
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          const colour = palette[ch];
          if (!colour) return;
          ctx.fillStyle = colour;
          ctx.fillRect(x, y, 1, 1);
        }),
      );
    };
    draw();
    const timer = setInterval(() => {
      step++;
      draw();
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [frames, palette, size, speed, base]);
  return (
    <canvas
      ref={ref}
      width={size.w}
      height={size.h}
      className={styles.playBox}
      aria-hidden="true"
    />
  );
}

// A character's animations: choose one, work on its frames, play it, and draw each frame.
export function AnimationEditor({
  kind,
  look,
  target,
  testId,
  notes = {},
  locked,
  onCommand,
  onBegin,
  onCommit,
  readPicture,
  confirm,
  preview,
}: Props) {
  const rule = KINDS[kind];
  const names = Object.keys(rule.animations);
  const [animation, setAnimation] = useState(names[0]);
  const [chosen, setChosen] = useState(0);
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [slot, setSlot] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [onion, setOnion] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);

  const sprites = useMemo(() => lookSprites(look, kind), [look, kind]);
  const palette = useMemo(() => paletteOf(look.colours), [look.colours]);
  const anim = look.animations[animation];
  const frame = Math.min(chosen, anim.frames.length - 1); // undo can take the chosen frame away
  const poseRule = rule.animations[animation];
  const size = anim.size;
  const body = poseBox(look, kind, animation);
  const colour = Math.min(slot, look.colours.length);
  const fixed = isFixed(poseRule); // the hero's shots
  // A Size step the hitbox can't fit into is dimmed, with a note saying why.
  const bodySize =
    poseRule.body === "main"
      ? look.body
      : poseRule.body === "slide"
        ? look.slideBody
        : undefined;
  const roomFor = (w: number, h: number) =>
    !bodySize || (w >= bodySize.w && h >= bodySize.h);
  const narrowerFits = size.w - 2 >= poseRule.min.w;
  const shorterFits = size.h - 2 >= poseRule.min.h;
  const hitboxStops =
    (narrowerFits && !roomFor(size.w - 2, size.h)) ||
    (shorterFits && !roomFor(size.w, size.h - 2));
  const resize = (w: number, h: number) => {
    if (
      cutsDrawing(look, animation, w, h) &&
      !confirm("This cuts off part of your drawing. You can undo it.")
    )
      return;
    send("resizePose", { animation, w, h });
  };

  // A hitbox or shot point being dragged: shown live, saved once when the press ends. The ref holds
  // the latest drag for the release, which may run before React re-renders.
  type Draft = { body?: LookBox; shotY?: number; grip?: Grip; from?: Pixel };
  const [draft, setDraftState] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const setDraft = (next: Draft | null) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const which = poseRule.body;
  const shotHeight = rule.shotHeight;
  // The box can't grow past the smallest picture of the poses that share it.
  const sharing = names
    .filter((n) => which !== null && rule.animations[n].body === which)
    .map((n) => look.animations[n].size);
  const smallest = {
    w: Math.min(...sharing.map((s) => s.w)),
    h: Math.min(...sharing.map((s) => s.h)),
  };
  const hitboxLimits: HitboxLimits = {
    canvas: size,
    maxW: Math.min(
      kind === "hero" && which === "main" ? HERO_BODY_MAX_W : Infinity,
      smallest.w,
    ),
    maxH: Math.min(
      kind === "hero"
        ? which === "slide"
          ? SLIDE_BODY_MAX_H
          : HERO_BODY_MAX_H
        : Infinity,
      smallest.h,
    ),
    minH: which === "main" ? shotHeight : null,
  };
  // Only a pose the character fires from offers the Shot point tool.
  const shotHere = firesFrom(kind, animation) && hasShotPoint(kind, animation) && body !== null;
  const extraTools: ExtraTool[] =
    body === null
      ? []
      : [
          {
            id: "hitbox",
            label: "Hitbox",
            press: (p: Pixel) => {
              const picked = pickGrip(body, p);
              const grip = which === "slide" && picked !== "move" ? "top" : picked; // a slide's feet stay on the floor
              setDraft({
                grip,
                from: p,
                body: grip === "move" ? body : moveEdge(body, grip, p, hitboxLimits),
              });
            },
            drag: (p: Pixel) => {
              const d = draftRef.current;
              if (!d?.grip || !d.from) return;
              setDraft({
                ...d,
                body:
                  d.grip === "move"
                    ? moveBox(body, d.from, p, size)
                    : moveEdge(body, d.grip, p, hitboxLimits),
              });
            },
            release: () => {
              const next = draftRef.current?.body;
              setDraft(null);
              if (
                !next ||
                (next.x === body.x &&
                  next.y === body.y &&
                  next.w === body.w &&
                  next.h === body.h)
              )
                return;
              // The command keeps every pose's shot point on the same row of its picture.
              send("setBody", { animation, body: next });
            },
          },
          ...(shotHere && shotHeight !== null
            ? [
                {
                  id: "shot",
                  label: "Shot point",
                  press: (p: Pixel) =>
                    setDraft({ shotY: shotYAt(body, p, shotHeight) }),
                  drag: (p: Pixel) =>
                    setDraft({ shotY: shotYAt(body, p, shotHeight) }),
                  release: () => {
                    const y = draftRef.current?.shotY;
                    setDraft(null);
                    if (y !== undefined && y !== anim.shotY)
                      send("setShotY", { animation, y });
                  },
                },
              ]
            : []),
        ];
  // A tool this animation doesn't offer (the shot point on the slide) falls back to the pencil.
  const offered =
    tool === "hitbox" ? body !== null : tool === "shot" ? shotHere : true;
  const activeTool = offered ? tool : "pencil";
  const shownBody = draft?.body ?? body;
  const shownShotY = draft?.shotY ?? anim.shotY;
  const shot =
    shotHere && shotHeight !== null && shownBody && shownShotY !== undefined
      ? { y: shownBody.y + shownShotY, h: shotHeight }
      : undefined;
  const send = (name: string, args: Record<string, unknown>) =>
    onCommand({ name, args: { target, ...args } });
  const label = ANIMATION_NAMES[animation];
  const under =
    onion && anim.frames.length > 1
      ? anim.frames[(frame - 1 + anim.frames.length) % anim.frames.length]
      : undefined;

  // The zoom fits the character's largest picture, so pixels stay the same size between poses.
  const largest = Object.values(look.animations).reduce(
    (most, a) => ({ w: Math.max(most.w, a.size.w), h: Math.max(most.h, a.size.h) }),
    { w: 0, h: 0 },
  );
  // Copy from offers the frames of poses that share this pose's hitbox (the hero's shots and Slide
  // only their own), fitted to this pose's size the way Size fits them.
  const sharesWith = (other: string) =>
    poseRule.body === null
      ? other === animation
      : rule.animations[other].body === poseRule.body;
  const partners = names.filter(sharesWith).flatMap((other) =>
    look.animations[other].frames.flatMap((rows, i) =>
      other === animation && i === frame
        ? []
        : [
            {
              id: `${other}:${i}`,
              name: `${ANIMATION_NAMES[other]} frame ${i + 1}`,
              rows: reframeRows(rows, size.w, size.h),
              cuts: cutsRows(rows, size.w, size.h),
            },
          ],
    ),
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= anim.frames.length || from === to) return;
    send("moveFrame", { animation, from, to });
    setChosen(to);
  };

  return (
    <section className={styles.animationEditor} aria-label="Look">
      <ul className={styles.poses} role="group" aria-label="Animations">
        {names.map((name) => {
          const count = look.animations[name].frames.length;
          return (
            <li key={name}>
              <button
                type="button"
                className={styles.swatch}
                aria-label={`${ANIMATION_NAMES[name]}, ${frameCount(count)}`}
                aria-pressed={name === animation}
                onClick={() => {
                  setAnimation(name);
                  setChosen(0);
                  setPlaying(false);
                }}
              >
                <SpriteSwatch
                  sprite={sprites[name].frames[0]}
                  palette={palette}
                />
                <span className={styles.animationName}>
                  {ANIMATION_NAMES[name]}
                  {notes[name] && (
                    <span className={styles.needs}>{notes[name]}</span>
                  )}
                  <span className={styles.frameCount}>{frameCount(count)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.lightTable}>
        <div className={styles.frameStrip}>
          <div role="group" aria-label="Frames" className={styles.frames}>
            {anim.frames.map((_, i) => (
              <button
                key={i}
                type="button"
                draggable
                className={styles.frameButton}
                aria-label={`Frame ${i + 1}`}
                aria-pressed={i === frame}
                onClick={() => setChosen(i)}
                onDragStart={(e) => {
                  e.dataTransfer?.setData("text/plain", String(i)); // some browsers only drag with data
                  setDragged(i);
                }}
                onDragEnd={() => setDragged(null)}
                onDragOver={(e) => {
                  if (dragged !== null) e.preventDefault(); // only a frame from this strip can be dropped
                }}
                onDrop={(e) => {
                  if (dragged === null) return;
                  e.preventDefault();
                  move(dragged, i);
                  setDragged(null);
                }}
              >
                <SpriteSwatch
                  sprite={sprites[animation].frames[i]}
                  palette={palette}
                />
                {i + 1}
              </button>
            ))}
          </div>
          <div
            className={styles.drawTools}
            role="group"
            aria-label="Frame tools"
          >
            <button
              type="button"
              className={styles.action}
              disabled={anim.frames.length >= MAX_FRAMES}
              onClick={() => {
                send("addFrame", { animation, after: frame });
                setChosen(frame + 1);
              }}
            >
              Add frame
            </button>
            <button
              type="button"
              className={styles.action}
              disabled={anim.frames.length >= MAX_FRAMES}
              onClick={() => {
                send("addFrame", { animation, after: frame, copy: true });
                setChosen(frame + 1);
              }}
            >
              Copy frame
            </button>
            <button
              type="button"
              className={`${styles.action} ${styles.danger}`}
              disabled={anim.frames.length <= 1}
              onClick={() => {
                send("removeFrame", { animation, frame });
                setChosen(Math.max(0, frame - 1));
              }}
            >
              Delete frame
            </button>
            <button
              type="button"
              className={styles.action}
              disabled={frame === 0}
              onClick={() => move(frame, frame - 1)}
            >
              Move left
            </button>
            <button
              type="button"
              className={styles.action}
              disabled={frame === anim.frames.length - 1}
              onClick={() => move(frame, frame + 1)}
            >
              Move right
            </button>
          </div>
          {anim.frames.length >= MAX_FRAMES && (
            <p className={styles.note}>{MAX_FRAMES} frames is the most.</p>
          )}
        </div>

        <div className={styles.playRow}>
          <button
            type="button"
            className={styles.action}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? "Stop animation" : "Play animation"}
          </button>
          {playing && (
            <Player
              frames={anim.frames}
              palette={palette}
              size={size}
              speed={anim.speed}
              base={baseFor(animation)}
            />
          )}
          <div
            role="group"
            aria-label="Animation speed"
            className={styles.steps}
          >
            <span className={styles.abilityLabel}>Animation speed</span>
            {ANIMATION_SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={styles.step}
                aria-pressed={anim.speed === speed}
                onClick={() => send("setAnimationSpeed", { animation, speed })}
              >
                {SPEED_NAMES[speed]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.choice}
            aria-pressed={onion}
            onClick={() => setOnion((o) => !o)}
          >
            Onion skin
          </button>
        </div>

        <PictureEditor
          pictureButtons={
            <>
              {activeTool === "hitbox" && (
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => send("fitBody", { animation })}
                >
                  Fit to drawing
                </button>
              )}

              {!fixed && (
                <div role="group" aria-label="Size" className={styles.steps}>
                  <span className={styles.abilityLabel}>Size</span>
                  <span
                    className={styles.note}
                  >{`${size.w} × ${size.h}`}</span>
                  <button
                    type="button"
                    className={styles.action}
                    disabled={!narrowerFits || !roomFor(size.w - 2, size.h)}
                    onClick={() => resize(size.w - 2, size.h)}
                  >
                    Narrower
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    disabled={size.w + 2 > poseRule.max.w}
                    onClick={() => resize(size.w + 2, size.h)}
                  >
                    Wider
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    disabled={!shorterFits || !roomFor(size.w, size.h - 2)}
                    onClick={() => resize(size.w, size.h - 2)}
                  >
                    Shorter
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    disabled={size.h + 2 > poseRule.max.h}
                    onClick={() => resize(size.w, size.h + 2)}
                  >
                    Taller
                  </button>
                  {hitboxStops && (
                    <p className={styles.note}>
                      The hitbox needs this much room.
                    </p>
                  )}
                </div>
              )}
            </>
          }
          key={`${animation}:${frame}`}
          name={`${label} frame ${frame + 1}`}
          rows={anim.frames[frame]}
          under={under}
          palette={palette}
          size={size}
          body={shownBody}
          shot={shot}
          extraTools={extraTools}
          zoomFor={largest}
          confirm={confirm}
          feet={poseRule.body !== null}
          testId={testId}
          colours={look.colours}
          tool={activeTool}
          onTool={setTool}
          slot={colour}
          onSlot={setSlot}
          partners={partners}
          importTarget={{
            ...size,
            stand: poseRule.body !== null,
          }}
          readPicture={readPicture}
          locked={locked}
          onRows={(rows) => send("setFrame", { animation, frame, rows })}
          onImport={(result) => {
            if (result.colours.length !== look.colours.length)
              send("setLookColours", { colours: result.colours });
            send("setFrame", { animation, frame, rows: result.rows });
          }}
          onBegin={onBegin}
          onCommit={onCommit}
        />
      </div>
      <div className={styles.lookPanels}>
        <Colours
          colours={look.colours}
          slot={colour}
          onSlot={setSlot}
          onColours={(colours) => send("setLookColours", { colours })}
        />
        {preview && (
          <div className={styles.panel}>
            <h2 className={styles.panelHeading}>Preview</h2>
            {preview}
          </div>
        )}
      </div>
    </section>
  );
}
