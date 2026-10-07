"use client";

import { useCallback, useMemo, useState } from "react";
import type { LevelCheck } from "@/checker/check";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import { HERO_PICTURES, PICTURE_NAMES, PICTURE_SIZES, pictureRows, type HeroPicture } from "@/model/hero";
import type { EnemyDesign } from "@/model/designs";
import type { Level, Project } from "@/model/schema";
import type { ArtSet } from "@/runtime/render/art";
import { heroArt } from "@/runtime/render/heroArt";
import styles from "../editor.module.css";
import type { RawImage } from "../hero/importPicture";
import { bodyBox } from "../hero/pixels";
import { previewInputs, previewSim } from "../hero/preview";
import { readPicture as readPictureFile } from "../hero/readPicture";
import { HeroAbilities } from "./HeroAbilities";
import { Colours } from "./Colours";
import { GamePreview } from "./GamePreview";
import { SpriteSwatch } from "./Palette";
import { PictureEditor, type DrawTool } from "./PictureEditor";

const NO_ENEMIES: EnemyDesign[] = [];

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
  const startPreview = useCallback(() => previewSim(look, abilities, pack), [look, abilities, pack]);
  const previewShow = useMemo(() => previewInputs(abilities), [abilities]);
  const [picture, setPicture] = useState<HeroPicture>("stand");
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [slot, setSlot] = useState(1);
  const colour = Math.min(slot, look.colours.length); // the chosen colour may have been removed
  const rows = pictureRows(look, picture);
  const size = PICTURE_SIZES[picture];

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
      <PictureEditor
        key={picture}
        name={PICTURE_NAMES[picture]}
        rows={rows}
        palette={sprites.palette}
        size={size}
        body={bodyBox(picture)}
        feet={picture !== "shot" && picture !== "chargedShot"}
        testId="hero-canvas"
        colours={look.colours}
        tool={tool}
        onTool={setTool}
        slot={colour}
        onSlot={setSlot}
        partners={partners.map((p) => ({ id: p, name: PICTURE_NAMES[p], rows: pictureRows(look, p) }))}
        importTarget={picture}
        readPicture={readPicture}
        locked={locked}
        onRows={(next) => onCommand({ name: "setHeroPose", args: { picture, rows: next } })}
        onImport={(result) => {
          if (result.colours.length !== look.colours.length) {
            onCommand({ name: "setHeroColours", args: { colours: result.colours } });
          }
          onCommand({ name: "setHeroPose", args: { picture, rows: result.rows } });
        }}
        onBegin={onBegin}
        onCommit={onCommit}
      />
      <div className={styles.heroSide}>
        <Colours
          colours={look.colours}
          slot={colour}
          onSlot={setSlot}
          onColours={(colours) => onCommand({ name: "setHeroColours", args: { colours } })}
        />
        <GamePreview
          label="Your hero in action"
          start={startPreview}
          inputs={previewShow}
          heroLook={look}
          enemies={NO_ENEMIES}
          art={art}
        />
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
    </fieldset>
  );
}
