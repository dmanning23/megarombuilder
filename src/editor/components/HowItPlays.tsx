"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "../editor.module.css";

// A character's settings (how it moves, fights, how tough it is), tucked into a drawer: kids change
// them now and then, and draw all the time. The button sits in the tab's top row; the drawer opens
// over the right-hand column and closes with Done or Escape.
export function HowItPlays({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const done = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) done.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.howItPlaysButton}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span aria-hidden="true">⚙</span> How it plays
      </button>
      {open && (
        <aside
          className={styles.drawer}
          aria-label="How it plays"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <div className={styles.drawerHead}>
            <h2 className={styles.panelHeading}>How it plays</h2>
            <button ref={done} type="button" className={styles.action} onClick={close}>
              Done
            </button>
          </div>
          <div className={styles.drawerBody}>{children}</div>
        </aside>
      )}
    </>
  );
}
