"use client";

import Link from "next/link";
import styles from "@/editor/home.module.css";

// Shown if the editor breaks while open, so there is always a way back to the game list.
export default function EditError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className={styles.page}>
      <p className={styles.message}>Something went wrong in the editor.</p>
      <p>
        <button type="button" className={styles.primary} onClick={reset}>
          Try again
        </button>{" "}
        <Link className={styles.link} href="/">
          Back to your games
        </Link>
      </p>
    </main>
  );
}
