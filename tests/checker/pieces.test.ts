import { describe, expect, it } from "vitest";
import { checkZone } from "@/checker/check";
import { snowPack } from "@/content/snow/pack";
import { snowPieces } from "@/content/snow/pieces";
import { createProbe } from "@/checker/probe";
import { applyCommand } from "@/commands";
import { heroPhysics, JUMPS, SPEEDS } from "@/model/hero";
import { settingCombos, zoneWithPiece } from "./pieceHarness";

const EXPECTED = [
  "flat-run",
  "stairs-up",
  "stairs-down",
  "gap",
  "spike-pit",
  "spike-pit-platform",
  "ice-run",
  "ladder-climb",
  "ladder-turrets",
  "stepped-platforms",
  "enemy-gauntlet",
  "rest-area",
  "crawl-space",
];

describe("snow pieces", () => {
  it("are the snow pack's pieces", () => {
    expect(snowPack.pieces).toBe(snowPieces);
    for (const id of EXPECTED) expect(snowPieces.map((p) => p.id)).toContain(id);
  });

  it("are 15 rows high, fill every cell, and place only known things", () => {
    for (const piece of snowPieces) {
      for (const settings of settingCombos(piece)) {
        const built = piece.build(settings);
        const where = `${piece.id} ${JSON.stringify(settings)}`;
        expect(built.height, where).toBe(15);
        expect(built.tiles, where).toHaveLength(built.width * 15);
        expect(built.tiles.every((t) => t >= 0), where).toBe(true);
        for (const t of built.things) {
          expect(snowPack.things.map((d) => d.type), where).toContain(t.type);
        }
      }
    }
  });

  it("has thirteen pieces with different ids", () => {
    expect(snowPieces).toHaveLength(13);
    expect(new Set(snowPieces.map((p) => p.id)).size).toBe(13);
  });

  it("scale enemies with difficulty", () => {
    const gauntlet = snowPieces.find((p) => p.id === "enemy-gauntlet");
    const count = (difficulty: number) => gauntlet?.build({ width: 10, difficulty }).things.length ?? 0;
    expect(count(1)).toBeLessThan(count(2));
    expect(count(2)).toBeLessThan(count(3));
  });

  it("end ladder climbs higher by their height", () => {
    const climb = snowPieces.find((p) => p.id === "ladder-climb");
    expect(climb?.build({ height: 5 })).toMatchObject({ enterRow: 13, exitRow: 8 });
  });

  for (const piece of snowPieces) {
    it(`can be crossed: ${piece.id}, at every setting extreme`, () => {
      for (const settings of settingCombos(piece)) {
        const result = checkZone(zoneWithPiece(piece, settings), "L", "z", snowPack);
        expect(result.passable, `${piece.id} ${JSON.stringify(settings)}: ${result.reason}`).toBe(true);
      }
    });
  }

  it("say the right heights: stairs end higher, and a flat run does not", () => {
    const up = snowPieces.find((p) => p.id === "stairs-up");
    expect(up?.build({ steps: 3, rise: 2 })).toMatchObject({ enterRow: 13, exitRow: 7 });
    const down = snowPieces.find((p) => p.id === "stairs-down");
    expect(down?.build({ steps: 3, rise: 2 })).toMatchObject({ enterRow: 7, exitRow: 13 });
    expect(snowPieces.find((p) => p.id === "flat-run")?.build({ width: 6 })).toMatchObject({ enterRow: 13, exitRow: 13 });
  });

  for (const jump of JUMPS) {
    it(`can all be crossed by a hero with a ${jump} jump, at every speed`, () => {
      for (const speed of SPEEDS) {
        for (const piece of snowPieces) {
          for (const settings of settingCombos(piece)) {
            const project = zoneWithPiece(piece, settings);
            const hero = { ...project.hero, abilities: { ...project.hero.abilities, jump, speed } };
            const result = checkZone({ ...project, hero }, "L", "z", snowPack);
            expect(result.passable, `${piece.id} ${JSON.stringify(settings)} ${speed}: ${result.reason}`).toBe(true);
          }
        }
      }
    }, 120_000);
  }

  it("say which need slide, and a crawl space cannot be crossed without it", () => {
    const crawl = snowPieces.find((p) => p.id === "crawl-space")!;
    expect(crawl.needs).toBe("slide");
    expect(snowPieces.filter((p) => p.needs).map((p) => p.id)).toEqual(["crawl-space"]);
    const project = zoneWithPiece(crawl, { length: 4 });
    const noSlide = { ...project, hero: { ...project.hero, abilities: { ...project.hero.abilities, slide: false } } };
    const result = checkZone(noSlide, "L", "z", snowPack);
    expect(result.passable).toBe(false);
    expect(result.reason).toMatch(/too low to walk through\. Give your hero slide/);
  });

  it("build a crawl space one tile high under solid ground, with floor before and after", () => {
    const built = snowPieces.find((p) => p.id === "crawl-space")!.build({ length: 3 });
    expect(built.width).toBe(7);
    const at = (x: number, y: number) => built.tiles[y * built.width + x];
    expect([at(0, 12), at(1, 12), at(5, 12), at(6, 12)]).toEqual([0, 0, 0, 0]); // room to stand before and after
    for (let x = 2; x <= 4; x++) {
      expect(at(x, 12), `tunnel at ${x}`).toBe(0);
      expect(at(x, 11), `ceiling at ${x}`).not.toBe(0);
      expect(at(x, 0), `ceiling top at ${x}`).not.toBe(0);
    }
    for (let x = 0; x < 7; x++) expect(at(x, 13)).not.toBe(0);
  });

  it("can all be crossed by a tall hero (30 high), and the crawl space by it sliding", () => {
    for (const piece of snowPieces) {
      for (const settings of settingCombos(piece)) {
        let project = zoneWithPiece(piece, settings);
        for (const [name, args] of [
          ["resizeCanvas", { target: "hero", canvas: "main", w: 16, h: 32 }],
          ["setBody", { target: "hero", body: { x: 1, y: 2, w: 14, h: 30 } }],
        ] as const) {
          const result = applyCommand(project, { name, args }, { pack: snowPack });
          if (!result.ok) throw new Error(result.error);
          project = result.project;
        }
        const result = checkZone(project, "L", "z", snowPack);
        expect(result.passable, `${piece.id} ${JSON.stringify(settings)}: ${result.reason}`).toBe(true);
      }
    }
  }, 120_000);

  it("are checked with the kid's hero, not the pack's", () => {
    const flat = snowPieces.find((p) => p.id === "flat-run")!;
    let project = zoneWithPiece(flat, { width: 6 });
    const commands: [string, unknown][] = [
      ["resizeCanvas", { target: "hero", canvas: "main", w: 16, h: 32 }],
      ["setBody", { target: "hero", body: { x: 1, y: 2, w: 14, h: 30 } }],
    ];
    for (const [name, args] of commands) {
      const result = applyCommand(project, { name, args }, { pack: snowPack });
      if (!result.ok) throw new Error(result.error);
      project = result.project;
    }
    const zone = project.levels[0].zones[0];
    expect(createProbe(zone, snowPack, heroPhysics(project.hero.abilities), project.hero.look).sim.player.h).toBe(30);
    expect(createProbe(zone, snowPack, heroPhysics(project.hero.abilities)).sim.player.h).toBe(22);
  });
});
