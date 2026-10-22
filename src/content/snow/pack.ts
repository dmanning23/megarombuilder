import type { ContentPack } from "@/model/contentPack";

import { snowBossLook, snowEnemyLooks } from "./enemies";
import { snowHero } from "./hero";
import { snowPieces } from "./pieces";
import { GROUND, ICE, LADDER, LEDGE, SPIKE } from "./tiles";

export { FLOOR, GROUND, ICE, LADDER, LEDGE, SPIKE } from "./tiles";

export const snowPack: ContentPack = {
  id: "snow",
  name: "Snow",
  variants: ["outdoor", "cave"],
  groundTileId: GROUND,
  tiles: [
    { id: GROUND, name: "ground", behaviour: "solid" },
    { id: ICE, name: "ice", behaviour: "ice" },
    { id: LADDER, name: "ladder", behaviour: "ladder" },
    { id: SPIKE, name: "spike", behaviour: "spike" },
    { id: LEDGE, name: "ledge", behaviour: "oneWay" },
  ],
  things: [
        { type: "walker", name: "Snow Crawler", category: "enemy", behaviour: "walker", description: "Patrols back and forth.", defaults: { speed: 0.5 } },
        { type: "flyer", name: "Frost Bat", category: "enemy", behaviour: "flyer", description: "Swoops toward you.", defaults: {} },
        { type: "turret", name: "Icicle Cannon", category: "enemy", behaviour: "turret", description: "Fires icicles at you.", defaults: {} },
        { type: "jumper", name: "Hopper", category: "enemy", behaviour: "jumper", description: "Hops toward you.", defaults: {} },
        { type: "shielded", name: "Shield Guard", category: "enemy", behaviour: "shielded", description: "Blocks shots until it opens up.", defaults: {} },
        { type: "sniper", name: "Sniper", category: "enemy", behaviour: "sniper", description: "Hides behind its shield, then fires three low shots.", defaults: {}, shotYs: { shoot: 9 } },
        { type: "dropper", name: "Icicle Dropper", category: "enemy", behaviour: "dropper", description: "Drops when you pass underneath.", defaults: {} },
        { type: "platform", name: "Moving Platform", category: "platform", behaviour: "platform", description: "Slides back and forth.", defaults: { axis: "x", distance: 4, speed: 0.5 } },
        { type: "small-health", name: "Small Health", category: "pickup", behaviour: "health", description: "Restores a little health.", defaults: { amount: 2 } },
        { type: "large-health", name: "Large Health", category: "pickup", behaviour: "health", description: "Restores a lot of health.", defaults: { amount: 10 } },
        { type: "boss", name: "Blizzard Bot", category: "boss", behaviour: "boss", description: "The stage boss.", defaults: { health: 28 } },
    ],
    pieces: snowPieces,
    hero: snowHero,
    enemyLooks: snowEnemyLooks,
    bossLook: snowBossLook,
};
