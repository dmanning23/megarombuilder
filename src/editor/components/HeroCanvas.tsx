"use client";

import { useEffect, useRef } from "react";
import { PICTURE_NAMES, PICTURE_SIZES, type HeroPicture } from "@/model/hero";
import styles from "../editor.module.css";
import { drawPicture, edgePixel, pixelFromPointer, ZOOM, type Pixel } from "../hero/pixels";

type Props = {
  rows: string[];
  palette: Record<string, string>;
  picture: HeroPicture;
  onPress(p: Pixel): void;
  onDrag(p: Pixel, fresh: boolean): void; // fresh: the pointer came back in, so don't join it to the last pixel
  onRelease(): void;
};

// One hero picture, big, to draw on with mouse, pen or finger. Only the pointer that started a
// stroke draws; leaving the canvas paints to its edge, and coming back starts a fresh line.
export function HeroCanvas({ rows, palette, picture, onPress, onDrag, onRelease }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pressed = useRef(false);
  const last = useRef<string | null>(null);
  const pointer = useRef<number | null>(null);
  const outside = useRef(false);
  const { w, h } = PICTURE_SIZES[picture];

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawPicture(ctx, rows, palette, picture);
  }, [rows, palette, picture]);

  const pixelAt = (clientX: number, clientY: number) =>
    ref.current ? pixelFromPointer(clientX, clientY, ref.current.getBoundingClientRect(), w, h) : null;

  const end = (pointerId: number) => {
    if (!pressed.current || pointerId !== pointer.current) return;
    pressed.current = false;
    pointer.current = null;
    last.current = null;
    onRelease();
  };

  return (
    <canvas
      ref={ref}
      data-testid="hero-canvas"
      role="img"
      aria-label={`${PICTURE_NAMES[picture]}, ${w} by ${h} pixels`}
      width={w * ZOOM}
      height={h * ZOOM}
      className={styles.heroCanvas}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0 || pressed.current) return;
        const p = pixelAt(e.clientX, e.clientY);
        if (!p) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pressed.current = true;
        pointer.current = e.pointerId;
        outside.current = false;
        last.current = `${p.x},${p.y}`;
        onPress(p);
      }}
      onPointerMove={(e) => {
        if (!pressed.current || e.pointerId !== pointer.current) return;
        const p = pixelAt(e.clientX, e.clientY);
        if (!p) {
          if (outside.current || !ref.current) return;
          outside.current = true; // paint up to the edge, once
          const edge = edgePixel(e.clientX, e.clientY, ref.current.getBoundingClientRect(), w, h);
          last.current = `${edge.x},${edge.y}`;
          onDrag(edge, false);
          return;
        }
        const fresh = outside.current;
        outside.current = false;
        const key = `${p.x},${p.y}`;
        if (key === last.current && !fresh) return;
        last.current = key;
        onDrag(p, fresh);
      }}
      onPointerUp={(e) => end(e.pointerId)}
      onPointerCancel={(e) => end(e.pointerId)}
      onLostPointerCapture={(e) => end(e.pointerId)}
    />
  );
}
