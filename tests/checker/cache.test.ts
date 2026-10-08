import { describe, expect, it } from "vitest";
import { createCheckCache } from "@/checker/cache";
import { checkLevel } from "@/checker/check";
import { applyCommand, type Command } from "@/commands";
import { snowPack } from "@/content/snow/pack";
import { createLevel, createProject } from "@/model/factory";
import type { Project } from "@/model/schema";

const pack = snowPack;

function game(): Project {
  return {
    ...createProject({ id: "p1", name: "Game" }, pack),
    levels: [createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["z1", "corridor", "boss"] }, pack)],
  };
}

function run(project: Project, command: Command): Project {
  const result = applyCommand(project, command, { pack });
  if (!result.ok) throw new Error(result.error);
  return result.project;
}

describe("createCheckCache", () => {
  it("returns the same check for a zone that has not changed", () => {
    const cache = createCheckCache();
    const project = game();
    const first = cache.zone(project, "L1", "z1", pack);
    const later = run(project, { name: "renameZone", args: { levelId: "L1", zoneId: "corridor", name: "Long Hall" } });
    expect(cache.zone(later, "L1", "z1", pack)).toBe(first);
  });

  it("checks a zone again after it changes", () => {
    const cache = createCheckCache();
    const project = game();
    const first = cache.zone(project, "L1", "z1", pack);
    const walled = run(project, { name: "fillRect", args: { levelId: "L1", zoneId: "z1", x: 8, y: 0, w: 1, h: 13, tile: 1 } });
    const again = cache.zone(walled, "L1", "z1", pack);
    expect(first.passable).toBe(true);
    expect(again.passable).toBe(false);
  });

  it("checks again when the hero's abilities change, but not its look", () => {
    const cache = createCheckCache();
    const project = game();
    const first = cache.zone(project, "L1", "z1", pack);
    const recoloured = { ...project, hero: { ...project.hero, look: { ...project.hero.look, colours: [0, 1, 2, 3, 4, 5, 6] } } };
    expect(cache.zone(recoloured, "L1", "z1", pack)).toBe(first);
    const lowJump = { ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, jump: "low" as const } } };
    expect(cache.zone(lowJump, "L1", "z1", pack)).not.toBe(first);
  });

  it("finds a zone that fails with a lower jump, and passes it again when the jump is put back", () => {
    const cache = createCheckCache();
    const walled = run(game(), { name: "fillRect", args: { levelId: "L1", zoneId: "z1", x: 8, y: 10, w: 2, h: 3, tile: 1 } });
    const withJump = (jump: "low" | "high") => ({
      ...walled,
      hero: { ...walled.hero, abilities: { ...walled.hero.abilities, jump } },
    });
    const high = withJump("high");
    expect(cache.zone(high, "L1", "z1", pack).passable).toBe(true);
    expect(cache.zone(withJump("low"), "L1", "z1", pack).passable).toBe(false);
    expect(cache.zone(high, "L1", "z1", pack).passable).toBe(true); // undo brings back the same abilities
  });

  it("checks a whole level the same way checkLevel does", () => {
    const project = game();
    expect(createCheckCache().level(project, "L1", pack)).toEqual(checkLevel(project, "L1", pack));
  });

  it("says when the level does not exist", () => {
    expect(() => createCheckCache().level(game(), "nope", pack)).toThrow(/no level/);
  });

  it("checks again when the kid's enemies change", () => {
    const cache = createCheckCache();
    const project = run(game(), { name: "addEnemy", args: { enemyId: "e1", name: "Fang", behaviour: "walker" } });
    const first = cache.zone(project, "L1", "z1", pack);
    const tuned = run(project, { name: "setEnemyTuning", args: { enemyId: "e1", speed: "fast" } });
    expect(cache.zone(tuned, "L1", "z1", pack)).not.toBe(first);
  });

  it("checks a zone again after the hero's look changes", () => {
    const cache = createCheckCache();
    const project = game();
    const first = cache.zone(project, "L1", "z1", pack);
    const narrow = run(project, { name: "setBody", args: { target: "hero", body: { x: 2, y: 2, w: 12, h: 22 } } });
    expect(cache.zone(narrow, "L1", "z1", pack)).not.toBe(first);
  });

  it("checks a zone again after the kid's boss changes", () => {
    const cache = createCheckCache();
    let project = run(game(), { name: "createBoss", args: { name: "Volt Viper" } });
    const first = cache.zone(project, "L1", "boss", pack);
    project = run(project, { name: "resizeCanvas", args: { target: "boss", canvas: "main", w: 32, h: 32 } });
    expect(cache.zone(project, "L1", "boss", pack)).not.toBe(first);
  });
});
