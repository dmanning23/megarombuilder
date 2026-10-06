"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LevelCheck } from "@/checker/check";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import { HERO_PICTURES, PICTURE_NAMES, PICTURE_SIZES, pictureRows, type HeroPicture } from "@/model/hero";
import type { Level, Project } from "@/model/schema";
import type { ArtSet } from "@/runtime/render/art";
import { heroArt } from "@/runtime/render/heroArt";
import styles from "../editor.module.css";
import type { Imported, RawImage } from "../hero/importPicture";
import { blankRows, flipRows, floodFill, linePixels, setPixels, type Pixel } from "../hero/pixels";
import { NOT_A_PICTURE, readPicture as readPictureFile } from "../hero/readPicture";
import { HeroAbilities } from "./HeroAbilities";
import { HeroCanvas } from "./HeroCanvas";
import { HeroColours } from "./HeroColours";
import { HeroPreview } from "./HeroPreview";
import { ImportDialog } from "./ImportDialog";
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
  level: Level;
  check: LevelCheck | null;
  onGoToZone(zoneId: string): void;
  confirm(message: string): boolean;
  readPicture?: (file: File) => Promise<RawImage>;
};

// Draw the hero picture by picture. A stroke is one undo step, like painting tiles.
export function HeroScreen({
  project,
  pack,
  art,
  locked,
  error,
  onDismissError,
  onCommand,
  onBegin,
  onCommit,
  level,
  check,
  onGoToZone,
  confirm,
  readPicture = readPictureFile,
}: Props) {
  const { look, abilities } = project.hero;
  const sprites = useMemo(() => heroArt(look), [look]);
  const [picture, setPicture] = useState<HeroPicture>("stand");
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [slot, setSlot] = useState(1);
  const colour = Math.min(slot, look.colours.length); // the chosen colour may have been removed
  // The stroke being drawn, and the picture it belongs to.
  const stroke = useRef<{ picture: HeroPicture; rows: string[]; last: Pixel } | null>(null);

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
    stroke.current = { picture, rows: next, last: p };
    save(next);
  };
  const drag = (p: Pixel, fresh: boolean) => {
    const current = stroke.current;
    if (!current) return;
    const next = setPixels(current.rows, fresh ? [p] : linePixels(current.last, p), ink);
    stroke.current = { ...current, rows: next, last: p };
    onCommand({ name: "setHeroPose", args: { picture: current.picture, rows: next } });
  };
  const release = () => {
    if (!stroke.current) return;
    stroke.current = null;
    onCommit();
  };
  const choosePicture = (next: HeroPicture) => {
    release(); // a stroke ends in its own picture
    setPicture(next);
  };

  // Leaving the hero screen mid-stroke (opening the level, say) ends the stroke as one undo step.
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });
  useEffect(() => {
    const open = stroke;
    const commit = commitRef;
    return () => {
      if (!open.current) return;
      open.current = null;
      commit.current();
    };
  }, []);

  // Importing a picture: read the file, show the dialog, and on "Use this" make it one undo step.
  const [importing, setImporting] = useState<RawImage | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      setImporting(await readPicture(file));
    } catch {
      setImportError(NOT_A_PICTURE);
    }
  };
  const useImport = (result: Imported) => {
    release();
    onBegin("Import a picture");
    if (result.colours.length !== look.colours.length) {
      onCommand({ name: "setHeroColours", args: { colours: result.colours } });
    }
    onCommand({ name: "setHeroPose", args: { picture, rows: result.rows } });
    onCommit();
    setImporting(null);
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
      {importError && (
        <p className={styles.alert} role="alert">
          {importError}
          <button type="button" onClick={() => setImportError(null)}>
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
              onClick={() => choosePicture(p)}
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
          <button type="button" className={styles.swatch} onClick={() => fileInput.current?.click()}>
            Import picture
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            aria-label="Picture file"
            className={styles.fileInput}
            onChange={(e) => {
              void pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <div className={styles.heroSide}>
        <HeroColours
          colours={look.colours}
          slot={colour}
          onSlot={setSlot}
          onColours={(colours) => onCommand({ name: "setHeroColours", args: { colours } })}
        />
        <HeroPreview look={look} abilities={abilities} pack={pack} art={art} />
      </div>
      <HeroAbilities
        abilities={abilities}
        level={level}
        check={check}
        onAbilities={(changes) => onCommand({ name: "setHeroAbilities", args: changes })}
        onGoToZone={onGoToZone}
        onReset={() => {
          if (confirm("Start again from the snow hero's look? You can undo this.")) {
            onCommand({ name: "resetHeroLook", args: {} });
          }
        }}
      />
      {importing && (
        <ImportDialog
          picture={picture}
          colours={look.colours}
          image={importing}
          onUse={useImport}
          onCancel={() => setImporting(null)}
        />
      )}
    </fieldset>
  );
}
