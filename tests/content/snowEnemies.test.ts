import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { snowEnemyLooks } from "@/content/snow/enemies";
import { snowPack } from "@/content/snow/pack";
import { ENEMY_BEHAVIOURS, ENEMY_FRAME, framesProblems } from "@/model/designs";

describe("the snow enemies as starting looks", () => {
  it("give every behaviour two good 16 by 16 frames", () => {
    for (const behaviour of ENEMY_BEHAVIOURS) {
      expect(framesProblems(behaviour, snowEnemyLooks[behaviour], ENEMY_FRAME), behaviour).toEqual([]);
      expect(snowEnemyLooks[behaviour].frames).toHaveLength(2);
    }
  });

  it("keep the snow drawings' shapes", () => {
    const shape = (rows: string[]) => rows.map((row) => row.replace(/[^.]/g, "#"));
    expect(snowEnemyLooks.walker.frames.map(shape)).toEqual(snowArt.things.walker.map((s) => shape(s.rows)));
    expect(snowEnemyLooks.turret.frames[1]).toEqual(snowEnemyLooks.turret.frames[0]); // one picture, both frames
  });

  it("are the snow pack's starting looks", () => {
    expect(snowPack.enemyLooks).toBe(snowEnemyLooks);
  });
});
