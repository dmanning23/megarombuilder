import { describe, expect, it } from "vitest";
import { applyCommand, type Command } from "@/commands";
import { checkLevel, checkZone } from "@/checker/check";
import { createDemoProject, DEMO_LEVEL_ID } from "@/content/demo";
import { snowPack } from "@/content/snow/pack";
import { createLevel, createProject } from "@/model/factory";
import type { Project } from "@/model/schema";

// An eight-screen zone built from a run of pieces that keep the floor level.
function longZone(): Project {
  const pieces: [string, Record<string, number>][] = [
    ["gap", { width: 3 }],
    ["stepped-platforms", { width: 8 }],
    ["spike-pit", { width: 5 }],
    ["ice-run", { width: 12, difficulty: 3 }],
    ["enemy-gauntlet", { width: 14, difficulty: 3 }],
    ["spike-pit-platform", { width: 8 }],
    ["gap", { width: 2 }],
    ["stepped-platforms", { width: 6 }],
    ["spike-pit", { width: 4 }],
    ["flat-run", { width: 16 }],
  ];
  let project: Project = {
    ...createProject({ id: "p", name: "Long" }, snowPack),
    levels: [createLevel({ id: "L", name: "Long", zoneIds: ["z", "corridor", "boss"] }, snowPack)],
  };
  const commands: Command[] = [{ name: "resizeZone", args: { levelId: "L", zoneId: "z", screens: 8 } }];
  let x = 2;
  pieces.forEach(([pieceId, settings], i) => {
    const piece = snowPack.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new Error(pieceId);
    commands.push({ name: "insertPiece", args: { levelId: "L", zoneId: "z", pieceId, x, y: 0, settings, idPrefix: `p${i}` } });
    x += piece.build(settings).width;
  });
  for (const command of commands) {
    const result = applyCommand(project, command, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
  }
  return project;
}

describe("checker speed", () => {
  it("checks the whole demo level in under 3 seconds", () => {
    const started = performance.now();
    checkLevel(createDemoProject(), DEMO_LEVEL_ID, snowPack);
    expect(performance.now() - started).toBeLessThan(3000);
  });

  it("checks an eight-screen zone of pieces in under 3 seconds, and finds it passable", () => {
    const project = longZone();
    const started = performance.now();
    const result = checkZone(project, "L", "z", snowPack);
    expect(performance.now() - started).toBeLessThan(3000);
    expect(result.passable, result.reason ?? "").toBe(true);
  });
});
