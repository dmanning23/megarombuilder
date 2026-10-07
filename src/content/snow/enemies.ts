import { ENEMY_BEHAVIOURS, lettersToLook, type EnemyBehaviour } from "@/model/designs";
import type { Look } from "@/model/look";
import { designLookFrom } from "@/model/lookUpgrade";
import { snowArt } from "./art";
import { SNOW_PALETTE } from "./palette";

// The snow enemies as the drawings a kid's new enemy starts from, one per behaviour. The behaviours
// share their names with the snow enemy types; a single picture fills both frames.
function look(behaviour: EnemyBehaviour): Look {
  const frames = snowArt.things[behaviour].map((sprite) => sprite.rows);
  const two = frames.length === 1 ? [frames[0], frames[0]] : frames.slice(0, 2);
  return designLookFrom(behaviour, lettersToLook(two, SNOW_PALETTE));
}

export const snowEnemyLooks = Object.fromEntries(ENEMY_BEHAVIOURS.map((b) => [b, look(b)])) as Record<EnemyBehaviour, Look>;

// The Blizzard Bot as the drawing a kid's new boss starts from.
export const snowBossLook: Look = designLookFrom(
  "boss",
  lettersToLook(
    snowArt.things.boss.map((sprite) => sprite.rows),
    SNOW_PALETTE,
  ),
);
