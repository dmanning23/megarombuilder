import { HERO_POSES, type HeroLook, type HeroPicture } from "@/model/hero";
import { nearestColour } from "@/model/palette";
import { SNOW_PALETTE } from "./palette";

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

const body = (head: string[], arms: string[], legs: string[]) => [...head, ...TORSO, ...arms, ...WAIST, ...legs];

// Sliding: 24 by 16, low and long, head forward.
const SLIDE = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "..............kkkk......",
  ".............kttttk.....",
  "............kttttttk....",
  "............ktwwwwtk....",
  "............ktwkwktk....",
  "..kkkkkkkkkkktwwwwtk....",
  ".kGGkttTTTTTkkttttk.....",
  "kGGGkttTTTTTTTkkkkttk...",
  "kGGGkkttTTTTTTTTTTtttk..",
  "kkkkkkkkttTTTTTTTTkkkk..",
  ".......kkkkkkkkkkkk.....",
];

const SHOT = [".kkkk.", "kyyywk", "kyyywk", ".kkkk."];

const CHARGED_SHOT = [
  "....kkkk....",
  "..kkyyyykk..",
  ".kyyywwyyyk.",
  ".kyywwwwyyk.",
  "kyywwwwwwyyk",
  "kyywwwwwwyyk",
  ".kyywwwwyyk.",
  ".kyyywwyyyk.",
  "..kkyyyykk..",
  "....kkkk....",
];

// The snow hero in the snow palette's letters.
export const SNOW_HERO_PICTURES: Record<HeroPicture, string[]> = {
  stand: body(HEAD, ARMS_DOWN, LEGS_STAND),
  standShoot: body(HEAD, ARMS_SHOOT, LEGS_STAND),
  run1: body(HEAD, ARMS_DOWN, LEGS_RUN1),
  run2: body(HEAD, ARMS_DOWN, LEGS_RUN2),
  jump: body(HEAD, ARMS_UP, LEGS_JUMP),
  jumpShoot: body(HEAD, ARMS_SHOOT, LEGS_JUMP),
  climb: body(BACK_HEAD, ARMS_UP, LEGS_CLIMB),
  hurt: body(HURT_HEAD, ARMS_UP, LEGS_JUMP),
  slide: SLIDE,
  shot: SHOT,
  chargedShot: CHARGED_SHOT,
};

// Each letter the hero uses becomes a colour slot, "1" for the first.
const LETTERS = ["k", "t", "T", "w", "o", "G", "y"];

function toSlots(rows: string[]): string[] {
  return rows.map((row) =>
    [...row]
      .map((ch) => {
        if (ch === ".") return ".";
        const slot = LETTERS.indexOf(ch);
        if (slot < 0) throw new Error(`The snow hero uses the letter "${ch}", which has no colour slot.`);
        return String(slot + 1);
      })
      .join(""),
  );
}

export const snowHero: HeroLook = {
  colours: LETTERS.map((ch) => nearestColour(SNOW_PALETTE[ch])),
  poses: Object.fromEntries(HERO_POSES.map((pose) => [pose, toSlots(SNOW_HERO_PICTURES[pose])])) as HeroLook["poses"],
  shot: toSlots(SHOT),
  chargedShot: toSlots(CHARGED_SHOT),
};
