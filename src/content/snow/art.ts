import { PLAYER_POSES, sprite, type ArtSet, type Sprite } from "@/runtime/render/art";
import { SNOW_PALETTE } from "./palette";
import { SNOW_HERO_PICTURES } from "./hero";
import { GROUND, ICE, LADDER, LEDGE, SPIKE } from "./tiles";

// ---- Tiles, generated ----

type Grid = string[][];
const grid = (w: number, h: number, fill: string): Grid =>
  Array.from({ length: h }, () => new Array<string>(w).fill(fill));
const toSprite = (g: Grid): Sprite => sprite(g.map((row) => row.join("")));
const copy = (g: Grid): Grid => g.map((row) => [...row]);

function speckled(base: string, dark: string): Grid {
  const g = grid(16, 16, base);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) if ((x * 7 + y * 13) % 23 === 0) g[y][x] = dark;
  }
  return g;
}

function snowCapped(below: Grid): Grid {
  const g = copy(below);
  for (let x = 0; x < 16; x++) {
    g[0][x] = "n";
    g[1][x] = "n";
    g[2][x] = x % 3 === 0 ? "N" : "n";
    if (x % 5 === 1) g[3][x] = "N";
  }
  return g;
}

function bricks(): Grid {
  const g = grid(16, 16, "c");
  for (let x = 0; x < 16; x++) {
    g[7][x] = "C";
    g[15][x] = "C";
  }
  for (let y = 0; y < 7; y++) g[y][3] = "C";
  for (let y = 8; y < 15; y++) g[y][11] = "C";
  return g;
}

function frosted(below: Grid): Grid {
  const g = copy(below);
  for (let x = 0; x < 16; x++) {
    g[0][x] = "N";
    if (x % 4 === 0) g[1][x] = "N";
  }
  return g;
}

function ice(): Grid {
  const g = grid(16, 16, "I");
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (y === 0) g[y][x] = "i";
      else if (y === 15) g[y][x] = "B";
      else if ((x + y) % 6 === 0 && y < 12) g[y][x] = "i";
    }
  }
  return g;
}

function ladder(): Grid {
  const g = grid(16, 16, ".");
  for (let y = 0; y < 16; y++) {
    g[y][2] = "h";
    g[y][3] = "H";
    g[y][12] = "h";
    g[y][13] = "H";
  }
  for (const y of [3, 11]) {
    for (let x = 4; x < 12; x++) {
      g[y][x] = "h";
      g[y + 1][x] = "H";
    }
  }
  return g;
}

function spikes(): Grid {
  const g = grid(16, 16, ".");
  for (let j = 0; j < 4; j++) {
    const x0 = j * 4;
    for (let y = 4; y < 16; y++) {
      g[y][x0 + 1] = "w";
      g[y][x0 + 2] = "g";
    }
    for (let y = 10; y < 16; y++) {
      g[y][x0] = "g";
      g[y][x0 + 3] = "G";
    }
  }
  for (let x = 0; x < 16; x++) g[15][x] = "G";
  return g;
}

function ledge(): Grid {
  const g = grid(16, 16, ".");
  for (let x = 0; x < 16; x++) {
    g[0][x] = "n";
    g[1][x] = "N";
    g[2][x] = "h";
    g[3][x] = "H";
  }
  return g;
}

function platform(): Grid {
  const g = grid(32, 8, "g");
  for (let x = 0; x < 32; x++) {
    g[0][x] = "k";
    g[1][x] = "n";
    g[2][x] = "N";
    g[7][x] = "k";
    if (x % 8 === 3) for (let y = 3; y < 7; y++) g[y][x] = "G";
  }
  for (let y = 0; y < 8; y++) {
    g[y][0] = "k";
    g[y][31] = "k";
  }
  return g;
}

const SHARED_TILES = {
  [ICE]: { fill: toSprite(ice()) },
  [LADDER]: { fill: toSprite(ladder()) },
  [SPIKE]: { fill: toSprite(spikes()) },
  [LEDGE]: { fill: toSprite(ledge()) },
};

// ---- Things ----

const BLANK16 = "................";
const pad = (count: number, row = BLANK16) => new Array<string>(count).fill(row);

const WALKER_BODY = [
  ...pad(6),
  ".....kkkkkk.....",
  "....knnnnnnk....",
  "...knnnnnnnnk...",
  "...knnnnnnrnk...",
  "...kNnnnnnnnk...",
  "...kNNnnnnnNk...",
  "....kNNNNNNk....",
];
const WALKER = [
  sprite([...WALKER_BODY, "....kGkGGkGk....", "...kGk.kk.kGk...", "...kk......kk..."]),
  sprite([...WALKER_BODY, "....kGGGGGGk....", "....kGk..kGk....", "....kk....kk...."]),
];

const FLYER = [
  sprite([
    ...pad(6),
    "kk............kk",
    "kpk..........kpk",
    "kppk...kk...kppk",
    "kpppk.kppk.kpppk",
    ".kpppkppppkpppk.",
    "..kpppwppwpppk..",
    "...kppppppppk...",
    "....kpPPPPpk....",
    ".....kkPPkk.....",
    "......k..k......",
  ]),
  sprite([
    ...pad(8),
    "......kkkk......",
    ".....kppppk.....",
    "..kkkppwwppkkk..",
    ".kpppppppppppk..",
    "kpppkppppppkpppk",
    "kppk.kPPPPk.kppk",
    "kpk...kPPk...kpk",
    "kk.....kk.....kk",
  ]),
];

const TURRET = [
  sprite([
    ...pad(5),
    ".....kkkkkk.....",
    "....kgggggGk....",
    "...kgggggggGkkkk",
    "...kggwwgggGIIIk",
    "...kgggggggGkkkk",
    "...kGgggggGGk...",
    "..knnnnnnnnnnk..",
    ".knnnnnnnnnnnnk.",
    ".kNnnnnnnnnnnNk.",
    ".kNNNNNNNNNNNNk.",
    "..kkkkkkkkkkkk..",
  ]),
];

const JUMPER = [
  sprite([
    ...pad(4),
    "....kkkkkkkk....",
    "...keeeeeeeek...",
    "..keeeeeeeeeek..",
    "..keeeeeeeeeek..",
    "..keeweeeeweek..",
    "..keeeeeeeeeek..",
    "..kEeeeeeeeeEk..",
    "..kEEEEEEEEEEk..",
    "..kEEEEEEEEEEk..",
    ".kEEk......kEEk.",
    "kEEEk......kEEEk",
    "kkkkk......kkkkk",
  ]),
  sprite([
    ...pad(3),
    "....kkkkkkkk....",
    "...keeeeeeeek...",
    "..keeweeeeweek..",
    "..keeeeeeeeeek..",
    "..kEeeeeeeeeEk..",
    "...kEEEEEEEEk...",
    "....kEEkkEEk....",
    "....kEk..kEk....",
    "....kEk..kEk....",
    "...kEEk..kEEk...",
    "...kkkk..kkkk...",
    ...pad(2),
  ]),
];

const SHIELDED = [
  sprite([
    BLANK16,
    ".....kkkkk......",
    "....kbbbbbk.....",
    "....kbbbbbk.kkk.",
    "....kbwkwbk.kgk.",
    "....kbwwwbk.kgk.",
    "....kbbbbbk.kgk.",
    "...kBBBBBBBkkgk.",
    "...kBBBBBBBkkgk.",
    "...kBBBBBBBkkgk.",
    "...kBBBBBBBkkgk.",
    "....kBBBBBk.kgk.",
    "....kBk.kBk.kkk.",
    "....kBk.kBk.....",
    "...kGGk.kGGk....",
    "...kkkk.kkkk....",
  ]),
  sprite([
    BLANK16,
    ".....kkkkk......",
    "....kbbbbbk.....",
    "....kbbbbbk.....",
    "....kbwkwbk.....",
    "....kbwwwbk.....",
    "....kbbbbbk.....",
    "...kBBBBBBBk....",
    "...kBBBBBBBkoook",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "....kBBBBBk.....",
    "....kBk.kBk.....",
    "....kBk.kBk.....",
    "...kGGk.kGGk....",
    "...kkkk.kkkk....",
  ]),
];

const DROPPER = [
  sprite([
    ...pad(4),
    "....kkkkkkkk....",
    "....kIIIIIIk....",
    "....kIkIIkIk....",
    "....kIIIIIIk....",
    "....kIIIIIIk....",
    ".....kIIIIk.....",
    ".....kIiIIk.....",
    ".....kIIIIk.....",
    "......kIIk......",
    "......kIIk......",
    "......kIIk......",
    ".......kk.......",
  ]),
  sprite([
    ...pad(7),
    "......kkkk......",
    ".....kIIIIk.....",
    "....kIkIIkIk....",
    "....kIIIIIIk....",
    "...kIIiIIiIIk...",
    "...kIIIIIIIIk...",
    "....kkIIIIkk....",
    "....kGk..kGk....",
    "...kkk....kkk...",
  ]),
];

const SMALL_HEALTH = [
  sprite([
    "..........",
    "..kkkkkk..",
    ".krrrrwrk.",
    "krrrrrrwrk",
    "krrrrrrrrk",
    "krrrrrrrrk",
    "kRrrrrrrrk",
    "kRRrrrrrRk",
    ".kRRRRRRk.",
    "..kkkkkk..",
  ]),
];

const LARGE_HEALTH = [
  sprite([
    "..............",
    "...kkkkkkkk...",
    "..kyyyyyyyyk..",
    ".kyywwyyyyyyk.",
    ".kywyyyyyyyyk.",
    "krrrrrrrrrrrrk",
    "krrrrrrrrrrrrk",
    "krrrrrrrrrrrrk",
    "krrrrrrrrrrrrk",
    "kRrrrrrrrrrrRk",
    ".kRRRRRRRRRRk.",
    ".kyyyyyyyyyyk.",
    "..kyyyyyyyyk..",
    "...kkkkkkkk...",
  ]),
];

// ---- Blizzard Bot, 24 by 28 ----

const BLANK24 = "........................";
const BOSS_BODY = [
  BLANK24,
  "........kkkkkkkk........",
  ".......kwwwwwwwwk.......",
  "......kwwnnnnnnwwk......",
  ".....kwnnnnnnnnnnwk.....",
  ".....kIIIIIIIIIIIIk.....",
  ".....kIkkIIIIIIkkIk.....",
  ".....kIrkIIIIIIrkIk.....",
  ".....kIIIIIIIIIIIIk.....",
  "......kwwwkkkkwwwk......",
  "....kkkwwwwwwwwwwkkk....",
  "...kbbkwwwwwwwwwwkbbk...",
  "..kbbbkwwwIIIIwwwkbbbk..",
  "..kbbbkwwIiiiiIwwkbbbk..",
  "..kbbbkwwIiiiiIwwkbbbk..",
  "..kbbbkwwwIIIIwwwkbbbk..",
  "..kBBBkwwwwwwwwwwkBBBk..",
  "..kwwwkwwwwwwwwwwkwwwk..",
  "..kwwwkNNNNNNNNNNkwwwk..",
  "...kkk.kNNNNNNNNk.kkk...",
];
const BOSS_LEGS = [
  "........kBBkkBBk........",
  "........kBBkkBBk........",
  ".......kBBBkkBBBk.......",
  ".......kBBBkkBBBk.......",
  "......kwwwwkkwwwwk......",
  ".....kwwwwwkkwwwwwk.....",
  ".....kNNNNNkkNNNNNk.....",
  ".....kkkkkkkkkkkkkk.....",
];
const BOSS_TUCKED = [
  ".......kBBBkkBBBk.......",
  "......kwwwwkkwwwwk......",
  ".....kwwwwwkkwwwwwk.....",
  ".....kNNNNNkkNNNNNk.....",
  ".....kkkkkkkkkkkkkk.....",
];
const BOSS_CANNON = [
  "..kbbbkwwwIIIIwwwkbbbbbk",
  "..kbbbkwwIiiiiIwwkbbbIIk",
  "..kbbbkwwIiiiiIwwkbbbIIk",
  "..kbbbkwwwIIIIwwwkbbbbbk",
];
const BOSS_SHOOTING = BOSS_BODY.map((row, y) => (y >= 12 && y <= 15 ? BOSS_CANNON[y - 12] : row));

const BOSS = [
  sprite([...BOSS_BODY, ...BOSS_LEGS]), // standing, idle and dashing
  sprite([BLANK24, BLANK24, BLANK24, ...BOSS_BODY, ...BOSS_TUCKED]), // jumping
  sprite([...BOSS_SHOOTING, ...BOSS_LEGS]), // shooting
];

export const snowArt: ArtSet = {
  palette: SNOW_PALETTE,
  backgrounds: { outdoor: "#9bd4ff", cave: "#1c2740" },
  tiles: {
    outdoor: {
      [GROUND]: {
        fill: toSprite(speckled("d", "D")),
        top: toSprite(snowCapped(speckled("d", "D"))),
      },
      ...SHARED_TILES,
    },
    cave: {
      [GROUND]: { fill: toSprite(bricks()), top: toSprite(frosted(bricks())) },
      ...SHARED_TILES,
    },
  },
  player: Object.fromEntries(PLAYER_POSES.map((pose) => [pose, sprite(SNOW_HERO_PICTURES[pose])])) as ArtSet["player"],
  things: {
    walker: WALKER,
    flyer: FLYER,
    turret: TURRET,
    jumper: JUMPER,
    shielded: SHIELDED,
    dropper: DROPPER,
    platform: [toSprite(platform())],
    "small-health": SMALL_HEALTH,
    "large-health": LARGE_HEALTH,
    boss: BOSS,
  },
  playerShot: sprite(SNOW_HERO_PICTURES.shot),
  enemyShot: sprite(["..kk..", ".kiik.", "kiIIik", "kiIIik", ".kiik.", "..kk.."]),
};
