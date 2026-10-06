import { describe, expect, it } from "vitest";
import { checkZone } from "@/checker/check";
import type { Abilities } from "@/model/hero";
import { game, pack, run } from "../ai/helpers";

// Zone 1 with a wall two tiles thick and `height` tiles tall standing on the floor.
function wall(height: number, jump: Abilities["jump"]) {
  const p = run(game(), "fillRect", { levelId: "L1", zoneId: "z1", x: 8, y: 13 - height, w: 2, h: height, tile: 1 });
  return { ...p, hero: { ...p.hero, abilities: { ...p.hero.abilities, jump } } };
}

describe("jump steps, played by the checker", () => {
  for (const [jump, clears] of [["low", 2], ["normal", 2], ["high", 3], ["veryHigh", 4]] as const) {
    it(`a ${jump} jump clears a ${clears}-tile wall but not ${clears + 1}`, () => {
      expect(checkZone(wall(clears, jump), "L1", "z1", pack).passable).toBe(true);
      expect(checkZone(wall(clears + 1, jump), "L1", "z1", pack).passable).toBe(false);
    });
  }
});
