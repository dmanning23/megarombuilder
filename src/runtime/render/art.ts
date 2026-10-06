import type { ContentPack } from "@/model/contentPack";
import type { HeroPose } from "@/model/hero";
import { TILE_SIZE } from "@/model/geometry";
import type { Entity } from "@/runtime/sim/entities/types";
import { PLAYER_H } from "@/runtime/sim/constants";
import type { Player } from "@/runtime/sim/state";

// One character per pixel; "." is transparent and every other character is a palette key.
export type Sprite = { w: number; h: number; rows: string[] };

export function sprite(rows: string[]): Sprite {
  return { w: rows[0]?.length ?? 0, h: rows.length, rows };
}

// A ground tile can have a "top" sprite, used when the tile above is something else.
export type TileArt = { fill: Sprite; top?: Sprite };

export type ArtSet = {
  palette: Record<string, string>;
  backgrounds: Record<string, string>; // by variant
  tiles: Record<string, Record<number, TileArt>>; // by variant, then tile id
  things: Record<string, Sprite[]>; // by thing type: one or more frames
  enemyShot: Sprite;
};

export function spriteProblems(
  name: string,
  s: Sprite,
  palette: Record<string, string>,
): string[] {
  if (s.rows.length === 0) return [`${name} has no rows.`];
  const problems: string[] = [];
  s.rows.forEach((row, y) => {
    if (row.length !== s.w) problems.push(`${name} row ${y} is ${row.length} wide, not ${s.w}.`);
    const unknown = [...row].find((ch) => ch !== "." && !(ch in palette));
    if (unknown) problems.push(`${name} row ${y} uses "${unknown}", which is not in the palette.`);
  });
  return problems;
}

// Everything wrong with an art set for a pack: missing art, wrong sizes, broken sprites.
export function artProblems(art: ArtSet, pack: ContentPack): string[] {
  const problems: string[] = [];
  const check = (name: string, s: Sprite, w?: number, h?: number) => {
    problems.push(...spriteProblems(name, s, art.palette));
    if (w !== undefined && (s.w !== w || s.h !== h)) {
      problems.push(`${name} is ${s.w} by ${s.h}, not ${w} by ${h}.`);
    }
  };

  for (const variant of pack.variants) {
    if (!art.backgrounds[variant]) problems.push(`No background colour for variant "${variant}".`);
    for (const tile of pack.tiles) {
      const tileArt = art.tiles[variant]?.[tile.id];
      if (!tileArt) {
        problems.push(`No art for tile "${tile.name}" in variant "${variant}".`);
        continue;
      }
      check(`Tile "${tile.name}" (${variant})`, tileArt.fill, TILE_SIZE, TILE_SIZE);
      if (tileArt.top) check(`Tile "${tile.name}" top (${variant})`, tileArt.top, TILE_SIZE, TILE_SIZE);
    }
  }
  for (const def of pack.things) {
    const frames = art.things[def.type];
    if (!frames || frames.length === 0) {
      problems.push(`No art for thing "${def.type}".`);
      continue;
    }
    frames.forEach((s, i) => check(`Thing "${def.type}" frame ${i}`, s));
  }
  check("Enemy shot", art.enemyShot);
  return problems;
}

export function playerPose(p: Player, steps: number): { pose: HeroPose; flip: boolean } {
  const flip = p.facing < 0;
  if (p.h < PLAYER_H) return { pose: "slide", flip };
  if (p.hurt > 0) return { pose: "hurt", flip };
  if (p.onLadder) return { pose: "climb", flip: Math.floor(p.y / 8) % 2 === 1 };
  const shooting = p.shotTimer > 0;
  if (!p.onGround) return { pose: shooting ? "jumpShoot" : "jump", flip };
  if (p.vx !== 0) return { pose: Math.floor(steps / 6) % 2 === 0 ? "run1" : "run2", flip };
  return { pose: shooting ? "standShoot" : "stand", flip };
}

export function thingFrame(e: Entity, steps: number, count: number): number {
  const pick = (frame: number) => Math.min(frame, count - 1);
  switch (e.behaviour) {
    case "shielded":
      return pick(e.mode === "open" ? 1 : 0);
    case "dropper":
      return pick(e.mode === "hang" ? 0 : 1);
    case "jumper":
      return pick(e.onGround ? 0 : 1);
    case "boss":
      return pick(e.mode === "jump" ? 1 : e.mode === "shot" ? 2 : 0);
    default:
      return Math.floor(steps / 8) % count;
  }
}
