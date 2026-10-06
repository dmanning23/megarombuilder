import { describe, expect, it } from "vitest";
import { createDemoProject, DEMO_LEVEL_ID } from "@/content/demo";
import { snowArt } from "@/content/snow/art";
import { snowPack } from "@/content/snow/pack";
import type { Abilities } from "@/model/hero";
import type { Sprite } from "@/runtime/render/art";
import { draw } from "@/runtime/render/draw";
import { heroArt } from "@/runtime/render/heroArt";
import { CHARGE_STEPS, CHARGED_H, CHARGED_W } from "@/runtime/sim/constants";
import { createSim, NO_INPUT, type Sim } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import type { Thing } from "@/model/schema";
import { testPack } from "../fixtures/testPack";
import { flatArt, projectFromArt, thing } from "./helpers";
import { entity, run } from "./simHelpers";

function sim(things: Thing[] = [], changes: Partial<Abilities> = { chargeShot: true }): Sim {
  const project = projectFromArt([{ art: flatArt(), things }]);
  const hero = { ...project.hero, abilities: { ...project.hero.abilities, ...changes } };
  const s = createSim({ ...project, hero }, "L1", testPack);
  run(s, {}, 5);
  return s;
}

// Holds shoot for `steps` steps, then lets go.
function hold(s: Sim, steps: number) {
  run(s, { shoot: true }, steps);
  run(s, {}, 1);
}

const charged = (s: Sim) => s.shots.filter((shot) => shot.charged);

describe("the charge shot", () => {
  it("fires a normal shot on a tap", () => {
    const s = sim();
    hold(s, 1);
    expect(s.shots).toHaveLength(1);
    expect(charged(s)).toEqual([]);
  });

  it("fires a charged shot when shoot is held for a second and let go", () => {
    const s = sim();
    hold(s, CHARGE_STEPS);
    expect(charged(s)).toHaveLength(1);
    expect(s.player.charge).toBe(0);
  });

  it("fires nothing more when let go too soon", () => {
    const s = sim();
    hold(s, CHARGE_STEPS - 10);
    expect(charged(s)).toEqual([]);
  });

  it("does not charge without the ability", () => {
    const s = sim([], {});
    hold(s, CHARGE_STEPS + 20);
    expect(charged(s)).toEqual([]);
    expect(s.player.charge).toBe(0);
  });

  it("fires even when the shots-on-screen limit is full", () => {
    const s = sim([], { chargeShot: true, shots: 1 });
    run(s, { shoot: true }, CHARGE_STEPS);
    s.shots = [{ x: 100, y: 100, vx: 0 }]; // the one allowed shot is on screen
    run(s, {}, 1);
    expect(charged(s)).toHaveLength(1);
  });

  it("forgets a charge let go during a zone change", () => {
    const project = projectFromArt([{ art: flatArt() }, { art: flatArt() }]);
    const hero = { ...project.hero, abilities: { ...project.hero.abilities, chargeShot: true } };
    const s = createSim({ ...project, hero }, "L1", testPack);
    run(s, {}, 5);
    let steps = 0;
    while (s.phase !== "transition" && steps++ < 400) run(s, { right: true, shoot: true }, 1);
    expect(s.phase).toBe("transition");
    run(s, {}, 1); // let go while the screen slides
    while (s.phase === "transition") run(s, {}, 1);
    expect(s.player.charge).toBe(0);
    hold(s, 1);
    expect(charged(s)).toEqual([]);
  });

  it("does 3 damage, and carries on through an enemy it destroys", () => {
    const s = sim([thing("turret", 8, 12, { interval: 1000 }), thing("turret", 11, 12, { interval: 1000 })]);
    run(s, { shoot: true }, CHARGE_STEPS); // the tap's normal shot hits the first turret: 3 → 2
    run(s, {}, 1);
    run(s, {}, 60);
    expect(s.slots.map((slot) => slot.entity)).toEqual([null, null]);
  });

  it("stops at an enemy it does not destroy", () => {
    const s = sim([thing("turret", 8, 12, { interval: 1000, health: 6 }), thing("turret", 11, 12, { interval: 1000 })]);
    run(s, { shoot: true }, CHARGE_STEPS);
    run(s, {}, 1);
    run(s, {}, 60);
    expect(s.slots[0].entity?.health).toBe(2); // 6 - 1 - 3
    expect(s.slots[1].entity?.health).toBe(3);
    expect(s.shots).toEqual([]);
  });

  it("is stopped by a shield", () => {
    const s = sim([thing("shielded", 8, 12)]);
    run(s, { shoot: true }, CHARGE_STEPS);
    run(s, {}, 1);
    run(s, {}, 40);
    expect(entity(s, "shielded")?.health).toBe(2);
  });

  it("is a 12 by 10 shot", () => {
    const s = sim();
    hold(s, CHARGE_STEPS);
    const shot = charged(s)[0];
    expect(shot.x).toBe(s.player.x + s.player.w + shot.vx); // in front of the hero, one step on
    expect([CHARGED_W, CHARGED_H]).toEqual([12, 10]);
  });
});

describe("drawing the charge", () => {
  const hero = heroArt(createDemoProject().hero.look);
  type Drawn = { sprite: Sprite; flip: boolean; flash?: boolean };

  function drawn(prepare: (s: Sim) => void): Drawn[] {
    const project = createDemoProject();
    const hero2 = { ...project.hero, abilities: { ...project.hero.abilities, chargeShot: true } };
    const s = createSim({ ...project, hero: hero2 }, DEMO_LEVEL_ID, snowPack);
    step(s, NO_INPUT);
    prepare(s);
    const images: Drawn[] = [];
    const ctx = {
      fillStyle: "",
      font: "",
      textAlign: "start" as CanvasTextAlign,
      fillRect: () => {},
      fillText: () => {},
      drawImage: (image: CanvasImageSource) => images.push(image as unknown as Drawn),
    };
    const image = (sprite: Sprite, flip: boolean) => ({ sprite, flip }) as unknown as CanvasImageSource;
    const flashImage = (sprite: Sprite, flip: boolean) => ({ sprite, flip, flash: true }) as unknown as CanvasImageSource;
    draw(ctx, s, { set: snowArt, image, hero: { art: hero, image, flashImage } });
    return images;
  }

  it("blinks the hero white once fully charged", () => {
    const flashing = drawn((s) => {
      s.player.charge = CHARGE_STEPS;
      s.steps = 0;
    });
    expect(flashing).toContainEqual({ sprite: hero.poses.stand, flip: false, flash: true });
    const between = drawn((s) => {
      s.player.charge = CHARGE_STEPS;
      s.steps = 4;
    });
    expect(between).toContainEqual({ sprite: hero.poses.stand, flip: false });
  });

  it("draws charged shots with the charged-shot picture", () => {
    const images = drawn((s) => s.shots.push({ x: 60, y: 180, vx: 4, charged: true }));
    expect(images).toContainEqual({ sprite: hero.chargedShot, flip: false });
  });
});
