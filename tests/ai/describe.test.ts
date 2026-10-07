import { describe, expect, it } from "vitest";
import { describeCatalogue, describeCheck, describeDesigns, describeHero, describeLevel, describeZone, tileChar } from "@/ai/describe";
import { gamePack } from "@/model/gamePack";
import { DEFAULT_ABILITIES, HEALTHS, JUMPS, SHOT_COUNTS, SPEEDS, type Abilities } from "@/model/hero";
import { createCheckCache } from "@/checker/cache";
import type { ZoneCheck } from "@/checker/check";
import { SPIKE } from "@/content/snow/pack";
import type { Project } from "@/model/schema";
import { game, pack, run } from "./helpers";

const level = (project: Project) => project.levels[0];
const zone = (project: Project, id: string) => level(project).zones.find((z) => z.id === id)!;

describe("tileChar", () => {
  it("draws each kind of tile with its legend character", () => {
    expect(tileChar(pack, 0)).toBe(".");
    expect(pack.tiles.map((t) => tileChar(pack, t.id)).sort().join("")).toBe("#=H^~");
    expect(tileChar(pack, 99)).toBe("?");
  });
});

describe("describeZone", () => {
  it("shows the zone's facts, a legend and a numbered grid", () => {
    const text = describeZone(level(game()), zone(game(), "z1"), pack);
    const lines = text.split("\n");
    expect(text).toContain('Zone "Zone 1" (id z1), number 1 of 3, a normal zone.');
    expect(text).toContain("Sideways, 1 screen: 16 tiles wide and 15 tiles high.");
    expect(text).toContain("Way in: left edge, rows 9 to 12. Way out: right edge, rows 9 to 12.");
    expect(text).toContain("Legend: . empty   # solid   ~ ice   H ladder   ^ spike   = one-way");
    expect(lines).toContain("              111111");
    expect(lines).toContain("    0123456789012345");
    expect(lines).toContain(" 0  ................");
    expect(lines).toContain("13  ################");
    expect(lines).toContain("14  ################");
  });

  it("shows tiles, things and checkpoints where they are", () => {
    let project = run(game(), "fillRect", { levelId: "L1", zoneId: "z1", x: 5, y: 12, w: 1, h: 1, tile: SPIKE });
    project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "walker", x: 3, y: 12 });
    project = run(project, "addCheckpoint", { levelId: "L1", zoneId: "z1", x: 8, y: 12 });
    const text = describeZone(level(project), zone(project, "z1"), pack);
    expect(text.split("\n")).toContain("12  .....^..........");
    expect(text).toContain("- t1: Snow Crawler (walker) at (3, 12)");
    expect(text).toContain("Checkpoints: (8, 12)");
  });

  it("says when a zone has no things, no checkpoints, no purpose and no way out", () => {
    const text = describeZone(level(game()), zone(game(), "corridor"), pack);
    expect(text).toContain("Things: none");
    expect(text).toContain("Checkpoints: none");
    expect(text).toContain("Purpose: not set");
    const boss = describeZone(level(game()), zone(game(), "boss"), pack);
    expect(boss).toContain("Way out: none");
    expect(boss).toContain("a boss room");
  });

  it("numbers the columns of a long zone in tens", () => {
    const project = run(game(), "resizeZone", { levelId: "L1", zoneId: "z1", screens: 2 });
    const lines = describeZone(level(project), zone(project, "z1"), pack).split("\n");
    expect(lines).toContain("              1111111111222222222233");
    expect(lines).toContain("    01234567890123456789012345678901");
  });
});

describe("describeCheck", () => {
  const base: ZoneCheck = {
    zoneId: "z1",
    name: "Ice Cave",
    passable: true,
    difficulty: 4,
    reason: null,
    furthest: null,
    warnings: [],
  };

  it("says a zone passes, with its difficulty and warnings", () => {
    expect(describeCheck({ ...base, warnings: ["The Snow Crawler at (2, 12) is right where the player arrives."] })).toBe(
      '"Ice Cave" passes: the player can get from the way in to the way out. Difficulty 4 of 10.\n' +
        "Warning: The Snow Crawler at (2, 12) is right where the player arrives.",
    );
  });

  it("says why a zone fails and how far the player gets", () => {
    expect(
      describeCheck({ ...base, passable: false, reason: "The wall at column 8 is too high to jump.", furthest: { x: 7, y: 12 } }),
    ).toBe('"Ice Cave" FAILS: The wall at column 8 is too high to jump. The player gets as far as x 7, y 12.');
  });
});

describe("describeLevel", () => {
  it("lists the brief and every zone in order with its verdict", () => {
    let project = run(game(), "setLevelBrief", { levelId: "L1", brief: "A frozen fortress." });
    project = run(project, "fillRect", { levelId: "L1", zoneId: "z1", x: 8, y: 0, w: 1, h: 13, tile: 1 });
    const text = describeLevel(level(project), createCheckCache().level(project, "L1", pack));
    expect(text).toContain('Level "Snow Stage".');
    expect(text).toContain("Brief: A frozen fortress.");
    expect(text).toMatch(/1\. "Zone 1" \(id z1\): normal zone, sideways, 1 screen \(16 by 15 tiles\), look \w+; purpose: not set; FAILS the check\./);
    expect(text).toMatch(/2\. "Boss Corridor" \(id corridor\): boss corridor, .*; passes, difficulty \d+ of 10\./);
    expect(text).toContain('3. "Boss Room" (id boss): boss room');
    expect(text).toContain("No problems with how the zones connect.");
    expect(text).toContain("Checkpoints: none");
  });

  it("lists problems with how the zones connect", () => {
    const project = run(game(), "setZoneOpenings", { levelId: "L1", zoneId: "z1", exit: { edge: "right", from: 5, to: 6 } });
    const text = describeLevel(level(project), createCheckCache().level(project, "L1", pack));
    expect(text).toContain("Problems with how the zones connect:");
    expect(text).toMatch(/- The exit of "Zone 1" is 2 tiles long/);
  });
});

describe("describeCatalogue", () => {
  it("lists every tile, thing and piece, and how far the player can jump", () => {
    const text = describeCatalogue(game(), pack);
    for (const tile of pack.tiles) expect(text).toContain(`- ${tile.id}: ${tile.name}`);
    for (const thing of pack.things) expect(text).toContain(`- ${thing.type}: ${thing.name}`);
    for (const piece of pack.pieces) expect(text).toContain(`- ${piece.id}: ${piece.name}.`);
    expect(text).toContain("It can jump across gaps up to 3 tiles wide.");
    expect(text).toMatch(/- crawl-space: Crawl space\. .* Needs slide\./);
    expect(text).toMatch(/- gap: .* tiles wide at its default settings\. Settings: width \d+ to \d+ \(default \d+\)/);
  });
});

describe("describeHero", () => {
  const withAbilities = (changes: Partial<Abilities>) => {
    const project = game();
    return { ...project, hero: { ...project.hero, abilities: { ...DEFAULT_ABILITIES, ...changes } } };
  };

  it("says what a new hero can do", () => {
    expect(describeHero(game())).toBe(
      "Your hero runs at normal speed, jumps onto ledges up to 2 tiles high, has 28 health and can have 3 shots on screen. It can't slide. It has no charge shot.",
    );
  });

  it("says what a hero with every move can do", () => {
    expect(describeHero(withAbilities({ speed: "veryFast", jump: "veryHigh", health: "tough", shots: 1, slide: true, chargeShot: true }))).toBe(
      "Your hero runs very fast, jumps onto ledges up to 4 tiles high, has 40 health and can have 1 shot on screen. It can slide under gaps one tile high. It has a charge shot.",
    );
  });

  it("reads well for every step", () => {
    for (const speed of SPEEDS)
      for (const jump of JUMPS)
        for (const health of HEALTHS)
          for (const shots of SHOT_COUNTS) {
            const text = describeHero(withAbilities({ speed, jump, health, shots }));
            expect(text).toMatch(/^Your hero runs (at normal speed|fast|very fast), jumps onto ledges up to [234] tiles high, has (20|28|40) health and can have [1235] shots? on screen\./);
            expect(text).not.toMatch(/1 shots/);
          }
  });

  it("opens the catalogue", () => {
    expect(describeCatalogue(game(), pack)).toMatch(/^Your hero runs at normal speed/);
  });
});

describe("describeDesigns", () => {
  function designed(): Project {
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "  Frost   Fang ", behaviour: "walker" });
    project = run(project, "setEnemyTuning", { enemyId: "e1", speed: "fast", health: 3, damage: "high" });
    project = run(project, "addEnemy", { enemyId: "e2", name: "Ice Eye", behaviour: "turret" });
    project = run(project, "setEnemyTuning", { enemyId: "e2", shoots: "often" });
    project = run(project, "createBoss", { name: "Volt Viper" });
    return run(project, "setBoss", { fight: "long", attacks: ["rain", "big", "dash"] });
  }

  it("lists each enemy by type, with only the tuning its behaviour uses", () => {
    const text = describeDesigns(designed(), pack);
    expect(text).toContain("Their own enemies (place them with place_thing using the type; their settings come from their designs):");
    expect(text).toContain("- own-e1: Frost Fang, a walker that patrols back and forth: fast, 3 hits, high damage.");
    expect(text).toContain("- own-e2: Ice Eye, a turret that fires at the hero: 3 hits, normal damage, shoots often.");
  });

  it("describes the boss's fight and attacks in order, and which boss is in the boss room", () => {
    const project = designed();
    const line =
      "Their own boss: Volt Viper, a long fight (40 health). Attacks in order: shots falling from above, a big slow shot at chest height, a dash along the floor.";
    expect(describeDesigns(project, pack)).toContain(`${line} The Blizzard Bot is in the boss room instead; the user can swap theirs in on the Boss tab.`);
    expect(describeDesigns(run(project, "useBoss", { boss: "yours" }), pack)).toContain(`${line} It is in the boss room.`);
  });

  it("says so in one line when there are no designs", () => {
    expect(describeDesigns(game(), pack)).toBe("They haven't made any enemies or a boss of their own yet.");
  });

  it("is in the catalogue, after the things", () => {
    const text = describeCatalogue(designed(), pack);
    expect(text.indexOf("- own-e1: Frost Fang")).toBeGreaterThan(text.indexOf("- boss: Blizzard Bot"));
  });
});

describe("describeZone with the kid's enemies", () => {
  it("names a placed own enemy and marks it as theirs", () => {
    let project = run(game(), "addEnemy", { enemyId: "e1", name: "Frost Fang", behaviour: "walker" });
    project = run(project, "placeThing", { levelId: "L1", zoneId: "z1", thingId: "t1", type: "own-e1", x: 6, y: 12 });
    const text = describeZone(level(project), zone(project, "z1"), gamePack(project, pack));
    expect(text).toContain("- t1: Frost Fang, yours (own-e1) at (6, 12)");
  });
});
