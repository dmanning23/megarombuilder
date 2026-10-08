import type { LevelCheck, ZoneCheck } from "@/checker/check";
import { clearableGap } from "@/checker/reasons";
import { heroPhysics, type Abilities } from "@/model/hero";
import type { ContentPack, PieceDef, TileBehaviour } from "@/model/contentPack";
import { tileIndex, zoneSize, type Opening } from "@/model/geometry";
import { FIGHT_HEALTH, TUNING_USED, type BossAttack, type EnemyBehaviour, type EnemyDesign } from "@/model/designs";
import { OWN_BOSS, ownType } from "@/model/gamePack";
import { tidyName, type Level, type Project, type Zone } from "@/model/schema";

// How Claude sees a level: plain text, small enough to send only the zones it asks for.

const CHAR: Record<TileBehaviour, string> = { solid: "#", ice: "~", ladder: "H", spike: "^", oneWay: "=" };

const BEHAVIOUR_TEXT: Record<TileBehaviour, string> = {
  solid: "solid ground",
  ice: "slippery ground",
  ladder: "a ladder to climb",
  spike: "spikes that defeat the player on touch",
  oneWay: "a ledge the player can jump up through and stand on",
};

const KIND: Record<Zone["kind"], string> = {
  normal: "normal zone",
  bossCorridor: "boss corridor",
  bossRoom: "boss room",
};

export const LEGEND = ". empty   # solid   ~ ice   H ladder   ^ spike   = one-way";

export function tileChar(pack: ContentPack, tile: number): string {
  if (tile === 0) return ".";
  const def = pack.tiles.find((t) => t.id === tile);
  return def ? CHAR[def.behaviour] : "?";
}

function opening(o: Opening | null): string {
  if (!o) return "none";
  const along = o.edge === "left" || o.edge === "right" ? "rows" : "columns";
  return `${o.edge} edge, ${along} ${o.from} to ${o.to}`;
}

const screens = (n: number) => `${n} screen${n === 1 ? "" : "s"}`;

export function describeZone(level: Level, zone: Zone, pack: ContentPack): string {
  const size = zoneSize(zone.scroll, zone.screens);
  const number = level.zones.findIndex((z) => z.id === zone.id) + 1;
  const lines = [
    `Zone "${zone.name}" (id ${zone.id}), number ${number} of ${level.zones.length}, a ${KIND[zone.kind]}.`,
    `${zone.scroll === "horizontal" ? "Sideways" : "Climbing"}, ${screens(zone.screens)}: ${size.width} tiles wide and ${size.height} tiles high. Look: ${zone.variant}.`,
    `Purpose: ${zone.intent || "not set"}`,
    `Way in: ${opening(zone.entry)}. Way out: ${opening(zone.exit)}.`,
    "",
    `Legend: ${LEGEND}`,
    "x counts columns from 0 at the left; y counts rows from 0 at the top.",
  ];
  const columns = (digit: (x: number) => string) =>
    "    " + Array.from({ length: size.width }, (_, x) => digit(x)).join("");
  if (size.width > 10) lines.push(columns((x) => (x >= 10 ? String(Math.floor(x / 10) % 10) : " ")));
  lines.push(columns((x) => String(x % 10)));
  for (let y = 0; y < size.height; y++) {
    let row = "";
    for (let x = 0; x < size.width; x++) row += tileChar(pack, zone.tiles[tileIndex(size, x, y)]);
    lines.push(`${String(y).padStart(2)}  ${row}`);
  }
  lines.push("");
  lines.push(zone.things.length > 0 ? "Things:" : "Things: none");
  for (const thing of zone.things) {
    const def = pack.things.find((d) => d.type === thing.type);
    const settings = Object.keys(thing.settings).length > 0 ? `, settings ${JSON.stringify(thing.settings)}` : "";
    const name = def ? (def.own ? `${tidyName(def.name)}, yours` : def.name) : thing.type;
    lines.push(`- ${thing.id}: ${name} (${thing.type}) at (${thing.x}, ${thing.y})${settings}`);
  }
  const checkpoints = level.checkpoints.filter((c) => c.zoneId === zone.id);
  lines.push(
    checkpoints.length > 0
      ? `Checkpoints: ${checkpoints.map((c) => `(${c.x}, ${c.y})`).join(", ")}`
      : "Checkpoints: none",
  );
  return lines.join("\n");
}

export function describeCheck(check: ZoneCheck): string {
  const head = check.passable
    ? `"${check.name}" passes: the player can get from the way in to the way out. Difficulty ${check.difficulty} of 10.`
    : `"${check.name}" FAILS: ${check.reason ?? "the player cannot get through."}` +
      (check.furthest ? ` The player gets as far as x ${check.furthest.x}, y ${check.furthest.y}.` : "");
  return [head, ...check.warnings.map((w) => `Warning: ${w}`)].join("\n");
}

export function describeLevel(level: Level, check: LevelCheck): string {
  const lines = [
    `Level "${level.name}".`,
    `Brief: ${level.brief || "not set"}`,
    "",
    "Zones, in the order the player goes through them:",
  ];
  level.zones.forEach((zone, i) => {
    const size = zoneSize(zone.scroll, zone.screens);
    const c = check.zones.find((z) => z.zoneId === zone.id);
    const verdict = !c ? "not checked" : c.passable ? `passes, difficulty ${c.difficulty} of 10` : "FAILS the check";
    lines.push(
      `${i + 1}. "${zone.name}" (id ${zone.id}): ${KIND[zone.kind]}, ${zone.scroll === "horizontal" ? "sideways" : "climbing"}, ` +
        `${screens(zone.screens)} (${size.width} by ${size.height} tiles), look ${zone.variant}; ` +
        `purpose: ${zone.intent || "not set"}; ${verdict}.`,
    );
  });
  lines.push("");
  if (check.problems.length === 0) lines.push("No problems with how the zones connect.");
  else lines.push("Problems with how the zones connect:", ...check.problems.map((p) => `- ${p}`));
  const names = new Map(level.zones.map((z) => [z.id, z.name]));
  lines.push(
    level.checkpoints.length > 0
      ? `Checkpoints: ${level.checkpoints.map((c) => `"${names.get(c.zoneId)}" (${c.x}, ${c.y})`).join(", ")}`
      : "Checkpoints: none",
  );
  return lines.join("\n");
}

function pieceLine(piece: PieceDef): string {
  const defaults = Object.fromEntries(piece.settings.map((s) => [s.key, s.default]));
  const built = piece.build(defaults);
  const settings =
    piece.settings.length > 0
      ? ` Settings: ${piece.settings.map((s) => `${s.key} ${s.min} to ${s.max} (default ${s.default}): ${s.description}`).join("; ")}.`
      : "";
  const needs = piece.needs === "slide" ? " Needs slide." : "";
  return `- ${piece.id}: ${piece.name}. ${piece.description} ${built.width} tiles wide at its default settings.${settings}${needs}`;
}

const SPEED_TEXT: Record<Abilities["speed"], string> = { normal: "at normal speed", fast: "fast", veryFast: "very fast" };
// The highest ledge each jump lands on, measured with the checker (plan 1 of milestone 2).
const JUMP_TILES: Record<Abilities["jump"], number> = { low: 2, normal: 2, high: 3, veryHigh: 4 };

// What the hero can do, in words.
export function describeHero(project: Project): string {
  const a = project.hero.abilities;
  const { body } = project.hero.look;
  const physics = heroPhysics(a);
  return [
    `Your hero runs ${SPEED_TEXT[a.speed]}, jumps onto ledges up to ${JUMP_TILES[a.jump]} tiles high, has ${physics.maxHealth} health and can have ${a.shots} shot${a.shots === 1 ? "" : "s"} on screen.`,
    `Your hero is ${body.h} pixels tall and ${body.w} wide, so it fits through 2-tile gaps.`,
    a.slide ? "It can slide under gaps one tile high." : "It can't slide.",
    a.chargeShot ? "It has a charge shot." : "It has no charge shot.",
  ].join(" ");
}

export function describeCatalogue(project: Project, pack: ContentPack): string {
  const physics = heroPhysics(project.hero.abilities);
  return [
    describeHero(project),
    `It can jump across gaps up to ${clearableGap(physics)} tiles wide.`,
    `Content pack: ${pack.name}. Looks a zone can have: ${pack.variants.join(", ")}.`,
    "",
    "Tiles (use the number in fill_rect and set_tiles; 0 is empty):",
    ...pack.tiles.map((t) => `- ${t.id}: ${t.name} (${tileChar(pack, t.id)}), ${BEHAVIOUR_TEXT[t.behaviour]}`),
    "",
    "Things (use the type in place_thing):",
    ...pack.things.map((d) => {
      const settings = Object.keys(d.defaults).length > 0 ? ` Settings: ${JSON.stringify(d.defaults)}.` : "";
      return `- ${d.type}: ${d.name}, ${d.category}. ${d.description}${settings}`;
    }),
    "",
    describeDesigns(project, pack),
    "",
    "Pieces (use the id in insert_piece; each is a full-height slice of 15 rows, so place it at y 0 in a sideways zone):",
    ...pack.pieces.map(pieceLine),
  ].join("\n");
}

const BEHAVIOUR_WORDS: Record<EnemyBehaviour, string> = {
  walker: "a walker that patrols back and forth",
  flyer: "a flyer that swoops toward the hero",
  turret: "a turret that fires at the hero",
  jumper: "a hopper that hops toward the hero",
  shielded: "a shield guard that blocks shots until it opens up",
  dropper: "a dropper that drops when the hero passes underneath",
};

const ATTACK_WORDS: Record<BossAttack, string> = {
  jump: "a jump at the hero",
  dash: "a dash along the floor",
  spread: "three spreading shots",
  aimed: "a quick shot aimed at the hero",
  rain: "shots falling from above",
  big: "a big slow shot at chest height",
};

function tuningWords(enemy: EnemyDesign): string {
  const t = enemy.tuning;
  const used = TUNING_USED[enemy.behaviour];
  return [
    used.includes("speed") ? t.speed : null,
    `${t.health} hit${t.health === 1 ? "" : "s"}`,
    `${t.damage} damage`,
    used.includes("shoots") ? `shoots ${t.shoots}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
}

// The kid's own enemies and boss, as the assistant needs them: what to place, and what it does.
export function describeDesigns(project: Project, pack: ContentPack): string {
  const { enemies, boss } = project;
  if (enemies.length === 0 && !boss) return "They haven't made any enemies or a boss of their own yet.";
  const lines: string[] = [];
  if (enemies.length > 0) {
    lines.push("Their own enemies (place them with place_thing using the type; their settings come from their designs):");
    for (const enemy of enemies) {
      lines.push(`- ${ownType(enemy.id)}: ${tidyName(enemy.name)}, ${BEHAVIOUR_WORDS[enemy.behaviour]}: ${tuningWords(enemy)}.`);
    }
  } else {
    lines.push("They haven't made any enemies of their own yet.");
  }
  if (boss) {
    const placed = project.levels.some((l) => l.zones.some((z) => z.things.some((t) => t.type === OWN_BOSS)));
    const other = pack.things.find((d) => d.behaviour === "boss" && !d.own)?.name ?? "content pack's boss";
    lines.push(
      `Their own boss: ${tidyName(boss.name)}, a ${boss.fight} fight (${FIGHT_HEALTH[boss.fight]} health). ` +
        `Attacks in order: ${boss.attacks.map((a) => ATTACK_WORDS[a]).join(", ")}. ` +
        (placed ? "It is in the boss room." : `The ${other} is in the boss room instead; the user can swap theirs in on the Boss tab.`),
    );
  } else {
    lines.push("They haven't made a boss of their own yet.");
  }
  return lines.join("\n");
}
