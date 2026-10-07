import { ENEMY_BEHAVIOURS, lettersToLook, type BossDesign, type EnemyBehaviour, type EnemyDesign } from "@/model/designs";
import { snowArt } from "./art";
import { SNOW_PALETTE } from "./palette";

// The snow enemies as the drawings a kid's new enemy starts from, one per behaviour. The behaviours
// share their names with the snow enemy types; a single picture fills both frames.
function look(behaviour: EnemyBehaviour): EnemyDesign["look"] {
  const frames = snowArt.things[behaviour].map((sprite) => sprite.rows);
  const two = frames.length === 1 ? [frames[0], frames[0]] : frames.slice(0, 2);
  return lettersToLook(two, SNOW_PALETTE) as EnemyDesign["look"]; // exactly two frames
}

export const snowEnemyLooks = Object.fromEntries(ENEMY_BEHAVIOURS.map((b) => [b, look(b)])) as Record<
  EnemyBehaviour,
  EnemyDesign["look"]
>;

// The Blizzard Bot as the drawing a kid's new boss starts from.
export const snowBossLook = lettersToLook(
  snowArt.things.boss.map((sprite) => sprite.rows),
  SNOW_PALETTE,
) as BossDesign["look"];
