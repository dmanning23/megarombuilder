import type { Project } from "@/model/schema";
import { levelCommands } from "./level";
import { zoneCommands } from "./zones";
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
  return def.apply(project, parsed.data as never, ctx);
}
