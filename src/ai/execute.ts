import type { CheckCache } from "@/checker/cache";
import { applyCommand } from "@/commands/registry";
import type { Command } from "@/commands/types";
import type { ContentPack } from "@/model/contentPack";
import { tidyName, type Level, type Project, type Zone } from "@/model/schema";
import { describeCatalogue, describeCheck, describeHero, describeLevel, describeZone } from "./describe";
import { AI_TOOLS, type AiTool } from "./tools";

export type TurnState = {
  project: Project;
  levelId: string;
  // Zones changed this turn, and whether each has been checked since its last change.
  changed: Map<string, boolean>;
};

export type ToolContext = { pack: ContentPack; makeId: () => string; checks: CheckCache };

export type ToolOutcome = {
  state: TurnState;
  content: string; // the tool result Claude reads
  isError: boolean;
  command: Command | null; // the change that was made, for the editor to replay
  activity: string; // a short line for the chat panel
};

const byName = new Map(AI_TOOLS.map((t) => [t.name, t]));

export function startTurn(project: Project, levelId: string): TurnState {
  return { project, levelId, changed: new Map() };
}

function levelOf(state: TurnState): Level {
  const level = state.project.levels.find((l) => l.id === state.levelId);
  if (!level) throw new Error(`There is no level with id "${state.levelId}".`);
  return level;
}

// A zone by its id, or by its name ignoring case and extra spaces.
export function findZone(level: Level, ref: string): Zone | string {
  const byId = level.zones.find((z) => z.id === ref);
  if (byId) return byId;
  const wanted = tidyName(ref).toLowerCase();
  const byZoneName = level.zones.find((z) => z.name.toLowerCase() === wanted);
  if (byZoneName) return byZoneName;
  return `There is no zone called "${ref}". The zones are: ${level.zones.map((z) => `"${z.name}"`).join(", ")}.`;
}

function activityFor(tool: AiTool, zone: Zone | null): string {
  const where = zone ? zone.name : "the level";
  switch (tool.kind) {
    case "look":
      return tool.name === "get_catalogue" ? "Looking at the pieces…" : `Looking at ${where}…`;
    case "plan":
      return "Planning the level…";
    case "build":
      return `Building ${where}…`;
    case "check":
      return `Checking ${where}…`;
  }
}

function doneText(generated: string | null, id: string | null): string {
  if (generated === "zoneId") return `Done. The new zone's id is ${id}.`;
  if (generated === "thingId") return `Done. The new thing's id is ${id}.`;
  if (generated === "idPrefix") return `Done. Any things the piece added have ids starting with ${id}-.`;
  return "Done.";
}

// Zones a change touched: any whose object changed or is new, plus the zone it was aimed at.
function touchedZones(before: Level, after: Level, target: string | null): string[] {
  const old = new Map(before.zones.map((z) => [z.id, z]));
  const ids = after.zones.filter((z) => old.get(z.id) !== z).map((z) => z.id);
  if (target && !ids.includes(target) && after.zones.some((z) => z.id === target)) ids.push(target);
  return ids;
}

function markChecked(state: TurnState, ids: string[]): TurnState {
  const changed = new Map(state.changed);
  for (const id of ids) if (changed.has(id)) changed.set(id, true);
  return { ...state, changed };
}

export function executeTool(state: TurnState, name: string, input: unknown, ctx: ToolContext): ToolOutcome {
  const fail = (content: string, activity = "Thinking…"): ToolOutcome => ({
    state,
    content,
    isError: true,
    command: null,
    activity,
  });

  const tool = byName.get(name);
  if (!tool) return fail(`There is no tool called "${name}".`);
  const parsed = tool.input.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return fail(`Invalid input for ${name}: ${details}`);
  }
  const args = parsed.data as Record<string, unknown>;
  const level = levelOf(state);
  let zone: Zone | null = null;
  if (typeof args.zone === "string") {
    const found = findZone(level, args.zone);
    if (typeof found === "string") return fail(found);
    zone = found;
  }
  const activity = activityFor(tool, zone);
  const { project, levelId } = state;
  const ok = (content: string, next = state, command: Command | null = null): ToolOutcome => ({
    state: next,
    content,
    isError: false,
    command,
    activity,
  });

  switch (tool.name) {
    case "get_level_overview":
      return ok(`${describeLevel(level, ctx.checks.level(project, levelId, ctx.pack))}\n\n${describeHero(project)}`);
    case "get_zone":
      return ok(describeZone(level, zone!, ctx.pack));
    case "get_catalogue":
      return ok(describeCatalogue(project, ctx.pack));
    case "check_zone":
      return ok(describeCheck(ctx.checks.zone(project, levelId, zone!.id, ctx.pack)), markChecked(state, [zone!.id]));
    case "check_level": {
      const check = ctx.checks.level(project, levelId, ctx.pack);
      const problems =
        check.problems.length === 0
          ? ["No problems with how the zones connect."]
          : ["Problems with how the zones connect:", ...check.problems.map((p) => `- ${p}`)];
      return ok(
        [...check.zones.map(describeCheck), ...problems].join("\n"),
        markChecked(state, level.zones.map((z) => z.id)),
      );
    }
  }

  const spec = tool.command!;
  const commandArgs: Record<string, unknown> = { levelId };
  for (const [key, value] of Object.entries(args)) if (key !== "zone") commandArgs[key] = value;
  if (spec.zoneArg && zone) commandArgs.zoneId = zone.id;
  const newId = spec.generated ? ctx.makeId() : null;
  if (spec.generated) commandArgs[spec.generated] = newId;
  const command: Command = { name: spec.name, args: commandArgs };
  const result = applyCommand(project, command, { pack: ctx.pack });
  if (!result.ok) return fail(result.error, activity);

  const after = { ...state, project: result.project };
  const target = spec.generated === "zoneId" ? newId : (zone?.id ?? null);
  const changed = new Map(state.changed);
  for (const id of touchedZones(level, levelOf(after), target)) changed.set(id, false);
  for (const id of changed.keys()) if (!levelOf(after).zones.some((z) => z.id === id)) changed.delete(id);
  return ok(doneText(spec.generated, newId), { ...after, changed }, command);
}

export function uncheckedZones(state: TurnState): string[] {
  const zones = levelOf(state).zones;
  return [...state.changed].filter(([id, checked]) => !checked && zones.some((z) => z.id === id)).map(([id]) => id);
}

// The forced check round: checks the zones Claude changed but did not check, for one more round.
export function checkUnchecked(state: TurnState, ctx: ToolContext): { state: TurnState; text: string } | null {
  const ids = uncheckedZones(state);
  if (ids.length === 0) return null;
  const results = ids.map((id) => describeCheck(ctx.checks.zone(state.project, state.levelId, id, ctx.pack)));
  return {
    state: markChecked(state, ids),
    text: [
      "From the editor, not the user: you changed these zones but did not check them, so here is what the checker says.",
      ...results,
      "If a zone fails, fix it and check it again. Then reply to the user.",
    ].join("\n"),
  };
}
