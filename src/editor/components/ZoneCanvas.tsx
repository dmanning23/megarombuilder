"use client";

import { useEffect, useRef } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { Checkpoint, Zone } from "@/model/schema";
import type { Skin } from "@/runtime/render/draw";
import styles from "../editor.module.css";
import { drawZoneView, spotFromPointer, zonePixels, type Spot } from "../zoneView";

type Props = {
  zone: Zone;
  pack: ContentPack;
  skin?: Skin;
  checkpoints: Checkpoint[];
  zoom: number;
  marker?: { x: number; y: number } | null;
  onPress(spot: Spot): void;
  onDrag(spot: Spot): void;
  onRelease(spot: Spot | null): void;
};

export function ZoneCanvas({ zone, pack, skin, checkpoints, zoom, marker = null, onPress, onDrag, onRelease }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pressed = useRef(false);
  const lastTile = useRef<string | null>(null);
  const { width, height } = zonePixels(zone);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawZoneView(ctx, zone, pack, skin, checkpoints, marker);
  }, [zone, pack, skin, checkpoints, marker]);

  const spotAt = (clientX: number, clientY: number) =>
    ref.current ? spotFromPointer(clientX, clientY, ref.current.getBoundingClientRect(), zone) : null;

  const end = (clientX: number, clientY: number) => {
    if (!pressed.current) return;
    pressed.current = false;
    lastTile.current = null;
    onRelease(spotAt(clientX, clientY));
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
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const spot = spotAt(e.clientX, e.clientY);
        if (!spot) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pressed.current = true;
        lastTile.current = `${spot.tile.x},${spot.tile.y}`;
        onPress(spot);
      }}
      onPointerMove={(e) => {
        if (!pressed.current) return;
        const spot = spotAt(e.clientX, e.clientY);
        if (!spot) return;
        const key = `${spot.tile.x},${spot.tile.y}`;
        if (key === lastTile.current) return;
        lastTile.current = key;
        onDrag(spot);
      }}
      onPointerUp={(e) => end(e.clientX, e.clientY)}
      onPointerCancel={() => end(Number.NaN, Number.NaN)}
      onLostPointerCapture={(e) => end(e.clientX, e.clientY)}
    />
  );
}
