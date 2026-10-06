"use client";

import { MAX_COLOURS } from "@/model/hero";
import { PALETTE_8BIT } from "@/model/palette";
import styles from "../editor.module.css";

type Props = {
  colours: number[];
  slot: number; // the chosen colour, from 1
  onSlot(slot: number): void;
  onColours(colours: number[]): void;
};

const WHITE = 27; // a new colour starts white

// The hero's colours, and the 8-bit palette to change the chosen one.
export function HeroColours({ colours, slot, onSlot, onColours }: Props) {
  return (
    <section className={styles.colours} aria-label="Colours">
      <h3 className={styles.heroHeading}>Colours</h3>
      <div className={styles.slots} role="group" aria-label="Your colours">
        {colours.map((colour, i) => (
          <button
            key={i}
            type="button"
            className={styles.slot}
            aria-label={`Colour ${i + 1}`}
            aria-pressed={slot === i + 1}
            style={{ background: PALETTE_8BIT[colour] }}
            onClick={() => onSlot(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className={styles.drawTools}>
        {colours.length < MAX_COLOURS && (
          <button
            type="button"
            className={styles.swatch}
            onClick={() => {
              onColours([...colours, WHITE]);
              onSlot(colours.length + 1);
            }}
          >
            Add a colour
          </button>
        )}
        {colours.length > 1 && (
          <button type="button" className={styles.swatch} onClick={() => onColours(colours.slice(0, -1))}>
            Remove colour {colours.length}
          </button>
        )}
      </div>
      <p className={styles.note}>Pick a new look for colour {slot}:</p>
      <div className={styles.palette8} role="group" aria-label="8-bit colours">
        {PALETTE_8BIT.map((hex, i) => (
          <button
            key={hex}
            type="button"
            className={styles.colour}
            aria-label={`8-bit colour ${i + 1}`}
            title={hex}
            aria-pressed={colours[slot - 1] === i}
            style={{ background: hex }}
            onClick={() => onColours(colours.map((c, j) => (j === slot - 1 ? i : c)))}
          />
        ))}
      </div>
    </section>
  );
}
