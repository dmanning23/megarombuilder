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
  it("keeps React, Next.js, the DOM and randomness out of model, commands, the simulation and the checker", () => {
    const offenders: string[] = [];
    for (const file of [
      ...sourceFiles("src/model"),
      ...sourceFiles("src/commands"),
      ...sourceFiles("src/runtime/sim"),
      ...sourceFiles("src/checker"),
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
      ].sort(),
    );
    for (const def of commandDefs) expect(def.description.length).toBeGreaterThan(10);
  });
});
