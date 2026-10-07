"use client";

import { useEffect, useRef } from "react";
import type { BossDesign, EnemyDesign } from "@/model/designs";
import type { HeroLook } from "@/model/hero";
import type { ArtSet } from "@/runtime/render/art";
import { draw, type Skin } from "@/runtime/render/draw";
import { heroArt } from "@/runtime/render/heroArt";
import { ownSkins } from "@/runtime/render/lookArt";
import { stepsFor } from "@/runtime/render/loop";
import { browserCanvas, createSpriteCache } from "@/runtime/render/sprites";
import { SCREEN_H, SCREEN_W } from "@/runtime/sim/constants";
import type { Input, Sim } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import styles from "../editor.module.css";

type Props = {
  label: string;
  start: () => Sim; // a fresh game, each time the show starts again
  inputs: Input[];
  heroLook: HeroLook;
  enemies: EnemyDesign[];
  boss?: BossDesign | null;
  art?: ArtSet;
};

// Plays a short show over and over, starting again whenever what it shows changes.
export function GamePreview({ label, start, inputs, heroLook, enemies, boss = null, art }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !art) return;
    const hero = heroArt(heroLook);
    const skin: Skin = {
      set: art,
      image: createSpriteCache(art.palette, browserCanvas),
      hero: {
        art: hero,
        image: createSpriteCache(hero.palette, browserCanvas),
        flashImage: createSpriteCache(hero.flashPalette, browserCanvas),
      },
      own: ownSkins(enemies, (palette) => createSpriteCache(palette, browserCanvas), boss),
    };
    let sim = start();
    let next = 0;
    let accumulator = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const due = stepsFor(accumulator, now - last);
      last = now;
      accumulator = due.accumulator;
      for (let i = 0; i < due.steps; i++) {
        if (next >= inputs.length || sim.phase !== "play") {
          sim = start();
          next = 0;
        }
        step(sim, inputs[next++]);
      }
      draw(ctx, sim, skin);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, inputs, heroLook, enemies, boss, art]);

  return (
    <canvas ref={ref} width={SCREEN_W} height={SCREEN_H} role="img" aria-label={label} className={styles.preview} />
  );
}
