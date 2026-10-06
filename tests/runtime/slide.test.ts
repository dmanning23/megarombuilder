import { describe, expect, it } from "vitest";
import type { Abilities } from "@/model/hero";
import type { Checkpoint } from "@/model/schema";
import { playerPose } from "@/runtime/render/art";
import { PLAYER_H, SLIDE_H } from "@/runtime/sim/constants";
import { createSim, type Sim } from "@/runtime/sim/state";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, rowWith, type ZoneArt } from "./helpers";
import { run, runUntil } from "./simHelpers";

function sim(zones: ZoneArt[], changes: Partial<Abilities> = { slide: true }, checkpoints: Checkpoint[] = []): Sim {
  const project = projectFromArt(zones, checkpoints);
  const hero = { ...project.hero, abilities: { ...project.hero.abilities, ...changes } };
  const s = createSim({ ...project, hero }, "L1", testPack);
  run(s, {}, 5); // land on the floor
  return s;
}

// Solid ground in rows 0 to 11 of columns `from` to `to`: a tunnel one tile high over the floor.
function tunnel(from: number, to: number): Record<number, string> {
  const cells: Record<number, string> = {};
  for (let c = from; c <= to; c++) cells[c] = "#";
  return Object.fromEntries(Array.from({ length: 12 }, (_, y) => [y, rowWith(cells)]));
}

const slideRight = (s: Sim) => {
  run(s, { right: true, down: true }, 1);
  run(s, { down: true, jump: true }, 1);
};
const standing = (s: Sim) => s.player.h === PLAYER_H && s.player.onGround && Math.abs(s.player.vx) < 0.01;

describe("sliding", () => {
  it("is an ordinary jump without the ability", () => {
    const s = sim([{ art: flatArt() }], {});
    run(s, { down: true, jump: true }, 1);
    expect(s.player.h).toBe(PLAYER_H);
    expect(s.player.vy).toBeLessThan(0);
  });

  it("goes low and fast, about four tiles, then stands up", () => {
    const s = sim([{ art: flatArt() }]);
    const start = s.player.x;
    slideRight(s);
    expect(s.player.h).toBe(SLIDE_H);
    expect(s.player.vx).toBeGreaterThan(1.875);
    expect(playerPose(s.player, s.steps).pose).toBe("slide");
    runUntil(s, {}, standing);
    expect(s.player.x - start).toBeGreaterThan(56);
    expect(s.player.x - start).toBeLessThan(76);
    expect(s.player.onGround).toBe(true);
  });

  it("fits through a one-tile gap that stops a walking hero", () => {
    const walker = sim([{ art: flatArt(tunnel(3, 4)) }]);
    run(walker, { right: true }, 60);
    expect(walker.player.x).toBe(3 * 16 - 14);

    const slider = sim([{ art: flatArt(tunnel(3, 4)) }]);
    slideRight(slider);
    runUntil(slider, {}, standing);
    expect(slider.player.x).toBeGreaterThanOrEqual(5 * 16);
  });

  it("keeps sliding under a long low ceiling until there is room to stand", () => {
    const s = sim([{ art: flatArt(tunnel(2, 9)) }]);
    slideRight(s);
    runUntil(s, {}, standing);
    expect(s.player.x).toBeGreaterThanOrEqual(10 * 16);
  });

  it("can turn round in a dead end and slide back out", () => {
    const dead = flatArt({ ...tunnel(2, 9), 12: rowWith({ 8: "#" }) }); // a wall at column 8 inside the tunnel
    const s = sim([{ art: dead }]);
    slideRight(s);
    run(s, {}, 60);
    expect(s.player.h).toBe(SLIDE_H); // stuck against the wall, no room to stand
    runUntil(s, { left: true }, (x) => x.player.h === PLAYER_H);
    expect(s.player.x).toBeLessThan(2 * 16);
  });

  it("stands up and falls when it slides off a ledge", () => {
    const ledge = flatArt({ 13: "###............." }); // shorter than one slide
    const s = sim([{ art: ledge }]);
    slideRight(s);
    runUntil(s, {}, standing);
    expect(s.player.h).toBe(PLAYER_H);
    expect(s.player.y).toBe(14 * 16 - PLAYER_H);
  });

  it("jumps out with room to stand", () => {
    const s = sim([{ art: flatArt() }]);
    slideRight(s);
    run(s, {}, 2);
    run(s, { jump: true }, 1);
    expect(s.player.h).toBe(PLAYER_H);
    expect(s.player.vy).toBeLessThan(0);
  });

  it("cannot start in the air", () => {
    const s = sim([{ art: flatArt() }]);
    run(s, { jump: true }, 5);
    run(s, { jump: false }, 1);
    run(s, { down: true, jump: true }, 1);
    expect(s.player.h).toBe(PLAYER_H);
  });

  it("cannot shoot while sliding", () => {
    const s = sim([{ art: flatArt() }]);
    slideRight(s);
    run(s, { shoot: true }, 1);
    expect(s.shots).toEqual([]);
  });

  it("saves a standing respawn point when it slides through a checkpoint", () => {
    const s = sim([{ art: flatArt() }], { slide: true }, [{ zoneId: "z1", x: 3, y: 12 }]);
    slideRight(s);
    runUntil(s, {}, standing);
    expect(s.respawn.y).toBe(13 * 16 - PLAYER_H);
  });

  it("stands up when it slides out of the zone", () => {
    const s = sim([{ art: flatArt() }, { art: flatArt() }]);
    runUntil(s, { right: true }, (x) => x.player.x > 190);
    run(s, { right: true, down: true }, 1);
    run(s, { down: true, jump: true }, 1);
    runUntil(s, {}, (x) => x.zoneIndex === 1);
    expect(s.player.h).toBe(PLAYER_H);
    expect(s.player.y + s.player.h).toBeLessThanOrEqual(13 * 16);
  });
});
