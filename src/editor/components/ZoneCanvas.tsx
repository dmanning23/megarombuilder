"use client";

import { useEffect, useRef } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { Checkpoint, Zone } from "@/model/schema";
import type { Skin } from "@/runtime/render/draw";
import styles from "../editor.module.css";
import { drawZoneView, tileFromPointer, zonePixels } from "../zoneView";

type Props = {
  zone: Zone;
  pack: ContentPack;
  skin?: Skin;
  checkpoints: Checkpoint[];
  zoom: number;
  onStrokeStart(): void;
  onPaint(x: number, y: number): void;
  onStrokeEnd(): void;
};

export function ZoneCanvas({ zone, pack, skin, checkpoints, zoom, onStrokeStart, onPaint, onStrokeEnd }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const lastTile = useRef<string | null>(null);
  const { width, height } = zonePixels(zone);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawZoneView(ctx, zone, pack, skin, checkpoints);
  }, [zone, pack, skin, checkpoints]);

  const paintAt = (clientX: number, clientY: number) => {
    const canvas = ref.current;
    if (!canvas) return;
    const tile = tileFromPointer(clientX, clientY, canvas.getBoundingClientRect(), zone);
    if (!tile) return;
    const key = `${tile.x},${tile.y}`;
    if (key === lastTile.current) return;
    lastTile.current = key;
    onPaint(tile.x, tile.y);
  };

  const end = () => {
    if (!painting.current) return;
    painting.current = false;
    lastTile.current = null;
    onStrokeEnd();
  };

  const label = `${zone.name}, ${zone.screens} screen${zone.screens === 1 ? "" : "s"}`;
  return (
    <canvas
      ref={ref}
      data-testid="zone-canvas"
      aria-label={label}
      role="img"
      width={width}
      height={height}
      className={styles.zoneCanvas}
      style={{ width: width * zoom, height: height * zoom }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        painting.current = true;
        lastTile.current = null;
        onStrokeStart();
        paintAt(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (painting.current) paintAt(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    />
  );
}
