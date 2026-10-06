"use client";

import { useEffect, useRef } from "react";
import { PICTURE_NAMES, PICTURE_SIZES, type HeroPicture } from "@/model/hero";
import styles from "../editor.module.css";
import { drawPicture, pixelFromPointer, ZOOM, type Pixel } from "../hero/pixels";

type Props = {
  rows: string[];
  palette: Record<string, string>;
  picture: HeroPicture;
  onPress(p: Pixel): void;
  onDrag(p: Pixel): void;
  onRelease(): void;
};

// One hero picture, big, to draw on with mouse, pen or finger.
export function HeroCanvas({ rows, palette, picture, onPress, onDrag, onRelease }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pressed = useRef(false);
  const last = useRef<string | null>(null);
  const { w, h } = PICTURE_SIZES[picture];

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawPicture(ctx, rows, palette, picture);
  }, [rows, palette, picture]);

  const pixelAt = (clientX: number, clientY: number) =>
    ref.current ? pixelFromPointer(clientX, clientY, ref.current.getBoundingClientRect(), w, h) : null;

  const end = () => {
    if (!pressed.current) return;
    pressed.current = false;
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
        if (e.button !== 0) return;
        const p = pixelAt(e.clientX, e.clientY);
        if (!p) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pressed.current = true;
        last.current = `${p.x},${p.y}`;
        onPress(p);
      }}
      onPointerMove={(e) => {
        if (!pressed.current) return;
        const p = pixelAt(e.clientX, e.clientY);
        if (!p) return;
        const key = `${p.x},${p.y}`;
        if (key === last.current) return;
        last.current = key;
        onDrag(p);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    />
  );
}
