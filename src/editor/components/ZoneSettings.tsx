"use client";

import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import { MAX_SCREENS, zoneSize, type Edge, type Opening } from "@/model/geometry";
import type { Level, Zone } from "@/model/schema";
import styles from "../editor.module.css";

const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SIDE_NAMES: Record<Edge, string> = { left: "Left side", right: "Right side", top: "Top", bottom: "Bottom" };
const isSide = (edge: Edge) => edge === "left" || edge === "right";
const lengthOf = (edge: Edge) => (isSide(edge) ? 4 : 2);

function OpeningField(props: {
  legend: string;
  sides: Edge[];
  opening: Opening;
  zone: Zone;
  onChange(opening: Opening): void;
}) {
  const { legend, sides, opening, zone, onChange } = props;
  const size = zoneSize(zone.scroll, zone.screens);
  const last = (edge: Edge) => (isSide(edge) ? size.height : size.width) - lengthOf(edge);
  const set = (edge: Edge, from: number) => onChange({ edge, from, to: from + lengthOf(edge) - 1 });
  const fresh = (edge: Edge) =>
    Math.min(last(edge), isSide(edge) ? size.height - 6 : Math.floor((size.width - 2) / 2));
  return (
    <fieldset className={styles.fieldset}>
      <legend>{legend}</legend>
      <label className={styles.field}>
        <span>Side</span>
        <select
          aria-label={`${legend} side`}
          value={opening.edge}
          onChange={(e) => {
            const edge = e.target.value as Edge;
            set(edge, fresh(edge));
          }}
        >
          {sides.map((edge) => (
            <option key={edge} value={edge}>
              {SIDE_NAMES[edge]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Starts at</span>
        <select
          aria-label={`${legend} starts at ${isSide(opening.edge) ? "row" : "column"}`}
          value={opening.from}
          onChange={(e) => set(opening.edge, Number(e.target.value))}
        >
          {range(0, last(opening.edge)).map((n) => (
            <option key={n} value={n}>
              {isSide(opening.edge) ? `Row ${n}` : `Column ${n}`}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

type Props = {
  level: Level;
  zone: Zone;
  pack: ContentPack;
  onCommand(command: Command): void;
  onDelete(): void;
};

export function ZoneSettings({ level, zone, pack, onCommand, onDelete }: Props) {
  const ids = { levelId: level.id, zoneId: zone.id };
  const boss = zone.kind !== "normal";
  const index = level.zones.findIndex((z) => z.id === zone.id);
  const lastNormal = level.zones.length - 3;

  return (
    <section className={styles.settings} aria-labelledby="zone-settings-title">
      <h2 id="zone-settings-title" className={styles.sideTitle}>
        This zone
      </h2>
      {boss ? (
        <p className={styles.note}>Boss zones are always one screen.</p>
      ) : (
        <label className={styles.field}>
          Length
          <select
            value={zone.screens}
            onChange={(e) => onCommand({ name: "resizeZone", args: { ...ids, screens: Number(e.target.value) } })}
          >
            {range(1, MAX_SCREENS[zone.scroll]).map((n) => (
              <option key={n} value={n}>
                {n} screen{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles.field}>
        Look
        <select
          value={zone.variant}
          onChange={(e) => onCommand({ name: "setZoneVariant", args: { ...ids, variant: e.target.value } })}
        >
          {pack.variants.map((v) => (
            <option key={v} value={v}>
              {capital(v)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        What it&apos;s for
        <textarea
          key={`${zone.id}:${zone.intent}`}
          defaultValue={zone.intent}
          maxLength={200}
          rows={2}
          onBlur={(e) => {
            if (e.target.value !== zone.intent) {
              onCommand({ name: "setZoneIntent", args: { ...ids, intent: e.target.value } });
            }
          }}
        />
      </label>
      <OpeningField
        legend="Way in"
        sides={["left", "top", "bottom"]}
        opening={zone.entry}
        zone={zone}
        onChange={(entry) => onCommand({ name: "setZoneOpenings", args: { ...ids, entry } })}
      />
      {zone.exit && (
        <OpeningField
          legend="Way out"
          sides={["right", "top", "bottom"]}
          opening={zone.exit}
          zone={zone}
          onChange={(exit) => onCommand({ name: "setZoneOpenings", args: { ...ids, exit } })}
        />
      )}
      {!boss && (
        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            disabled={index <= 0}
            onClick={() => onCommand({ name: "moveZone", args: { ...ids, toIndex: index - 1 } })}
          >
            Move earlier
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={index >= lastNormal}
            onClick={() => onCommand({ name: "moveZone", args: { ...ids, toIndex: index + 1 } })}
          >
            Move later
          </button>
        </div>
      )}
      {!boss && (
        <button type="button" className={`${styles.button} ${styles.danger}`} onClick={onDelete}>
          Delete this zone
        </button>
      )}
    </section>
  );
}
