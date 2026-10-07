"use client";

import { useCallback, useMemo, useState } from "react";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import {
  DAMAGE_STEPS,
  ENEMY_BEHAVIOURS,
  ENEMY_FRAME,
  HEALTH_STEPS,
  MAX_ENEMIES,
  SHOOT_STEPS,
  SPEED_STEPS,
  TUNING_USED,
  type EnemyBehaviour,
  type EnemyDesign,
  type EnemyTuning,
} from "@/model/designs";
import { tidyName, type Project } from "@/model/schema";
import type { ArtSet } from "@/runtime/render/art";
import { lookArt } from "@/runtime/render/lookArt";
import styles from "../editor.module.css";
import type { RawImage } from "../hero/importPicture";
import { enemyBody } from "../hero/pixels";
import { enemyPreviewSim, IDLE_INPUTS } from "../hero/preview";
import { readPicture as readPictureFile } from "../hero/readPicture";
import { Colours } from "./Colours";
import { GamePreview } from "./GamePreview";
import { SpriteSwatch } from "./Palette";
import { PictureEditor, type DrawTool } from "./PictureEditor";

export const BEHAVIOUR_NAMES: Record<EnemyBehaviour, string> = {
  walker: "Walker",
  flyer: "Flyer",
  turret: "Turret",
  jumper: "Hopper",
  shielded: "Shield guard",
  dropper: "Dropper",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STEP_ROWS: { key: keyof EnemyTuning; label: string; steps: readonly (string | number)[]; name(step: string | number): string }[] = [
  { key: "health", label: "Health", steps: HEALTH_STEPS, name: (s) => (s === 1 ? "1 hit" : `${s} hits`) },
  { key: "damage", label: "Damage", steps: DAMAGE_STEPS, name: (s) => cap(String(s)) },
  { key: "speed", label: "Speed", steps: SPEED_STEPS, name: (s) => cap(String(s)) },
  { key: "shoots", label: "Shoots", steps: SHOOT_STEPS, name: (s) => cap(String(s)) },
];

// "Enemy N" with the smallest N no enemy is called.
function nextName(enemies: EnemyDesign[]): string {
  const taken = new Set(enemies.map((e) => tidyName(e.name).toLowerCase()));
  for (let n = 1; ; n++) if (!taken.has(`enemy ${n}`)) return `Enemy ${n}`;
}

// The enemy doing its thing on one screen, with the hero standing still.
function EnemyPreview({ enemy, project, pack, art }: { enemy: EnemyDesign; project: Project; pack: ContentPack; art?: ArtSet }) {
  const hero = project.hero;
  const start = useCallback(() => enemyPreviewSim(enemy, hero, pack), [enemy, hero, pack]);
  const enemies = useMemo(() => [enemy], [enemy]);
  return (
    <GamePreview
      label={`${tidyName(enemy.name)} in action`}
      start={start}
      inputs={IDLE_INPUTS}
      heroLook={hero.look}
      enemies={enemies}
      art={art}
    />
  );
}

// The name box saves when it loses focus or Enter is pressed, if the name changed.
function NameField({ name, onRename }: { name: string; onRename(name: string): void }) {
  const [text, setText] = useState(name);
  const save = () => {
    if (tidyName(text) && tidyName(text) !== tidyName(name)) onRename(text);
  };
  return (
    <label className={styles.field}>
      Name
      <input
        value={text}
        maxLength={40}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
    </label>
  );
}

type Props = {
  project: Project;
  pack: ContentPack;
  art?: ArtSet;
  locked: boolean;
  error: string | null;
  onDismissError(): void;
  onCommand(command: Command): void;
  onBegin(label: string): void;
  onCommit(): void;
  confirm(message: string): boolean;
  makeId(): string;
  readPicture?: (file: File) => Promise<RawImage>;
};

export function EnemiesScreen({
  project,
  pack,
  art,
  locked,
  error,
  onDismissError,
  onCommand,
  onBegin,
  onCommit,
  confirm,
  makeId,
  readPicture = readPictureFile,
}: Props) {
  const { enemies } = project;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const enemy = enemies.find((e) => e.id === selectedId) ?? enemies[0] ?? null;
  const [making, setMaking] = useState(false);
  const [newName, setNewName] = useState("");
  const [frame, setFrame] = useState<0 | 1>(0);
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [slot, setSlot] = useState(1);
  const arts = useMemo(() => new Map(enemies.map((e) => [e.id, lookArt(e.look)])), [enemies]);

  const create = (behaviour: EnemyBehaviour) => {
    const id = makeId();
    onCommand({ name: "addEnemy", args: { enemyId: id, name: tidyName(newName) || nextName(enemies), behaviour } });
    setSelectedId(id);
    setMaking(false);
    setNewName("");
    setFrame(0);
  };

  return (
    <fieldset className={styles.heroScreen} disabled={locked} aria-label="Your enemies">
      {error && (
        <p className={styles.alert} role="alert">
          {error}
          <button type="button" onClick={onDismissError}>
            Dismiss
          </button>
        </p>
      )}
      <div className={styles.enemyList}>
        <ul className={styles.poses} aria-label="Enemies">
          {enemies.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={styles.swatch}
                aria-pressed={e.id === enemy?.id}
                onClick={() => {
                  setSelectedId(e.id);
                  setFrame(0);
                }}
              >
                <SpriteSwatch sprite={arts.get(e.id)?.frames[0]} palette={arts.get(e.id)?.palette} />
                {tidyName(e.name)}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={styles.swatch}
          disabled={enemies.length >= MAX_ENEMIES}
          onClick={() => setMaking((m) => !m)}
        >
          New enemy
        </button>
        {enemies.length >= MAX_ENEMIES && <p className={styles.note}>12 is the most.</p>}
        {making && (
          <div className={styles.newEnemy}>
            <label className={styles.field}>
              Enemy name
              <input value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <div className={styles.steps} role="group" aria-label="Choose how it behaves">
              {ENEMY_BEHAVIOURS.map((b) => (
                <button key={b} type="button" className={styles.step} onClick={() => create(b)}>
                  {BEHAVIOUR_NAMES[b]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!enemy ? (
        <p className={styles.note}>Make your own enemies to fight. Start with New enemy.</p>
      ) : (
        <>
          <div className={styles.drawing}>
            <NameField
              key={enemy.id}
              name={tidyName(enemy.name)}
              onRename={(name) => onCommand({ name: "renameEnemy", args: { enemyId: enemy.id, name } })}
            />
            <div role="group" aria-label="Behaviour" className={styles.ability}>
              <span className={styles.abilityLabel}>Behaviour</span>
              <div className={styles.steps}>
                {ENEMY_BEHAVIOURS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={styles.step}
                    aria-pressed={enemy.behaviour === b}
                    onClick={() => onCommand({ name: "setEnemyBehaviour", args: { enemyId: enemy.id, behaviour: b } })}
                  >
                    {BEHAVIOUR_NAMES[b]}
                  </button>
                ))}
              </div>
            </div>
            {STEP_ROWS.filter((row) => TUNING_USED[enemy.behaviour].includes(row.key)).map((row) => (
              <div key={row.key} role="group" aria-label={row.label} className={styles.ability}>
                <span className={styles.abilityLabel}>{row.label}</span>
                <div className={styles.steps}>
                  {row.steps.map((step) => (
                    <button
                      key={String(step)}
                      type="button"
                      className={styles.step}
                      aria-pressed={enemy.tuning[row.key] === step}
                      onClick={() => onCommand({ name: "setEnemyTuning", args: { enemyId: enemy.id, [row.key]: step } })}
                    >
                      {row.name(step)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className={styles.drawTools} role="group" aria-label="Frames">
              {([0, 1] as const).map((f) => (
                <button key={f} type="button" className={styles.swatch} aria-pressed={frame === f} onClick={() => setFrame(f)}>
                  Frame {f + 1}
                </button>
              ))}
            </div>
            <PictureEditor
              key={`${enemy.id}:${frame}`}
              name={`Frame ${frame + 1}`}
              rows={enemy.look.frames[frame]}
              palette={arts.get(enemy.id)!.palette}
              size={ENEMY_FRAME}
              body={enemyBody(enemy.behaviour)}
              feet
              testId="enemy-canvas"
              colours={enemy.look.colours}
              tool={tool}
              onTool={setTool}
              slot={Math.min(slot, enemy.look.colours.length)}
              onSlot={setSlot}
              partners={[{ id: String(1 - frame), name: `Frame ${2 - frame}`, rows: enemy.look.frames[1 - frame] }]}
              importTarget={{ ...ENEMY_FRAME, stand: true }}
              readPicture={readPicture}
              locked={locked}
              onRows={(rows) => onCommand({ name: "setEnemyFrame", args: { enemyId: enemy.id, frame, rows } })}
              onImport={(result) => {
                if (result.colours.length !== enemy.look.colours.length) {
                  onCommand({ name: "setEnemyColours", args: { enemyId: enemy.id, colours: result.colours } });
                }
                onCommand({ name: "setEnemyFrame", args: { enemyId: enemy.id, frame, rows: result.rows } });
              }}
              onBegin={onBegin}
              onCommit={onCommit}
            />
          </div>
          <div className={styles.heroSide}>
            <Colours
              colours={enemy.look.colours}
              slot={Math.min(slot, enemy.look.colours.length)}
              onSlot={setSlot}
              onColours={(colours) => onCommand({ name: "setEnemyColours", args: { enemyId: enemy.id, colours } })}
            />
            <EnemyPreview enemy={enemy} project={project} pack={pack} art={art} />
            <button
              type="button"
              className={styles.swatch}
              onClick={() => {
                if (confirm(`Delete ${tidyName(enemy.name)}? You can undo this.`)) {
                  onCommand({ name: "removeEnemy", args: { enemyId: enemy.id } });
                }
              }}
            >
              Delete enemy
            </button>
          </div>
        </>
      )}
    </fieldset>
  );
}
