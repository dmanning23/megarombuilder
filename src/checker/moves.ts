import { TILE_SIZE } from "@/model/geometry";
import { PLAYER_H } from "@/runtime/sim/constants";
import { NO_INPUT, type Input, type Sim } from "@/runtime/sim/state";
import { firstTile, isPlatform, isSolid, ladderAtPx } from "@/runtime/sim/tilemap";

// A scripted bit of play: the keys to hold on step t, or null when the script is done.
export type Script = (sim: Sim, t: number) => Input | null;
export type Move = {
  name: string;
  jump: boolean;
  when?: (sim: Sim) => boolean; // skip the move unless this holds at the start
  start: () => Script;
};

type Dir = -1 | 0 | 1;
const keys = (k: Partial<Input>): Input => ({ ...NO_INPUT, ...k });
const toward = (d: Dir): Partial<Input> => (d < 0 ? { left: true } : d > 0 ? { right: true } : {});
const side = (d: Dir) => (d < 0 ? "left" : d > 0 ? "right" : "up");
const stepsPerTile = (sim: Sim) => Math.ceil(TILE_SIZE / sim.settings.runSpeed);

function groundAhead(sim: Sim, d: Dir): boolean {
  const p = sim.player;
  const tx = firstTile(d > 0 ? p.x + p.w + 1 : p.x - 1);
  const ty = firstTile(p.y + p.h + 1);
  return isSolid(sim.map.behaviourAt(tx, ty)) || isPlatform(sim.map, tx, ty);
}

// Walks one tile.
const walk = (d: Dir): Move => ({
  name: `walk ${side(d)}`,
  jump: false,
  start: () => (sim, t) => (t < stepsPerTile(sim) ? keys(toward(d)) : null),
});

// The most a take-off may overhang an edge: the player's box is 14 pixels wide, so 12 still leaves
// 2 pixels standing on the edge.
export const MAX_OVERHANG = 12;

// Runs toward an edge and jumps once the player overhangs it by `overhang` pixels, holding jump for
// full height. Trying several overhangs means the verdict does not depend on where the player
// happened to come to rest before the edge.
const runJump = (d: Dir, overhang: number): Move => ({
  name: `running jump ${side(d)} (overhang ${overhang})`,
  jump: true,
  start: () => {
    let edgeAt = -1;
    let jumpedAt = -1;
    return (sim, t) => {
      const p = sim.player;
      if (jumpedAt < 0) {
        if (t > 4 * stepsPerTile(sim)) return null;
        if (edgeAt < 0 && p.onGround && !groundAhead(sim, d)) edgeAt = t;
        if (edgeAt >= 0 && t >= edgeAt + Math.ceil(overhang / sim.settings.runSpeed)) {
          if (!p.onGround) return null; // walked off before the jump
          jumpedAt = t;
          return keys({ ...toward(d), jump: true });
        }
        return keys(toward(d));
      }
      if (t > jumpedAt + 2 && p.onGround) return null;
      return keys({ ...toward(d), jump: true });
    };
  },
});

// Jumps holding up, to grab a ladder that does not reach the floor.
const jumpGrab = (d: Dir): Move => ({
  name: `jump and grab ${side(d)}`,
  jump: true,
  start: () => (sim, t) => {
    const p = sim.player;
    if ((t > 0 && p.onLadder) || (t > 2 && p.onGround) || t > 600) return null;
    return keys({ ...toward(d), jump: true, up: true });
  },
});

// Jumps from where the player stands, holding jump for `hold` steps and the direction from step `drift`.
const standJump = (d: Dir, hold: number, drift: number): Move => ({
  name: `jump ${side(d)}${hold < 99 ? " (short)" : ""}${drift > 0 ? ` (drift after ${drift})` : ""}`,
  jump: true,
  start: () => (sim, t) => {
    if ((t > 2 && sim.player.onGround) || t > 600) return null;
    return keys({ ...(t >= drift ? toward(d) : {}), jump: t < hold });
  },
});

// Climbs until the player is off the ladder (at the top, the bottom, or through the exit).
const climb = (dir: "up" | "down"): Move => ({
  name: `climb ${dir}`,
  jump: false,
  when: (sim) => {
    const p = sim.player;
    const cx = p.x + p.w / 2;
    if (dir === "up") return ladderAtPx(sim.map, cx, p.y + p.h / 2) || ladderAtPx(sim.map, cx, p.y + p.h - 1);
    return p.onLadder || ladderAtPx(sim.map, cx, p.y + p.h);
  },
  start: () => (sim, t) => {
    if ((t > 2 && !sim.player.onLadder) || t > 1200) return null;
    return keys({ [dir]: true });
  },
});

// Slides from where the player stands, then waits until they are standing again.
const slide = (d: -1 | 1): Move => ({
  name: `slide ${side(d)}`,
  jump: false,
  when: (sim) => sim.settings.slide && sim.player.onGround,
  start: () => (sim, t) => {
    if (t === 0) return keys({ ...toward(d), down: true }); // face that way
    if (t === 1) return keys({ down: true, jump: true });
    if (sim.player.h < PLAYER_H && t < 600) return NO_INPUT;
    return null;
  },
});

export const MOVES: Move[] = [
  walk(1),
  walk(-1),
  slide(1),
  slide(-1),
  ...[0, 4, 8, MAX_OVERHANG].flatMap((o) => [runJump(1, o), runJump(-1, o)]),
  standJump(0, 99, 0),
  standJump(1, 99, 0),
  standJump(-1, 99, 0),
  standJump(1, 6, 0),
  standJump(-1, 6, 0),
  standJump(1, 99, 12),
  standJump(-1, 99, 12),
  standJump(1, 99, 24),
  standJump(-1, 99, 24),
  jumpGrab(0),
  jumpGrab(1),
  jumpGrab(-1),
  climb("up"),
  climb("down"),
];
