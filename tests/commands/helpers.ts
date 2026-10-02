import { expect } from "vitest";
import { applyCommand } from "@/commands/registry";
import type { CommandContext } from "@/commands/types";
import { createLevel, createProject } from "@/model/factory";
import { projectSchema, type Project, type Zone } from "@/model/schema";
import { structureProblems } from "@/model/validate";
import { testPack } from "../fixtures/testPack";

export const ctx: CommandContext = { pack: testPack };

// One level "L1" with zones z1 ("Zone 1"), corridor and boss.
export function baseProject(): Project {
  return {
    ...createProject({ id: "p1", name: "Game" }, testPack),
    levels: [
      createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["z1", "corridor", "boss"] }, testPack),
    ],
  };
}

// Runs a command that must succeed, and checks it left a project that could be saved and reopened.
export function run(project: Project, name: string, args: unknown): Project {
  const result = applyCommand(project, { name, args }, ctx);
  if (!result.ok) throw new Error(`${name} failed: ${result.error}`);
  expect(structureProblems(result.project, testPack)).toEqual([]);
  projectSchema.parse(result.project);
  return result.project;
}

// Runs a command that must fail, and returns its error message.
export function runError(project: Project, name: string, args: unknown): string {
  const result = applyCommand(project, { name, args }, ctx);
  if (result.ok) throw new Error(`${name} should have failed`);
  return result.error;
}

export function zoneOf(project: Project, zoneId: string): Zone {
  const zone = project.levels[0].zones.find((z) => z.id === zoneId);
  if (!zone) throw new Error(`no zone ${zoneId}`);
  return zone;
}

export function patchZone(project: Project, zoneId: string, patch: Partial<Zone>): Project {
  const level = project.levels[0];
  const zones = level.zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z));
  return { ...project, levels: [{ ...level, zones }, ...project.levels.slice(1)] };
}
