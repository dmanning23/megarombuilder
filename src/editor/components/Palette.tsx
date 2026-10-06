"use client";

import { useEffect, useRef, useState } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { ArtSet, Sprite } from "@/runtime/render/art";
import styles from "../editor.module.css";
import type { Tool } from "../state";

const label = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

// A sprite painted pixel by pixel into a small canvas, shown at a fixed size.
function SpriteSwatch({ sprite, palette }: { sprite?: Sprite; palette?: Record<string, string> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !sprite || !palette) return;
    ctx.clearRect(0, 0, sprite.w, sprite.h);
    sprite.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const colour = palette[ch];
        if (!colour) return;
        ctx.fillStyle = colour;
        ctx.fillRect(x, y, 1, 1);
      }),
    );
  }, [sprite, palette]);
  return (
    <canvas
      ref={ref}
      width={sprite?.w ?? 16}
      height={sprite?.h ?? 16}
      className={styles.swatchArt}
      aria-hidden="true"
    />
  );
}

const TABS = [
  { id: "tiles", label: "Tiles" },
  { id: "things", label: "Enemies and items" },
  { id: "pieces", label: "Pieces" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);

type Props = { pack: ContentPack; art?: ArtSet; tool: Tool; onTool(tool: Tool): void; canSlide?: boolean };

export function Palette({ pack, art, tool, onTool, canSlide = false }: Props) {
  const [tab, setTab] = useState<Tab>("tiles");
  const variant = pack.variants[0];
  const piece = tool.kind === "piece" ? pack.pieces.find((p) => p.id === tool.pieceId) : undefined;

  return (
    <div className={styles.palette}>
      <div className={styles.tabs} role="tablist" aria-label="Palette">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.choices} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "tiles" &&
          pack.tiles.map((tile) => {
            const tileArt = art?.tiles[variant]?.[tile.id];
            return (
              <button
                key={tile.id}
                type="button"
                className={styles.swatch}
                aria-pressed={tool.kind === "tile" && tool.tile === tile.id}
                onClick={() => onTool({ kind: "tile", tile: tile.id })}
              >
                <SpriteSwatch sprite={tileArt?.top ?? tileArt?.fill} palette={art?.palette} />
                {label(tile.name)}
              </button>
            );
          })}
        {tab === "things" &&
          pack.things.map((def) => (
            <button
              key={def.type}
              type="button"
              className={styles.swatch}
              aria-pressed={tool.kind === "thing" && tool.type === def.type}
              onClick={() => onTool({ kind: "thing", type: def.type })}
            >
              <SpriteSwatch sprite={art?.things[def.type]?.[0]} palette={art?.palette} />
              {def.name}
            </button>
          ))}
        {tab === "pieces" &&
          pack.pieces.map((p) => {
            const locked = p.needs === "slide" && !canSlide;
            return (
              <button
                key={p.id}
                type="button"
                className={styles.swatch}
                disabled={locked}
                aria-pressed={tool.kind === "piece" && tool.pieceId === p.id}
                onClick={() =>
                  onTool({
                    kind: "piece",
                    pieceId: p.id,
                    settings: Object.fromEntries(p.settings.map((s) => [s.key, s.default])),
                  })
                }
              >
                {p.name}
                {locked && (
                  <>
                    {" "}
                    <span className={styles.needs}>Needs slide</span>
                  </>
                )}
              </button>
            );
          })}
        <button
          type="button"
          className={`${styles.swatch} ${styles.erase}`}
          aria-pressed={tool.kind === "erase"}
          onClick={() => onTool({ kind: "erase" })}
        >
          Erase
        </button>
      </div>
      {tab === "pieces" && piece && tool.kind === "piece" && (
        <div className={styles.pieceSettings}>
          <p>{piece.description}</p>
          {piece.settings.map((s) => (
            <label key={s.key} className={styles.field}>
              {s.description}
              <select
                value={tool.settings[s.key] ?? s.default}
                onChange={(e) =>
                  onTool({ ...tool, settings: { ...tool.settings, [s.key]: Number(e.target.value) } })
                }
              >
                {range(s.min, s.max).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
