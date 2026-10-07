import type { Project } from "@/model/schema";
import { levelCommands } from "./level";
import { zoneCommands } from "./zones";
import { tileCommands } from "./tiles";
import { thingCommands } from "./things";
import { checkpointCommands } from "./checkpoints";
import { pieceCommands } from "./pieces";
import { enemyCommands } from "./enemies";
import { heroCommands } from "./hero";
import { gamePack } from "@/model/gamePack";
import {
  fail,
  type Command,
  type CommandContext,
  type CommandDef,
  type CommandResult,
} from "./types";

export const commandDefs: CommandDef[] = [
  ...levelCommands,
  ...zoneCommands,
  ...tileCommands,
  ...thingCommands,
  ...checkpointCommands,
  ...pieceCommands,
  ...heroCommands,
  ...enemyCommands,
];

const byName = new Map(commandDefs.map((def) => [def.name, def]));

export function applyCommand(
  project: Project,
  command: Command,
  ctx: CommandContext,
): CommandResult {
  const def = byName.get(command.name);
  if (!def) return fail(`Unknown command "${command.name}".`);
  const parsed = def.args.safeParse(command.args);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "arguments"}: ${issue.message}`)
      .join("; ");
    return fail(`Invalid arguments for ${command.name}: ${details}`);
  }
  // Commands see the kid's own enemies as thing types like any other.
  return def.apply(project, parsed.data as never, { ...ctx, pack: gamePack(project, ctx.pack) });
}
