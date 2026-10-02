import { describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { GROUND, snowPack } from "@/content/snow/pack";
import { artProblems } from "@/runtime/render/art";
import { spawnBox } from "@/runtime/sim/entities/spawn";

describe("the snow art", () => {
  it("covers every tile, thing and pose in the snow pack, with no broken sprites", () => {
    expect(artProblems(snowArt, snowPack)).toEqual([]);
  });

  it("caps ground tiles in both looks", () => {
    expect(snowArt.tiles.outdoor[GROUND].top).toBeDefined();
    expect(snowArt.tiles.cave[GROUND].top).toBeDefined();
    expect(snowArt.tiles.outdoor[GROUND].top).not.toEqual(snowArt.tiles.outdoor[GROUND].fill);
  });

  it("animates walkers and flyers with two frames, and gives the boss three", () => {
    expect(snowArt.things.walker).toHaveLength(2);
    expect(snowArt.things.flyer).toHaveLength(2);
    expect(snowArt.things.boss).toHaveLength(3);
  });

  it("draws the boss at the size of its box", () => {
    for (const frame of snowArt.things.boss) expect([frame.w, frame.h]).toEqual([24, 28]);
  });

  it("gives every player pose something to see", () => {
    for (const pose of Object.values(snowArt.player)) {
      expect(pose.rows.join("").replace(/\./g, "").length).toBeGreaterThan(50);
    }
  });

  // Drawn bottom-centred on its box, an enemy's visible pixels should fill the box, so contact and
  // hits happen where the player can see something.
  it("fills each enemy's and the boss's box with visible pixels", () => {
    const problems: string[] = [];
    for (const def of snowPack.things) {
      if (!["walker", "flyer", "turret", "jumper", "shielded", "dropper", "boss"].includes(def.behaviour)) continue;
      const box = spawnBox({ id: "t", type: def.type, x: 0, y: 0, settings: {} }, def.behaviour);
      snowArt.things[def.type].forEach((frame, i) => {
        const left = Math.round(box.w / 2 - frame.w / 2);
        const top = box.h - frame.h;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        frame.rows.forEach((row, y) =>
          [...row].forEach((ch, x) => {
            if (ch === ".") return;
            minX = Math.min(minX, x + left);
            maxX = Math.max(maxX, x + left);
            minY = Math.min(minY, y + top);
            maxY = Math.max(maxY, y + top);
          }),
        );
        const name = `${def.type} frame ${i}`;
        if (minY > 4) problems.push(`${name}: nothing visible in the top ${minY} rows of its box`);
        if (maxY < box.h - 3) problems.push(`${name}: nothing visible in the bottom ${box.h - 1 - maxY} rows of its box`);
        if (minX > 3 || maxX < box.w - 4) problems.push(`${name}: too narrow for its box`);
      });
    }
    expect(problems).toEqual([]);
  });
});
