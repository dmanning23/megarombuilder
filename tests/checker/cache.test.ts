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

  it("checks again when the player's settings change", () => {
    const cache = createCheckCache();
    const project = game();
    const first = cache.zone(project, "L1", "z1", pack);
    const faster = { ...project, player: { ...project.player, runSpeed: project.player.runSpeed + 0.25 } };
    expect(cache.zone(faster, "L1", "z1", pack)).not.toBe(first);
  });

  it("checks a whole level the same way checkLevel does", () => {
    const project = game();
    expect(createCheckCache().level(project, "L1", pack)).toEqual(checkLevel(project, "L1", pack));
  });

  it("says when the level does not exist", () => {
    expect(() => createCheckCache().level(game(), "nope", pack)).toThrow(/no level/);
  });
});
