import { describe, expect, it } from "vitest";
import { getPack } from "@/content/packs";
import { exportFileName, projectToJson, readProjectText } from "@/editor/files";
import { newProject } from "@/editor/newProject";

let n = 0;
const makeId = () => `id-${++n}`;

describe("exportFileName", () => {
  it("is the game's name in lower case with dashes", () => {
    expect(exportFileName(newProject("Snow Fortress!", makeId))).toBe("snow-fortress.megarom.json");
    expect(exportFileName(newProject("???", makeId))).toBe("game.megarom.json");
  });
});

describe("readProjectText", () => {
  it("reads an exported game back, with a new id", () => {
    const game = newProject("Round Trip", makeId);
    const result = readProjectText(projectToJson(game), getPack, () => "fresh");
    expect(result).toEqual({ ok: true, project: { ...game, id: "fresh" } });
  });

  it("refuses text that is not JSON", () => {
    expect(readProjectText("not json {", getPack, makeId)).toEqual({
      ok: false,
      error: "This file isn't a MegaRomBuilder game.",
    });
  });

  it("refuses JSON that is not a game, or is from a newer version", () => {
    expect(readProjectText('{"hello": 1}', getPack, makeId).ok).toBe(false);
    const newer = { ...newProject("Future", makeId), formatVersion: 99 };
    const result = readProjectText(JSON.stringify(newer), getPack, makeId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/);
  });
});
