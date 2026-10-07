import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { snowBossLook, snowEnemyLooks } from "@/content/snow/enemies";
import { snowPack } from "@/content/snow/pack";
import { designFrames, ENEMY_BEHAVIOURS } from "@/model/designs";
import { lookProblems } from "@/model/look";

describe("the snow enemies as starting looks", () => {
  it("give every behaviour two good 16 by 16 frames", () => {
    for (const behaviour of ENEMY_BEHAVIOURS) {
      expect(lookProblems(behaviour, snowEnemyLooks[behaviour], behaviour), behaviour).toEqual([]);
      expect(designFrames(behaviour, snowEnemyLooks[behaviour])).toHaveLength(2);
    }
  });

  it("keep the snow drawings' shapes", () => {
    const shape = (rows: string[]) => rows.map((row) => row.replace(/[^.]/g, "#"));
    expect(designFrames("walker", snowEnemyLooks.walker).map(shape)).toEqual(snowArt.things.walker.map((s) => shape(s.rows)));
    const turret = designFrames("turret", snowEnemyLooks.turret);
    expect(turret[1]).toEqual(turret[0]); // one picture, both frames
  });

  it("are the snow pack's starting looks", () => {
    expect(snowPack.enemyLooks).toBe(snowEnemyLooks);
  });
});

describe("the Blizzard Bot as a starting look", () => {
  it("has three good 24 by 28 frames in at most eight colours", () => {
    expect(lookProblems("boss", snowBossLook, "Blizzard Bot")).toEqual([]);
    expect(designFrames("boss", snowBossLook)).toHaveLength(3);
    expect(snowBossLook.colours.length).toBeLessThanOrEqual(8);
    expect(snowPack.bossLook).toBe(snowBossLook);
  });
});
