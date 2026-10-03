import type { PieceDef, PieceResult, PieceSettingDef, PieceThing } from "@/model/contentPack";
import type { ThingSettings } from "@/model/schema";
import { FLOOR, GROUND, LEDGE, SPIKE } from "./tiles";

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
];
