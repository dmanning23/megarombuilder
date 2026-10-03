"use client";

import { useEffect, useRef } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { ArtSet, Sprite } from "@/runtime/render/art";
import styles from "../editor.module.css";
import type { Tool } from "../state";

const label = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

// A sprite painted pixel by pixel into a small canvas.
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
  return <canvas ref={ref} width={16} height={16} className={styles.swatchArt} aria-hidden="true" />;
}

type Props = { pack: ContentPack; art?: ArtSet; tool: Tool; onTool(tool: Tool): void };

export function Palette({ pack, art, tool, onTool }: Props) {
  const variant = pack.variants[0];
  return (
    <div className={styles.palette} role="toolbar" aria-label="Tiles">
      {pack.tiles.map((tile) => {
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
      <button
        type="button"
        className={`${styles.swatch} ${styles.erase}`}
        aria-pressed={tool.kind === "erase"}
        onClick={() => onTool({ kind: "erase" })}
      >
        Erase
      </button>
    </div>
  );
}
