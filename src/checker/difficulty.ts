import type { ContentPack, ThingBehaviour } from "@/model/contentPack";
import { tileIndex, zoneSize } from "@/model/geometry";
import type { Zone } from "@/model/schema";

const WEIGHTS: Record<ThingBehaviour, number> = {
  walker: 1,
  dropper: 1,
  flyer: 1.5,
  turret: 1.5,
  jumper: 1.5,
  shielded: 2,
  health: -0.5,
  platform: 0,
  boss: 0,
};

// A rough 1-10 guide for the AI and the zone badge. Not a measurement.
export function difficulty(zone: Zone, pack: ContentPack, jumps: number): number {
  const screens = zone.screens;
  const size = zoneSize(zone.scroll, zone.screens);
  const behaviourOf = new Map(pack.tiles.map((t) => [t.id, t.behaviour]));

  let enemyLoad = 0;
  for (const thing of zone.things) {
    const def = pack.things.find((d) => d.type === thing.type);
    if (def) enemyLoad += WEIGHTS[def.behaviour];
  }
  enemyLoad /= screens;

  const spikes = zone.tiles.filter((t) => behaviourOf.get(t) === "spike").length;
  let pits = 0;
  if (zone.scroll === "horizontal") {
    for (let x = 0; x < size.width; x++) {
      if (zone.tiles[tileIndex(size, x, size.height - 1)] === 0) pits++;
    }
  }
  const hazards = (spikes / 4 + pits) / screens;

  const score = 1 + 1.5 * enemyLoad + hazards + 0.5 * (jumps / screens);
  return Math.min(10, Math.max(1, Math.round(score)));
}
