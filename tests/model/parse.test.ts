import { describe, expect, it } from "vitest";
import { createLevel, createProject } from "@/model/factory";
import { parseProject } from "@/model/parse";
import type { Project } from "@/model/schema";
import { testPack } from "../fixtures/testPack";

const getPack = (id: string) => (id === "test" ? testPack : undefined);

function project(): Project {
  return {
    ...createProject({ id: "p1", name: "Game" }, testPack),
    levels: [createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack)],
  };
}

function errorOf(raw: unknown): string {
  const result = parseProject(raw, getPack);
  if (result.ok) throw new Error("expected a failure");
  return result.error;
}

describe("parseProject", () => {
  it("round-trips a project through JSON", () => {
    const original = project();
    const result = parseProject(JSON.parse(JSON.stringify(original)), getPack);
    expect(result).toEqual({ ok: true, project: original });
  });

  it("refuses things that are not a project file", () => {
    for (const raw of ["hello", null, undefined, 42, [1, 2, 3]]) {
      expect(errorOf(raw)).toMatch(/not a MegaRomBuilder project/);
    }
  });

  it("refuses an object with no format version", () => {
    expect(errorOf({ name: "x" })).toMatch(/not a MegaRomBuilder project/);
  });

  it("refuses a project from a newer version", () => {
    expect(errorOf({ ...project(), formatVersion: 2 })).toMatch(/newer version/);
  });

  it("explains which field is wrong when the shape is bad", () => {
    const bad = { ...project(), name: 5 };
    expect(errorOf(bad)).toMatch(/name/);
  });

  it("refuses a project whose content pack is missing", () => {
    expect(errorOf({ ...project(), contentPackId: "lava" })).toMatch(/content pack "lava"/);
  });

  it("refuses a project that breaks a hard rule", () => {
    const p = project();
    const zones = p.levels[0].zones.map((z, i) => (i === 0 ? { ...z, tiles: [0] } : z));
    const bad = { ...p, levels: [{ ...p.levels[0], zones }] };
    expect(errorOf(bad)).toMatch(/has 1 tiles but its size needs 240/);
  });
});
