import { sprite, type ArtSet, type Sprite } from "@/runtime/render/art";
import { GROUND, ICE, LADDER, LEDGE, SPIKE } from "./pack";

const PALETTE: Record<string, string> = {
  k: "#1a1c2c", // outline
  w: "#f4f4f4",
  t: "#2ec4b6",
  T: "#1b8a80",
  o: "#ff9f1c",
  g: "#8d99ae",
  G: "#4a5568",
  b: "#3a86ff",
  B: "#1d4ed8",
  i: "#bdf4ff",
  I: "#5bc0eb",
  n: "#f8fafc",
  N: "#cbd5e1",
  d: "#8b5e34",
  D: "#5c3d22",
  c: "#64748b",
  C: "#334155",
  h: "#c08a4a",
  H: "#7a4f24",
  r: "#ef476f",
  R: "#a4133c",
  y: "#ffd166",
  p: "#9b5de5",
  P: "#5a2d91",
  e: "#80ed99",
  E: "#2d8f4e",
};

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

// ---- The hero, 16 by 24, built from parts ----

const HEAD = [
  "................",
  "................",
  "................",
  "......kkkk......",
  ".....kttttk.....",
  "....kttttttk....",
  "....ktwwwwtk....",
  "....ktwkwktk....",
  "....ktwwwwtk....",
  ".....kttttk.....",
];
const HURT_HEAD = HEAD.map((row, y) => (y === 7 ? "....ktwkkwtk...." : row));
const BACK_HEAD = HEAD.map((row, y) =>
  y === 6 || y === 8 ? "....kttttttk...." : y === 7 ? "....ktTTTTtk...." : row,
);
const TORSO = ["....kkTTTTkk....", "...kttTTTTttk..."];
const ARMS_DOWN = ["..kttkTTTTkttk..", "..ktkkTTTTkktk..", "..kk.kTTTTk.kk.."];
const ARMS_SHOOT = ["..kttkTTTTkttkkk", "..ktkkTTTTktoooo", "..kk.kTTTTkkkkkk"];
const ARMS_UP = [".kttkkTTTTkkttk.", ".ktk.kTTTTk.ktk.", ".kk..kTTTTk..kk."];
const WAIST = [".....kTTTTk....."];
const LEGS_STAND = [
  ".....ktttTk.....",
  ".....ktk.kTk....",
  ".....ktk.kTk....",
  ".....ktk.kTk....",
  ".....ktk.kTk....",
  "....kGGk.kGGk...",
  "...kGGGk.kGGGk..",
  "...kkkkk.kkkkk..",
];
const LEGS_RUN1 = [
  ".....ktttTk.....",
  ".....ktttTk.....",
  "....kttkkTTk....",
  "...kttk..kTTk...",
  "..kttk....kTTk..",
  ".kGGk......kGGk.",
  "kGGGk......kGGGk",
  "kkkkk......kkkkk",
];
const LEGS_RUN2 = [
  ".....ktttTk.....",
  ".....kttTTk.....",
  "......ktTk......",
  "......ktTk......",
  ".....kttTTk.....",
  "....kGGGGGk.....",
  "....kGGGGGGk....",
  "....kkkkkkkk....",
];
const LEGS_JUMP = [
  ".....ktttTk.....",
  "....kttkkTTk....",
  "...kttk..kTTk...",
  "...kGGk..kGGk...",
  "...kGGk..kGGk...",
  "...kkkk..kkkk...",
  "................",
  "................",
];
const LEGS_CLIMB = [
  ".....ktttTk.....",
  ".....ktk.kTk....",
  ".....ktk.kTk....",
  ".....kGk.kTk....",
  "....kGGk.kTk....",
  "....kkkk.kGGk...",
  ".........kGGGk..",
  ".........kkkkk..",
];

const hero = (head: string[], arms: string[], legs: string[]) =>
  sprite([...head, ...TORSO, ...arms, ...WAIST, ...legs]);

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
    ...pad(2),
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
    ...pad(4),
  ]),
  sprite([
    ...pad(4),
    "......kkkk......",
    ".....kppppk.....",
    "..kkkppwwppkkk..",
    ".kpppppppppppk..",
    "kpppkppppppkpppk",
    "kppk.kPPPPk.kppk",
    "kpk...kPPk...kpk",
    "kk.....kk.....kk",
    ...pad(4),
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
    ...pad(7),
    "....kkkkkkkk....",
    "...keeeeeeeek...",
    "..keeeeeeeeeek..",
    "..keeweeeeweek..",
    "..kEeeeeeeeeEk..",
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
    "....kkkkkkkk....",
    "....kIIIIIIk....",
    "....kIkIIkIk....",
    "....kIIIIIIk....",
    ".....kIIIIk.....",
    ".....kIiIIk.....",
    "......kIIk......",
    "......kIIk......",
    ".......kk.......",
    ...pad(7),
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
  BLANK24,
  BLANK24,
  BLANK24,
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
  sprite([...BOSS_BODY, ...BOSS_TUCKED]), // jumping
  sprite([...BOSS_SHOOTING, ...BOSS_LEGS]), // shooting
];

export const snowArt: ArtSet = {
  palette: PALETTE,
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
  player: {
    stand: hero(HEAD, ARMS_DOWN, LEGS_STAND),
    standShoot: hero(HEAD, ARMS_SHOOT, LEGS_STAND),
    run1: hero(HEAD, ARMS_DOWN, LEGS_RUN1),
    run2: hero(HEAD, ARMS_DOWN, LEGS_RUN2),
    jump: hero(HEAD, ARMS_UP, LEGS_JUMP),
    jumpShoot: hero(HEAD, ARMS_SHOOT, LEGS_JUMP),
    climb: hero(BACK_HEAD, ARMS_UP, LEGS_CLIMB),
    hurt: hero(HURT_HEAD, ARMS_UP, LEGS_JUMP),
  },
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
  playerShot: sprite([".kkkk.", "kyyywk", "kyyywk", ".kkkk."]),
  enemyShot: sprite(["..kk..", ".kiik.", "kiIIik", "kiIIik", ".kiik.", "..kk.."]),
};
