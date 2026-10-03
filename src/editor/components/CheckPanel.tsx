"use client";

import type { ZoneCheck } from "@/checker/check";
import styles from "../editor.module.css";

type Props = { zoneCheck?: ZoneCheck; problems: string[] };

export function CheckPanel({ zoneCheck, problems }: Props) {
  return (
    <section className={styles.checks} aria-label="Level check">
      {!zoneCheck ? (
        <p>Checking…</p>
      ) : zoneCheck.passable ? (
        <p className={styles.good}>This zone can be crossed. Difficulty {zoneCheck.difficulty} of 10.</p>
      ) : (
        <>
          <p className={styles.bad}>This zone can&apos;t be crossed.</p>
          <p>{zoneCheck.reason}</p>
        </>
      )}
      {zoneCheck?.warnings.map((warning) => (
        <p key={warning} className={styles.warning}>
          {warning}
        </p>
      ))}
      {problems.length > 0 && (
        <>
          <h3 className={styles.problemsTitle}>Level problems</h3>
          <ul className={styles.problems}>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
