import { ENEMY_BEHAVIOURS, lettersToLook, type DesignLook, type EnemyBehaviour } from "@/model/designs";
import { snowArt } from "./art";
import { SNOW_PALETTE } from "./palette";

// The snow enemies as the drawings a kid's new enemy starts from, one per behaviour. The behaviours
// share their names with the snow enemy types; a single picture fills both frames.
function look(behaviour: EnemyBehaviour): DesignLook {
  const frames = snowArt.things[behaviour].map((sprite) => sprite.rows);
  return lettersToLook(frames.length === 1 ? [frames[0], frames[0]] : frames.slice(0, 2), SNOW_PALETTE);
}

export const snowEnemyLooks = Object.fromEntries(ENEMY_BEHAVIOURS.map((b) => [b, look(b)])) as Record<
  EnemyBehaviour,
  DesignLook
>;
