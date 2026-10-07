import { describe, expect, it } from "vitest";
import {
  bossDesignSchema,
  defaultTuning,
  ENEMY_BEHAVIOURS,
  enemyDesignSchema,
  framesProblems,
  lettersToLook,
  tuningSettings,
  TUNING_USED,
  type EnemyDesign,
} from "@/model/designs";
import { lookProblems } from "@/model/look";
import { designLookFrom } from "@/model/lookUpgrade";
import { nearestColour, PALETTE_8BIT } from "@/model/palette";

const solid = (ch = "1") => Array.from({ length: 16 }, () => ch.repeat(16));

function design(changes: Partial<EnemyDesign> = {}): EnemyDesign {
  return {
    id: "e1",
    name: "Frost Fang",
    behaviour: "walker",
    tuning: defaultTuning("walker"),
    look: designLookFrom("walker", { colours: [13], frames: [solid(), solid()] }),
    ...changes,
  };
}

describe("enemy tuning", () => {
  it("gives a normal enemy the snow enemy's own numbers", () => {
    expect(tuningSettings("walker", defaultTuning("walker"))).toEqual({ health: 1, damage: 2, speed: 0.5 });
    expect(tuningSettings("flyer", defaultTuning("flyer"))).toEqual({ health: 1, damage: 2, speed: 0.75 });
    expect(tuningSettings("turret", defaultTuning("turret"))).toEqual({ health: 3, damage: 2, interval: 90, shotDamage: 2 });
    expect(tuningSettings("jumper", defaultTuning("jumper"))).toEqual({ health: 2, damage: 2, hop: 1 });
    expect(tuningSettings("shielded", defaultTuning("shielded"))).toEqual({
      health: 2,
      damage: 2,
      speed: 0.4,
      interval: 120,
      shotDamage: 2,
    });
    expect(tuningSettings("dropper", defaultTuning("dropper"))).toEqual({ health: 1, damage: 2 });
  });

  it("turns each step into its number", () => {
    const walker = (changes: object) => tuningSettings("walker", { ...defaultTuning("walker"), ...changes });
    expect(walker({ speed: "slow" }).speed).toBeCloseTo(0.5 * (2 / 3));
    expect(walker({ speed: "fast" }).speed).toBe(0.75);
    expect([walker({ damage: "low" }).damage, walker({ damage: "high" }).damage]).toEqual([1, 4]);
    expect(walker({ health: 5 }).health).toBe(5);
    const turret = (shoots: "rarely" | "often") => tuningSettings("turret", { ...defaultTuning("turret"), shoots });
    expect([turret("rarely").interval, turret("often").interval]).toEqual([180, 45]);
    expect(tuningSettings("turret", { ...defaultTuning("turret"), damage: "high" }).shotDamage).toBe(4);
  });

  it("names the steps each behaviour uses", () => {
    expect(TUNING_USED.walker).toEqual(["health", "damage", "speed"]);
    expect(TUNING_USED.turret).toEqual(["health", "damage", "shoots"]);
    expect(TUNING_USED.shielded).toEqual(["health", "damage", "speed", "shoots"]);
    expect(TUNING_USED.dropper).toEqual(["health", "damage"]);
    expect(Object.keys(TUNING_USED).sort()).toEqual([...ENEMY_BEHAVIOURS].sort());
  });
});

describe("design schemas", () => {
  it("accept a complete enemy and refuse unknown behaviours, steps and too many colours", () => {
    expect(enemyDesignSchema.safeParse(design()).success).toBe(true);
    expect(enemyDesignSchema.safeParse({ ...design(), behaviour: "dragon" }).success).toBe(false);
    expect(enemyDesignSchema.safeParse({ ...design(), tuning: { ...design().tuning, health: 4 } }).success).toBe(false);
    expect(enemyDesignSchema.safeParse({ ...design(), look: { ...design().look, colours: Array.from({ length: 17 }, (_, i) => i) } }).success).toBe(false);
    expect(lookProblems("walker", { ...design().look, animations: {} }, "Frost Fang")).toEqual(["Frost Fang has no Walk animation."]);
    expect(enemyDesignSchema.safeParse({ ...design(), name: "" }).success).toBe(false);
  });

  it("accept a boss with two or three attacks, and no other number", () => {
    const frame = Array.from({ length: 28 }, () => "1".repeat(24));
    const boss = { name: "Volt Viper", fight: "normal", attacks: ["jump", "rain"], look: designLookFrom("boss", { colours: [13], frames: [frame, frame, frame] }) };
    expect(bossDesignSchema.safeParse(boss).success).toBe(true);
    expect(bossDesignSchema.safeParse({ ...boss, attacks: ["jump", "dash", "spread", "big"] }).success).toBe(false);
    expect(bossDesignSchema.safeParse({ ...boss, attacks: ["jump"] }).success).toBe(false);
    expect(bossDesignSchema.safeParse({ ...boss, attacks: ["jump", "fireworks"] }).success).toBe(false);
  });
});

describe("framesProblems", () => {
  it("finds nothing wrong with a good look", () => {
    expect(framesProblems("Frost Fang", { colours: [13], frames: [solid(), solid()] }, { w: 16, h: 16 })).toEqual([]);
  });

  it("names a frame of the wrong size, an odd pixel, or a missing colour", () => {
    expect(framesProblems("Frost Fang", { colours: [13], frames: [solid(), ["1"]] }, { w: 16, h: 16 })).toEqual([
      "Frost Fang frame 2 is not 16 by 16 pixels.",
    ]);
    expect(framesProblems("Frost Fang", { colours: [13], frames: [solid("x"), solid()] }, { w: 16, h: 16 })).toEqual([
      'Frost Fang frame 1 has a pixel "x" that is not a colour.',
    ]);
    expect(framesProblems("Frost Fang", { colours: [13], frames: [solid(), solid("2")] }, { w: 16, h: 16 })).toEqual([
      "Frost Fang frame 2 uses colour 2, but Frost Fang only has 1 colour.",
    ]);
  });
});

describe("lettersToLook", () => {
  it("snaps each letter's colour to the palette and shares slots for letters that snap together", () => {
    const look = lettersToLook([["kw", "nk"], ["wk", "kn"]], { k: "#1a1c2c", w: "#f4f4f4", n: "#f8fafc" });
    expect(look.colours).toEqual([nearestColour("#1a1c2c"), nearestColour("#f4f4f4")]);
    expect(look.frames).toEqual([["12", "21"], ["21", "12"]]);
  });

  it("keeps see-through pixels, names slots past 9 with letters, and refuses more than sixteen colours", () => {
    expect(lettersToLook([[".k"]], { k: "#000000" }).frames).toEqual([[".1"]]);
    const letters = "ABCDEFGHIJKLMNOPQ";
    const many = Object.fromEntries([...letters].map((ch, i) => [ch, PALETTE_8BIT[i * 3]]));
    expect(lettersToLook([[letters.slice(0, 16)]], many).frames).toEqual([["123456789abcdefg"]]);
    expect(() => lettersToLook([[letters]], many)).toThrow(/more than 16 colours/);
  });
});
