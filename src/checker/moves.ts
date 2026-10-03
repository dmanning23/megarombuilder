import { TILE_SIZE } from "@/model/geometry";
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

// Runs toward an edge and jumps at the last moment, holding jump for full height.
const runJump = (d: Dir): Move => ({
  name: `running jump ${side(d)}`,
  jump: true,
  start: () => {
    let jumpedAt = -1;
    return (sim, t) => {
      const p = sim.player;
      if (jumpedAt < 0) {
        if (t > 4 * stepsPerTile(sim)) return null;
        if (p.onGround && !groundAhead(sim, d)) {
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

// Jumps from where the player stands, holding jump for `hold` steps and the direction from step `drift`.
const standJump = (d: Dir, hold: number, drift: number): Move => ({
  name: `jump ${side(d)}${hold < 99 ? " (short)" : ""}${drift > 0 ? ` (drift after ${drift})` : ""}`,
  jump: true,
  start: () => (sim, t) => {
    if ((t > 2 && sim.player.onGround) || t > 200) return null;
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

export const MOVES: Move[] = [
  walk(1),
  walk(-1),
  runJump(1),
  runJump(-1),
  standJump(0, 99, 0),
  standJump(1, 99, 0),
  standJump(-1, 99, 0),
  standJump(1, 6, 0),
  standJump(-1, 6, 0),
  standJump(1, 99, 12),
  standJump(-1, 99, 12),
  standJump(1, 99, 24),
  standJump(-1, 99, 24),
  climb("up"),
  climb("down"),
];
