import { z } from "zod";
import type { ContentPack } from "@/model/contentPack";
import { MAX_ID_LENGTH, MAX_NAME_LENGTH, tidyName, type Project } from "@/model/schema";

export type CommandContext = { pack: ContentPack };

export type CommandResult = { ok: true; project: Project } | { ok: false; error: string };

export type Command = { name: string; args: unknown };

export type CommandDef = {
  name: string;
  description: string;
  args: z.ZodType;
  apply: (project: Project, args: never, ctx: CommandContext) => CommandResult;
};

// Keeps each command's args typed from its schema, then erases the type for the registry.
export function defineCommand<S extends z.ZodType>(def: {
  name: string;
  description: string;
  args: S;
  apply: (project: Project, args: z.infer<S>, ctx: CommandContext) => CommandResult;
}): CommandDef {
  return def as unknown as CommandDef;
}

export const ok = (project: Project): CommandResult => ({ ok: true, project });
export const fail = (error: string): CommandResult => ({ ok: false, error });

export const idArg = z.string().min(1).max(MAX_ID_LENGTH);
export const nameArg = z.string().transform(tidyName).pipe(z.string().min(1).max(MAX_NAME_LENGTH));
export const coordArg = z.number().int("must be a whole number of tiles");
