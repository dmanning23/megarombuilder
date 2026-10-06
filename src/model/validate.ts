import { lookProblems } from "./hero";
import type { ContentPack } from "./contentPack";
import {
  MAX_SCREENS,
  edgeLength,
  inBounds,
  zoneSize,
  type Edge,
  type Opening,
  type Size,
} from "./geometry";
import { tidyName, type Level, type Project, type Zone } from "./schema";

export function openingProblem(
  size: Size,
  opening: Opening,
  role: "entry" | "exit",
): string | null {
  if (role === "entry" && opening.edge === "right") {
    return "An entry cannot be on the right edge because zones never lead left.";
  }
  if (role === "exit" && opening.edge === "left") {
    return "An exit cannot be on the left edge because zones never lead left.";
  }
  if (opening.from > opening.to) {
    return `The ${role} opening must have "from" less than or equal to "to".`;
  }
  const length = edgeLength(size, opening.edge);
  if (opening.to >= length) {
    return `The ${role} opening runs from ${opening.from} to ${opening.to} but the ${opening.edge} edge only has positions 0 to ${length - 1}.`;
  }
  return null;
}

export function overlapProblem(entry: Opening, exit: Opening | null): string | null {
  if (!exit || entry.edge !== exit.edge) return null;
  if (entry.to < exit.from || exit.to < entry.from) return null;
  return `The entry and exit overlap on the ${entry.edge} edge.`;
}

export function zoneProblems(zone: Zone, pack: ContentPack): string[] {
  const problems: string[] = [];
  const where = `Zone "${zone.name}"`;

  if (zone.name.trim() === "") problems.push("A zone has an empty name.");
  else if (zone.name !== tidyName(zone.name)) problems.push(`${where} has a name with extra spaces.`);
  if (zone.kind !== "normal" && (zone.scroll !== "horizontal" || zone.screens !== 1)) {
    problems.push(`${where} is a boss zone and must be one horizontal screen.`);
  }
  if (zone.screens > MAX_SCREENS[zone.scroll]) {
    problems.push(
      `${where} is ${zone.screens} screens long but a ${zone.scroll} zone can be at most ${MAX_SCREENS[zone.scroll]}.`,
    );
  }

  const size = zoneSize(zone.scroll, zone.screens);
  const needed = size.width * size.height;
  if (zone.tiles.length !== needed) {
    problems.push(`${where} has ${zone.tiles.length} tiles but its size needs ${needed}.`);
  }
  const tileIds = new Set(pack.tiles.map((t) => t.id));
  if (zone.tiles.some((t) => t !== 0 && !tileIds.has(t))) {
    problems.push(`${where} uses a tile that is not in the content pack.`);
  }
  if (!pack.variants.includes(zone.variant)) {
    problems.push(`${where} uses the unknown variant "${zone.variant}".`);
  }

  const entryProblem = openingProblem(size, zone.entry, "entry");
  if (entryProblem) problems.push(`${where}: ${entryProblem}`);
  if (zone.kind === "bossRoom") {
    if (zone.exit) problems.push(`${where}: the boss room cannot have an exit.`);
  } else if (!zone.exit) {
    problems.push(`${where} needs an exit.`);
  } else {
    const exitProblem = openingProblem(size, zone.exit, "exit");
    if (exitProblem) problems.push(`${where}: ${exitProblem}`);
  }

  const overlap = overlapProblem(zone.entry, zone.exit);
  if (overlap) problems.push(`${where}: ${overlap}`);

  const seen = new Set<string>();
  for (const thing of zone.things) {
    if (seen.has(thing.id)) problems.push(`${where} has two things with the id "${thing.id}".`);
    seen.add(thing.id);
    if (!pack.things.some((d) => d.type === thing.type)) {
      problems.push(`${where} has an unknown thing type "${thing.type}".`);
    }
    if (!inBounds(size, thing.x, thing.y)) {
      problems.push(`${where} has a "${thing.type}" at (${thing.x}, ${thing.y}), outside the zone.`);
    }
  }
  return problems;
}

export function levelProblems(level: Level, pack: ContentPack): string[] {
  const problems: string[] = [];
  const where = `Level "${level.name}"`;
  const zones = level.zones;

  if (zones.length < 3) problems.push(`${where} needs at least three zones.`);
  const kinds = zones.map((z) => z.kind);
  const endsRight =
    kinds.length >= 2 &&
    kinds[kinds.length - 2] === "bossCorridor" &&
    kinds[kinds.length - 1] === "bossRoom";
  const earlyBoss = kinds.slice(0, -2).some((k) => k !== "normal");
  if (!endsRight || earlyBoss) {
    problems.push(`${where} must end with a boss corridor and then a boss room, and have no others.`);
  }

  const ids = new Set<string>();
  const names = new Set<string>();
  for (const zone of zones) {
    if (ids.has(zone.id)) problems.push(`${where} has two zones with the id "${zone.id}".`);
    ids.add(zone.id);
    const key = tidyName(zone.name).toLowerCase();
    if (names.has(key)) problems.push(`${where} has more than one zone called "${tidyName(zone.name)}".`);
    names.add(key);
    problems.push(...zoneProblems(zone, pack));
  }

  const spots = new Set<string>();
  for (const checkpoint of level.checkpoints) {
    const zone = zones.find((z) => z.id === checkpoint.zoneId);
    const spot = `${checkpoint.zoneId} ${checkpoint.x} ${checkpoint.y}`;
    if (spots.has(spot)) {
      problems.push(
        `${where} has two checkpoints at (${checkpoint.x}, ${checkpoint.y}) in "${zone?.name ?? checkpoint.zoneId}".`,
      );
    }
    spots.add(spot);
    if (!zone) {
      problems.push(`${where}: a checkpoint is in a zone that does not exist.`);
    } else if (!inBounds(zoneSize(zone.scroll, zone.screens), checkpoint.x, checkpoint.y)) {
      problems.push(`${where}: a checkpoint in "${zone.name}" is outside the zone.`);
    }
  }
  return problems;
}

export function structureProblems(project: Project, pack: ContentPack): string[] {
  const problems: string[] = [];
  if (project.contentPackId !== pack.id) {
    problems.push(`This project uses the content pack "${project.contentPackId}", not "${pack.id}".`);
  }
  const ids = new Set<string>();
  for (const level of project.levels) {
    if (ids.has(level.id)) problems.push(`Two levels share the id "${level.id}".`);
    ids.add(level.id);
    problems.push(...levelProblems(level, pack));
  }
  problems.push(...lookProblems(project.hero.look).map((p) => `The hero: ${p}`));
  return problems;
}

const PAIRED_ENTRY: Record<Edge, Edge | null> = {
  right: "left",
  top: "bottom",
  bottom: "top",
  left: null,
};

// Connection problems between neighbouring zones. Reported, never enforced by commands.
export function chainProblems(level: Level): string[] {
  const problems: string[] = [];
  for (let i = 0; i < level.zones.length - 1; i++) {
    const from = level.zones[i];
    const to = level.zones[i + 1];
    if (!from.exit) continue;
    const wanted = PAIRED_ENTRY[from.exit.edge];
    if (wanted !== to.entry.edge) {
      problems.push(
        `"${from.name}" exits on its ${from.exit.edge} edge, so "${to.name}" must be entered from its ${wanted} edge, not its ${to.entry.edge} edge.`,
      );
      continue;
    }
    const exitLength = from.exit.to - from.exit.from + 1;
    const entryLength = to.entry.to - to.entry.from + 1;
    if (exitLength !== entryLength) {
      problems.push(
        `The exit of "${from.name}" is ${exitLength} tiles long but the entry of "${to.name}" is ${entryLength} tiles long. They must match.`,
      );
    }
  }
  return problems;
}
