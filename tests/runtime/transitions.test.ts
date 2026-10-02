import { describe, expect, it } from "vitest";
import { RESPAWN_STEPS, TRANSITION_STEPS } from "@/runtime/sim/constants";
import { flatArt, rowWith, type ZoneArt } from "./helpers";
import { makeSim, run, runUntil, standOn } from "./simHelpers";

const FLOOR_Y = 13 * 16 - 22;
const inZone = (index: number) => (s: { zoneIndex: number }) => s.zoneIndex === index;

// A zone with a ladder in column 4 running to the top, and its exit there.
function ladderUp(): ZoneArt {
  const overrides: Record<number, string> = {};
  for (let y = 0; y <= 12; y++) overrides[y] = rowWith({ 4: "H" });
  return { art: flatArt(overrides), exit: { edge: "top", from: 4, to: 5 } };
}

// A two-screen vertical zone entered from below, with a ladder in column 7.
function shaft(withLadder: boolean): ZoneArt {
  const art = Array.from({ length: 30 }, () => (withLadder ? rowWith({ 7: "H" }) : rowWith({})));
  return { art, entry: { edge: "bottom", from: 7, to: 8 } };
}

describe("leaving by the right edge", () => {
  it("moves to the next zone at the same height", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt() }]);
    runUntil(sim, { right: true }, inZone(1));
    expect(sim.phase).toBe("transition");
    expect(sim.timer).toBe(TRANSITION_STEPS);
    expect(sim.transition).toMatchObject({ fromIndex: 0, direction: "right" });
    expect(sim.transition?.fromCamera).toEqual({ x: 0, y: 0 });
    expect(sim.map.zone.id).toBe("z2");
    expect(sim.player).toMatchObject({ x: 2, y: FLOOR_Y });
  });

  it("freezes everything during the transition, then resumes", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt() }]);
    runUntil(sim, { right: true }, inZone(1));
    run(sim, { right: true }, TRANSITION_STEPS - 1);
    expect(sim.phase).toBe("transition");
    expect(sim.player.x).toBe(2);
    run(sim, { right: true }, 1);
    expect(sim.phase).toBe("play");
    expect(sim.transition).toBeNull();
    run(sim, { right: true }, 1);
    expect(sim.player.x).toBe(2 + 1.375);
  });

  it("keeps the player's height within the opening", () => {
    const raised = flatArt({ 9: "#".repeat(16) });
    const sim = makeSim([
      { art: raised, entry: { edge: "left", from: 5, to: 8 }, exit: { edge: "right", from: 5, to: 8 } },
      { art: flatArt() },
    ]);
    expect(sim.player.y).toBe(9 * 16 - 22);
    runUntil(sim, { right: true }, inZone(1));
    // feet were at the bottom of a four-tile opening, so they arrive at the bottom of the next one
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("clears shots", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt() }]);
    sim.player.x = 200;
    run(sim, { right: true, shoot: true }, 1);
    expect(sim.shots).toHaveLength(1);
    runUntil(sim, { right: true }, inZone(1));
    expect(sim.shots).toEqual([]);
  });

  it("does not jump after the transition because jump was held through it", () => {
    const sim = makeSim([{ art: flatArt() }, { art: flatArt() }]);
    sim.player.x = 230;
    run(sim, {}, 1);
    runUntil(sim, { right: true }, inZone(1));
    run(sim, { jump: true }, TRANSITION_STEPS + 10);
    expect(sim.phase).toBe("play");
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("is blocked outside the opening's rows", () => {
    const sim = makeSim([
      { art: flatArt(), exit: { edge: "right", from: 2, to: 5 } },
      { art: flatArt() },
    ]);
    run(sim, { right: true }, 300);
    expect(sim.zoneIndex).toBe(0);
    expect(sim.player.x).toBe(256 - 14);
  });
});

describe("leaving by the top", () => {
  it("climbs into the next zone and stays on the ladder", () => {
    const sim = makeSim([ladderUp(), shaft(true)]);
    standOn(sim, 4, 13);
    runUntil(sim, { up: true }, inZone(1));
    expect(sim.transition).toMatchObject({ fromIndex: 0, direction: "up" });
    expect(sim.player.x).toBe(7 * 16 + 1);
    expect(sim.player.y).toBe(480 - 22);
    expect(sim.player.onLadder).toBe(true);
    run(sim, { up: true }, TRANSITION_STEPS + 10);
    expect(sim.player.y).toBe(480 - 22 - 10 * 1.25);
  });

  it("does not trigger outside the opening's columns", () => {
    const sim = makeSim([{ ...ladderUp(), exit: { edge: "top", from: 10, to: 11 } }, shaft(true)]);
    standOn(sim, 4, 13);
    run(sim, { up: true }, 300);
    expect(sim.zoneIndex).toBe(0);
  });

  it("kills and respawns a player who arrives with nothing to stand on", () => {
    const sim = makeSim([ladderUp(), shaft(false)]);
    standOn(sim, 4, 13);
    runUntil(sim, { up: true }, inZone(1));
    runUntil(sim, {}, (s) => s.phase === "dead", TRANSITION_STEPS + 60);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.phase).toBe("play");
    expect(sim.zoneIndex).toBe(0);
    expect(sim.player).toMatchObject({ x: 2, y: FLOOR_Y });
  });
});

describe("leaving by the bottom", () => {
  const holed = flatArt({ 13: "####..##########", 14: "####..##########" });

  it("falls into the next zone from the top", () => {
    const sim = makeSim([
      { art: holed, exit: { edge: "bottom", from: 4, to: 5 } },
      { art: flatArt(), entry: { edge: "top", from: 4, to: 5 } },
    ]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, inZone(1), 120);
    expect(sim.transition).toMatchObject({ fromIndex: 0, direction: "down" });
    expect(sim.player).toMatchObject({ x: 65, y: 0 });
    run(sim, {}, TRANSITION_STEPS + 60);
    expect(sim.player.y).toBe(FLOOR_Y);
  });

  it("is a deadly pit outside the opening's columns", () => {
    const sim = makeSim([
      { art: holed, exit: { edge: "bottom", from: 10, to: 11 } },
      { art: flatArt(), entry: { edge: "top", from: 10, to: 11 } },
    ]);
    standOn(sim, 4, 13);
    runUntil(sim, {}, (s) => s.phase === "dead", 120);
    expect(sim.zoneIndex).toBe(0);
  });
});

describe("edge cases", () => {
  it("has no way out of the boss room", () => {
    const sim = makeSim([{ art: flatArt() }], [], "boss");
    run(sim, { right: true }, 300);
    expect(sim.zoneIndex).toBe(2);
    expect(sim.player.x).toBe(256 - 14);
  });

  it("places the player at the next entry even when the edges do not pair", () => {
    const sim = makeSim([{ art: flatArt() }, shaft(true)]);
    runUntil(sim, { right: true }, inZone(1));
    expect(sim.phase).toBe("transition");
    expect(sim.player.y).toBe(480 - 22);
    // nothing to stand on there, so the player falls, dies and respawns at the start
    runUntil(sim, {}, (s) => s.phase === "dead", TRANSITION_STEPS + 60);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.zoneIndex).toBe(0);
  });

  it("kills a player who arrives inside solid tiles, instead of trapping them", () => {
    const blocked: Record<number, string> = {};
    for (let y = 0; y <= 12; y++) blocked[y] = "###.............";
    const sim = makeSim([{ art: flatArt() }, { art: flatArt(blocked) }]);
    runUntil(sim, { right: true }, inZone(1));
    runUntil(sim, { right: true }, (s) => s.phase === "dead", TRANSITION_STEPS + 5);
    run(sim, {}, RESPAWN_STEPS);
    expect(sim.zoneIndex).toBe(0);
    expect(sim.phase).toBe("play");
  });

  it("cannot jump in mid-air on arriving where there is no floor", () => {
    const noFloor = flatArt({ 13: "....############", 14: "....############" });
    const sim = makeSim([{ art: flatArt() }, { art: noFloor }]);
    runUntil(sim, { right: true }, inZone(1));
    run(sim, {}, TRANSITION_STEPS);
    run(sim, { jump: true }, 1);
    expect(sim.player.vy).toBeGreaterThan(0);
  });

  it("cannot climb down out of the bottom of a zone entered from below", () => {
    const sim = makeSim([ladderUp(), shaft(true)]);
    standOn(sim, 4, 13);
    runUntil(sim, { up: true }, inZone(1));
    run(sim, { down: true }, TRANSITION_STEPS + 30);
    expect(sim.phase).toBe("play");
    expect(sim.player.onLadder).toBe(true);
    expect(sim.player.y).toBe(480 - 22);
  });

  it("can still climb down through a bottom exit", () => {
    const overrides: Record<number, string> = {};
    for (let y = 5; y <= 14; y++) overrides[y] = rowWith({ 4: "H" }, 16).replace(/\./g, y >= 13 ? "#" : ".");
    const sim = makeSim([
      { art: flatArt(overrides), exit: { edge: "bottom", from: 4, to: 5 } },
      { art: flatArt(), entry: { edge: "top", from: 4, to: 5 } },
    ]);
    standOn(sim, 4, 5);
    runUntil(sim, { down: true }, inZone(1), 300);
    expect(sim.transition).toMatchObject({ direction: "down" });
  });

  it("walks the whole default chain to the boss room", () => {
    const sim = makeSim([{ art: flatArt() }]);
    runUntil(sim, { right: true }, inZone(2), 1000);
    expect(sim.map.zone.kind).toBe("bossRoom");
  });
});
