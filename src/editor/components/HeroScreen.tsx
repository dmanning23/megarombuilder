"use client";

import { useCallback, useMemo } from "react";
import type { LevelCheck } from "@/checker/check";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import type { EnemyDesign } from "@/model/designs";
import type { Level, Project } from "@/model/schema";
import type { ArtSet } from "@/runtime/render/art";
import styles from "../editor.module.css";
import type { RawImage } from "../hero/importPicture";
import { previewInputs, previewSim } from "../hero/preview";
import { readPicture as readPictureFile } from "../hero/readPicture";
import { HeroAbilities } from "./HeroAbilities";
import { AnimationEditor } from "./AnimationEditor";
import { GamePreview } from "./GamePreview";

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

// The hero: its animations, drawn frame by frame, a preview, and its abilities. A stroke is one undo step.
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
  const startPreview = useCallback(
    () => previewSim(look, abilities, pack),
    [look, abilities, pack],
  );
  const previewShow = useMemo(() => previewInputs(abilities), [abilities]);

  return (
    <fieldset
      className={styles.characterScreen}
      disabled={locked}
      aria-label="Your hero"
    >
      {error && (
        <p className={styles.alert} role="alert">
          {error}
          <button type="button" onClick={onDismissError}>
            Dismiss
          </button>
        </p>
      )}
      <section className={styles.aboutBar} aria-label="About your hero">
        <HeroAbilities
          abilities={abilities}
          level={level}
          check={check}
          onAbilities={(changes) =>
            onCommand({ name: "setHeroAbilities", args: changes })
          }
          onGoToZone={onGoToZone}
          onReset={() => {
            if (
              confirm(
                "Start again from the snow hero's look? You can undo this.",
              )
            ) {
              onCommand({ name: "resetHeroLook", args: {} });
            }
          }}
        />
      </section>
      <AnimationEditor
        kind="hero"
        look={look}
        target="hero"
        testId="hero-canvas"
        notes={{
          ...(abilities.slide ? {} : { slide: "(needs slide)" }),
          ...(abilities.chargeShot
            ? {}
            : { chargedShot: "(needs charge shot)" }),
        }}
        locked={locked}
        onCommand={onCommand}
        onBegin={onBegin}
        onCommit={onCommit}
        readPicture={readPicture}
        confirm={confirm}
        preview={
          <GamePreview
            label="Your hero in action"
            start={startPreview}
            inputs={previewShow}
            heroLook={look}
            enemies={NO_ENEMIES}
            art={art}
          />
        }
      />
    </fieldset>
  );
}
