import { TILE_SIZE } from "@/model/geometry";
import type { PlayerSettings } from "@/model/schema";
import type { Player } from "@/runtime/sim/state";
import { firstTile, isPlatform, isSolid, lastTile, type TileMap } from "@/runtime/sim/tilemap";
import { MAX_OVERHANG } from "./moves";
import { FAIR_RUN_SPEED, type Probe } from "./probe";

// The highest and furthest a full jump from flat ground reaches, in pixels.
export function jumpReach(settings: PlayerSettings): { height: number; distance: number } {
  let vy = -settings.jumpVelocity;
  let y = 0;
  let top = 0;
  let steps = 0;
  do {
    vy = Math.min(vy + settings.gravity, settings.maxFallSpeed);
    y += vy;
    top = Math.min(top, y);
    steps++;
  } while (y < 0 && steps < 1000);
  return { height: -top, distance: steps * settings.runSpeed };
}

// The widest gap the checker accepts on flat ground, in tiles: a fair-speed jump plus the most
// a take-off may overhang the edge.
export function clearableGap(settings: PlayerSettings): number {
  const fair = jumpReach({ ...settings, runSpeed: settings.runSpeed * FAIR_RUN_SPEED });
  return Math.floor((fair.distance + MAX_OVERHANG) / TILE_SIZE);
}

// Whether column c has anywhere to stand at or below the surface row, and whether spikes come first.
function footing(map: TileMap, c: number, surface: number): { stand: boolean; spikes: boolean } {
  for (let r = surface; r < map.height; r++) {
    const cell = map.behaviourAt(c, r);
    if (cell === "spike") return { stand: false, spikes: true };
    if (isSolid(cell) || isPlatform(map, c, r) || cell === "ladder") return { stand: true, spikes: false };
  }
  return { stand: false, spikes: false };
}

// The row the player is standing on.
export const surfaceRow = (p: Player): number => Math.round((p.y + p.h) / TILE_SIZE);

// The column a stuck player is standing in: for a right exit, the rightmost column under their
// feet that holds them up (they may overhang an edge); otherwise the column under their centre.
export function standingColumn(map: TileMap, p: Player, exitEdge: string | undefined): number {
  if (exitEdge !== "right") return firstTile(p.x + p.w / 2);
  const surface = surfaceRow(p);
  for (let c = lastTile(p.x + p.w); c > firstTile(p.x); c--) {
    if (footing(map, c, surface).stand) return c;
  }
  return firstTile(p.x);
}

// Why the player cannot get from where they got stuck to the exit.
export function stuckReason(probe: Probe, furthest: Player, settings: PlayerSettings): string {
  const map = probe.map;
  const exit = probe.zone.exit;
  const col = standingColumn(map, furthest, exit?.edge);
  const surface = surfaceRow(furthest);
  if (!exit || exit.edge !== "right") {
    return `Cannot reach the exit at the ${exit?.edge ?? "end"}. The player gets as far as column ${col}, row ${surface - 1}.`;
  }
  const reach = jumpReach(settings);
  for (let c = col + 1; c < map.width; c++) {
    if (isSolid(map.behaviourAt(c, surface - 1)) || isSolid(map.behaviourAt(c, surface - 2))) {
      let top = surface - 1;
      while (top > 0 && isSolid(map.behaviourAt(c, top - 1))) top--;
      return `Cannot get past column ${col}: a wall ${surface - top} tiles high at column ${c}, and the highest jump is about ${Math.floor(reach.height / TILE_SIZE)} tiles.`;
    }
    if (!footing(map, c, surface).stand) {
      let width = 0;
      let spikes = false;
      while (c + width < map.width) {
        const here = footing(map, c + width, surface);
        if (here.stand) break;
        spikes ||= here.spikes;
        width++;
      }
      return `Cannot get past column ${col}: a ${spikes ? "spike pit" : "gap"} ${width} tiles wide at column ${c}, and the longest gap the player can clear on flat ground is about ${clearableGap(settings)} tiles.`;
    }
  }
  return `Cannot get past column ${col}.`;
}
