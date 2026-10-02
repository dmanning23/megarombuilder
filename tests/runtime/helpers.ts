import { createLevel, createProject, createZone } from "@/model/factory";
import type { Opening } from "@/model/geometry";
import type { Checkpoint, Project, Zone } from "@/model/schema";
import { testPack } from "../fixtures/testPack";

const GLYPHS: Record<string, number> = { ".": 0, "#": 1, H: 2, "^": 3, "~": 4, "=": 5 };

export type ZoneArt = { art: string[]; entry?: Opening; exit?: Opening | null };

// A row of empty tiles with the given glyphs at the given columns.
export function rowWith(cells: Record<number, string>, width = 16): string {
  const row = new Array<string>(width).fill(".");
  for (const [x, glyph] of Object.entries(cells)) row[Number(x)] = glyph;
  return row.join("");
}

// A horizontal zone with a two-row floor. Overrides replace whole rows by index.
export function flatArt(overrides: Record<number, string> = {}, screens = 1): string[] {
  const width = 16 * screens;
  return Array.from({ length: 15 }, (_, y) => overrides[y] ?? (y >= 13 ? "#" : ".").repeat(width));
}

function zoneFromArt(base: Zone, { art, entry, exit }: ZoneArt): Zone {
  const vertical = art.length > 15;
  const width = art[0].length;
  const screens = vertical ? art.length / 15 : width / 16;
  const wholeScreens = Number.isInteger(screens) && (vertical ? width === 16 : art.length === 15);
  if (!wholeScreens || art.some((row) => row.length !== width)) {
    throw new Error("Zone art must be whole screens with rows of equal length.");
  }
  const tiles = art.flatMap((row) =>
    [...row].map((glyph) => {
      const tile = GLYPHS[glyph];
      if (tile === undefined) throw new Error(`Unknown glyph "${glyph}".`);
      return tile;
    }),
  );
  return {
    ...base,
    scroll: vertical ? "vertical" : "horizontal",
    screens,
    tiles,
    entry: entry ?? base.entry,
    exit: exit === undefined ? base.exit : exit,
  };
}

// A project whose level "L1" has the given zones (z1, z2, ...), then "corridor" and "boss".
export function projectFromArt(zones: ZoneArt[], checkpoints: Checkpoint[] = []): Project {
  const project = createProject({ id: "p1", name: "Game" }, testPack);
  const level = createLevel(
    { id: "L1", name: "Stage", zoneIds: ["z1", "corridor", "boss"] },
    testPack,
  );
  const [first, corridor, boss] = level.zones;
  const made = zones.map((spec, i) =>
    zoneFromArt(
      i === 0 ? first : createZone({ id: `z${i + 1}`, name: `Zone ${i + 1}` }, testPack),
      spec,
    ),
  );
  return { ...project, levels: [{ ...level, zones: [...made, corridor, boss], checkpoints }] };
}
