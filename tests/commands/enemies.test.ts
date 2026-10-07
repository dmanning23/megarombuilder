import { describe, expect, it } from "vitest";
import { createHistory, runCommand, undo } from "@/commands/history";
import { defaultTuning } from "@/model/designs";
import { testEnemyLooks } from "../fixtures/testPack";
import { baseProject, ctx, run, runError } from "./helpers";

const add = (project = baseProject(), enemyId = "e1", name = "Frost Fang", behaviour = "walker") =>
  run(project, "addEnemy", { enemyId, name, behaviour });
const place = (project: ReturnType<typeof baseProject>, zoneId = "z1", thingId = "t1") =>
  run(project, "placeThing", { levelId: "L1", zoneId, thingId, type: "own-e1", x: 3, y: 12 });
const solid = (ch: string) => Array.from({ length: 16 }, () => ch.repeat(16));

describe("addEnemy", () => {
  it("adds an enemy starting from the pack's drawing for its behaviour", () => {
    const project = add(baseProject(), "e1", "  Frost   Fang ", "turret");
    expect(project.enemies).toEqual([
      { id: "e1", name: "Frost Fang", behaviour: "turret", tuning: defaultTuning("turret"), look: testEnemyLooks.turret },
    ]);
  });

  it("refuses a used id or name, and a thirteenth enemy", () => {
    const one = add();
    expect(runError(one, "addEnemy", { enemyId: "e1", name: "Other", behaviour: "walker" })).toBe(
      'There is already an enemy with the id "e1".',
    );
    expect(runError(one, "addEnemy", { enemyId: "e2", name: "frost fang", behaviour: "walker" })).toBe(
      'There is already an enemy called "Frost Fang".',
    );
    let many = baseProject();
    for (let i = 0; i < 12; i++) many = add(many, `e${i}`, `Enemy ${i}`);
    expect(runError(many, "addEnemy", { enemyId: "e99", name: "One more", behaviour: "walker" })).toBe(
      "A game can have up to 12 enemies of its own.",
    );
  });
});

describe("changing an enemy", () => {
  it("renames, changes behaviour and tunes, keeping everything else", () => {
    let project = add();
    project = run(project, "renameEnemy", { enemyId: "e1", name: "Ice Fang" });
    project = run(project, "setEnemyBehaviour", { enemyId: "e1", behaviour: "jumper" });
    project = run(project, "setEnemyTuning", { enemyId: "e1", speed: "fast", health: 5, shoots: undefined });
    expect(project.enemies[0]).toMatchObject({
      name: "Ice Fang",
      behaviour: "jumper",
      tuning: { ...defaultTuning("walker"), speed: "fast", health: 5 },
      look: testEnemyLooks.walker,
    });
    expect(runError(project, "setEnemyTuning", { enemyId: "e1" })).toBe("Give at least one step to change.");
    expect(runError(project, "renameEnemy", { enemyId: "nope", name: "X" })).toBe('There is no enemy with the id "nope".');
  });

  it("draws frames and recolours, refusing to drop a colour that is used", () => {
    let project = add();
    project = run(project, "setEnemyColours", { enemyId: "e1", colours: [13, 20] });
    project = run(project, "setEnemyFrame", { enemyId: "e1", frame: 1, rows: solid("2") });
    expect(project.enemies[0].look.frames[1]).toEqual(solid("2"));
    expect(runError(project, "setEnemyColours", { enemyId: "e1", colours: [13] })).toBe(
      "Colour 2 is still used in Frost Fang's frame 2.",
    );
    expect(runError(project, "setEnemyFrame", { enemyId: "e1", frame: 0, rows: ["1"] })).toBe(
      "Frost Fang frame 1 is not 16 by 16 pixels.",
    );
    expect(runError(project, "setEnemyFrame", { enemyId: "e1", frame: 2, rows: solid("1") })).toMatch(/frame/);
  });
});

describe("placing and removing an enemy", () => {
  it("places an own enemy with only its own settings, so its tuning stays live", () => {
    const project = place(add());
    expect(project.levels[0].zones[0].things[0]).toEqual({ id: "t1", type: "own-e1", x: 3, y: 12, settings: {} });
  });

  it("refuses to remove an enemy that is placed, naming the zones", () => {
    let project = place(add());
    project = place(project, "corridor", "t2");
    expect(runError(project, "removeEnemy", { enemyId: "e1" })).toBe(
      "Frost Fang is used in Zone 1 and Boss Corridor.",
    );
  });

  it("names the level too when the enemy is used in more than one", () => {
    let project = place(add());
    project = run(project, "createLevel", { levelId: "L2", name: "Ice Stage", zoneIds: ["a", "b", "c"] });
    project = run(project, "placeThing", { levelId: "L2", zoneId: "a", thingId: "t9", type: "own-e1", x: 3, y: 12 });
    expect(runError(project, "removeEnemy", { enemyId: "e1" })).toBe(
      "Frost Fang is used in Zone 1 in Snow Stage and Zone 1 in Ice Stage.",
    );
  });

  it("removes an enemy that isn't placed", () => {
    expect(run(add(), "removeEnemy", { enemyId: "e1" }).enemies).toEqual([]);
  });

  it("undoes exactly", () => {
    const history = createHistory(baseProject());
    const { history: added } = runCommand(history, { name: "addEnemy", args: { enemyId: "e1", name: "Fang", behaviour: "flyer" } }, ctx);
    expect(undo(added).project).toBe(history.project);
  });
});
