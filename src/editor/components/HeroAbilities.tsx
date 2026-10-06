"use client";

import type { LevelCheck } from "@/checker/check";
import { HEALTHS, JUMPS, SHOT_COUNTS, SPEEDS, type Abilities } from "@/model/hero";
import type { Level } from "@/model/schema";
import styles from "../editor.module.css";

type Step = string | number | boolean;

const ROWS: { key: keyof Abilities; label: string; steps: readonly Step[]; name(step: Step): string }[] = [
  {
    key: "speed",
    label: "Speed",
    steps: SPEEDS,
    name: (s) => ({ normal: "Normal", fast: "Fast", veryFast: "Very fast" })[s as string] ?? String(s),
  },
  {
    key: "jump",
    label: "Jump",
    steps: JUMPS,
    name: (s) => ({ low: "Low", normal: "Normal", high: "High", veryHigh: "Very high" })[s as string] ?? String(s),
  },
  {
    key: "health",
    label: "Health",
    steps: HEALTHS,
    name: (s) => ({ fragile: "Fragile", normal: "Normal", tough: "Tough" })[s as string] ?? String(s),
  },
  { key: "shots", label: "Shots on screen", steps: SHOT_COUNTS, name: (s) => String(s) },
  { key: "slide", label: "Slide", steps: [false, true], name: (s) => (s ? "On" : "Off") },
  { key: "chargeShot", label: "Charge shot", steps: [false, true], name: (s) => (s ? "On" : "Off") },
];

type Props = {
  abilities: Abilities;
  level: Level;
  check: LevelCheck | null;
  onAbilities(changes: Partial<Abilities>): void;
  onGoToZone(zoneId: string): void;
  onReset(): void;
};

// The hero's abilities as step buttons, and what the checker now says about the level.
export function HeroAbilities({ abilities, level, check, onAbilities, onGoToZone, onReset }: Props) {
  const failing = check
    ? level.zones.filter((z) => check.zones.some((c) => c.zoneId === z.id && !c.passable))
    : [];
  return (
    <section className={styles.abilities} aria-label="Abilities">
      <h3 className={styles.heroHeading}>Abilities</h3>
      <div className={styles.abilityRows}>
        {ROWS.map((row) => (
          <div key={row.key} role="group" aria-label={row.label} className={styles.ability}>
            <span className={styles.abilityLabel}>{row.label}</span>
            <div className={styles.steps}>
              {row.steps.map((step) => (
                <button
                  key={String(step)}
                  type="button"
                  className={styles.step}
                  aria-pressed={abilities[row.key] === step}
                  onClick={() => onAbilities({ [row.key]: step } as Partial<Abilities>)}
                >
                  {row.name(step)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p role="status" className={check && failing.length > 0 ? styles.bad : styles.good}>
        {!check ? (
          "Checking the level…"
        ) : failing.length === 0 ? (
          "All zones can still be finished."
        ) : (
          <>
            {failing.length === 1 ? "1 zone can't" : `${failing.length} zones can't`} be finished with this hero:{" "}
            {failing.map((zone, i) => (
              <span key={zone.id}>
                {i > 0 && ", "}
                <button type="button" className={styles.link} onClick={() => onGoToZone(zone.id)}>
                  {zone.name}
                </button>
              </span>
            ))}
          </>
        )}
      </p>
      <button type="button" className={styles.swatch} onClick={onReset}>
        Start from the snow hero
      </button>
    </section>
  );
}
