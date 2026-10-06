"use client";

import { useEffect, useRef } from "react";
import type { ContentPack } from "@/model/contentPack";
import type { Abilities, HeroLook } from "@/model/hero";
import type { ArtSet } from "@/runtime/render/art";
import { draw, type Skin } from "@/runtime/render/draw";
import { heroArt } from "@/runtime/render/heroArt";
import { stepsFor } from "@/runtime/render/loop";
import { browserCanvas, createSpriteCache } from "@/runtime/render/sprites";
import { SCREEN_H, SCREEN_W } from "@/runtime/sim/constants";
import { step } from "@/runtime/sim/step";
import styles from "../editor.module.css";
import { previewInputs, previewSim } from "../hero/preview";

type Props = { look: HeroLook; abilities: Abilities; pack: ContentPack; art?: ArtSet };

// Plays the preview show over and over, starting again whenever the hero changes.
export function HeroPreview({ look, abilities, pack, art }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !art) return;
    const hero = heroArt(look);
    const skin: Skin = {
      set: art,
      image: createSpriteCache(art.palette, browserCanvas),
      hero: {
        art: hero,
        image: createSpriteCache(hero.palette, browserCanvas),
        flashImage: createSpriteCache(hero.flashPalette, browserCanvas),
      },
    };
    const inputs = previewInputs(abilities);
    let sim = previewSim(look, abilities, pack);
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
          sim = previewSim(look, abilities, pack);
          next = 0;
        }
        step(sim, inputs[next++]);
      }
      draw(ctx, sim, skin);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [look, abilities, pack, art]);

  return (
    <canvas
      ref={ref}
      width={SCREEN_W}
      height={SCREEN_H}
      role="img"
      aria-label="Your hero in action"
      className={styles.preview}
    />
  );
}
