import { applyCommand, type Command } from "@/commands";
import { snowPack } from "@/content/snow/pack";
import { GROUND } from "@/content/snow/tiles";
import type { PieceDef } from "@/model/contentPack";
import { createLevel, createProject } from "@/model/factory";
import type { Project } from "@/model/schema";

// Each setting at its minimum, default and maximum, in every combination.
export function settingCombos(piece: PieceDef): Record<string, number>[] {
  let combos: Record<string, number>[] = [{}];
  for (const s of piece.settings) {
    const values = [...new Set([s.min, s.default, s.max])];
    combos = combos.flatMap((c) => values.map((v) => ({ ...c, [s.key]: v })));
  }
  return combos;
}

// A one-level project whose zone "z" is: floor, the piece, floor, at the heights the piece says.
export function zoneWithPiece(piece: PieceDef, settings: Record<string, number>): Project {
  const built = piece.build(settings);
  const enter = built.enterRow ?? 13;
  const exit = built.exitRow ?? 13;
  const used = 3 + built.width + 3;
  const screens = Math.ceil(used / 16);
  const width = screens * 16;
  const L = "L";
  const commands: Command[] = [
    { name: "resizeZone", args: { levelId: L, zoneId: "z", screens } },
    { name: "clearRect", args: { levelId: L, zoneId: "z", x: 0, y: 0, w: width, h: 15 } },
    { name: "fillRect", args: { levelId: L, zoneId: "z", x: 0, y: enter, w: 3, h: 15 - enter, tile: GROUND } },
    { name: "insertPiece", args: { levelId: L, zoneId: "z", pieceId: piece.id, x: 3, y: 0, settings, idPrefix: "p" } },
    {
      name: "fillRect",
      args: { levelId: L, zoneId: "z", x: 3 + built.width, y: exit, w: width - 3 - built.width, h: 15 - exit, tile: GROUND },
    },
    {
      name: "setZoneOpenings",
      args: {
        levelId: L,
        zoneId: "z",
        entry: { edge: "left", from: enter - 4, to: enter - 1 },
        exit: { edge: "right", from: exit - 4, to: exit - 1 },
      },
    },
  ];
  let project: Project = {
    ...createProject({ id: "p", name: "Pieces" }, snowPack),
    levels: [createLevel({ id: L, name: "Pieces", zoneIds: ["z", "corridor", "boss"] }, snowPack)],
  };
  for (const command of commands) {
    const result = applyCommand(project, command, { pack: snowPack });
    if (!result.ok) throw new Error(`${piece.id}: ${command.name} failed: ${result.error}`);
    project = result.project;
  }
  // A piece that needs a move is checked with a hero that has it.
  if (piece.needs !== "slide") return project;
  return { ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, slide: true } } };
}
