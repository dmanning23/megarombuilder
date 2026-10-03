import type { ContentPack } from "@/model/contentPack";
import type { ArtSet } from "@/runtime/render/art";
import { snowArt } from "./snow/art";
import { snowPack } from "./snow/pack";

const PACKS: Record<string, { pack: ContentPack; art: ArtSet }> = {
  [snowPack.id]: { pack: snowPack, art: snowArt },
};

export const getPack = (id: string): ContentPack | undefined => PACKS[id]?.pack;
export const getArt = (id: string): ArtSet | undefined => PACKS[id]?.art;
export const DEFAULT_PACK = snowPack;
