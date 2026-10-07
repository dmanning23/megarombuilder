"use client";

import { useCallback, useMemo, useState } from "react";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import {
  BOSS_ATTACKS,
  BOSS_FIGHTS,
  BOSS_FRAME,
  designFrames,
  designLook,
  type BossAttack,
  type BossDesign,
  type EnemyDesign,
} from "@/model/designs";
import { OWN_BOSS } from "@/model/gamePack";
import { tidyName, type Project } from "@/model/schema";
import type { ArtSet } from "@/runtime/render/art";
import { lookArt } from "@/runtime/render/lookArt";
import styles from "../editor.module.css";
import type { RawImage } from "../hero/importPicture";
import { BOSS_PREVIEW_INPUTS, bossPreviewSim } from "../hero/preview";
import { readPicture as readPictureFile } from "../hero/readPicture";
import { Colours } from "./Colours";
import { GamePreview } from "./GamePreview";
import { NameField } from "./NameField";
import { PictureEditor, type DrawTool } from "./PictureEditor";

export const ATTACK_TEXT: Record<BossAttack, { name: string; tip: string }> = {
  jump: { name: "Jump", tip: "Leaps at you. Run under it." },
  dash: { name: "Dash", tip: "Charges along the floor. Jump over it." },
  spread: { name: "Spread", tip: "Three shots fan out. Jump through the gap." },
  aimed: { name: "Aimed shot", tip: "One quick shot right at you. Move after it fires." },
  rain: { name: "Rain", tip: "Shots fall from above. Stand in a gap." },
  big: { name: "Big shot", tip: "A huge, slow shot. Jump over it or slide under." },
};

const FIGHT_NAMES: Record<BossDesign["fight"], string> = { short: "Short", normal: "Normal", long: "Long" };
const FRAME_NAMES = ["Stand", "Jump", "Attack"] as const;
const WHOLE_FRAME = { x: 0, y: 0, ...BOSS_FRAME };
const NO_ENEMIES: EnemyDesign[] = []; // one array, so the preview doesn't restart on every render

// The boss fighting in a one-screen boss room, with the hero standing still.
function BossPreview({ boss, project, pack, art }: { boss: BossDesign; project: Project; pack: ContentPack; art?: ArtSet }) {
  const hero = project.hero;
  const start = useCallback(() => bossPreviewSim(boss, hero, pack), [boss, hero, pack]);
  return (
    <GamePreview
      label={`${tidyName(boss.name)} fighting`}
      start={start}
      inputs={BOSS_PREVIEW_INPUTS}
      heroLook={hero.look}
      enemies={NO_ENEMIES}
      boss={boss}
      art={art}
    />
  );
}

// Which boss the game's boss rooms hold: the kid's, the pack's, or none placed.
function bossInUse(project: Project, pack: ContentPack): "yours" | "snow" | null {
  const types = project.levels.flatMap((l) => l.zones.flatMap((z) => z.things.map((t) => t.type)));
  if (types.includes(OWN_BOSS)) return "yours";
  const packBosses = new Set(pack.things.filter((d) => d.behaviour === "boss" && !d.own).map((d) => d.type));
  return types.some((t) => packBosses.has(t)) ? "snow" : null;
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
  readPicture?: (file: File) => Promise<RawImage>;
};

export function BossScreen({
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
  readPicture = readPictureFile,
}: Props) {
  const { boss } = project;
  const [frame, setFrame] = useState<0 | 1 | 2>(0);
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [slot, setSlot] = useState(1);
  const look = boss?.look;
  const bossArt = useMemo(() => (look ? lookArt(designLook("boss", look)) : null), [look]);
  const packBoss = pack.things.find((d) => d.behaviour === "boss" && !d.own);
  const inUse = bossInUse(project, pack);

  const setAttacks = (attacks: BossAttack[]) => onCommand({ name: "setBoss", args: { attacks } });

  return (
    <fieldset className={`${styles.heroScreen} ${styles.bossScreen}`} disabled={locked} aria-label="Your boss">
      {error && (
        <p className={styles.alert} role="alert">
          {error}
          <button type="button" onClick={onDismissError}>
            Dismiss
          </button>
        </p>
      )}
      {!boss || !bossArt ? (
        <div>
          <p className={styles.note}>
            Make your own boss to fight in the boss room. It starts as a copy of the {packBoss?.name ?? "boss"}.
          </p>
          <button type="button" className={styles.swatch} onClick={() => onCommand({ name: "createBoss", args: { name: "My Boss" } })}>
            Make your own boss
          </button>
        </div>
      ) : (
        <>
          <div className={styles.drawing}>
            <NameField
              key={boss.name}
              name={tidyName(boss.name)}
              onRename={(name) => onCommand({ name: "setBoss", args: { name } })}
            />
            <div role="group" aria-label="Fight" className={styles.ability}>
              <span className={styles.abilityLabel}>Fight</span>
              <div className={styles.steps}>
                {BOSS_FIGHTS.map((fight) => (
                  <button
                    key={fight}
                    type="button"
                    className={styles.step}
                    aria-pressed={boss.fight === fight}
                    onClick={() => onCommand({ name: "setBoss", args: { fight } })}
                  >
                    {FIGHT_NAMES[fight]}
                  </button>
                ))}
              </div>
            </div>
            <div role="group" aria-label="Attacks, in order" className={styles.ability}>
              <span className={styles.abilityLabel}>Attacks, in order</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.field}>
                  <label htmlFor={`boss-attack-${i}`}>Attack {i + 1}</label>
                  <select
                    id={`boss-attack-${i}`}
                    aria-label={`Attack ${i + 1}`}
                    value={boss.attacks[i] ?? ""}
                    onChange={(e) => {
                      const value = e.target.value as BossAttack | "";
                      const next = [...boss.attacks];
                      if (value === "") next.splice(2);
                      else next[i] = value;
                      setAttacks(next);
                    }}
                  >
                    {i === 2 && <option value="">None</option>}
                    {BOSS_ATTACKS.map((a) => (
                      <option key={a} value={a}>
                        {ATTACK_TEXT[a].name}
                      </option>
                    ))}
                  </select>
                  {boss.attacks[i] && <span className={styles.note}>{ATTACK_TEXT[boss.attacks[i]].tip}</span>}
                </div>
              ))}
            </div>
            <div className={styles.drawTools} role="group" aria-label="Frames">
              {([0, 1, 2] as const).map((f) => (
                <button key={f} type="button" className={styles.swatch} aria-pressed={frame === f} onClick={() => setFrame(f)}>
                  {FRAME_NAMES[f]}
                </button>
              ))}
            </div>
            <PictureEditor
              key={frame}
              name={FRAME_NAMES[frame]}
              rows={designFrames("boss", boss.look)[frame]}
              palette={bossArt.palette}
              size={BOSS_FRAME}
              body={WHOLE_FRAME}
              feet
              testId="boss-canvas"
              colours={boss.look.colours}
              tool={tool}
              onTool={setTool}
              slot={Math.min(slot, boss.look.colours.length)}
              onSlot={setSlot}
              partners={([0, 1, 2] as const)
                .filter((f) => f !== frame)
                .map((f) => ({ id: String(f), name: FRAME_NAMES[f], rows: designFrames("boss", boss.look)[f] }))}
              importTarget={{ ...BOSS_FRAME, stand: true }}
              readPicture={readPicture}
              locked={locked}
              onRows={(rows) => onCommand({ name: "setBossFrame", args: { frame, rows } })}
              onImport={(result) => {
                if (result.colours.length !== boss.look.colours.length) {
                  onCommand({ name: "setBossColours", args: { colours: result.colours } });
                }
                onCommand({ name: "setBossFrame", args: { frame, rows: result.rows } });
              }}
              onBegin={onBegin}
              onCommit={onCommit}
            />
          </div>
          <div className={styles.heroSide}>
            <Colours
              colours={boss.look.colours}
              slot={Math.min(slot, boss.look.colours.length)}
              onSlot={setSlot}
              onColours={(colours) => onCommand({ name: "setBossColours", args: { colours } })}
            />
            <BossPreview boss={boss} project={project} pack={pack} art={art} />
            <div role="group" aria-label="Use in the boss room" className={styles.ability}>
              <span className={styles.abilityLabel}>Use in the boss room</span>
              <div className={styles.steps}>
                <button
                  type="button"
                  className={styles.step}
                  aria-pressed={inUse === "snow"}
                  onClick={() => onCommand({ name: "useBoss", args: { boss: "snow" } })}
                >
                  {packBoss?.name ?? "Pack boss"}
                </button>
                <button
                  type="button"
                  className={styles.step}
                  aria-pressed={inUse === "yours"}
                  onClick={() => onCommand({ name: "useBoss", args: { boss: "yours" } })}
                >
                  Your boss
                </button>
              </div>
            </div>
            <button
              type="button"
              className={styles.swatch}
              onClick={() => {
                if (confirm(`Delete ${tidyName(boss.name)}? You can undo this.`)) onCommand({ name: "removeBoss", args: {} });
              }}
            >
              Delete boss
            </button>
          </div>
        </>
      )}
    </fieldset>
  );
}
