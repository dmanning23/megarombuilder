"use client";

import { MAX_LOOK_COLOURS } from "@/model/look";
import { PALETTE_8BIT, sortedPalette } from "@/model/palette";
import styles from "../editor.module.css";

type Props = {
  colours: number[];
  slot: number; // the chosen colour, from 1
  onSlot(slot: number): void;
  onColours(colours: number[]): void;
};

const WHITE = 27; // a new colour starts white

// A character's colours, and the 8-bit palette to change the chosen one.
// The palette in a friendly order (greys, then round the colour wheel, each hue dark to light),
// worked out once.
const ORDER = sortedPalette();

export function Colours({ colours, slot, onSlot, onColours }: Props) {
  return (
    <section className={styles.colours} aria-label="Colours">
      <h2 className={styles.panelHeading}>Colours</h2>
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
        {colours.length < MAX_LOOK_COLOURS && (
          <button
            type="button"
            className={styles.slotButton}
            aria-label="Add a colour"
            title="Add a colour"
            onClick={() => {
              onColours([...colours, WHITE]);
              onSlot(colours.length + 1);
            }}
          >
            +
          </button>
        )}
        {colours.length > 1 && (
          <button
            type="button"
            className={styles.slotButton}
            aria-label={`Remove colour ${colours.length}`}
            title={`Remove colour ${colours.length}`}
            onClick={() => onColours(colours.slice(0, -1))}
          >
            −
          </button>
        )}
      </div>
      <p className={styles.note}>Pick a colour for slot {slot}:</p>
      <div className={styles.palette8} role="group" aria-label="8-bit colours">
        {ORDER.map((i) => (
          <button
            key={i}
            type="button"
            className={styles.colour}
            aria-label={`8-bit colour ${i + 1}`}
            title={PALETTE_8BIT[i]}
            aria-pressed={colours[slot - 1] === i}
            style={{ background: PALETTE_8BIT[i] }}
            onClick={() => onColours(colours.map((c, j) => (j === slot - 1 ? i : c)))}
          />
        ))}
      </div>
    </section>
  );
}
