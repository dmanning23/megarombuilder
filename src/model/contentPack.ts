import type { HeroLook } from "./hero";
import type { ThingSettings } from "./schema";

export type TileBehaviour = "solid" | "ladder" | "spike" | "ice" | "oneWay";

export type TileDef = { id: number; name: string; behaviour: TileBehaviour };

export type ThingCategory = "enemy" | "pickup" | "platform" | "boss" | "marker";

export type ThingBehaviour =
  | "walker"
  | "flyer"
  | "turret"
  | "jumper"
  | "shielded"
  | "dropper"
  | "platform"
  | "health"
  | "boss";

export type ThingDef = {
  type: string;
  name: string;
  category: ThingCategory;
  behaviour: ThingBehaviour;
  description: string;
  defaults: ThingSettings;
};

// Piece settings are whole numbers so they can be described to the AI as plain ranges.
export type PieceSettingDef = {
  key: string;
  description: string;
  min: number;
  max: number;
  default: number;
};

export const KEEP_TILE = -1;

export type PieceThing = { type: string; x: number; y: number; settings: ThingSettings };

export type PieceResult = {
  width: number;
  height: number;
  tiles: number[]; // row by row; KEEP_TILE leaves the existing tile alone
  things: PieceThing[]; // positions relative to the piece's top-left corner
  enterRow?: number; // the row the player stands on at the left edge (13, the normal floor, if absent)
  exitRow?: number; // the row the player stands on at the right edge (13 if absent)
};

export type PieceDef = {
  id: string;
  name: string;
  description: string;
  settings: PieceSettingDef[];
  needs?: "slide"; // a move the hero must have to get through it
  build: (settings: Record<string, number>) => PieceResult;
};

export type ContentPack = {
  id: string;
  name: string;
  variants: string[];
  groundTileId: number;
  tiles: TileDef[];
  things: ThingDef[];
  pieces: PieceDef[];
  hero: HeroLook; // the hero a new game starts with
};
