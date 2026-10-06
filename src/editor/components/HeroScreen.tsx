"use client";

import { useMemo, useRef, useState } from "react";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import { HERO_PICTURES, PICTURE_NAMES, PICTURE_SIZES, pictureRows, type HeroPicture } from "@/model/hero";
import type { Project } from "@/model/schema";
import type { ArtSet } from "@/runtime/render/art";
import { heroArt } from "@/runtime/render/heroArt";
import styles from "../editor.module.css";
import { blankRows, flipRows, floodFill, linePixels, setPixels, type Pixel } from "../hero/pixels";
import { HeroCanvas } from "./HeroCanvas";
import { HeroPreview } from "./HeroPreview";
import { SpriteSwatch } from "./Palette";

type DrawTool = "pencil" | "eraser" | "fill" | "pick";

const TOOLS: { id: DrawTool; label: string }[] = [
  { id: "pencil", label: "Pencil" },
  { id: "eraser", label: "Eraser" },
  { id: "fill", label: "Fill" },
  { id: "pick", label: "Pick colour" },
];

type Props = {
  project: Project;
  pack: ContentPack;
  art?: ArtSet;
  locked: boolean; // the assistant is working
  error: string | null;
  onDismissError(): void;
  onCommand(command: Command): void;
  onBegin(label: string): void;
  onCommit(): void;
};

// Draw the hero picture by picture. A stroke is one undo step, like painting tiles.
export function HeroScreen({ project, pack, art, locked, error, onDismissError, onCommand, onBegin, onCommit }: Props) {
  const { look, abilities } = project.hero;
  const sprites = useMemo(() => heroArt(look), [look]);
  const [picture, setPicture] = useState<HeroPicture>("stand");
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [slot, setSlot] = useState(1);
  const colour = Math.min(slot, look.colours.length); // the chosen colour may have been removed
  const stroke = useRef<{ rows: string[]; last: Pixel } | null>(null);

  const rows = pictureRows(look, picture);
  const size = PICTURE_SIZES[picture];
  const save = (next: string[]) => onCommand({ name: "setHeroPose", args: { picture, rows: next } });
  const ink = tool === "eraser" ? "." : String(colour);

  const press = (p: Pixel) => {
    if (locked) return;
    if (tool === "pick") {
      const ch = rows[p.y][p.x];
      if (ch !== ".") setSlot(Number(ch));
      return;
    }
    if (tool === "fill") {
      save(floodFill(rows, p, String(colour)));
      return;
    }
    onBegin(tool === "eraser" ? "Erase" : "Draw");
    const next = setPixels(rows, [p], ink);
    stroke.current = { rows: next, last: p };
    save(next);
  };
  const drag = (p: Pixel) => {
    const current = stroke.current;
    if (!current) return;
    const next = setPixels(current.rows, linePixels(current.last, p), ink);
    stroke.current = { rows: next, last: p };
    save(next);
  };
  const release = () => {
    if (!stroke.current) return;
    stroke.current = null;
    onCommit();
  };

  const partners = HERO_PICTURES.filter(
    (other) => other !== picture && PICTURE_SIZES[other].w === size.w && PICTURE_SIZES[other].h === size.h,
  );
  const spriteOf = (p: HeroPicture) =>
    p === "shot" ? sprites.shot : p === "chargedShot" ? sprites.chargedShot : sprites.poses[p];

  return (
    <fieldset className={styles.heroScreen} disabled={locked} aria-label="Your hero">
      {error && (
        <p className={styles.alert} role="alert">
          {error}
          <button type="button" onClick={onDismissError}>
            Dismiss
          </button>
        </p>
      )}
      <ul className={styles.poses} aria-label="Pictures">
        {HERO_PICTURES.map((p) => (
          <li key={p}>
            <button
              type="button"
              className={styles.swatch}
              aria-pressed={p === picture}
              onClick={() => setPicture(p)}
            >
              <SpriteSwatch sprite={spriteOf(p)} palette={sprites.palette} />
              {PICTURE_NAMES[p]}
              {p === "slide" && !abilities.slide && (
                <>
                  {" "}
                  <span className={styles.needs}>(needs slide)</span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.drawing}>
        <HeroCanvas
          rows={rows}
          palette={sprites.palette}
          picture={picture}
          onPress={press}
          onDrag={drag}
          onRelease={release}
        />
        <div className={styles.drawTools} role="group" aria-label="Drawing tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.swatch}
              aria-pressed={tool === t.id}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.drawTools} role="group" aria-label="Picture tools">
          {partners.length > 0 && (
            <label className={styles.field}>
              Copy from
              <select
                value=""
                onChange={(e) => {
                  const from = e.target.value as HeroPicture;
                  if (from) save(pictureRows(look, from));
                }}
              >
                <option value="">Choose a picture…</option>
                {partners.map((other) => (
                  <option key={other} value={other}>
                    {PICTURE_NAMES[other]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className={styles.swatch} onClick={() => save(flipRows(rows))}>
            Flip
          </button>
          <button type="button" className={styles.swatch} onClick={() => save(blankRows(size.w, size.h))}>
            Clear
          </button>
        </div>
      </div>
      <div className={styles.heroSide}>
        <HeroPreview look={look} abilities={abilities} pack={pack} art={art} />
      </div>
    </fieldset>
  );
}
