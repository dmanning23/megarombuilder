import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commandDefs } from "@/commands/registry";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

const BANNED = [/from "react/, /from "next/, /\bdocument\./, /\bwindow\./, /Math\.random/, /randomUUID/];

describe("headless core", () => {
  it("keeps React, Next.js, the DOM and randomness out of model, commands, the simulation, the checker and the assistant", () => {
    const offenders: string[] = [];
    for (const file of [
      ...sourceFiles("src/model"),
      ...sourceFiles("src/commands"),
      ...sourceFiles("src/runtime/sim"),
      ...sourceFiles("src/checker"),
      ...sourceFiles("src/ai"),
    ]) {
      const text = readFileSync(file, "utf8");
      for (const pattern of BANNED) {
        if (pattern.test(text)) offenders.push(`${file} matches ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("command registry", () => {
  it("has every command in the spec, each with a description, and no duplicates", () => {
    const names = commandDefs.map((d) => d.name);
    expect([...names].sort()).toEqual(
      [
        "createLevel", "renameLevel", "setLevelBrief", "deleteLevel",
        "addZone", "removeZone", "moveZone", "renameZone", "resizeZone",
        "setZoneVariant", "setZoneIntent", "setZoneOpenings",
        "setTiles", "fillRect", "clearRect",
        "placeThing", "moveThing", "removeThing", "setThingSettings",
        "insertPiece",
        "addCheckpoint", "removeCheckpoint",
        "setHeroAbilities", "setHeroColours", "setHeroPose", "resetHeroLook",
        "addEnemy", "renameEnemy", "setEnemyBehaviour", "setEnemyTuning", "setEnemyColours", "setEnemyFrame", "removeEnemy",
        "createBoss", "setBoss", "setBossColours", "setBossFrame", "useBoss", "removeBoss",
      ].sort(),
    );
    for (const def of commandDefs) expect(def.description.length).toBeGreaterThan(10);
  });
});

describe("API key", () => {
  it("keeps the Anthropic SDK and the chat server code out of everything the browser loads", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src")) {
      if (file.startsWith(join("src", "ai", "server")) || file.startsWith(join("src", "app", "api"))) continue;
      const text = readFileSync(file, "utf8");
      if (/^import (?!type )[^;]*from "@anthropic-ai\/sdk"/m.test(text)) offenders.push(`${file} imports the SDK`);
      if (/from "@\/ai\/server/.test(text)) offenders.push(`${file} imports server code`);
      if (/ANTHROPIC_API_KEY/.test(text)) offenders.push(`${file} mentions the API key`);
    }
    expect(offenders).toEqual([]);
  });
});
