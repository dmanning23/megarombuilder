import type { PieceDef, PieceResult, PieceSettingDef, PieceThing } from "@/model/contentPack";
import type { ThingSettings } from "@/model/schema";
import { FLOOR, GROUND, ICE, LADDER, LEDGE, SPIKE } from "./tiles";

const ROWS = 15;

// A piece being built: every cell starts as air.
class Grid {
  readonly tiles: number[];
  readonly things: PieceThing[] = [];
  constructor(readonly width: number) {
    this.tiles = new Array<number>(width * ROWS).fill(0);
  }
  fill(x: number, y: number, w: number, h: number, tile: number): void {
    for (let r = Math.max(0, y); r < Math.min(ROWS, y + h); r++) {
      for (let c = Math.max(0, x); c < Math.min(this.width, x + w); c++) this.tiles[r * this.width + c] = tile;
    }
  }
  // Solid ground from row `top` to the bottom, in columns x0 to x1.
  ground(x0: number, x1: number, top: number): void {
    this.fill(x0, top, x1 - x0 + 1, ROWS - top, GROUND);
  }
  put(type: string, x: number, y: number, settings: ThingSettings = {}): void {
    this.things.push({ type, x, y, settings });
  }
  done(enterRow = FLOOR, exitRow = FLOOR): PieceResult {
    return { width: this.width, height: ROWS, tiles: this.tiles, things: this.things, enterRow, exitRow };
  }
}

const setting = (key: string, description: string, min: number, max: number, value: number): PieceSettingDef => ({
  key,
  description,
  min,
  max,
  default: value,
});

// A pit `width` wide starting at column 2, lined with spikes one row down.
function spikePit(g: Grid, width: number): void {
  g.ground(0, 1, FLOOR);
  g.ground(width + 2, width + 3, FLOOR);
  g.fill(2, FLOOR, width, 1, SPIKE);
  g.fill(2, FLOOR + 1, width, 1, GROUND);
}

// A ladder in column 2 up the face of a wall `height` tiles high that starts at column 3.
function ladderWall(g: Grid, height: number): void {
  const top = FLOOR - height;
  g.ground(0, 2, FLOOR);
  g.ground(3, g.width - 1, top);
  g.fill(2, top, 1, height, LADDER);
}

export const snowPieces: PieceDef[] = [
  {
    id: "flat-run",
    name: "Flat run",
    description: "Plain floor to run along.",
    settings: [setting("width", "How many tiles long", 4, 16, 6)],
    build: ({ width }) => {
      const g = new Grid(width);
      g.ground(0, width - 1, FLOOR);
      return g.done();
    },
  },
  {
    id: "stairs-up",
    name: "Staircase up",
    description: "Steps rising to the right. The floor is higher afterwards, by steps times rise.",
    settings: [setting("steps", "How many steps", 1, 4, 3), setting("rise", "How many tiles each step rises", 1, 2, 1)],
    build: ({ steps, rise }) => {
      const g = new Grid(steps * 2 + 2);
      g.ground(0, 1, FLOOR);
      for (let i = 0; i < steps; i++) g.ground(2 + 2 * i, 3 + 2 * i, FLOOR - (i + 1) * rise);
      return g.done(FLOOR, FLOOR - steps * rise);
    },
  },
  {
    id: "stairs-down",
    name: "Staircase down",
    description: "Steps falling to the right. Enter it from a floor higher by steps times rise.",
    settings: [setting("steps", "How many steps", 1, 4, 3), setting("rise", "How many tiles each step drops", 1, 2, 1)],
    build: ({ steps, rise }) => {
      const width = steps * 2 + 2;
      const g = new Grid(width);
      for (let i = 0; i < steps; i++) g.ground(2 * i, 2 * i + 1, FLOOR - (steps - i) * rise);
      g.ground(width - 2, width - 1, FLOOR);
      return g.done(FLOOR - steps * rise, FLOOR);
    },
  },
  {
    id: "gap",
    name: "Gap",
    description: "An open pit to jump over. Falling in loses a life.",
    settings: [setting("width", "How many tiles wide the pit is", 1, 3, 2)],
    build: ({ width }) => {
      const g = new Grid(width + 4);
      g.ground(0, 1, FLOOR);
      g.ground(width + 2, width + 3, FLOOR);
      return g.done();
    },
  },
  {
    id: "spike-pit",
    name: "Spike pit",
    description: "A shallow pit lined with spikes. Wide ones have a ledge in the middle to land on.",
    settings: [setting("width", "How many tiles wide the pit is", 2, 5, 3)],
    build: ({ width }) => {
      const g = new Grid(width + 4);
      spikePit(g, width);
      if (width >= 4) g.fill(3, FLOOR - 2, width - 2, 1, LEDGE);
      return g.done();
    },
  },
  {
    id: "spike-pit-platform",
    name: "Spike pit with moving platform",
    description: "A wide spike pit crossed by riding a moving platform.",
    settings: [setting("width", "How many tiles wide the pit is", 4, 8, 6)],
    build: ({ width }) => {
      const g = new Grid(width + 4);
      spikePit(g, width);
      g.put("platform", 2, FLOOR - 2, { axis: "x", distance: width - 2, speed: 0.5 });
      return g.done();
    },
  },
  {
    id: "ice-run",
    name: "Ice run",
    description: "A slippery ice floor. Harder versions add an enemy and then a pit.",
    settings: [setting("width", "How many tiles long", 4, 16, 8), setting("difficulty", "1 easy, 3 hard", 1, 3, 1)],
    build: ({ width, difficulty }) => {
      const g = new Grid(width);
      g.ground(0, width - 1, FLOOR);
      g.fill(0, FLOOR, width, 1, ICE);
      if (difficulty >= 3) {
        const mid = Math.floor(width / 2) - 1;
        g.fill(mid, FLOOR, 2, ROWS - FLOOR, 0);
      }
      if (difficulty >= 2) g.put("walker", width - 2, FLOOR - 1);
      return g.done();
    },
  },
  {
    id: "ladder-climb",
    name: "Ladder climb",
    description: "A ladder up the face of a wall. The floor is higher afterwards, by the height.",
    settings: [setting("height", "How many tiles high the wall is", 3, 6, 4)],
    build: ({ height }) => {
      const g = new Grid(6);
      ladderWall(g, height);
      return g.done(FLOOR, FLOOR - height);
    },
  },
  {
    id: "ladder-turrets",
    name: "Ladder climb with turrets",
    description: "A ladder up a wall, with Icicle Cannons waiting at the top.",
    settings: [
      setting("height", "How many tiles high the wall is", 3, 6, 4),
      setting("difficulty", "How many cannons, 1 to 3", 1, 3, 2),
    ],
    build: ({ height, difficulty }) => {
      const g = new Grid(6 + 2 * difficulty);
      ladderWall(g, height);
      for (let i = 0; i < difficulty; i++) g.put("turret", 5 + 2 * i, FLOOR - height - 1);
      return g.done(FLOOR, FLOOR - height);
    },
  },
  {
    id: "stepped-platforms",
    name: "Stepped platforms over a pit",
    description: "A bottomless pit crossed by hopping between small ledges.",
    settings: [setting("width", "How many tiles wide the pit is", 4, 8, 6)],
    build: ({ width }) => {
      const g = new Grid(width + 4);
      g.ground(0, 1, FLOOR);
      g.ground(width + 2, width + 3, FLOOR);
      for (let k = 0, x = 2; x <= width + 1; k++, x += 3) {
        g.fill(x, k % 2 === 0 ? FLOOR - 2 : FLOOR - 3, Math.min(2, width + 2 - x), 1, LEDGE);
      }
      return g.done();
    },
  },
  {
    id: "enemy-gauntlet",
    name: "Enemy gauntlet",
    description: "A stretch of floor packed with enemies. Harder versions add more kinds.",
    settings: [setting("width", "How many tiles long", 6, 14, 10), setting("difficulty", "1 easy, 3 hard", 1, 3, 2)],
    build: ({ width, difficulty }) => {
      const g = new Grid(width);
      g.ground(0, width - 1, FLOOR);
      for (let x = 3; x < width - 1; x += 4) g.put("walker", x, FLOOR - 1);
      if (difficulty >= 2) g.put("flyer", Math.floor(width / 2), FLOOR - 5);
      if (difficulty >= 3) {
        g.put("shielded", width - 2, FLOOR - 1);
        g.put("jumper", Math.floor(width / 2) + 1, FLOOR - 1);
      }
      return g.done();
    },
  },
  {
    id: "rest-area",
    name: "Rest area",
    description: "A calm stretch with a health pickup, to recover before what comes next.",
    settings: [setting("width", "How many tiles long", 4, 8, 5), setting("difficulty", "1 gives more health", 1, 3, 1)],
    build: ({ width, difficulty }) => {
      const g = new Grid(width);
      g.ground(0, width - 1, FLOOR);
      g.put(difficulty === 1 ? "large-health" : "small-health", Math.floor(width / 2), FLOOR - 1);
      return g.done();
    },
  },
];
