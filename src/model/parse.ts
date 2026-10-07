import type { ContentPack } from "./contentPack";
import type { EnemyBehaviour } from "./designs";
import { abilitiesFromSettings } from "./hero";
import { designLookFrom, heroLookFrom, type OldDesignLook, type OldHeroLook } from "./lookUpgrade";
import { FORMAT_VERSION, projectSchema, type Project } from "./schema";
import { structureProblems } from "./validate";

export type ParseResult = { ok: true; project: Project } | { ok: false; error: string };

// One entry per old format version: upgrades a document to the next version.
const UPGRADES: Record<number, (doc: Record<string, unknown>, pack: ContentPack) => Record<string, unknown>> = {
  // Version 2 gave games a hero. A version 1 game gets the pack's hero, with the abilities
  // nearest to the physics numbers it stored (milestone 1's defaults become normal everywhere).
  1: (doc, pack) => {
    const { player, ...rest } = doc;
    return { ...rest, formatVersion: 2, hero: { abilities: abilitiesFromSettings(player), look: pack.hero } };
  },
  // Version 3 gave games their own enemies and boss. A version 2 game has none of its own.
  2: (doc) => ({ ...doc, formatVersion: 3, enemies: [], boss: null }),
  // Version 4 gave every character a look: named animations, canvas sizes, a hitbox and a shot point.
  // A version 1 game's hero came from the pack, whose hero is already a look.
  3: (doc) => ({
    ...doc,
    formatVersion: 4,
    hero: upgradeHero(doc.hero),
    enemies: Array.isArray(doc.enemies) ? doc.enemies.map(upgradeEnemy) : doc.enemies,
    boss: upgradeDesign(doc.boss, "boss"),
  }),
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Each converts only an old-shaped picture set, and leaves anything else for the schema to judge.
function upgradeHero(hero: unknown): unknown {
  if (!isObject(hero) || !isObject(hero.look) || !isObject(hero.look.poses)) return hero;
  return { ...hero, look: heroLookFrom(hero.look as unknown as OldHeroLook) };
}

function upgradeDesign(design: unknown, kind: EnemyBehaviour | "boss"): unknown {
  if (!isObject(design) || !isObject(design.look) || !Array.isArray(design.look.frames)) return design;
  try {
    return { ...design, look: designLookFrom(kind, design.look as unknown as OldDesignLook) };
  } catch {
    return design; // a damaged old look: the schema refuses it
  }
}

function upgradeEnemy(enemy: unknown): unknown {
  if (!isObject(enemy) || typeof enemy.behaviour !== "string") return enemy;
  return upgradeDesign(enemy, enemy.behaviour as EnemyBehaviour);
}

const NOT_A_PROJECT = "This file is not a MegaRomBuilder project.";

export function parseProject(
  raw: unknown,
  getPack: (id: string) => ContentPack | undefined,
): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: NOT_A_PROJECT };
  }
  let doc = raw as Record<string, unknown>;
  const version = doc.formatVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: NOT_A_PROJECT };
  }
  if (version > FORMAT_VERSION) {
    return {
      ok: false,
      error: "This project was made with a newer version of MegaRomBuilder and cannot be opened here.",
    };
  }
  if (version < FORMAT_VERSION) {
    const pack = getPack(String(doc.contentPackId));
    if (!pack) {
      return {
        ok: false,
        error: `This project needs the content pack "${String(doc.contentPackId)}", which is not available.`,
      };
    }
    for (let v = version; v < FORMAT_VERSION; v++) doc = UPGRADES[v](doc, pack);
  }

  const parsed = projectSchema.safeParse(doc);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "project"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `This project file is damaged (${details}).` };
  }

  const pack = getPack(parsed.data.contentPackId);
  if (!pack) {
    return {
      ok: false,
      error: `This project needs the content pack "${parsed.data.contentPackId}", which is not available.`,
    };
  }
  const problems = structureProblems(parsed.data, pack);
  if (problems.length > 0) {
    return { ok: false, error: `This project file is damaged. ${problems.slice(0, 3).join(" ")}` };
  }
  return { ok: true, project: parsed.data };
}
