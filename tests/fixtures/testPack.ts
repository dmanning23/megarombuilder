import { KEEP_TILE, type ContentPack } from "@/model/contentPack";
import { ENEMY_BEHAVIOURS, type BossDesign, type EnemyBehaviour, type EnemyDesign } from "@/model/designs";
import { HERO_PICTURES, PICTURE_SIZES, type HeroLook, type HeroPicture } from "@/model/hero";

const solid = (picture: HeroPicture) =>
  Array.from({ length: PICTURE_SIZES[picture].h }, () => "1".repeat(PICTURE_SIZES[picture].w));

const enemyFrame = Array.from({ length: 16 }, () => "1".repeat(16));
export const testEnemyLooks = Object.fromEntries(
  ENEMY_BEHAVIOURS.map((b) => [b, { colours: [13], frames: [enemyFrame, enemyFrame] }]),
) as Record<EnemyBehaviour, EnemyDesign["look"]>;

const bossFrame = Array.from({ length: 28 }, () => "1".repeat(24));
export const testBossLook = { colours: [13], frames: [bossFrame, bossFrame, bossFrame] } as BossDesign["look"];

// A plain black hero: every picture filled with its one colour.
export const testHero: HeroLook = {
  colours: [13],
  poses: Object.fromEntries(HERO_PICTURES.filter((p) => p !== "shot" && p !== "chargedShot").map((p) => [p, solid(p)])) as HeroLook["poses"],
  shot: solid("shot"),
  chargedShot: solid("chargedShot"),
};

export const testPack: ContentPack = {
  id: "test",
  name: "Test Pack",
  variants: ["outdoor", "cave"],
  groundTileId: 1,
  tiles: [
    { id: 1, name: "ground", behaviour: "solid" },
    { id: 2, name: "ladder", behaviour: "ladder" },
    { id: 3, name: "spike", behaviour: "spike" },
    { id: 4, name: "ice", behaviour: "ice" },
    { id: 5, name: "ledge", behaviour: "oneWay" },
  ],
  things: [
    {
      type: "walker",
      name: "Walker",
      category: "enemy",
      behaviour: "walker",
      description: "Patrols a platform.",
      defaults: { speed: 1 },
    },
    {
      type: "health",
      name: "Health",
      category: "pickup",
      behaviour: "health",
      description: "Restores health.",
      defaults: { amount: 4 },
    },
    { type: "flyer", name: "Flyer", category: "enemy", behaviour: "flyer", description: "Flies.", defaults: {} },
    { type: "turret", name: "Turret", category: "enemy", behaviour: "turret", description: "Shoots.", defaults: {} },
    { type: "jumper", name: "Jumper", category: "enemy", behaviour: "jumper", description: "Hops.", defaults: {} },
    { type: "shielded", name: "Shielded", category: "enemy", behaviour: "shielded", description: "Blocks.", defaults: {} },
    { type: "dropper", name: "Dropper", category: "enemy", behaviour: "dropper", description: "Drops.", defaults: {} },
    { type: "platform", name: "Platform", category: "platform", behaviour: "platform", description: "Moves.", defaults: {} },
    { type: "boss", name: "Boss", category: "boss", behaviour: "boss", description: "Fights.", defaults: {} },
  ],
  pieces: [
    {
      id: "step",
      name: "Step",
      description: "A solid block with a walker standing on it.",
      settings: [
        { key: "width", description: "Block width in tiles", min: 1, max: 4, default: 2 },
        { key: "height", description: "Block height in tiles", min: 1, max: 3, default: 1 },
      ],
      build: ({ width, height }) => ({
        width,
        height: height + 1,
        tiles: [
          ...new Array<number>(width).fill(KEEP_TILE),
          ...new Array<number>(width * height).fill(1),
        ],
        things: [{ type: "walker", x: 0, y: 0, settings: {} }],
      }),
    },
  ],
  hero: testHero,
  enemyLooks: testEnemyLooks,
  bossLook: testBossLook,
};
