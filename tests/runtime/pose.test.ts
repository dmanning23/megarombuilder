import { describe, expect, it } from "vitest";
import type { Entity } from "@/runtime/sim/entities/types";
import { entityShotY, heroShotY } from "@/runtime/sim/pose";
import type { Player } from "@/runtime/sim/state";

const shotYs = { standShoot: 8, runShoot: 9, jumpShoot: 4, climb: 2, hurt: 12 };
const player = (o: Partial<Player> = {}): Player => ({
  x: 0, y: 0, vx: 0, vy: 0, w: 14, h: 22, facing: 1, onGround: true, onIce: false, onLadder: false,
  health: 28, hurt: 0, invuln: 0, knockback: 1, ridingId: null, shotTimer: 0, slide: 0, charge: 0, airSteps: 0, standH: 22, slideH: 14, shotYs,
  ...o,
});
const entity = (o: Partial<Entity> = {}): Entity => ({
  x: 0, y: 0, w: 14, h: 14, vx: 0, vy: 0, onGround: true, onIce: false,
  id: "t", type: "own-e1", behaviour: "shielded", facing: 1, health: 1, mode: "closed",
  timer: 0, attack: 0, homeX: 0, homeY: 0, dx: 0, dy: 0, flash: 0, modeSteps: 0, shotYs: { open: 1, closed: 7 }, settings: {},
  ...o,
});

describe("where shots come out", () => {
  it("is the shot point of the pose the hero fires in", () => {
    expect(heroShotY(player())).toBe(8);
    expect(heroShotY(player({ vx: 1.5 }))).toBe(9);
    expect(heroShotY(player({ onGround: false }))).toBe(4);
    expect(heroShotY(player({ onLadder: true, onGround: false }))).toBe(2); // on a ladder: Climb's
    expect(heroShotY(player({ hurt: 10 }))).toBe(12);
    expect(heroShotY(player({ shotYs: {} }))).toBe(8); // a pose without one: 8, as always
  });

  it("is the shot point of an enemy's pose, or its middle", () => {
    expect(entityShotY(entity({ mode: "open" }))).toBe(1);
    expect(entityShotY(entity({ shotYs: {} }))).toBe(4); // the middle of 14, for a 6-high shot
  });
});
