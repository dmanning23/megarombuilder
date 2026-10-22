import { describe, expect, it } from "vitest";
import { applyCommand } from "@/commands";
import { snowArt } from "@/content/snow/art";
import { snowEnemyLooks } from "@/content/snow/enemies";
import { snowPack } from "@/content/snow/pack";
import { DEFAULT_HEALTH, ENEMY_BEHAVIOURS, HEALTH_STEPS, TUNING_USED, defaultTuning, tuningSettings } from "@/model/designs";
import { ANIMATION_NAMES, firesFrom, KINDS, lookForKind, lookProblems, shotPoints } from "@/model/look";
import { artProblems } from "@/runtime/render/art";
import { game } from "../ai/helpers";

describe("the Sniper in the model", () => {
  it("is a seventh enemy kind with Guard and Shoot poses, firing from Shoot", () => {
    expect(ENEMY_BEHAVIOURS).toContain("sniper");
    expect(Object.keys(KINDS.sniper.animations)).toEqual(["guard", "shoot"]);
    expect([ANIMATION_NAMES.guard, ANIMATION_NAMES.shoot]).toEqual(["Guard", "Shoot"]);
    expect(firesFrom("sniper", "shoot")).toBe(true);
    expect(firesFrom("sniper", "guard")).toBe(false);
  });

  it("uses Health and Damage only, starts at 8, and fires at its Damage", () => {
    expect(HEALTH_STEPS).toEqual([1, 2, 3, 5, 8, 12]);
    expect(DEFAULT_HEALTH.sniper).toBe(8);
    expect(TUNING_USED.sniper).toEqual(["health", "damage"]);
    expect(tuningSettings("sniper", defaultTuning("sniper"))).toEqual({ health: 8, damage: 2, shotDamage: 2 });
  });

  it("has a drawn snow look, low shots, and a pack enemy with art", () => {
    expect(lookProblems("sniper", snowEnemyLooks.sniper, "Sniper")).toEqual([]);
    expect(shotPoints(snowEnemyLooks.sniper)).toEqual({ guard: 9, shoot: 9 });
    const def = snowPack.things.find((d) => d.type === "sniper")!;
    expect(def).toMatchObject({ name: "Sniper", category: "enemy", behaviour: "sniper", shotYs: { shoot: 9 } });
    expect(snowArt.things.sniper).toHaveLength(2);
    expect(artProblems(snowArt, snowPack)).toEqual([]);
  });

  it("swaps with the Shield Guard keeping the drawing, both ways", () => {
    const sniper = lookForKind(snowEnemyLooks.shielded, "shielded", "sniper");
    expect(lookProblems("sniper", sniper, "Sniper")).toEqual([]);
    expect(sniper.animations.guard.frames).toEqual(snowEnemyLooks.shielded.animations.closed.frames);
    expect(lookProblems("shielded", lookForKind(sniper, "sniper", "shielded"), "Guard")).toEqual([]);
  });

  it("lets any enemy have 8 or 12 health, and leaves 5 alone", () => {
    let project = game();
    const run = (name: string, args: unknown) => {
      const result = applyCommand(project, { name, args }, { pack: snowPack });
      if (!result.ok) throw new Error(result.error);
      project = result.project;
    };
    run("addEnemy", { enemyId: "e1", name: "Fang", behaviour: "walker" });
    run("setEnemyTuning", { enemyId: "e1", health: 5 });
    expect(project.enemies[0].tuning.health).toBe(5);
    run("setEnemyTuning", { enemyId: "e1", health: 12 });
    expect(project.enemies[0].tuning.health).toBe(12);
  });
});
