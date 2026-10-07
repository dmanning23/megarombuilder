import { describe, expect, it } from "vitest";
import { checkUnchecked, executeTool, findZone, startTurn, uncheckedZones, type ToolContext } from "@/ai/execute";
import { createCheckCache } from "@/checker/cache";
import { SPIKE } from "@/content/snow/pack";
import { counter, game, pack, run } from "./helpers";

const context = (): ToolContext => ({ pack, makeId: counter(), checks: createCheckCache() });
const tileAt = (project: ReturnType<typeof game>, zoneId: string, x: number, y: number) => {
  const zone = project.levels[0].zones.find((z) => z.id === zoneId)!;
  return zone.tiles[y * (zone.screens * 16) + x];
};

describe("findZone", () => {
  const level = game().levels[0];

  it("finds a zone by id, or by name ignoring case and extra spaces", () => {
    expect(findZone(level, "corridor")).toMatchObject({ id: "corridor" });
    expect(findZone(level, "  boss   ROOM ")).toMatchObject({ id: "boss" });
  });

  it("lists the real zones when the name is wrong", () => {
    expect(findZone(level, "Ice Cave")).toBe(
      'There is no zone called "Ice Cave". The zones are: "Zone 1", "Boss Corridor", "Boss Room".',
    );
  });
});

describe("executeTool", () => {
  it("names the kid's enemies in a zone, and lists their designs in the level overview", () => {
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 6, y: 12 });
    const state = startTurn(project, "L1");
    const ctx = context();
    expect(executeTool(state, "get_zone", { zone: "Zone 1" }, ctx).content).toContain("- t1: Frost Fang, yours (own-e1) at (6, 12)");
    expect(executeTool(state, "get_level_overview", {}, ctx).content).toContain("- own-e1: Frost Fang, a walker");
  });

  it("shows a zone, the level and the catalogue without changing anything", () => {
    const state = startTurn(game(), "L1");
    const ctx = context();
    const zone = executeTool(state, "get_zone", { zone: "zone 1" }, ctx);
    expect(zone).toMatchObject({ isError: false, command: null, activity: "Looking at Zone 1…" });
    expect(zone.content).toContain('Zone "Zone 1" (id z1)');
    expect(zone.state).toBe(state);
    expect(executeTool(state, "get_level_overview", {}, ctx).content).toContain('3. "Boss Room"');
    expect(executeTool(state, "get_catalogue", {}, ctx).content).toContain("- flat-run:");
  });

  it("includes the hero in the level overview", () => {
    expect(executeTool(startTurn(game(), "L1"), "get_level_overview", {}, context()).content).toContain("Your hero runs at normal speed");
  });

  it("changes the hero's abilities, says what it can do now, and counts every zone as changed", () => {
    const out = executeTool(startTurn(game(), "L1"), "set_hero_abilities", { slide: true, jump: "high" }, context());
    expect(out).toMatchObject({ isError: false, activity: "Changing your hero…" });
    expect(out.command).toEqual({ name: "setHeroAbilities", args: { slide: true, jump: "high" } });
    expect(out.content).toBe("Done. Your hero runs at normal speed, jumps onto ledges up to 3 tiles high, has 28 health and can have 3 shots on screen. It can slide under gaps one tile high. It has no charge shot.");
    expect(out.state.project.hero.abilities).toMatchObject({ slide: true, jump: "high" });
    expect(uncheckedZones(out.state)).toEqual(["z1", "corridor", "boss"]);
  });

  it("refuses ability steps that don't exist, a level id, and nothing at all", () => {
    const state = startTurn(game(), "L1");
    for (const input of [{ jump: "huge" }, { shots: 4 }, { slide: true, levelId: "L1" }]) {
      const out = executeTool(state, "set_hero_abilities", input, context());
      expect(out.isError, JSON.stringify(input)).toBe(true);
      expect(out.state).toBe(state);
    }
    expect(executeTool(state, "set_hero_abilities", {}, context()).content).toBe("Give at least one ability to change.");
  });

  it("makes a change with the zone's id filled in, and returns the command for the editor", () => {
    const out = executeTool(startTurn(game(), "L1"), "fill_rect", { zone: "Zone 1", x: 3, y: 13, w: 2, h: 1, tile: SPIKE }, context());
    expect(out).toMatchObject({ isError: false, content: "Done.", activity: "Building Zone 1…" });
    expect(out.command).toEqual({
      name: "fillRect",
      args: { levelId: "L1", zoneId: "z1", x: 3, y: 13, w: 2, h: 1, tile: SPIKE },
    });
    expect(tileAt(out.state.project, "z1", 4, 13)).toBe(SPIKE);
    expect(uncheckedZones(out.state)).toEqual(["z1"]);
  });

  it("makes up ids for new zones and things, and says what they are", () => {
    const ctx = context();
    const added = executeTool(startTurn(game(), "L1"), "add_zone", { name: "Ice Cave" }, ctx);
    expect(added.content).toBe("Done. The new zone's id is id-1.");
    expect(added.state.project.levels[0].zones.map((z) => z.id)).toEqual(["z1", "id-1", "corridor", "boss"]);
    expect(uncheckedZones(added.state)).toEqual(["id-1"]);

    const placed = executeTool(added.state, "place_thing", { zone: "Ice Cave", type: "walker", x: 6, y: 12 }, ctx);
    expect(placed.content).toBe("Done. The new thing's id is id-2.");
    expect(placed.command).toMatchObject({ name: "placeThing", args: { zoneId: "id-1", thingId: "id-2" } });

    const piece = executeTool(placed.state, "insert_piece", { zone: "Zone 1", pieceId: "enemy-gauntlet", x: 0, y: 0 }, ctx);
    expect(piece.content).toBe("Done. Any things the piece added have ids starting with id-3-.");
  });

  it("returns a readable error for bad input and changes nothing", () => {
    const state = startTurn(game(), "L1");
    const ctx = context();
    const fraction = executeTool(state, "fill_rect", { zone: "Zone 1", x: 1.5, y: 12, w: 1, h: 1, tile: 1 }, ctx);
    expect(fraction).toMatchObject({ isError: true, command: null });
    expect(fraction.content).toMatch(/^Invalid input for fill_rect: x: /);
    expect(fraction.state).toBe(state);

    const extra = executeTool(state, "get_zone", { zone: "Zone 1", levelId: "L1" }, ctx);
    expect(extra.content).toMatch(/^Invalid input for get_zone: .*levelId/);

    const nowhere = executeTool(state, "get_zone", { zone: "Ice Cave" }, ctx);
    expect(nowhere).toMatchObject({ isError: true, content: expect.stringContaining('no zone called "Ice Cave"') });

    expect(executeTool(state, "launch_rocket", {}, ctx)).toMatchObject({
      isError: true,
      content: 'There is no tool called "launch_rocket".',
    });
  });

  it("passes on the command's own error and changes nothing", () => {
    const state = startTurn(game(), "L1");
    const out = executeTool(state, "fill_rect", { zone: "Zone 1", x: 15, y: 12, w: 4, h: 1, tile: 1 }, context());
    expect(out.isError).toBe(true);
    expect(out.content).toMatch(/Zone 1/);
    expect(out.state).toBe(state);
    expect(uncheckedZones(out.state)).toEqual([]);
  });

  it("counts a zone as checked once check_zone or check_level has run since its last change", () => {
    const ctx = context();
    let state = executeTool(startTurn(game(), "L1"), "fill_rect", { zone: "Zone 1", x: 3, y: 13, w: 1, h: 1, tile: SPIKE }, ctx).state;
    state = executeTool(state, "set_zone_intent", { zone: "Boss Corridor", intent: "a calm walk" }, ctx).state;
    expect(uncheckedZones(state)).toEqual(["z1", "corridor"]);

    const one = executeTool(state, "check_zone", { zone: "Zone 1" }, ctx);
    expect(one.content).toContain('"Zone 1" passes');
    expect(one.activity).toBe("Checking Zone 1…");
    expect(uncheckedZones(one.state)).toEqual(["corridor"]);

    const all = executeTool(one.state, "check_level", {}, ctx);
    expect(all.content).toContain('"Boss Room"');
    expect(all.content).toContain("No problems with how the zones connect.");
    expect(uncheckedZones(all.state)).toEqual([]);

    const again = executeTool(all.state, "fill_rect", { zone: "Zone 1", x: 4, y: 13, w: 1, h: 1, tile: SPIKE }, ctx);
    expect(uncheckedZones(again.state)).toEqual(["z1"]);
  });

  it("forgets a changed zone once it is removed", () => {
    const ctx = context();
    let state = executeTool(startTurn(game(), "L1"), "add_zone", { name: "Ice Cave" }, ctx).state;
    state = executeTool(state, "remove_zone", { zone: "Ice Cave" }, ctx).state;
    expect(uncheckedZones(state)).toEqual([]);
  });

  it("says planning while it changes the level's plan", () => {
    const out = executeTool(startTurn(game(), "L1"), "set_level_brief", { brief: "A frozen fortress." }, context());
    expect(out.activity).toBe("Planning the level…");
    expect(uncheckedZones(out.state)).toEqual([]);
  });
});

describe("checkUnchecked", () => {
  it("checks every changed zone that has not been checked, and marks them checked", () => {
    const ctx = context();
    let state = startTurn(game(), "L1");
    expect(checkUnchecked(state, ctx)).toBeNull();
    state = executeTool(state, "fill_rect", { zone: "Zone 1", x: 8, y: 0, w: 1, h: 13, tile: 1 }, ctx).state;
    const forced = checkUnchecked(state, ctx)!;
    expect(forced.text).toContain("From the editor, not the user:");
    expect(forced.text).toContain('"Zone 1" FAILS');
    expect(forced.text).toContain("fix it and check it again");
    expect(uncheckedZones(forced.state)).toEqual([]);
  });
});
