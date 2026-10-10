import { describe, expect, it } from "vitest";
import { applyCommand } from "@/commands";
import { snowPack } from "@/content/snow/pack";
import { createCheckCache } from "@/checker/cache";
import { placeOn } from "@/runtime/render/draw";
import { lookSprites } from "@/runtime/render/lookArt";
import { createSim, NO_INPUT } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { game } from "../ai/helpers";

const press = (keys: Partial<typeof NO_INPUT>) => ({ ...NO_INPUT, ...keys });
function apply(project: ReturnType<typeof game>, commands: [string, unknown][]) {
  for (const [name, args] of commands) {
    const result = applyCommand(project, { name, args }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    project = result.project;
  }
  return project;
}
// The snow hero with a big Jump and shoot (24 by 28) that fires from 4, and a Stand and shoot that fires from 14.
const posedGame = () =>
  apply(game(), [
    ["resizePose", { target: "hero", animation: "jumpShoot", w: 24, h: 28 }],
    ["setShotY", { target: "hero", animation: "jumpShoot", y: 4 }],
    ["setShotY", { target: "hero", animation: "standShoot", y: 14 }],
    ["setShotY", { target: "hero", animation: "climb", y: 2 }],
  ]);
const land = (sim: ReturnType<typeof createSim>) => {
  for (let i = 0; i < 120 && !sim.player.onGround; i++) step(sim, NO_INPUT);
};

describe("each pose in the game", () => {
  it("fires from Stand and shoot's shot point on the ground and Jump and shoot's in the air", () => {
    const sim = createSim(posedGame(), "L1", snowPack);
    land(sim);
    step(sim, press({ shoot: true }));
    expect(sim.shots[0].y).toBe(sim.player.y + 14);
    step(sim, NO_INPUT);
    step(sim, press({ jump: true }));
    step(sim, press({ jump: true }));
    expect(sim.player.onGround).toBe(false);
    step(sim, press({ jump: true, shoot: true }));
    expect(sim.shots.at(-1)!.y).toBe(sim.player.y + 4);
  });

  it("keeps the body's size and collisions whatever the poses' pictures", () => {
    const plain = createSim(game(), "L1", snowPack);
    const posed = createSim(posedGame(), "L1", snowPack);
    const moves = [press({ right: true }), press({ right: true, jump: true }), press({ left: true, shoot: true }), NO_INPUT];
    for (let i = 0; i < 240; i++) {
      const input = moves[Math.floor(i / 30) % moves.length];
      step(plain, input);
      step(posed, input);
    }
    expect([posed.player.x, posed.player.y, posed.player.w, posed.player.h]).toEqual([plain.player.x, plain.player.y, plain.player.w, plain.player.h]);
  });

  it("draws a pose so its hitbox lies on the body, facing either way", () => {
    const sprites = lookSprites(posedGame().hero.look, "hero");
    const jump = sprites.jumpShoot;
    expect(jump.size).toEqual({ w: 24, h: 28 });
    expect(jump.box).toEqual({ x: 5, y: 6, w: 14, h: 22 });
    const body = { x: 100, y: 50, w: 14, h: 22 };
    expect(placeOn(body, jump.box!, jump.size.w, false)).toEqual({ x: 95, y: 44 });
    expect(placeOn(body, jump.box!, jump.size.w, true)).toEqual({ x: 95, y: 44 }); // centred hitbox: mirroring keeps it
  });

  it("checks the level again when only one pose's shot point changes", () => {
    const cache = createCheckCache();
    const project = game();
    const levelId = project.levels[0].id;
    const zoneId = project.levels[0].zones[0].id;
    const first = cache.zone(project, levelId, zoneId, snowPack);
    const drawn = apply(project, [["setFrame", { target: "hero", animation: "stand", frame: 0, rows: project.hero.look.animations.stand.frames[0] }]]);
    expect(cache.zone(drawn, levelId, zoneId, snowPack)).toBe(first); // drawing alone needs no new check
    const moved = apply(drawn, [["setShotY", { target: "hero", animation: "climb", y: 3 }]]);
    expect(cache.zone(moved, levelId, zoneId, snowPack)).not.toBe(first);
  });
});
