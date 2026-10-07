import { describe, expect, it } from "vitest";
import { createHistory, runCommand, undo } from "@/commands/history";
import { testBossLook } from "../fixtures/testPack";
import { baseProject, ctx, run, runError } from "./helpers";

const frame = (ch: string) => Array.from({ length: 28 }, () => ch.repeat(24));

// The base project's boss room ("boss") with the test pack's boss in it.
function withSnowBoss() {
  return run(baseProject(), "placeThing", { levelId: "L1", zoneId: "boss", thingId: "b1", type: "boss", x: 10, y: 12 });
}
const bossThing = (project: ReturnType<typeof baseProject>) => project.levels[0].zones[2].things[0];

describe("createBoss", () => {
  it("makes a boss starting from the pack's boss drawing and the Blizzard Bot's attacks", () => {
    const project = run(baseProject(), "createBoss", { name: "  Volt   Viper " });
    expect(project.boss).toEqual({ name: "Volt Viper", fight: "normal", attacks: ["jump", "spread", "dash"], look: testBossLook });
    expect(runError(project, "createBoss", { name: "Another" })).toBe("Your game already has a boss of its own.");
  });
});

describe("changing the boss", () => {
  it("renames it, sets its fight and its attacks", () => {
    let project = run(baseProject(), "createBoss", { name: "Volt Viper" });
    project = run(project, "setBoss", { fight: "long", attacks: ["rain", "big"], name: "Volt King" });
    expect(project.boss).toMatchObject({ name: "Volt King", fight: "long", attacks: ["rain", "big"] });
    expect(runError(project, "setBoss", { attacks: ["rain"] })).toMatch(/attacks/);
    expect(runError(project, "setBoss", { attacks: ["rain", "big", "jump", "dash"] })).toMatch(/attacks/);
    expect(runError(project, "setBoss", {})).toBe("Give something about the boss to change.");
    expect(runError(baseProject(), "setBoss", { fight: "short" })).toBe("Your game has no boss of its own yet.");
  });

  it("draws frames and recolours, refusing to drop a used colour", () => {
    let project = run(baseProject(), "createBoss", { name: "Volt Viper" });
    project = run(project, "setBossColours", { colours: [13, 20] });
    project = run(project, "setBossFrame", { frame: 2, rows: frame("2") });
    expect(project.boss?.look.frames[2]).toEqual(frame("2"));
    expect(runError(project, "setBossColours", { colours: [13] })).toBe("Colour 2 is still used in Volt Viper's frame 3.");
    expect(runError(project, "setBossFrame", { frame: 0, rows: ["1"] })).toBe("Volt Viper frame 1 is not 24 by 28 pixels.");
  });
});

describe("using the kid's boss in the boss room", () => {
  it("swaps the boss both ways, keeping its id and place", () => {
    let project = run(withSnowBoss(), "createBoss", { name: "Volt Viper" });
    project = run(project, "useBoss", { boss: "yours" });
    expect(bossThing(project)).toEqual({ id: "b1", type: "own-boss", x: 10, y: 12, settings: {} });
    project = run(project, "useBoss", { boss: "snow" });
    expect(bossThing(project)).toMatchObject({ id: "b1", type: "boss", x: 10, y: 12 });
  });

  it("is one undo step", () => {
    const start = run(withSnowBoss(), "createBoss", { name: "Volt Viper" });
    const history = createHistory(start);
    const { history: swapped } = runCommand(history, { name: "useBoss", args: { boss: "yours" } }, ctx);
    expect(undo(swapped).project).toBe(start);
  });

  it("refuses with no boss of its own, or nothing placed to swap", () => {
    expect(runError(withSnowBoss(), "useBoss", { boss: "yours" })).toBe("Your game has no boss of its own yet.");
    expect(runError(run(baseProject(), "createBoss", { name: "V" }), "useBoss", { boss: "yours" })).toBe(
      "There is no boss in a boss room to swap. Put one there first.",
    );
  });
});

describe("removeBoss", () => {
  it("removes the kid's boss when it isn't in use", () => {
    expect(run(run(baseProject(), "createBoss", { name: "V" }), "removeBoss", {}).boss).toBeNull();
  });

  it("refuses while it is in the boss room", () => {
    let project = run(withSnowBoss(), "createBoss", { name: "Volt Viper" });
    project = run(project, "useBoss", { boss: "yours" });
    expect(runError(project, "removeBoss", {})).toBe("Volt Viper is in Boss Room. Put the Boss back first.");
  });
});
