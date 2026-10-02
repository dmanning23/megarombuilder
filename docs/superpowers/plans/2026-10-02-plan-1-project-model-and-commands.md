# Project Model and Commands Implementation Plan (Milestone 1, Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js app and build the headless core every other unit depends on: the project data model with validation, and the undoable edit commands.

**Architecture:** A project is one immutable JSON document described by Zod schemas. Every edit is a named command with a Zod argument schema and a pure `apply(project, args, ctx)` that returns a new project or a readable error. Undo is done by keeping the before and after project for each command group; unchanged zones are shared between snapshots, so this is cheap.

**Tech Stack:** Next.js (App Router), React, TypeScript (strict), Zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-playable-core-ai-level-builder-design.md`

**Plan series for milestone 1:**

1. Project model and commands (this plan)
2. Runtime: simulation, rendering, a playable hand-made level
3. Snow content pack, level pieces and the checker
4. Editor UI and IndexedDB storage
5. AI assistant: proxy route, tools, chat loop

## Global Constraints

- A tile is 16 by 16 pixels. A screen is 16 by 15 tiles.
- A horizontal zone is 1 to 8 screens long; a vertical zone is 1 to 6. Boss corridor and boss room are one horizontal screen each.
- A level has at least three zones. The last two are a `bossCorridor` then a `bossRoom`; no other zone has those kinds.
- Zones never lead left: an exit is never on the left edge and an entry is never on the right edge.
- Zone names are unique within a level, compared case-insensitively after trimming.
- `src/model/` and `src/commands/` are plain TypeScript: no React, no Next.js, no DOM globals.
- Commands never throw for bad input. They return `{ ok: false, error }` with a sentence a child or the AI can act on.
- Commands that create things take their IDs as arguments. Nothing in `src/model/` or `src/commands/` generates random values.
- No Capcom names, sprites or tiles anywhere in the repo.
- Import alias `@/` maps to `src/`.

## Review Focus

1. **A project file that is not a project** (plain text, `null`, an array, a file from a newer version): import must refuse with an explanation, never throw. Tested in Task 3.
2. **Zone names that differ only by case or spaces** ("ice cave " against "Ice Cave"): must be rejected as a clash, or chat references become ambiguous. Tested in Task 5.
3. **Shrinking a zone that has things, checkpoints or openings beyond the new edge**: they must be removed or moved inside, leaving a valid project. Tested in Task 5.
4. **Edits partly or wholly outside a zone, or at fractional coordinates**: must be refused with the zone's real size in the message and leave the project untouched. Tested in Tasks 6 and 7.
5. **A group of edits that fails partway** (the AI's turn dies after three commands): rollback must restore the exact original project object. Tested in Task 9.

## File Structure

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts, .gitignore
src/app/layout.tsx            root layout
src/app/page.tsx              placeholder home page
src/model/geometry.ts         sizes, bounds, opening maths
src/model/schema.ts           Zod schemas and the Project types
src/model/contentPack.ts      ContentPack, TileDef, ThingDef, PieceDef types
src/model/factory.ts          createProject, createLevel, createZone
src/model/validate.ts         structureProblems (hard rules), chainProblems (reported)
src/model/parse.ts            parseProject for import and load
src/model/index.ts            re-exports
src/commands/types.ts         CommandDef, CommandResult, defineCommand, shared arg schemas
src/commands/helpers.ts       editLevel, editZone, nameTaken
src/commands/level.ts         createLevel, renameLevel, setLevelBrief, deleteLevel
src/commands/zones.ts         addZone, removeZone, moveZone, renameZone, resizeZone, setZoneVariant, setZoneIntent, setZoneOpenings
src/commands/tiles.ts         setTiles, fillRect, clearRect
src/commands/things.ts        placeThing, moveThing, removeThing, setThingSettings
src/commands/checkpoints.ts   addCheckpoint, removeCheckpoint
src/commands/pieces.ts        insertPiece
src/commands/registry.ts      commandDefs, applyCommand
src/commands/history.ts       undo, redo, groups, rollback
src/commands/index.ts         re-exports
tests/fixtures/testPack.ts    small content pack for tests
tests/commands/helpers.ts     baseProject, run, runError, patchZone, zoneOf
tests/model/*.test.ts, tests/commands/*.test.ts, tests/boundaries.test.ts
```

Two rule categories matter throughout:

- **Hard rules** are enforced by commands and by `structureProblems`. A project that breaks one is refused on import.
- **Chain rules** (zone N's exit must pair with zone N+1's entry) are reported by `chainProblems` but not enforced by commands, because fixing a connection takes two edits and the state in between must be allowed.

---

### Task 1: Scaffold the app and add geometry

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/model/geometry.ts`
- Test: `tests/model/geometry.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TILE_SIZE = 16`, `SCREEN_TILES_W = 16`, `SCREEN_TILES_H = 15`, `MAX_SCREENS = { horizontal: 8, vertical: 6 }`
  - `type Scroll = "horizontal" | "vertical"`, `type Edge = "left" | "right" | "top" | "bottom"`, `type Size = { width: number; height: number }`, `type Opening = { edge: Edge; from: number; to: number }`
  - `zoneSize(scroll: Scroll, screens: number): Size`
  - `tileIndex(size: Size, x: number, y: number): number`
  - `inBounds(size: Size, x: number, y: number): boolean`
  - `rectInBounds(size: Size, x: number, y: number, w: number, h: number): boolean`
  - `edgeLength(size: Size, edge: Edge): number`
  - `clampOpening(opening: Opening, length: number): Opening`

Note: do not use `create-next-app`. It refuses this folder because the name `MegaRomBuilder` contains capital letters.

- [ ] **Step 1: Write the config files**

`package.json`:

```json
{
  "name": "megarombuilder",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

`.gitignore`:

```
node_modules
.next
out
next-env.d.ts
*.tsbuildinfo
.env*.local
.DS_Store
```

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "MegaRomBuilder",
  description: "Build your own run-and-gun game.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>MegaRomBuilder</h1>
      <p>The editor arrives in a later plan.</p>
    </main>
  );
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install next@latest react@latest react-dom@latest zod@latest
npm install -D typescript @types/node @types/react @types/react-dom vitest
```

Expected: both finish without errors and `package.json` now lists the dependencies. Confirm `zod` is version 4 or later with `npm ls zod`.

- [ ] **Step 3: Write the failing geometry test**

`tests/model/geometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clampOpening,
  edgeLength,
  inBounds,
  rectInBounds,
  tileIndex,
  zoneSize,
} from "@/model/geometry";

describe("zoneSize", () => {
  it("makes horizontal zones 16 tiles wide per screen and 15 high", () => {
    expect(zoneSize("horizontal", 3)).toEqual({ width: 48, height: 15 });
  });

  it("makes vertical zones 16 wide and 15 tiles high per screen", () => {
    expect(zoneSize("vertical", 2)).toEqual({ width: 16, height: 30 });
  });
});

describe("bounds", () => {
  const size = { width: 16, height: 15 };

  it("accepts corners and rejects cells outside", () => {
    expect(inBounds(size, 0, 0)).toBe(true);
    expect(inBounds(size, 15, 14)).toBe(true);
    expect(inBounds(size, 16, 0)).toBe(false);
    expect(inBounds(size, 0, 15)).toBe(false);
    expect(inBounds(size, -1, 0)).toBe(false);
  });

  it("rejects fractional coordinates", () => {
    expect(inBounds(size, 1.5, 2)).toBe(false);
  });

  it("checks whole rectangles", () => {
    expect(rectInBounds(size, 14, 13, 2, 2)).toBe(true);
    expect(rectInBounds(size, 14, 13, 3, 2)).toBe(false);
    expect(rectInBounds(size, 0, 0, 0, 1)).toBe(false);
  });

  it("indexes tiles row by row", () => {
    expect(tileIndex(size, 3, 2)).toBe(35);
  });

  it("measures left and right edges by height, top and bottom by width", () => {
    const wide = { width: 48, height: 15 };
    expect(edgeLength(wide, "left")).toBe(15);
    expect(edgeLength(wide, "right")).toBe(15);
    expect(edgeLength(wide, "top")).toBe(48);
    expect(edgeLength(wide, "bottom")).toBe(48);
  });
});

describe("clampOpening", () => {
  it("leaves an opening that already fits", () => {
    expect(clampOpening({ edge: "left", from: 9, to: 12 }, 15)).toEqual({
      edge: "left",
      from: 9,
      to: 12,
    });
  });

  it("slides an opening back inside a shorter edge, keeping its length", () => {
    expect(clampOpening({ edge: "top", from: 40, to: 43 }, 32)).toEqual({
      edge: "top",
      from: 28,
      to: 31,
    });
  });

  it("slides an opening up from negative positions", () => {
    expect(clampOpening({ edge: "left", from: -3, to: 0 }, 15)).toEqual({
      edge: "left",
      from: 0,
      to: 3,
    });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL, cannot resolve `@/model/geometry`.

- [ ] **Step 5: Implement geometry**

`src/model/geometry.ts`:

```ts
export const TILE_SIZE = 16;
export const SCREEN_TILES_W = 16;
export const SCREEN_TILES_H = 15;
export const MAX_SCREENS = { horizontal: 8, vertical: 6 } as const;

export type Scroll = "horizontal" | "vertical";
export type Edge = "left" | "right" | "top" | "bottom";
export type Size = { width: number; height: number };
export type Opening = { edge: Edge; from: number; to: number };

export function zoneSize(scroll: Scroll, screens: number): Size {
  return scroll === "horizontal"
    ? { width: screens * SCREEN_TILES_W, height: SCREEN_TILES_H }
    : { width: SCREEN_TILES_W, height: screens * SCREEN_TILES_H };
}

export function tileIndex(size: Size, x: number, y: number): number {
  return y * size.width + x;
}

export function inBounds(size: Size, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < size.width &&
    y < size.height
  );
}

export function rectInBounds(size: Size, x: number, y: number, w: number, h: number): boolean {
  return w >= 1 && h >= 1 && inBounds(size, x, y) && inBounds(size, x + w - 1, y + h - 1);
}

export function edgeLength(size: Size, edge: Edge): number {
  return edge === "left" || edge === "right" ? size.height : size.width;
}

// Slides an opening along its edge until it fits, keeping its length where possible.
export function clampOpening(opening: Opening, length: number): Opening {
  const span = Math.min(opening.to - opening.from, length - 1);
  const from = Math.min(Math.max(opening.from, 0), length - 1 - span);
  return { edge: opening.edge, from, to: from + span };
}
```

- [ ] **Step 6: Run tests, typecheck and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all geometry tests PASS, typecheck prints nothing, the build completes and lists the `/` route.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts .gitignore src/app src/model/geometry.ts tests/model/geometry.test.ts
git commit -m "feat: scaffold app and add zone geometry"
```

---

### Task 2: Schemas, content pack types and factories

**Files:**
- Create: `src/model/schema.ts`, `src/model/contentPack.ts`, `src/model/factory.ts`
- Create: `tests/fixtures/testPack.ts`
- Test: `tests/model/factory.test.ts`

**Interfaces:**
- Consumes: everything from `@/model/geometry` (Task 1)
- Produces:
  - Schemas: `openingSchema`, `thingSchema`, `zoneSchema`, `levelSchema`, `playerSettingsSchema`, `projectSchema`
  - Types: `ThingSettings`, `Thing`, `ZoneKind`, `Zone`, `Checkpoint`, `Level`, `PlayerSettings`, `ChatMessage`, `Project`
  - `FORMAT_VERSION = 1`, `DEFAULT_PLAYER: PlayerSettings`
  - `type TileBehaviour`, `TileDef`, `ThingDef`, `PieceSettingDef`, `PieceThing`, `PieceResult`, `PieceDef`, `ContentPack`; `KEEP_TILE = -1`
  - `createZone(opts: NewZone, pack: ContentPack): Zone` where `NewZone = { id: string; name: string; kind?: ZoneKind; scroll?: Scroll; screens?: number; variant?: string; intent?: string }`
  - `createLevel(opts: { id: string; name: string; brief?: string; zoneIds: [string, string, string] }, pack: ContentPack): Level`
  - `createProject(opts: { id: string; name: string }, pack: ContentPack): Project`
  - `testPack: ContentPack` with tiles 1 ground (solid), 2 ladder, 3 spike, 4 ice, 5 ledge (oneWay); variants `outdoor`, `cave`; things `walker`, `health`; piece `step`

- [ ] **Step 1: Write the content pack types**

`src/model/contentPack.ts`:

```ts
import type { ThingSettings } from "./schema";

export type TileBehaviour = "solid" | "ladder" | "spike" | "ice" | "oneWay";

export type TileDef = { id: number; name: string; behaviour: TileBehaviour };

export type ThingCategory = "enemy" | "pickup" | "platform" | "boss" | "marker";

export type ThingDef = {
  type: string;
  name: string;
  category: ThingCategory;
  description: string;
  defaults: ThingSettings;
};

// Piece settings are whole numbers so they can be described to the AI as plain ranges.
export type PieceSettingDef = {
  key: string;
  description: string;
  min: number;
  max: number;
  default: number;
};

export const KEEP_TILE = -1;

export type PieceThing = { type: string; x: number; y: number; settings: ThingSettings };

export type PieceResult = {
  width: number;
  height: number;
  tiles: number[]; // row by row; KEEP_TILE leaves the existing tile alone
  things: PieceThing[]; // positions relative to the piece's top-left corner
};

export type PieceDef = {
  id: string;
  name: string;
  description: string;
  settings: PieceSettingDef[];
  build: (settings: Record<string, number>) => PieceResult;
};

export type ContentPack = {
  id: string;
  name: string;
  variants: string[];
  groundTileId: number;
  tiles: TileDef[];
  things: ThingDef[];
  pieces: PieceDef[];
};
```

- [ ] **Step 2: Write the test pack fixture**

`tests/fixtures/testPack.ts`:

```ts
import { KEEP_TILE, type ContentPack } from "@/model/contentPack";

export const testPack: ContentPack = {
  id: "test",
  name: "Test Pack",
  variants: ["outdoor", "cave"],
  groundTileId: 1,
  tiles: [
    { id: 1, name: "ground", behaviour: "solid" },
    { id: 2, name: "ladder", behaviour: "ladder" },
    { id: 3, name: "spike", behaviour: "spike" },
    { id: 4, name: "ice", behaviour: "ice" },
    { id: 5, name: "ledge", behaviour: "oneWay" },
  ],
  things: [
    {
      type: "walker",
      name: "Walker",
      category: "enemy",
      description: "Patrols a platform.",
      defaults: { speed: 1 },
    },
    {
      type: "health",
      name: "Health",
      category: "pickup",
      description: "Restores health.",
      defaults: { amount: 4 },
    },
  ],
  pieces: [
    {
      id: "step",
      name: "Step",
      description: "A solid block with a walker standing on it.",
      settings: [
        { key: "width", description: "Block width in tiles", min: 1, max: 4, default: 2 },
        { key: "height", description: "Block height in tiles", min: 1, max: 3, default: 1 },
      ],
      build: ({ width, height }) => ({
        width,
        height: height + 1,
        tiles: [
          ...new Array<number>(width).fill(KEEP_TILE),
          ...new Array<number>(width * height).fill(1),
        ],
        things: [{ type: "walker", x: 0, y: 0, settings: {} }],
      }),
    },
  ],
};
```

- [ ] **Step 3: Write the failing factory test**

`tests/model/factory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLevel, createProject, createZone } from "@/model/factory";
import { tileIndex } from "@/model/geometry";
import { DEFAULT_PLAYER, projectSchema } from "@/model/schema";
import { testPack } from "../fixtures/testPack";

describe("createZone", () => {
  it("gives a horizontal zone a two-row floor and side openings", () => {
    const zone = createZone({ id: "z", name: "Snowy Path", screens: 2 }, testPack);
    const size = { width: 32, height: 15 };
    expect(zone.tiles).toHaveLength(480);
    expect(zone.tiles[tileIndex(size, 0, 12)]).toBe(0);
    expect(zone.tiles[tileIndex(size, 0, 13)]).toBe(1);
    expect(zone.tiles[tileIndex(size, 31, 14)]).toBe(1);
    expect(zone.entry).toEqual({ edge: "left", from: 9, to: 12 });
    expect(zone.exit).toEqual({ edge: "right", from: 9, to: 12 });
    expect(zone.kind).toBe("normal");
    expect(zone.variant).toBe("outdoor");
    expect(zone.intent).toBe("");
  });

  it("gives a vertical zone no floor and openings bottom and top", () => {
    const zone = createZone({ id: "z", name: "Climb", scroll: "vertical", screens: 2 }, testPack);
    expect(zone.tiles).toHaveLength(480);
    expect(zone.tiles.every((t) => t === 0)).toBe(true);
    expect(zone.entry).toEqual({ edge: "bottom", from: 7, to: 8 });
    expect(zone.exit).toEqual({ edge: "top", from: 7, to: 8 });
  });

  it("gives the boss room no exit", () => {
    const zone = createZone({ id: "b", name: "Boss Room", kind: "bossRoom" }, testPack);
    expect(zone.exit).toBeNull();
  });
});

describe("createLevel", () => {
  it("makes a start zone, a boss corridor and a boss room", () => {
    const level = createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack);
    expect(level.zones.map((z) => z.id)).toEqual(["a", "b", "c"]);
    expect(level.zones.map((z) => z.kind)).toEqual(["normal", "bossCorridor", "bossRoom"]);
    expect(level.zones.map((z) => z.name)).toEqual(["Zone 1", "Boss Corridor", "Boss Room"]);
    expect(level.brief).toBe("");
    expect(level.checkpoints).toEqual([]);
  });
});

describe("createProject", () => {
  it("produces a document the schema accepts", () => {
    const project = createProject({ id: "p1", name: "My Game" }, testPack);
    const withLevel = {
      ...project,
      levels: [createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack)],
    };
    expect(projectSchema.safeParse(withLevel).success).toBe(true);
    expect(project.contentPackId).toBe("test");
    expect(project.chat).toEqual([]);
  });

  it("uses the spec's default player numbers", () => {
    expect(DEFAULT_PLAYER).toEqual({
      runSpeed: 1.375,
      jumpVelocity: 4.875,
      gravity: 0.25,
      maxFallSpeed: 7,
      ladderSpeed: 1.25,
      maxHealth: 28,
      maxShots: 3,
    });
  });
});

describe("projectSchema", () => {
  it("rejects a document with the wrong format version", () => {
    const project = { ...createProject({ id: "p1", name: "My Game" }, testPack), formatVersion: 2 };
    expect(projectSchema.safeParse(project).success).toBe(false);
  });

  it("rejects a zone with a missing field", () => {
    const project = createProject({ id: "p1", name: "My Game" }, testPack);
    const level = createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack);
    const { intent: _intent, ...broken } = level.zones[0];
    const bad = { ...project, levels: [{ ...level, zones: [broken, level.zones[1], level.zones[2]] }] };
    expect(projectSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- tests/model/factory.test.ts`
Expected: FAIL, cannot resolve `@/model/factory`.

- [ ] **Step 5: Implement the schemas**

`src/model/schema.ts`:

```ts
import { z } from "zod";

export const FORMAT_VERSION = 1;

const idSchema = z.string().min(1).max(64);
const intSchema = z.number().int();

export const openingSchema = z.object({
  edge: z.enum(["left", "right", "top", "bottom"]),
  from: intSchema.min(0),
  to: intSchema.min(0),
});

export const thingSettingsSchema = z.record(
  z.string(),
  z.union([z.number(), z.string(), z.boolean()]),
);

export const thingSchema = z.object({
  id: idSchema,
  type: z.string().min(1),
  x: intSchema,
  y: intSchema,
  settings: thingSettingsSchema,
});

export const zoneKindSchema = z.enum(["normal", "bossCorridor", "bossRoom"]);

export const zoneSchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: zoneKindSchema,
  scroll: z.enum(["horizontal", "vertical"]),
  screens: intSchema.min(1).max(8),
  variant: z.string(),
  intent: z.string(),
  tiles: z.array(intSchema.min(0)),
  things: z.array(thingSchema),
  entry: openingSchema,
  exit: openingSchema.nullable(), // null only for the boss room
});

export const checkpointSchema = z.object({ zoneId: idSchema, x: intSchema, y: intSchema });

export const levelSchema = z.object({
  id: idSchema,
  name: z.string(),
  brief: z.string(),
  zones: z.array(zoneSchema),
  checkpoints: z.array(checkpointSchema),
});

// Units are pixels and simulation steps (60 per second).
export const playerSettingsSchema = z.object({
  runSpeed: z.number().positive(),
  jumpVelocity: z.number().positive(),
  gravity: z.number().positive(),
  maxFallSpeed: z.number().positive(),
  ladderSpeed: z.number().positive(),
  maxHealth: intSchema.positive(),
  maxShots: intSchema.positive(),
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  at: z.string(),
});

export const projectSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  id: idSchema,
  name: z.string(),
  contentPackId: z.string().min(1),
  player: playerSettingsSchema,
  levels: z.array(levelSchema),
  chat: z.array(chatMessageSchema),
});

export type ThingSettings = z.infer<typeof thingSettingsSchema>;
export type Thing = z.infer<typeof thingSchema>;
export type ZoneKind = z.infer<typeof zoneKindSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type Checkpoint = z.infer<typeof checkpointSchema>;
export type Level = z.infer<typeof levelSchema>;
export type PlayerSettings = z.infer<typeof playerSettingsSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type Project = z.infer<typeof projectSchema>;

export const DEFAULT_PLAYER: PlayerSettings = {
  runSpeed: 1.375,
  jumpVelocity: 4.875,
  gravity: 0.25,
  maxFallSpeed: 7,
  ladderSpeed: 1.25,
  maxHealth: 28,
  maxShots: 3,
};
```

- [ ] **Step 6: Implement the factories**

`src/model/factory.ts`:

```ts
import type { ContentPack } from "./contentPack";
import { tileIndex, zoneSize, type Opening, type Scroll } from "./geometry";
import {
  DEFAULT_PLAYER,
  FORMAT_VERSION,
  type Level,
  type Project,
  type Zone,
  type ZoneKind,
} from "./schema";

export type NewZone = {
  id: string;
  name: string;
  kind?: ZoneKind;
  scroll?: Scroll;
  screens?: number;
  variant?: string;
  intent?: string;
};

// Horizontal zones start with a two-row floor so they can be walked across at once.
export function defaultTiles(scroll: Scroll, screens: number, groundTileId: number): number[] {
  const size = zoneSize(scroll, screens);
  const tiles = new Array<number>(size.width * size.height).fill(0);
  if (scroll === "horizontal") {
    for (let y = size.height - 2; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) tiles[tileIndex(size, x, y)] = groundTileId;
    }
  }
  return tiles;
}

export function defaultOpenings(
  kind: ZoneKind,
  scroll: Scroll,
): { entry: Opening; exit: Opening | null } {
  if (scroll === "vertical") {
    return {
      entry: { edge: "bottom", from: 7, to: 8 },
      exit: { edge: "top", from: 7, to: 8 },
    };
  }
  return {
    entry: { edge: "left", from: 9, to: 12 },
    exit: kind === "bossRoom" ? null : { edge: "right", from: 9, to: 12 },
  };
}

export function createZone(opts: NewZone, pack: ContentPack): Zone {
  const kind = opts.kind ?? "normal";
  const scroll = opts.scroll ?? "horizontal";
  const screens = opts.screens ?? 1;
  return {
    id: opts.id,
    name: opts.name,
    kind,
    scroll,
    screens,
    variant: opts.variant ?? pack.variants[0],
    intent: opts.intent ?? "",
    tiles: defaultTiles(scroll, screens, pack.groundTileId),
    things: [],
    ...defaultOpenings(kind, scroll),
  };
}

export function createLevel(
  opts: { id: string; name: string; brief?: string; zoneIds: [string, string, string] },
  pack: ContentPack,
): Level {
  const [first, corridor, bossRoom] = opts.zoneIds;
  return {
    id: opts.id,
    name: opts.name,
    brief: opts.brief ?? "",
    zones: [
      createZone({ id: first, name: "Zone 1" }, pack),
      createZone({ id: corridor, name: "Boss Corridor", kind: "bossCorridor" }, pack),
      createZone({ id: bossRoom, name: "Boss Room", kind: "bossRoom" }, pack),
    ],
    checkpoints: [],
  };
}

export function createProject(opts: { id: string; name: string }, pack: ContentPack): Project {
  return {
    formatVersion: FORMAT_VERSION,
    id: opts.id,
    name: opts.name,
    contentPackId: pack.id,
    player: { ...DEFAULT_PLAYER },
    levels: [],
    chat: [],
  };
}
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 8: Commit**

```bash
git add src/model/schema.ts src/model/contentPack.ts src/model/factory.ts tests/fixtures/testPack.ts tests/model/factory.test.ts
git commit -m "feat: add project schemas, content pack types and factories"
```

---

### Task 3: Validation and project parsing

**Files:**
- Create: `src/model/validate.ts`, `src/model/parse.ts`, `src/model/index.ts`
- Test: `tests/model/validate.test.ts`, `tests/model/parse.test.ts`

**Interfaces:**
- Consumes: Task 1 geometry; Task 2 schemas, `ContentPack`, `createProject`, `createLevel`, `testPack`
- Produces:
  - `openingProblem(size: Size, opening: Opening, role: "entry" | "exit"): string | null`
  - `zoneProblems(zone: Zone, pack: ContentPack): string[]`
  - `levelProblems(level: Level, pack: ContentPack): string[]` (hard rules)
  - `structureProblems(project: Project, pack: ContentPack): string[]` (hard rules, whole project)
  - `chainProblems(level: Level): string[]` (reported, not enforced)
  - `parseProject(raw: unknown, getPack: (id: string) => ContentPack | undefined): { ok: true; project: Project } | { ok: false; error: string }`
  - `src/model/index.ts` re-exporting every model module

- [ ] **Step 1: Write the failing validation test**

`tests/model/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLevel, createProject } from "@/model/factory";
import type { Level, Project, Zone } from "@/model/schema";
import { chainProblems, structureProblems } from "@/model/validate";
import { testPack } from "../fixtures/testPack";

function project(): Project {
  return {
    ...createProject({ id: "p1", name: "Game" }, testPack),
    levels: [createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack)],
  };
}

function withZone(p: Project, index: number, patch: Partial<Zone>): Project {
  const level = p.levels[0];
  const zones = level.zones.map((z, i) => (i === index ? { ...z, ...patch } : z));
  return { ...p, levels: [{ ...level, zones }] };
}

function withLevel(p: Project, patch: Partial<Level>): Project {
  return { ...p, levels: [{ ...p.levels[0], ...patch }] };
}

describe("structureProblems", () => {
  it("finds nothing wrong with a fresh project", () => {
    expect(structureProblems(project(), testPack)).toEqual([]);
  });

  it("reports a tile grid of the wrong length", () => {
    const problems = structureProblems(withZone(project(), 0, { tiles: [0, 0, 0] }), testPack);
    expect(problems.join(" ")).toMatch(/has 3 tiles but its size needs 240/);
  });

  it("reports a tile the pack does not have", () => {
    const tiles = project().levels[0].zones[0].tiles.slice();
    tiles[0] = 99;
    const problems = structureProblems(withZone(project(), 0, { tiles }), testPack);
    expect(problems.join(" ")).toMatch(/tile that is not in the content pack/);
  });

  it("reports a level that does not end in corridor then boss room", () => {
    const p = project();
    const [a, b, c] = p.levels[0].zones;
    const problems = structureProblems(withLevel(p, { zones: [a, c, b] }), testPack);
    expect(problems.join(" ")).toMatch(/must end with a boss corridor and then a boss room/);
  });

  it("reports fewer than three zones", () => {
    const p = project();
    const problems = structureProblems(withLevel(p, { zones: p.levels[0].zones.slice(1) }), testPack);
    expect(problems.join(" ")).toMatch(/at least three zones/);
  });

  it("reports zone names that differ only by case and spaces", () => {
    const problems = structureProblems(withZone(project(), 0, { name: " boss ROOM " }), testPack);
    expect(problems.join(" ")).toMatch(/more than one zone called/);
  });

  it("reports a boss zone that is not one horizontal screen", () => {
    const problems = structureProblems(withZone(project(), 2, { screens: 2 }), testPack);
    expect(problems.join(" ")).toMatch(/must be one horizontal screen/);
  });

  it("reports a thing outside the zone", () => {
    const things = [{ id: "t1", type: "walker", x: 16, y: 0, settings: {} }];
    const problems = structureProblems(withZone(project(), 0, { things }), testPack);
    expect(problems.join(" ")).toMatch(/outside the zone/);
  });

  it("reports a thing type the pack does not have", () => {
    const things = [{ id: "t1", type: "dragon", x: 1, y: 1, settings: {} }];
    const problems = structureProblems(withZone(project(), 0, { things }), testPack);
    expect(problems.join(" ")).toMatch(/unknown thing type "dragon"/);
  });

  it("reports an entry on the right edge and an exit on the left edge", () => {
    const p = withZone(project(), 0, {
      entry: { edge: "right", from: 9, to: 12 },
      exit: { edge: "left", from: 9, to: 12 },
    });
    const text = structureProblems(p, testPack).join(" ");
    expect(text).toMatch(/entry cannot be on the right edge/);
    expect(text).toMatch(/exit cannot be on the left edge/);
  });

  it("reports an opening that runs off its edge", () => {
    const p = withZone(project(), 0, { exit: { edge: "right", from: 12, to: 15 } });
    expect(structureProblems(p, testPack).join(" ")).toMatch(/only has positions 0 to 14/);
  });

  it("reports a normal zone with no exit and a boss room with one", () => {
    const noExit = structureProblems(withZone(project(), 0, { exit: null }), testPack);
    expect(noExit.join(" ")).toMatch(/needs an exit/);
    const bossExit = structureProblems(
      withZone(project(), 2, { exit: { edge: "right", from: 9, to: 12 } }),
      testPack,
    );
    expect(bossExit.join(" ")).toMatch(/boss room cannot have an exit/);
  });

  it("reports a checkpoint in a zone that does not exist", () => {
    const p = withLevel(project(), { checkpoints: [{ zoneId: "gone", x: 1, y: 1 }] });
    expect(structureProblems(p, testPack).join(" ")).toMatch(/checkpoint is in a zone that does not exist/);
  });

  it("reports a project built for a different content pack", () => {
    const p = { ...project(), contentPackId: "lava" };
    expect(structureProblems(p, testPack).join(" ")).toMatch(/content pack "lava"/);
  });
});

describe("chainProblems", () => {
  it("finds nothing wrong with the default chain", () => {
    expect(chainProblems(project().levels[0])).toEqual([]);
  });

  it("reports an exit that does not pair with the next entry", () => {
    const p = withZone(project(), 0, { exit: { edge: "top", from: 7, to: 8 } });
    expect(chainProblems(p.levels[0]).join(" ")).toMatch(
      /"Zone 1" exits on its top edge, so "Boss Corridor" must be entered from its bottom edge/,
    );
  });

  it("reports paired openings of different lengths", () => {
    const p = withZone(project(), 0, { exit: { edge: "right", from: 9, to: 10 } });
    expect(chainProblems(p.levels[0]).join(" ")).toMatch(/2 tiles long.*4 tiles long/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/model/validate.test.ts`
Expected: FAIL, cannot resolve `@/model/validate`.

- [ ] **Step 3: Implement validation**

`src/model/validate.ts`:

```ts
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
import type { Level, Project, Zone } from "./schema";

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

export function zoneProblems(zone: Zone, pack: ContentPack): string[] {
  const problems: string[] = [];
  const where = `Zone "${zone.name}"`;

  if (zone.name.trim() === "") problems.push("A zone has an empty name.");
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
    const key = zone.name.trim().toLowerCase();
    if (names.has(key)) problems.push(`${where} has more than one zone called "${zone.name.trim()}".`);
    names.add(key);
    problems.push(...zoneProblems(zone, pack));
  }

  for (const checkpoint of level.checkpoints) {
    const zone = zones.find((z) => z.id === checkpoint.zoneId);
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
```

- [ ] **Step 4: Run the validation test to verify it passes**

Run: `npm test -- tests/model/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing parse test**

`tests/model/parse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLevel, createProject } from "@/model/factory";
import { parseProject } from "@/model/parse";
import type { Project } from "@/model/schema";
import { testPack } from "../fixtures/testPack";

const getPack = (id: string) => (id === "test" ? testPack : undefined);

function project(): Project {
  return {
    ...createProject({ id: "p1", name: "Game" }, testPack),
    levels: [createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["a", "b", "c"] }, testPack)],
  };
}

function errorOf(raw: unknown): string {
  const result = parseProject(raw, getPack);
  if (result.ok) throw new Error("expected a failure");
  return result.error;
}

describe("parseProject", () => {
  it("round-trips a project through JSON", () => {
    const original = project();
    const result = parseProject(JSON.parse(JSON.stringify(original)), getPack);
    expect(result).toEqual({ ok: true, project: original });
  });

  it("refuses things that are not a project file", () => {
    for (const raw of ["hello", null, undefined, 42, [1, 2, 3]]) {
      expect(errorOf(raw)).toMatch(/not a MegaRomBuilder project/);
    }
  });

  it("refuses an object with no format version", () => {
    expect(errorOf({ name: "x" })).toMatch(/not a MegaRomBuilder project/);
  });

  it("refuses a project from a newer version", () => {
    expect(errorOf({ ...project(), formatVersion: 2 })).toMatch(/newer version/);
  });

  it("explains which field is wrong when the shape is bad", () => {
    const bad = { ...project(), name: 5 };
    expect(errorOf(bad)).toMatch(/name/);
  });

  it("refuses a project whose content pack is missing", () => {
    expect(errorOf({ ...project(), contentPackId: "lava" })).toMatch(/content pack "lava"/);
  });

  it("refuses a project that breaks a hard rule", () => {
    const p = project();
    const zones = p.levels[0].zones.map((z, i) => (i === 0 ? { ...z, tiles: [0] } : z));
    const bad = { ...p, levels: [{ ...p.levels[0], zones }] };
    expect(errorOf(bad)).toMatch(/has 1 tiles but its size needs 240/);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- tests/model/parse.test.ts`
Expected: FAIL, cannot resolve `@/model/parse`.

- [ ] **Step 7: Implement parsing and the index**

`src/model/parse.ts`:

```ts
import type { ContentPack } from "./contentPack";
import { FORMAT_VERSION, projectSchema, type Project } from "./schema";
import { structureProblems } from "./validate";

export type ParseResult = { ok: true; project: Project } | { ok: false; error: string };

// One entry per old format version: upgrades a document to the next version.
const UPGRADES: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {};

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
  for (let v = version; v < FORMAT_VERSION; v++) doc = UPGRADES[v](doc);

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
```

`src/model/index.ts`:

```ts
export * from "./contentPack";
export * from "./factory";
export * from "./geometry";
export * from "./parse";
export * from "./schema";
export * from "./validate";
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 9: Commit**

```bash
git add src/model/validate.ts src/model/parse.ts src/model/index.ts tests/model/validate.test.ts tests/model/parse.test.ts
git commit -m "feat: add project validation and parsing"
```

---

### Task 4: Command core and level commands

**Files:**
- Create: `src/commands/types.ts`, `src/commands/helpers.ts`, `src/commands/level.ts`, `src/commands/registry.ts`
- Create: `tests/commands/helpers.ts`
- Test: `tests/commands/level.test.ts`

**Interfaces:**
- Consumes: `Project`, `Level`, `Zone` (Task 2); `createLevel` (Task 2); `ContentPack` (Task 2); `structureProblems` (Task 3); `testPack` (Task 2)
- Produces:
  - `type CommandContext = { pack: ContentPack }`
  - `type CommandResult = { ok: true; project: Project } | { ok: false; error: string }`
  - `type Command = { name: string; args: unknown }`
  - `type CommandDef = { name: string; description: string; args: z.ZodType; apply: (project: Project, args: never, ctx: CommandContext) => CommandResult }`
  - `defineCommand(def)`, `ok(project)`, `fail(error)`
  - Shared arg schemas: `idArg`, `nameArg`, `coordArg`
  - `editLevel(project: Project, levelId: string, fn: (level: Level) => Level | string): CommandResult`
  - `editZone(project: Project, levelId: string, zoneId: string, fn: (zone: Zone, level: Level) => Zone | string): CommandResult`
  - `nameTaken(level: Level, name: string, exceptZoneId?: string): boolean`
  - `levelCommands: CommandDef[]` with `createLevel`, `renameLevel`, `setLevelBrief`, `deleteLevel`
  - `commandDefs: CommandDef[]`, `applyCommand(project: Project, command: Command, ctx: CommandContext): CommandResult`
  - Test helpers: `ctx`, `baseProject()`, `run(project, name, args): Project`, `runError(project, name, args): string`, `patchZone(project, zoneId, patch): Project`, `zoneOf(project, zoneId): Zone`

- [ ] **Step 1: Write the test helpers**

`tests/commands/helpers.ts`:

```ts
import { expect } from "vitest";
import { applyCommand } from "@/commands/registry";
import type { CommandContext } from "@/commands/types";
import { createLevel, createProject } from "@/model/factory";
import type { Project, Zone } from "@/model/schema";
import { structureProblems } from "@/model/validate";
import { testPack } from "../fixtures/testPack";

export const ctx: CommandContext = { pack: testPack };

// One level "L1" with zones z1 ("Zone 1"), corridor and boss.
export function baseProject(): Project {
  return {
    ...createProject({ id: "p1", name: "Game" }, testPack),
    levels: [
      createLevel({ id: "L1", name: "Snow Stage", zoneIds: ["z1", "corridor", "boss"] }, testPack),
    ],
  };
}

// Runs a command that must succeed, and checks it left the project structurally valid.
export function run(project: Project, name: string, args: unknown): Project {
  const result = applyCommand(project, { name, args }, ctx);
  if (!result.ok) throw new Error(`${name} failed: ${result.error}`);
  expect(structureProblems(result.project, testPack)).toEqual([]);
  return result.project;
}

// Runs a command that must fail, and returns its error message.
export function runError(project: Project, name: string, args: unknown): string {
  const result = applyCommand(project, { name, args }, ctx);
  if (result.ok) throw new Error(`${name} should have failed`);
  return result.error;
}

export function zoneOf(project: Project, zoneId: string): Zone {
  const zone = project.levels[0].zones.find((z) => z.id === zoneId);
  if (!zone) throw new Error(`no zone ${zoneId}`);
  return zone;
}

export function patchZone(project: Project, zoneId: string, patch: Partial<Zone>): Project {
  const level = project.levels[0];
  const zones = level.zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z));
  return { ...project, levels: [{ ...level, zones }, ...project.levels.slice(1)] };
}
```

- [ ] **Step 2: Write the failing level command test**

`tests/commands/level.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { baseProject, run, runError } from "./helpers";

describe("applyCommand", () => {
  it("refuses an unknown command", () => {
    expect(runError(baseProject(), "explode", {})).toMatch(/Unknown command "explode"/);
  });

  it("refuses arguments of the wrong shape and names the field", () => {
    const error = runError(baseProject(), "renameLevel", { levelId: "L1", name: 7 });
    expect(error).toMatch(/Invalid arguments for renameLevel/);
    expect(error).toMatch(/name/);
  });

  it("does not change the project when a command fails", () => {
    const project = baseProject();
    const before = JSON.stringify(project);
    runError(project, "renameLevel", { levelId: "nope", name: "X" });
    expect(JSON.stringify(project)).toBe(before);
  });
});

describe("createLevel", () => {
  it("adds a level with three zones", () => {
    const project = run(baseProject(), "createLevel", {
      levelId: "L2",
      name: "  Ice Stage ",
      zoneIds: ["a", "b", "c"],
    });
    expect(project.levels).toHaveLength(2);
    expect(project.levels[1].name).toBe("Ice Stage");
    expect(project.levels[1].zones.map((z) => z.id)).toEqual(["a", "b", "c"]);
  });

  it("refuses a level id that is already used", () => {
    const error = runError(baseProject(), "createLevel", {
      levelId: "L1",
      name: "Again",
      zoneIds: ["a", "b", "c"],
    });
    expect(error).toMatch(/already exists/);
  });

  it("refuses repeated zone ids", () => {
    const error = runError(baseProject(), "createLevel", {
      levelId: "L2",
      name: "Ice",
      zoneIds: ["a", "a", "c"],
    });
    expect(error).toMatch(/must be different/);
  });
});

describe("renameLevel, setLevelBrief, deleteLevel", () => {
  it("renames a level", () => {
    const project = run(baseProject(), "renameLevel", { levelId: "L1", name: "Frost Peak" });
    expect(project.levels[0].name).toBe("Frost Peak");
  });

  it("refuses an empty name", () => {
    expect(runError(baseProject(), "renameLevel", { levelId: "L1", name: "   " })).toMatch(
      /Invalid arguments/,
    );
  });

  it("sets the brief", () => {
    const project = run(baseProject(), "setLevelBrief", {
      levelId: "L1",
      brief: "Teach ice floors early.",
    });
    expect(project.levels[0].brief).toBe("Teach ice floors early.");
  });

  it("deletes a level", () => {
    const project = run(baseProject(), "deleteLevel", { levelId: "L1" });
    expect(project.levels).toEqual([]);
  });

  it("reports a missing level", () => {
    expect(runError(baseProject(), "deleteLevel", { levelId: "nope" })).toMatch(
      /no level with id "nope"/,
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tests/commands/level.test.ts`
Expected: FAIL, cannot resolve `@/commands/registry`.

- [ ] **Step 4: Implement the command core**

`src/commands/types.ts`:

```ts
import { z } from "zod";
import type { ContentPack } from "@/model/contentPack";
import type { Project } from "@/model/schema";

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

export const idArg = z.string().min(1).max(64);
export const nameArg = z.string().trim().min(1).max(40);
export const coordArg = z.number().int();
```

`src/commands/helpers.ts`:

```ts
import type { Level, Project, Zone } from "@/model/schema";
import { fail, ok, type CommandResult } from "./types";

// Replaces one level. The callback returns the new level, or a string to fail with.
export function editLevel(
  project: Project,
  levelId: string,
  fn: (level: Level) => Level | string,
): CommandResult {
  const index = project.levels.findIndex((l) => l.id === levelId);
  if (index < 0) return fail(`There is no level with id "${levelId}".`);
  const next = fn(project.levels[index]);
  if (typeof next === "string") return fail(next);
  const levels = project.levels.slice();
  levels[index] = next;
  return ok({ ...project, levels });
}

// Replaces one zone. The callback returns the new zone, or a string to fail with.
export function editZone(
  project: Project,
  levelId: string,
  zoneId: string,
  fn: (zone: Zone, level: Level) => Zone | string,
): CommandResult {
  return editLevel(project, levelId, (level) => {
    const index = level.zones.findIndex((z) => z.id === zoneId);
    if (index < 0) return `There is no zone with id "${zoneId}" in level "${level.name}".`;
    const next = fn(level.zones[index], level);
    if (typeof next === "string") return next;
    const zones = level.zones.slice();
    zones[index] = next;
    return { ...level, zones };
  });
}

export function nameTaken(level: Level, name: string, exceptZoneId?: string): boolean {
  const key = name.trim().toLowerCase();
  return level.zones.some((z) => z.id !== exceptZoneId && z.name.trim().toLowerCase() === key);
}
```

`src/commands/level.ts`:

```ts
import { z } from "zod";
import { createLevel } from "@/model/factory";
import { editLevel } from "./helpers";
import { defineCommand, fail, idArg, nameArg, ok } from "./types";

const createLevelCommand = defineCommand({
  name: "createLevel",
  description: "Create a level with one starting zone, a boss corridor and a boss room.",
  args: z.object({
    levelId: idArg,
    name: nameArg,
    brief: z.string().max(1000).default(""),
    zoneIds: z.tuple([idArg, idArg, idArg]),
  }),
  apply(project, args, ctx) {
    if (project.levels.some((l) => l.id === args.levelId)) {
      return fail(`A level with id "${args.levelId}" already exists.`);
    }
    if (new Set(args.zoneIds).size !== 3) return fail("The three zone ids must be different.");
    const level = createLevel(
      { id: args.levelId, name: args.name, brief: args.brief, zoneIds: args.zoneIds },
      ctx.pack,
    );
    return ok({ ...project, levels: [...project.levels, level] });
  },
});

const renameLevelCommand = defineCommand({
  name: "renameLevel",
  description: "Change a level's name.",
  args: z.object({ levelId: idArg, name: nameArg }),
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => ({ ...level, name: args.name }));
  },
});

const setLevelBriefCommand = defineCommand({
  name: "setLevelBrief",
  description: "Set the plain-language design brief for a level.",
  args: z.object({ levelId: idArg, brief: z.string().max(1000) }),
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => ({ ...level, brief: args.brief }));
  },
});

const deleteLevelCommand = defineCommand({
  name: "deleteLevel",
  description: "Delete a level and everything in it.",
  args: z.object({ levelId: idArg }),
  apply(project, args) {
    if (!project.levels.some((l) => l.id === args.levelId)) {
      return fail(`There is no level with id "${args.levelId}".`);
    }
    return ok({ ...project, levels: project.levels.filter((l) => l.id !== args.levelId) });
  },
});

export const levelCommands = [
  createLevelCommand,
  renameLevelCommand,
  setLevelBriefCommand,
  deleteLevelCommand,
];
```

`src/commands/registry.ts`:

```ts
import type { Project } from "@/model/schema";
import { levelCommands } from "./level";
import {
  fail,
  type Command,
  type CommandContext,
  type CommandDef,
  type CommandResult,
} from "./types";

export const commandDefs: CommandDef[] = [...levelCommands];

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
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/commands/types.ts src/commands/helpers.ts src/commands/level.ts src/commands/registry.ts tests/commands/helpers.ts tests/commands/level.test.ts
git commit -m "feat: add command core and level commands"
```

---

### Task 5: Zone commands

**Files:**
- Create: `src/commands/zones.ts`
- Modify: `src/commands/registry.ts` (add `zoneCommands` to `commandDefs`)
- Test: `tests/commands/zones.test.ts`

**Interfaces:**
- Consumes: `defineCommand`, `fail`, `ok`, `idArg`, `nameArg`, `editLevel`, `editZone`, `nameTaken` (Task 4); `createZone` (Task 2); `openingProblem` (Task 3); `MAX_SCREENS`, `zoneSize`, `tileIndex`, `inBounds`, `edgeLength`, `clampOpening`, `Opening` (Task 1); test helpers (Task 4)
- Produces: `zoneCommands: CommandDef[]` with these commands and arguments:
  - `addZone { levelId, zoneId, name, scroll = "horizontal", screens = 1, variant?, intent = "", index? }`
  - `removeZone { levelId, zoneId }`
  - `moveZone { levelId, zoneId, toIndex }`
  - `renameZone { levelId, zoneId, name }`
  - `resizeZone { levelId, zoneId, screens }`
  - `setZoneVariant { levelId, zoneId, variant }`
  - `setZoneIntent { levelId, zoneId, intent }`
  - `setZoneOpenings { levelId, zoneId, entry?, exit? }` where each is `{ edge, from, to }`

Resize rules: a horizontal zone keeps its left side and gains or loses columns on the right, with new columns getting the two-row floor. A vertical zone keeps the side its entry is on: entry at the top keeps the top rows; otherwise it keeps the bottom rows and everything shifts down by the number of rows added. Things and checkpoints that end up outside are removed. Openings are slid back inside.

- [ ] **Step 1: Write the failing test**

`tests/commands/zones.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tileIndex } from "@/model/geometry";
import type { Project } from "@/model/schema";
import { baseProject, patchZone, run, runError, zoneOf } from "./helpers";

const L = "L1";

function withCave(): Project {
  return run(baseProject(), "addZone", { levelId: L, zoneId: "z2", name: "Ice Cave", screens: 3 });
}

describe("addZone", () => {
  it("inserts before the boss corridor by default", () => {
    const project = withCave();
    expect(project.levels[0].zones.map((z) => z.id)).toEqual(["z1", "z2", "corridor", "boss"]);
    expect(zoneOf(project, "z2").tiles).toHaveLength(48 * 15);
    expect(zoneOf(project, "z2").variant).toBe("outdoor");
  });

  it("inserts at a given position", () => {
    const project = run(baseProject(), "addZone", {
      levelId: L,
      zoneId: "z0",
      name: "Intro",
      index: 0,
    });
    expect(project.levels[0].zones.map((z) => z.id)).toEqual(["z0", "z1", "corridor", "boss"]);
  });

  it("refuses a position after the boss corridor", () => {
    expect(
      runError(baseProject(), "addZone", { levelId: L, zoneId: "z2", name: "Late", index: 2 }),
    ).toMatch(/before the boss corridor/);
  });

  it("refuses a name that differs only by case and spaces", () => {
    const error = runError(withCave(), "addZone", { levelId: L, zoneId: "z3", name: " ice CAVE " });
    expect(error).toMatch(/already a zone called "ice CAVE"/);
  });

  it("refuses a repeated zone id", () => {
    expect(runError(baseProject(), "addZone", { levelId: L, zoneId: "z1", name: "Dup" })).toMatch(
      /already exists/,
    );
  });

  it("refuses a vertical zone longer than six screens", () => {
    const error = runError(baseProject(), "addZone", {
      levelId: L,
      zoneId: "v",
      name: "Tower",
      scroll: "vertical",
      screens: 7,
    });
    expect(error).toMatch(/at most 6 screens/);
  });

  it("refuses an unknown variant and lists the real ones", () => {
    const error = runError(baseProject(), "addZone", {
      levelId: L,
      zoneId: "z2",
      name: "Lava",
      variant: "lava",
    });
    expect(error).toMatch(/Unknown variant "lava"/);
    expect(error).toMatch(/outdoor, cave/);
  });
});

describe("removeZone", () => {
  it("removes a zone and its checkpoints", () => {
    let project = withCave();
    project = {
      ...project,
      levels: [
        {
          ...project.levels[0],
          checkpoints: [
            { zoneId: "z2", x: 1, y: 12 },
            { zoneId: "z1", x: 1, y: 12 },
          ],
        },
      ],
    };
    project = run(project, "removeZone", { levelId: L, zoneId: "z2" });
    expect(project.levels[0].zones.map((z) => z.id)).toEqual(["z1", "corridor", "boss"]);
    expect(project.levels[0].checkpoints).toEqual([{ zoneId: "z1", x: 1, y: 12 }]);
  });

  it("refuses to remove a boss zone", () => {
    expect(runError(withCave(), "removeZone", { levelId: L, zoneId: "boss" })).toMatch(
      /boss corridor and boss room cannot be removed/,
    );
  });

  it("refuses to remove the last normal zone", () => {
    expect(runError(baseProject(), "removeZone", { levelId: L, zoneId: "z1" })).toMatch(
      /at least one zone before the boss corridor/,
    );
  });
});

describe("moveZone", () => {
  it("reorders normal zones", () => {
    const project = run(withCave(), "moveZone", { levelId: L, zoneId: "z2", toIndex: 0 });
    expect(project.levels[0].zones.map((z) => z.id)).toEqual(["z2", "z1", "corridor", "boss"]);
  });

  it("refuses to move a boss zone", () => {
    expect(runError(withCave(), "moveZone", { levelId: L, zoneId: "corridor", toIndex: 0 })).toMatch(
      /cannot be moved/,
    );
  });

  it("refuses a position among the boss zones", () => {
    expect(runError(withCave(), "moveZone", { levelId: L, zoneId: "z1", toIndex: 2 })).toMatch(
      /position 0 to 1/,
    );
  });
});

describe("renameZone", () => {
  it("renames and trims", () => {
    const project = run(baseProject(), "renameZone", { levelId: L, zoneId: "z1", name: " Snowy Path " });
    expect(zoneOf(project, "z1").name).toBe("Snowy Path");
  });

  it("lets a zone keep its own name with different case", () => {
    const project = run(baseProject(), "renameZone", { levelId: L, zoneId: "z1", name: "ZONE 1" });
    expect(zoneOf(project, "z1").name).toBe("ZONE 1");
  });

  it("refuses another zone's name", () => {
    expect(
      runError(baseProject(), "renameZone", { levelId: L, zoneId: "z1", name: "boss room" }),
    ).toMatch(/already a zone called "boss room"/);
  });

  it("reports a missing zone", () => {
    expect(runError(baseProject(), "renameZone", { levelId: L, zoneId: "zz", name: "X" })).toMatch(
      /no zone with id "zz"/,
    );
  });
});

describe("resizeZone", () => {
  it("shrinks a horizontal zone, dropping things and checkpoints past the new edge", () => {
    let project = patchZone(withCave(), "z2", {
      things: [
        { id: "near", type: "walker", x: 5, y: 12, settings: {} },
        { id: "far", type: "walker", x: 40, y: 12, settings: {} },
      ],
    });
    project = {
      ...project,
      levels: [
        {
          ...project.levels[0],
          checkpoints: [
            { zoneId: "z2", x: 5, y: 12 },
            { zoneId: "z2", x: 40, y: 12 },
          ],
        },
      ],
    };
    project = run(project, "resizeZone", { levelId: L, zoneId: "z2", screens: 1 });
    const zone = zoneOf(project, "z2");
    expect(zone.screens).toBe(1);
    expect(zone.tiles).toHaveLength(240);
    expect(zone.things.map((t) => t.id)).toEqual(["near"]);
    expect(project.levels[0].checkpoints).toEqual([{ zoneId: "z2", x: 5, y: 12 }]);
    expect(zone.exit).toEqual({ edge: "right", from: 9, to: 12 });
  });

  it("slides a top opening back inside when a horizontal zone shrinks", () => {
    let project = patchZone(withCave(), "z2", { exit: { edge: "top", from: 44, to: 45 } });
    project = run(project, "resizeZone", { levelId: L, zoneId: "z2", screens: 2 });
    expect(zoneOf(project, "z2").exit).toEqual({ edge: "top", from: 30, to: 31 });
  });

  it("grows a horizontal zone with floor under the new columns", () => {
    const project = run(baseProject(), "resizeZone", { levelId: L, zoneId: "z1", screens: 2 });
    const zone = zoneOf(project, "z1");
    const size = { width: 32, height: 15 };
    expect(zone.tiles).toHaveLength(480);
    expect(zone.tiles[tileIndex(size, 20, 14)]).toBe(1);
    expect(zone.tiles[tileIndex(size, 20, 13)]).toBe(1);
    expect(zone.tiles[tileIndex(size, 20, 12)]).toBe(0);
  });

  it("grows a bottom-entry vertical zone at the top, shifting contents down", () => {
    let project = run(baseProject(), "addZone", {
      levelId: L,
      zoneId: "v",
      name: "Climb",
      scroll: "vertical",
      screens: 2,
    });
    const tiles = zoneOf(project, "v").tiles.slice();
    tiles[tileIndex({ width: 16, height: 30 }, 4, 29)] = 2;
    project = patchZone(project, "v", {
      tiles,
      things: [{ id: "t", type: "walker", x: 3, y: 29, settings: {} }],
    });
    project = run(project, "resizeZone", { levelId: L, zoneId: "v", screens: 3 });
    const zone = zoneOf(project, "v");
    expect(zone.things[0].y).toBe(44);
    expect(zone.tiles[tileIndex({ width: 16, height: 45 }, 4, 44)]).toBe(2);
    expect(zone.entry).toEqual({ edge: "bottom", from: 7, to: 8 });
  });

  it("shrinks a bottom-entry vertical zone from the top", () => {
    let project = run(baseProject(), "addZone", {
      levelId: L,
      zoneId: "v",
      name: "Climb",
      scroll: "vertical",
      screens: 2,
    });
    project = patchZone(project, "v", {
      things: [
        { id: "low", type: "walker", x: 3, y: 29, settings: {} },
        { id: "high", type: "walker", x: 3, y: 0, settings: {} },
      ],
    });
    project = run(project, "resizeZone", { levelId: L, zoneId: "v", screens: 1 });
    const zone = zoneOf(project, "v");
    expect(zone.things).toEqual([{ id: "low", type: "walker", x: 3, y: 14, settings: {} }]);
  });

  it("keeps the top of a top-entry vertical zone", () => {
    let project = run(baseProject(), "addZone", {
      levelId: L,
      zoneId: "v",
      name: "Drop",
      scroll: "vertical",
      screens: 2,
    });
    project = patchZone(project, "v", {
      entry: { edge: "top", from: 7, to: 8 },
      exit: { edge: "bottom", from: 7, to: 8 },
      things: [{ id: "high", type: "walker", x: 3, y: 2, settings: {} }],
    });
    project = run(project, "resizeZone", { levelId: L, zoneId: "v", screens: 3 });
    expect(zoneOf(project, "v").things[0].y).toBe(2);
  });

  it("refuses to resize a boss zone", () => {
    expect(runError(baseProject(), "resizeZone", { levelId: L, zoneId: "boss", screens: 2 })).toMatch(
      /always one screen/,
    );
  });

  it("refuses a size past the limit", () => {
    expect(runError(baseProject(), "resizeZone", { levelId: L, zoneId: "z1", screens: 9 })).toMatch(
      /Invalid arguments/,
    );
  });
});

describe("setZoneVariant and setZoneIntent", () => {
  it("sets the variant", () => {
    const project = run(baseProject(), "setZoneVariant", { levelId: L, zoneId: "z1", variant: "cave" });
    expect(zoneOf(project, "z1").variant).toBe("cave");
  });

  it("refuses an unknown variant", () => {
    expect(
      runError(baseProject(), "setZoneVariant", { levelId: L, zoneId: "z1", variant: "lava" }),
    ).toMatch(/Unknown variant "lava"/);
  });

  it("sets the intent", () => {
    const project = run(baseProject(), "setZoneIntent", {
      levelId: L,
      zoneId: "z1",
      intent: "First safe look at ice floors.",
    });
    expect(zoneOf(project, "z1").intent).toBe("First safe look at ice floors.");
  });
});

describe("setZoneOpenings", () => {
  it("sets the exit and leaves the entry alone", () => {
    const project = run(baseProject(), "setZoneOpenings", {
      levelId: L,
      zoneId: "z1",
      exit: { edge: "top", from: 7, to: 8 },
    });
    expect(zoneOf(project, "z1").exit).toEqual({ edge: "top", from: 7, to: 8 });
    expect(zoneOf(project, "z1").entry).toEqual({ edge: "left", from: 9, to: 12 });
  });

  it("refuses an exit on the left edge", () => {
    expect(
      runError(baseProject(), "setZoneOpenings", {
        levelId: L,
        zoneId: "z1",
        exit: { edge: "left", from: 9, to: 12 },
      }),
    ).toMatch(/exit cannot be on the left edge/);
  });

  it("refuses an opening that runs off the edge", () => {
    expect(
      runError(baseProject(), "setZoneOpenings", {
        levelId: L,
        zoneId: "z1",
        entry: { edge: "left", from: 12, to: 15 },
      }),
    ).toMatch(/only has positions 0 to 14/);
  });

  it("refuses an exit on the boss room", () => {
    expect(
      runError(baseProject(), "setZoneOpenings", {
        levelId: L,
        zoneId: "boss",
        exit: { edge: "right", from: 9, to: 12 },
      }),
    ).toMatch(/boss room has no exit/);
  });

  it("refuses a call with neither opening", () => {
    expect(runError(baseProject(), "setZoneOpenings", { levelId: L, zoneId: "z1" })).toMatch(
      /Give an entry, an exit, or both/,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/commands/zones.test.ts`
Expected: FAIL with `Unknown command "addZone"`.

- [ ] **Step 3: Implement the zone commands**

`src/commands/zones.ts`:

```ts
import { z } from "zod";
import type { ContentPack } from "@/model/contentPack";
import { createZone } from "@/model/factory";
import {
  MAX_SCREENS,
  clampOpening,
  edgeLength,
  inBounds,
  tileIndex,
  zoneSize,
  type Opening,
} from "@/model/geometry";
import type { Level, Zone } from "@/model/schema";
import { openingProblem } from "@/model/validate";
import { editLevel, editZone, nameTaken } from "./helpers";
import { defineCommand, idArg, nameArg } from "./types";

const scrollArg = z.enum(["horizontal", "vertical"]);
const screensArg = z.number().int().min(1).max(8);
const openingArg = z.object({
  edge: z.enum(["left", "right", "top", "bottom"]),
  from: z.number().int().min(0),
  to: z.number().int().min(0),
});

function variantProblem(pack: ContentPack, variant: string): string | null {
  if (pack.variants.includes(variant)) return null;
  return `Unknown variant "${variant}". Choose one of: ${pack.variants.join(", ")}.`;
}

function nameProblem(level: Level, name: string, exceptZoneId?: string): string | null {
  if (!nameTaken(level, name, exceptZoneId)) return null;
  return `There is already a zone called "${name}" in this level. Zone names must be different.`;
}

const addZoneCommand = defineCommand({
  name: "addZone",
  description:
    "Add a zone to a level. By default it goes just before the boss corridor. Horizontal zones can be 1 to 8 screens, vertical zones 1 to 6.",
  args: z.object({
    levelId: idArg,
    zoneId: idArg,
    name: nameArg,
    scroll: scrollArg.default("horizontal"),
    screens: screensArg.default(1),
    variant: z.string().optional(),
    intent: z.string().max(200).default(""),
    index: z.number().int().min(0).optional(),
  }),
  apply(project, args, ctx) {
    return editLevel(project, args.levelId, (level) => {
      if (level.zones.some((z) => z.id === args.zoneId)) {
        return `A zone with id "${args.zoneId}" already exists in this level.`;
      }
      const clash = nameProblem(level, args.name);
      if (clash) return clash;
      if (args.screens > MAX_SCREENS[args.scroll]) {
        return `A ${args.scroll} zone can be at most ${MAX_SCREENS[args.scroll]} screens long.`;
      }
      const variant = args.variant ?? ctx.pack.variants[0];
      const badVariant = variantProblem(ctx.pack, variant);
      if (badVariant) return badVariant;
      const last = level.zones.length - 2;
      const index = args.index ?? last;
      if (index > last) {
        return `A zone can only be added before the boss corridor (position 0 to ${last}).`;
      }
      const zone = createZone(
        {
          id: args.zoneId,
          name: args.name,
          scroll: args.scroll,
          screens: args.screens,
          variant,
          intent: args.intent,
        },
        ctx.pack,
      );
      const zones = level.zones.slice();
      zones.splice(index, 0, zone);
      return { ...level, zones };
    });
  },
});

const removeZoneCommand = defineCommand({
  name: "removeZone",
  description: "Remove a zone and any checkpoints in it. Boss zones cannot be removed.",
  args: z.object({ levelId: idArg, zoneId: idArg }),
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => {
      const zone = level.zones.find((z) => z.id === args.zoneId);
      if (!zone) return `There is no zone with id "${args.zoneId}" in level "${level.name}".`;
      if (zone.kind !== "normal") return "The boss corridor and boss room cannot be removed.";
      if (level.zones.filter((z) => z.kind === "normal").length <= 1) {
        return "A level needs at least one zone before the boss corridor.";
      }
      return {
        ...level,
        zones: level.zones.filter((z) => z.id !== args.zoneId),
        checkpoints: level.checkpoints.filter((c) => c.zoneId !== args.zoneId),
      };
    });
  },
});

const moveZoneCommand = defineCommand({
  name: "moveZone",
  description: "Move a zone to a new position in the level. Boss zones stay at the end.",
  args: z.object({ levelId: idArg, zoneId: idArg, toIndex: z.number().int().min(0) }),
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => {
      const from = level.zones.findIndex((z) => z.id === args.zoneId);
      if (from < 0) return `There is no zone with id "${args.zoneId}" in level "${level.name}".`;
      if (level.zones[from].kind !== "normal") {
        return "The boss corridor and boss room cannot be moved.";
      }
      const last = level.zones.length - 3;
      if (args.toIndex > last) {
        return `A zone can only be moved to position 0 to ${last}, before the boss corridor.`;
      }
      const zones = level.zones.slice();
      const [zone] = zones.splice(from, 1);
      zones.splice(args.toIndex, 0, zone);
      return { ...level, zones };
    });
  },
});

const renameZoneCommand = defineCommand({
  name: "renameZone",
  description: "Change a zone's name. Names must be different within a level.",
  args: z.object({ levelId: idArg, zoneId: idArg, name: nameArg }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone, level) => {
      const clash = nameProblem(level, args.name, zone.id);
      return clash ?? { ...zone, name: args.name };
    });
  },
});

// Returns the resized zone and how many rows its contents moved down by.
function resized(zone: Zone, screens: number, groundTileId: number): { zone: Zone; dy: number } {
  const old = zoneSize(zone.scroll, zone.screens);
  const size = zoneSize(zone.scroll, screens);
  const keepBottom = zone.scroll === "vertical" && zone.entry.edge !== "top";
  const dy = keepBottom ? size.height - old.height : 0;

  const tiles = new Array<number>(size.width * size.height).fill(0);
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const oldY = y - dy;
      if (x < old.width && oldY >= 0 && oldY < old.height) {
        tiles[tileIndex(size, x, y)] = zone.tiles[tileIndex(old, x, oldY)];
      } else if (zone.scroll === "horizontal" && y >= size.height - 2) {
        tiles[tileIndex(size, x, y)] = groundTileId;
      }
    }
  }

  const fit = (opening: Opening): Opening => {
    const shift = opening.edge === "left" || opening.edge === "right" ? dy : 0;
    return clampOpening(
      { edge: opening.edge, from: opening.from + shift, to: opening.to + shift },
      edgeLength(size, opening.edge),
    );
  };

  return {
    dy,
    zone: {
      ...zone,
      screens,
      tiles,
      things: zone.things
        .map((t) => ({ ...t, y: t.y + dy }))
        .filter((t) => inBounds(size, t.x, t.y)),
      entry: fit(zone.entry),
      exit: zone.exit ? fit(zone.exit) : null,
    },
  };
}

const resizeZoneCommand = defineCommand({
  name: "resizeZone",
  description:
    "Change how many screens long a zone is. Things and checkpoints left outside are removed.",
  args: z.object({ levelId: idArg, zoneId: idArg, screens: screensArg }),
  apply(project, args, ctx) {
    return editLevel(project, args.levelId, (level) => {
      const index = level.zones.findIndex((z) => z.id === args.zoneId);
      if (index < 0) return `There is no zone with id "${args.zoneId}" in level "${level.name}".`;
      const zone = level.zones[index];
      if (zone.kind !== "normal") return "The boss corridor and boss room are always one screen.";
      if (args.screens > MAX_SCREENS[zone.scroll]) {
        return `A ${zone.scroll} zone can be at most ${MAX_SCREENS[zone.scroll]} screens long.`;
      }
      const next = resized(zone, args.screens, ctx.pack.groundTileId);
      const size = zoneSize(next.zone.scroll, next.zone.screens);
      const zones = level.zones.slice();
      zones[index] = next.zone;
      const checkpoints = level.checkpoints
        .map((c) => (c.zoneId === zone.id ? { ...c, y: c.y + next.dy } : c))
        .filter((c) => c.zoneId !== zone.id || inBounds(size, c.x, c.y));
      return { ...level, zones, checkpoints };
    });
  },
});

const setZoneVariantCommand = defineCommand({
  name: "setZoneVariant",
  description: "Change which look of the theme a zone uses, such as outdoor or cave.",
  args: z.object({ levelId: idArg, zoneId: idArg, variant: z.string() }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      return variantProblem(ctx.pack, args.variant) ?? { ...zone, variant: args.variant };
    });
  },
});

const setZoneIntentCommand = defineCommand({
  name: "setZoneIntent",
  description: "Set the one-line note on what a zone is for.",
  args: z.object({ levelId: idArg, zoneId: idArg, intent: z.string().max(200) }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) => ({
      ...zone,
      intent: args.intent,
    }));
  },
});

const setZoneOpeningsCommand = defineCommand({
  name: "setZoneOpenings",
  description:
    "Set where the player enters and leaves a zone. For left and right edges, from and to are rows; for top and bottom they are columns.",
  args: z.object({
    levelId: idArg,
    zoneId: idArg,
    entry: openingArg.optional(),
    exit: openingArg.optional(),
  }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      if (!args.entry && !args.exit) return "Give an entry, an exit, or both.";
      if (args.exit && zone.kind === "bossRoom") return "The boss room has no exit.";
      const size = zoneSize(zone.scroll, zone.screens);
      if (args.entry) {
        const problem = openingProblem(size, args.entry, "entry");
        if (problem) return problem;
      }
      if (args.exit) {
        const problem = openingProblem(size, args.exit, "exit");
        if (problem) return problem;
      }
      return { ...zone, entry: args.entry ?? zone.entry, exit: args.exit ?? zone.exit };
    });
  },
});

export const zoneCommands = [
  addZoneCommand,
  removeZoneCommand,
  moveZoneCommand,
  renameZoneCommand,
  resizeZoneCommand,
  setZoneVariantCommand,
  setZoneIntentCommand,
  setZoneOpeningsCommand,
];
```

- [ ] **Step 4: Register the zone commands**

In `src/commands/registry.ts`, add the import and extend the list:

```ts
import { zoneCommands } from "./zones";
```

```ts
export const commandDefs: CommandDef[] = [...levelCommands, ...zoneCommands];
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/commands/zones.ts src/commands/registry.ts tests/commands/zones.test.ts
git commit -m "feat: add zone commands"
```

---

### Task 6: Tile commands

**Files:**
- Create: `src/commands/tiles.ts`
- Modify: `src/commands/registry.ts` (add `tileCommands`)
- Test: `tests/commands/tiles.test.ts`

**Interfaces:**
- Consumes: `defineCommand`, `idArg`, `coordArg`, `editZone` (Task 4); `zoneSize`, `tileIndex`, `inBounds`, `rectInBounds` (Task 1); test helpers (Task 4)
- Produces: `tileCommands: CommandDef[]`:
  - `setTiles { levelId, zoneId, cells: { x, y, tile }[] }` (1 to 2000 cells)
  - `fillRect { levelId, zoneId, x, y, w, h, tile }`
  - `clearRect { levelId, zoneId, x, y, w, h }` (empties the tiles and removes things inside)

Tile `0` means empty and is always allowed. Any other tile must exist in the content pack.

- [ ] **Step 1: Write the failing test**

`tests/commands/tiles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tileIndex } from "@/model/geometry";
import { baseProject, patchZone, run, runError, zoneOf } from "./helpers";

const L = "L1";
const size = { width: 16, height: 15 };

describe("setTiles", () => {
  it("sets individual cells", () => {
    const project = run(baseProject(), "setTiles", {
      levelId: L,
      zoneId: "z1",
      cells: [
        { x: 2, y: 3, tile: 3 },
        { x: 4, y: 5, tile: 2 },
      ],
    });
    const tiles = zoneOf(project, "z1").tiles;
    expect(tiles[tileIndex(size, 2, 3)]).toBe(3);
    expect(tiles[tileIndex(size, 4, 5)]).toBe(2);
  });

  it("does not modify the original project", () => {
    const original = baseProject();
    run(original, "setTiles", { levelId: L, zoneId: "z1", cells: [{ x: 0, y: 0, tile: 1 }] });
    expect(zoneOf(original, "z1").tiles[0]).toBe(0);
  });

  it("refuses a cell outside the zone and gives the zone's size", () => {
    const error = runError(baseProject(), "setTiles", {
      levelId: L,
      zoneId: "z1",
      cells: [{ x: 16, y: 0, tile: 1 }],
    });
    expect(error).toMatch(/\(16, 0\) is outside "Zone 1"/);
    expect(error).toMatch(/16 tiles wide and 15 tiles high/);
  });

  it("refuses an unknown tile", () => {
    expect(
      runError(baseProject(), "setTiles", {
        levelId: L,
        zoneId: "z1",
        cells: [{ x: 0, y: 0, tile: 99 }],
      }),
    ).toMatch(/no tile with id 99/);
  });

  it("refuses fractional coordinates", () => {
    expect(
      runError(baseProject(), "setTiles", {
        levelId: L,
        zoneId: "z1",
        cells: [{ x: 1.5, y: 0, tile: 1 }],
      }),
    ).toMatch(/Invalid arguments/);
  });

  it("refuses an empty cell list", () => {
    expect(runError(baseProject(), "setTiles", { levelId: L, zoneId: "z1", cells: [] })).toMatch(
      /Invalid arguments/,
    );
  });
});

describe("fillRect", () => {
  it("fills a rectangle", () => {
    const project = run(baseProject(), "fillRect", {
      levelId: L,
      zoneId: "z1",
      x: 2,
      y: 10,
      w: 3,
      h: 2,
      tile: 3,
    });
    const tiles = zoneOf(project, "z1").tiles;
    for (const [x, y] of [[2, 10], [4, 10], [2, 11], [4, 11]]) {
      expect(tiles[tileIndex(size, x, y)]).toBe(3);
    }
    expect(tiles[tileIndex(size, 5, 10)]).toBe(0);
    expect(tiles[tileIndex(size, 2, 12)]).toBe(0);
  });

  it("refuses a rectangle that is partly outside and changes nothing", () => {
    const project = baseProject();
    const error = runError(project, "fillRect", {
      levelId: L,
      zoneId: "z1",
      x: 14,
      y: 0,
      w: 4,
      h: 1,
      tile: 1,
    });
    expect(error).toMatch(/does not fit inside "Zone 1"/);
    expect(error).toMatch(/16 tiles wide and 15 tiles high/);
    expect(zoneOf(project, "z1").tiles[tileIndex(size, 14, 0)]).toBe(0);
  });

  it("refuses a zero-sized rectangle", () => {
    expect(
      runError(baseProject(), "fillRect", { levelId: L, zoneId: "z1", x: 0, y: 0, w: 0, h: 1, tile: 1 }),
    ).toMatch(/Invalid arguments/);
  });

  it("refuses an unknown tile", () => {
    expect(
      runError(baseProject(), "fillRect", { levelId: L, zoneId: "z1", x: 0, y: 0, w: 1, h: 1, tile: 42 }),
    ).toMatch(/no tile with id 42/);
  });
});

describe("clearRect", () => {
  it("empties tiles and removes the things inside", () => {
    let project = patchZone(baseProject(), "z1", {
      things: [
        { id: "in", type: "walker", x: 3, y: 12, settings: {} },
        { id: "out", type: "walker", x: 10, y: 12, settings: {} },
      ],
    });
    project = run(project, "clearRect", { levelId: L, zoneId: "z1", x: 0, y: 12, w: 5, h: 3 });
    const zone = zoneOf(project, "z1");
    expect(zone.tiles[tileIndex(size, 0, 13)]).toBe(0);
    expect(zone.tiles[tileIndex(size, 4, 14)]).toBe(0);
    expect(zone.tiles[tileIndex(size, 5, 14)]).toBe(1);
    expect(zone.things.map((t) => t.id)).toEqual(["out"]);
  });

  it("refuses a rectangle outside the zone", () => {
    expect(
      runError(baseProject(), "clearRect", { levelId: L, zoneId: "z1", x: 0, y: 14, w: 1, h: 2 }),
    ).toMatch(/does not fit inside "Zone 1"/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/commands/tiles.test.ts`
Expected: FAIL with `Unknown command "setTiles"`.

- [ ] **Step 3: Implement the tile commands**

`src/commands/tiles.ts`:

```ts
import { z } from "zod";
import type { ContentPack } from "@/model/contentPack";
import { inBounds, rectInBounds, tileIndex, zoneSize, type Size } from "@/model/geometry";
import type { Zone } from "@/model/schema";
import { editZone } from "./helpers";
import { coordArg, defineCommand, idArg } from "./types";

const tileArg = z.number().int().min(0);
const rectArgs = {
  x: coordArg,
  y: coordArg,
  w: z.number().int().min(1),
  h: z.number().int().min(1),
};

function tileProblem(pack: ContentPack, tile: number): string | null {
  if (tile === 0 || pack.tiles.some((t) => t.id === tile)) return null;
  return `There is no tile with id ${tile} in the content pack.`;
}

function sizeText(zone: Zone, size: Size): string {
  return `"${zone.name}", which is ${size.width} tiles wide and ${size.height} tiles high`;
}

function rectProblem(zone: Zone, size: Size, x: number, y: number, w: number, h: number) {
  if (rectInBounds(size, x, y, w, h)) return null;
  return `The rectangle at (${x}, ${y}) sized ${w} by ${h} does not fit inside ${sizeText(zone, size)}.`;
}

const setTilesCommand = defineCommand({
  name: "setTiles",
  description: "Set individual tiles in a zone. Tile 0 is empty.",
  args: z.object({
    levelId: idArg,
    zoneId: idArg,
    cells: z.array(z.object({ x: coordArg, y: coordArg, tile: tileArg })).min(1).max(2000),
  }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const size = zoneSize(zone.scroll, zone.screens);
      const tiles = zone.tiles.slice();
      for (const cell of args.cells) {
        if (!inBounds(size, cell.x, cell.y)) {
          return `(${cell.x}, ${cell.y}) is outside ${sizeText(zone, size)}.`;
        }
        const problem = tileProblem(ctx.pack, cell.tile);
        if (problem) return problem;
        tiles[tileIndex(size, cell.x, cell.y)] = cell.tile;
      }
      return { ...zone, tiles };
    });
  },
});

const fillRectCommand = defineCommand({
  name: "fillRect",
  description: "Fill a rectangle of a zone with one tile.",
  args: z.object({ levelId: idArg, zoneId: idArg, ...rectArgs, tile: tileArg }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const size = zoneSize(zone.scroll, zone.screens);
      const problem =
        rectProblem(zone, size, args.x, args.y, args.w, args.h) ?? tileProblem(ctx.pack, args.tile);
      if (problem) return problem;
      const tiles = zone.tiles.slice();
      for (let y = args.y; y < args.y + args.h; y++) {
        for (let x = args.x; x < args.x + args.w; x++) tiles[tileIndex(size, x, y)] = args.tile;
      }
      return { ...zone, tiles };
    });
  },
});

const clearRectCommand = defineCommand({
  name: "clearRect",
  description: "Empty a rectangle of a zone: removes its tiles and any things inside it.",
  args: z.object({ levelId: idArg, zoneId: idArg, ...rectArgs }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const size = zoneSize(zone.scroll, zone.screens);
      const problem = rectProblem(zone, size, args.x, args.y, args.w, args.h);
      if (problem) return problem;
      const tiles = zone.tiles.slice();
      for (let y = args.y; y < args.y + args.h; y++) {
        for (let x = args.x; x < args.x + args.w; x++) tiles[tileIndex(size, x, y)] = 0;
      }
      const inside = (x: number, y: number) =>
        x >= args.x && x < args.x + args.w && y >= args.y && y < args.y + args.h;
      return { ...zone, tiles, things: zone.things.filter((t) => !inside(t.x, t.y)) };
    });
  },
});

export const tileCommands = [setTilesCommand, fillRectCommand, clearRectCommand];
```

- [ ] **Step 4: Register the tile commands**

In `src/commands/registry.ts`, add the import and extend the list:

```ts
import { tileCommands } from "./tiles";
```

```ts
export const commandDefs: CommandDef[] = [...levelCommands, ...zoneCommands, ...tileCommands];
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/commands/tiles.ts src/commands/registry.ts tests/commands/tiles.test.ts
git commit -m "feat: add tile commands"
```

---

### Task 7: Thing and checkpoint commands

**Files:**
- Create: `src/commands/things.ts`, `src/commands/checkpoints.ts`
- Modify: `src/commands/registry.ts` (add `thingCommands`, `checkpointCommands`)
- Test: `tests/commands/things.test.ts`

**Interfaces:**
- Consumes: `defineCommand`, `idArg`, `coordArg`, `editZone`, `editLevel` (Task 4); `zoneSize`, `inBounds` (Task 1); `thingSettingsSchema` (Task 2); test helpers (Task 4)
- Produces:
  - `thingCommands: CommandDef[]`:
    - `placeThing { levelId, zoneId, thingId, type, x, y, settings = {} }` (stored settings are the pack defaults overlaid with the given ones)
    - `moveThing { levelId, zoneId, thingId, x, y }`
    - `removeThing { levelId, zoneId, thingId }`
    - `setThingSettings { levelId, zoneId, thingId, settings }` (merged into the existing settings)
  - `checkpointCommands: CommandDef[]`:
    - `addCheckpoint { levelId, zoneId, x, y }`
    - `removeCheckpoint { levelId, zoneId, x, y }`

- [ ] **Step 1: Write the failing test**

`tests/commands/things.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Project } from "@/model/schema";
import { baseProject, run, runError, zoneOf } from "./helpers";

const L = "L1";

function withWalker(): Project {
  return run(baseProject(), "placeThing", {
    levelId: L,
    zoneId: "z1",
    thingId: "w1",
    type: "walker",
    x: 5,
    y: 12,
  });
}

describe("placeThing", () => {
  it("places a thing with the pack's default settings", () => {
    expect(zoneOf(withWalker(), "z1").things).toEqual([
      { id: "w1", type: "walker", x: 5, y: 12, settings: { speed: 1 } },
    ]);
  });

  it("overlays given settings on the defaults", () => {
    const project = run(baseProject(), "placeThing", {
      levelId: L,
      zoneId: "z1",
      thingId: "w1",
      type: "walker",
      x: 5,
      y: 12,
      settings: { speed: 2, facing: "left" },
    });
    expect(zoneOf(project, "z1").things[0].settings).toEqual({ speed: 2, facing: "left" });
  });

  it("refuses an unknown type and lists the real ones", () => {
    const error = runError(baseProject(), "placeThing", {
      levelId: L,
      zoneId: "z1",
      thingId: "d1",
      type: "dragon",
      x: 1,
      y: 1,
    });
    expect(error).toMatch(/no thing called "dragon"/);
    expect(error).toMatch(/walker, health/);
  });

  it("refuses a position outside the zone and gives the zone's size", () => {
    const error = runError(baseProject(), "placeThing", {
      levelId: L,
      zoneId: "z1",
      thingId: "w1",
      type: "walker",
      x: 5,
      y: 15,
    });
    expect(error).toMatch(/\(5, 15\) is outside "Zone 1"/);
    expect(error).toMatch(/16 tiles wide and 15 tiles high/);
  });

  it("refuses a fractional position", () => {
    expect(
      runError(baseProject(), "placeThing", {
        levelId: L,
        zoneId: "z1",
        thingId: "w1",
        type: "walker",
        x: 5.5,
        y: 12,
      }),
    ).toMatch(/Invalid arguments/);
  });

  it("refuses a repeated thing id", () => {
    expect(
      runError(withWalker(), "placeThing", {
        levelId: L,
        zoneId: "z1",
        thingId: "w1",
        type: "health",
        x: 1,
        y: 1,
      }),
    ).toMatch(/already a thing with id "w1"/);
  });
});

describe("moveThing, removeThing, setThingSettings", () => {
  it("moves a thing", () => {
    const project = run(withWalker(), "moveThing", { levelId: L, zoneId: "z1", thingId: "w1", x: 9, y: 4 });
    expect(zoneOf(project, "z1").things[0]).toMatchObject({ x: 9, y: 4 });
  });

  it("refuses to move a thing outside the zone", () => {
    expect(
      runError(withWalker(), "moveThing", { levelId: L, zoneId: "z1", thingId: "w1", x: -1, y: 4 }),
    ).toMatch(/is outside "Zone 1"/);
  });

  it("removes a thing", () => {
    const project = run(withWalker(), "removeThing", { levelId: L, zoneId: "z1", thingId: "w1" });
    expect(zoneOf(project, "z1").things).toEqual([]);
  });

  it("merges settings", () => {
    const project = run(withWalker(), "setThingSettings", {
      levelId: L,
      zoneId: "z1",
      thingId: "w1",
      settings: { facing: "left" },
    });
    expect(zoneOf(project, "z1").things[0].settings).toEqual({ speed: 1, facing: "left" });
  });

  it("reports a missing thing", () => {
    for (const [name, extra] of [
      ["moveThing", { x: 1, y: 1 }],
      ["removeThing", {}],
      ["setThingSettings", { settings: {} }],
    ] as const) {
      expect(
        runError(withWalker(), name, { levelId: L, zoneId: "z1", thingId: "zz", ...extra }),
      ).toMatch(/no thing with id "zz"/);
    }
  });
});

describe("checkpoints", () => {
  it("adds and removes a checkpoint", () => {
    let project = run(baseProject(), "addCheckpoint", { levelId: L, zoneId: "z1", x: 8, y: 12 });
    expect(project.levels[0].checkpoints).toEqual([{ zoneId: "z1", x: 8, y: 12 }]);
    project = run(project, "removeCheckpoint", { levelId: L, zoneId: "z1", x: 8, y: 12 });
    expect(project.levels[0].checkpoints).toEqual([]);
  });

  it("refuses a checkpoint outside the zone", () => {
    expect(
      runError(baseProject(), "addCheckpoint", { levelId: L, zoneId: "z1", x: 16, y: 12 }),
    ).toMatch(/\(16, 12\) is outside "Zone 1"/);
  });

  it("refuses a checkpoint in a missing zone", () => {
    expect(
      runError(baseProject(), "addCheckpoint", { levelId: L, zoneId: "zz", x: 1, y: 1 }),
    ).toMatch(/no zone with id "zz"/);
  });

  it("refuses a second checkpoint in the same place", () => {
    const project = run(baseProject(), "addCheckpoint", { levelId: L, zoneId: "z1", x: 8, y: 12 });
    expect(runError(project, "addCheckpoint", { levelId: L, zoneId: "z1", x: 8, y: 12 })).toMatch(
      /already a checkpoint/,
    );
  });

  it("reports a checkpoint that is not there", () => {
    expect(
      runError(baseProject(), "removeCheckpoint", { levelId: L, zoneId: "z1", x: 8, y: 12 }),
    ).toMatch(/no checkpoint at \(8, 12\)/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/commands/things.test.ts`
Expected: FAIL with `Unknown command "placeThing"`.

- [ ] **Step 3: Implement the thing commands**

`src/commands/things.ts`:

```ts
import { z } from "zod";
import { inBounds, zoneSize } from "@/model/geometry";
import { thingSettingsSchema, type Thing, type Zone } from "@/model/schema";
import { editZone } from "./helpers";
import { coordArg, defineCommand, idArg } from "./types";

function outsideProblem(zone: Zone, x: number, y: number): string | null {
  const size = zoneSize(zone.scroll, zone.screens);
  if (inBounds(size, x, y)) return null;
  return `(${x}, ${y}) is outside "${zone.name}", which is ${size.width} tiles wide and ${size.height} tiles high.`;
}

// Replaces one thing in a zone, or returns an error string if it is not there.
function editThing(zone: Zone, thingId: string, fn: (thing: Thing) => Thing): Zone | string {
  const index = zone.things.findIndex((t) => t.id === thingId);
  if (index < 0) return `There is no thing with id "${thingId}" in "${zone.name}".`;
  const things = zone.things.slice();
  things[index] = fn(zone.things[index]);
  return { ...zone, things };
}

const placeThingCommand = defineCommand({
  name: "placeThing",
  description: "Place an enemy, pickup, platform or other thing in a zone at a tile position.",
  args: z.object({
    levelId: idArg,
    zoneId: idArg,
    thingId: idArg,
    type: z.string().min(1),
    x: coordArg,
    y: coordArg,
    settings: thingSettingsSchema.default({}),
  }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const def = ctx.pack.things.find((d) => d.type === args.type);
      if (!def) {
        const known = ctx.pack.things.map((d) => d.type).join(", ");
        return `There is no thing called "${args.type}". Choose one of: ${known}.`;
      }
      const outside = outsideProblem(zone, args.x, args.y);
      if (outside) return outside;
      if (zone.things.some((t) => t.id === args.thingId)) {
        return `There is already a thing with id "${args.thingId}" in "${zone.name}".`;
      }
      const thing: Thing = {
        id: args.thingId,
        type: args.type,
        x: args.x,
        y: args.y,
        settings: { ...def.defaults, ...args.settings },
      };
      return { ...zone, things: [...zone.things, thing] };
    });
  },
});

const moveThingCommand = defineCommand({
  name: "moveThing",
  description: "Move a thing to a new tile position in its zone.",
  args: z.object({ levelId: idArg, zoneId: idArg, thingId: idArg, x: coordArg, y: coordArg }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const moved = editThing(zone, args.thingId, (t) => ({ ...t, x: args.x, y: args.y }));
      if (typeof moved === "string") return moved;
      return outsideProblem(zone, args.x, args.y) ?? moved;
    });
  },
});

const removeThingCommand = defineCommand({
  name: "removeThing",
  description: "Remove a thing from a zone.",
  args: z.object({ levelId: idArg, zoneId: idArg, thingId: idArg }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      if (!zone.things.some((t) => t.id === args.thingId)) {
        return `There is no thing with id "${args.thingId}" in "${zone.name}".`;
      }
      return { ...zone, things: zone.things.filter((t) => t.id !== args.thingId) };
    });
  },
});

const setThingSettingsCommand = defineCommand({
  name: "setThingSettings",
  description: "Change some of a thing's settings. Settings not mentioned are kept.",
  args: z.object({ levelId: idArg, zoneId: idArg, thingId: idArg, settings: thingSettingsSchema }),
  apply(project, args) {
    return editZone(project, args.levelId, args.zoneId, (zone) =>
      editThing(zone, args.thingId, (t) => ({ ...t, settings: { ...t.settings, ...args.settings } })),
    );
  },
});

export const thingCommands = [
  placeThingCommand,
  moveThingCommand,
  removeThingCommand,
  setThingSettingsCommand,
];
```

- [ ] **Step 4: Implement the checkpoint commands**

`src/commands/checkpoints.ts`:

```ts
import { z } from "zod";
import { inBounds, zoneSize } from "@/model/geometry";
import { editLevel } from "./helpers";
import { coordArg, defineCommand, idArg } from "./types";

const checkpointArgs = z.object({ levelId: idArg, zoneId: idArg, x: coordArg, y: coordArg });

const addCheckpointCommand = defineCommand({
  name: "addCheckpoint",
  description: "Add a checkpoint where the player respawns after reaching it.",
  args: checkpointArgs,
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => {
      const zone = level.zones.find((z) => z.id === args.zoneId);
      if (!zone) return `There is no zone with id "${args.zoneId}" in level "${level.name}".`;
      const size = zoneSize(zone.scroll, zone.screens);
      if (!inBounds(size, args.x, args.y)) {
        return `(${args.x}, ${args.y}) is outside "${zone.name}", which is ${size.width} tiles wide and ${size.height} tiles high.`;
      }
      const same = level.checkpoints.some(
        (c) => c.zoneId === args.zoneId && c.x === args.x && c.y === args.y,
      );
      if (same) return `There is already a checkpoint at (${args.x}, ${args.y}) in "${zone.name}".`;
      return {
        ...level,
        checkpoints: [...level.checkpoints, { zoneId: args.zoneId, x: args.x, y: args.y }],
      };
    });
  },
});

const removeCheckpointCommand = defineCommand({
  name: "removeCheckpoint",
  description: "Remove the checkpoint at a tile position.",
  args: checkpointArgs,
  apply(project, args) {
    return editLevel(project, args.levelId, (level) => {
      const kept = level.checkpoints.filter(
        (c) => !(c.zoneId === args.zoneId && c.x === args.x && c.y === args.y),
      );
      if (kept.length === level.checkpoints.length) {
        return `There is no checkpoint at (${args.x}, ${args.y}) in that zone.`;
      }
      return { ...level, checkpoints: kept };
    });
  },
});

export const checkpointCommands = [addCheckpointCommand, removeCheckpointCommand];
```

- [ ] **Step 5: Register the commands**

In `src/commands/registry.ts`, add the imports and extend the list:

```ts
import { checkpointCommands } from "./checkpoints";
import { thingCommands } from "./things";
```

```ts
export const commandDefs: CommandDef[] = [
  ...levelCommands,
  ...zoneCommands,
  ...tileCommands,
  ...thingCommands,
  ...checkpointCommands,
];
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 7: Commit**

```bash
git add src/commands/things.ts src/commands/checkpoints.ts src/commands/registry.ts tests/commands/things.test.ts
git commit -m "feat: add thing and checkpoint commands"
```

---

### Task 8: The insertPiece command

**Files:**
- Create: `src/commands/pieces.ts`
- Modify: `src/commands/registry.ts` (add `pieceCommands`)
- Test: `tests/commands/pieces.test.ts`

**Interfaces:**
- Consumes: `defineCommand`, `idArg`, `coordArg`, `editZone` (Task 4); `KEEP_TILE`, `PieceDef` (Task 2); `zoneSize`, `tileIndex`, `rectInBounds` (Task 1); `testPack` piece `step` (Task 2)
- Produces: `pieceCommands: CommandDef[]`:
  - `insertPiece { levelId, zoneId, pieceId, x, y, settings = {}, idPrefix }`

Behaviour: settings not given take the piece's default. Every setting must be a whole number inside the piece's range, and unknown setting names are refused. The piece's tiles overwrite the zone's, except `KEEP_TILE` cells. Things from the piece get the ids `<idPrefix>-1`, `<idPrefix>-2`, and so on, and the pack defaults for their type overlaid with the piece's settings for them.

- [ ] **Step 1: Write the failing test**

`tests/commands/pieces.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tileIndex } from "@/model/geometry";
import { baseProject, run, runError, zoneOf } from "./helpers";

const L = "L1";
const size = { width: 16, height: 15 };

describe("insertPiece", () => {
  it("stamps the piece's tiles and things using default settings", () => {
    const project = run(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 4,
      y: 11,
      idPrefix: "p1",
    });
    const zone = zoneOf(project, "z1");
    // default step: 2 wide, 1 high, plus one kept row on top for the walker
    expect(zone.tiles[tileIndex(size, 4, 11)]).toBe(0);
    expect(zone.tiles[tileIndex(size, 4, 12)]).toBe(1);
    expect(zone.tiles[tileIndex(size, 5, 12)]).toBe(1);
    expect(zone.tiles[tileIndex(size, 6, 12)]).toBe(0);
    expect(zone.things).toEqual([
      { id: "p1-1", type: "walker", x: 4, y: 11, settings: { speed: 1 } },
    ]);
  });

  it("leaves existing tiles alone where the piece says keep", () => {
    let project = run(baseProject(), "setTiles", {
      levelId: L,
      zoneId: "z1",
      cells: [{ x: 4, y: 11, tile: 2 }],
    });
    project = run(project, "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 4,
      y: 11,
      idPrefix: "p1",
    });
    expect(zoneOf(project, "z1").tiles[tileIndex(size, 4, 11)]).toBe(2);
  });

  it("uses given settings", () => {
    const project = run(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 0,
      y: 9,
      settings: { width: 4, height: 3 },
      idPrefix: "p1",
    });
    const tiles = zoneOf(project, "z1").tiles;
    expect(tiles[tileIndex(size, 3, 10)]).toBe(1);
    expect(tiles[tileIndex(size, 3, 12)]).toBe(1);
    expect(tiles[tileIndex(size, 4, 10)]).toBe(0);
  });

  it("refuses an unknown piece and lists the real ones", () => {
    const error = runError(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "loop",
      x: 0,
      y: 0,
      idPrefix: "p1",
    });
    expect(error).toMatch(/no piece called "loop"/);
    expect(error).toMatch(/step/);
  });

  it("refuses a setting outside its range and gives the range", () => {
    const error = runError(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 0,
      y: 0,
      settings: { width: 9 },
      idPrefix: "p1",
    });
    expect(error).toMatch(/"width" must be a whole number from 1 to 4/);
  });

  it("refuses a fractional setting", () => {
    expect(
      runError(baseProject(), "insertPiece", {
        levelId: L,
        zoneId: "z1",
        pieceId: "step",
        x: 0,
        y: 0,
        settings: { width: 1.5 },
        idPrefix: "p1",
      }),
    ).toMatch(/"width" must be a whole number from 1 to 4/);
  });

  it("refuses an unknown setting and lists the real ones", () => {
    const error = runError(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 0,
      y: 0,
      settings: { depth: 2 },
      idPrefix: "p1",
    });
    expect(error).toMatch(/has no setting called "depth"/);
    expect(error).toMatch(/width, height/);
  });

  it("refuses a piece that does not fit and gives both sizes", () => {
    const error = runError(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 15,
      y: 11,
      idPrefix: "p1",
    });
    expect(error).toMatch(/is 2 tiles wide and 2 tiles high/);
    expect(error).toMatch(/does not fit at \(15, 11\)/);
    expect(error).toMatch(/16 tiles wide and 15 tiles high/);
  });

  it("refuses an id prefix that would repeat a thing id", () => {
    const project = run(baseProject(), "insertPiece", {
      levelId: L,
      zoneId: "z1",
      pieceId: "step",
      x: 4,
      y: 11,
      idPrefix: "p1",
    });
    expect(
      runError(project, "insertPiece", {
        levelId: L,
        zoneId: "z1",
        pieceId: "step",
        x: 8,
        y: 11,
        idPrefix: "p1",
      }),
    ).toMatch(/already a thing with id "p1-1"/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/commands/pieces.test.ts`
Expected: FAIL with `Unknown command "insertPiece"`.

- [ ] **Step 3: Implement insertPiece**

`src/commands/pieces.ts`:

```ts
import { z } from "zod";
import { KEEP_TILE, type PieceDef } from "@/model/contentPack";
import { rectInBounds, tileIndex, zoneSize } from "@/model/geometry";
import type { Thing } from "@/model/schema";
import { editZone } from "./helpers";
import { coordArg, defineCommand, idArg } from "./types";

// Fills in defaults and checks ranges. Returns the full settings, or an error string.
function resolveSettings(
  piece: PieceDef,
  given: Record<string, number>,
): Record<string, number> | string {
  const known = piece.settings.map((s) => s.key);
  for (const key of Object.keys(given)) {
    if (!known.includes(key)) {
      return `The piece "${piece.id}" has no setting called "${key}". Its settings are: ${known.join(", ")}.`;
    }
  }
  const resolved: Record<string, number> = {};
  for (const setting of piece.settings) {
    const value = given[setting.key] ?? setting.default;
    if (!Number.isInteger(value) || value < setting.min || value > setting.max) {
      return `"${setting.key}" must be a whole number from ${setting.min} to ${setting.max}.`;
    }
    resolved[setting.key] = value;
  }
  return resolved;
}

const insertPieceCommand = defineCommand({
  name: "insertPiece",
  description:
    "Stamp a ready-made level piece into a zone with its top-left corner at a tile position. It overwrites the tiles it covers and adds its things.",
  args: z.object({
    levelId: idArg,
    zoneId: idArg,
    pieceId: z.string().min(1),
    x: coordArg,
    y: coordArg,
    settings: z.record(z.string(), z.number()).default({}),
    idPrefix: idArg,
  }),
  apply(project, args, ctx) {
    return editZone(project, args.levelId, args.zoneId, (zone) => {
      const piece = ctx.pack.pieces.find((p) => p.id === args.pieceId);
      if (!piece) {
        const known = ctx.pack.pieces.map((p) => p.id).join(", ");
        return `There is no piece called "${args.pieceId}". Choose one of: ${known}.`;
      }
      const settings = resolveSettings(piece, args.settings);
      if (typeof settings === "string") return settings;

      const built = piece.build(settings);
      const size = zoneSize(zone.scroll, zone.screens);
      if (!rectInBounds(size, args.x, args.y, built.width, built.height)) {
        return `The piece is ${built.width} tiles wide and ${built.height} tiles high, so it does not fit at (${args.x}, ${args.y}) in "${zone.name}", which is ${size.width} tiles wide and ${size.height} tiles high.`;
      }

      const tiles = zone.tiles.slice();
      for (let py = 0; py < built.height; py++) {
        for (let px = 0; px < built.width; px++) {
          const tile = built.tiles[py * built.width + px];
          if (tile !== KEEP_TILE) tiles[tileIndex(size, args.x + px, args.y + py)] = tile;
        }
      }

      const things: Thing[] = zone.things.slice();
      for (const [i, placed] of built.things.entries()) {
        const id = `${args.idPrefix}-${i + 1}`;
        if (things.some((t) => t.id === id)) {
          return `There is already a thing with id "${id}" in "${zone.name}". Use a different idPrefix.`;
        }
        const def = ctx.pack.things.find((d) => d.type === placed.type);
        things.push({
          id,
          type: placed.type,
          x: args.x + placed.x,
          y: args.y + placed.y,
          settings: { ...def?.defaults, ...placed.settings },
        });
      }
      return { ...zone, tiles, things };
    });
  },
});

export const pieceCommands = [insertPieceCommand];
```

- [ ] **Step 4: Register the command**

In `src/commands/registry.ts`, add the import and extend the list:

```ts
import { pieceCommands } from "./pieces";
```

```ts
export const commandDefs: CommandDef[] = [
  ...levelCommands,
  ...zoneCommands,
  ...tileCommands,
  ...thingCommands,
  ...checkpointCommands,
  ...pieceCommands,
];
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; typecheck prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/commands/pieces.ts src/commands/registry.ts tests/commands/pieces.test.ts
git commit -m "feat: add insertPiece command"
```

---

### Task 9: History, exports and the boundary check

**Files:**
- Create: `src/commands/history.ts`, `src/commands/index.ts`
- Test: `tests/commands/history.test.ts`, `tests/boundaries.test.ts`

**Interfaces:**
- Consumes: `applyCommand` (Task 4); `Command`, `CommandContext`, `CommandResult` (Task 4); all commands (Tasks 4 to 8)
- Produces:
  - `type HistoryEntry = { label: string; before: Project; after: Project }`
  - `type History = { project: Project; undoStack: HistoryEntry[]; redoStack: HistoryEntry[]; open: { label: string; before: Project } | null }`
  - `MAX_UNDO = 200`
  - `createHistory(project: Project): History`
  - `runCommand(history: History, command: Command, ctx: CommandContext): { history: History; result: CommandResult }`
  - `beginGroup(history: History, label: string): History`
  - `commitGroup(history: History): History`
  - `rollbackGroup(history: History): History`
  - `undo(history: History): History`, `redo(history: History): History`
  - `canUndo(history: History): boolean`, `canRedo(history: History): boolean`
  - `src/commands/index.ts` re-exporting `history`, `registry` and `types`

Behaviour: all functions return a new `History` and never modify the one passed in. Outside a group, each successful command is its own undo step. Inside a group, commands apply at once but become one undo step on `commitGroup`. A failed command changes nothing. `rollbackGroup` restores the project to exactly the object it was when the group began. `beginGroup` while a group is open, and `commitGroup`, `rollbackGroup`, `undo` or `redo` in the wrong state, throw an `Error` because they are programming mistakes, not user input.

- [ ] **Step 1: Write the failing history test**

`tests/commands/history.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  beginGroup,
  canRedo,
  canUndo,
  commitGroup,
  createHistory,
  redo,
  rollbackGroup,
  runCommand,
  undo,
  type History,
} from "@/commands/history";
import type { Command } from "@/commands/types";
import { baseProject, ctx } from "./helpers";

const rename = (name: string): Command => ({
  name: "renameZone",
  args: { levelId: "L1", zoneId: "z1", name },
});
const spike = (x: number): Command => ({
  name: "setTiles",
  args: { levelId: "L1", zoneId: "z1", cells: [{ x, y: 12, tile: 3 }] },
});
const bad: Command = { name: "renameZone", args: { levelId: "L1", zoneId: "zz", name: "X" } };

function apply(history: History, command: Command): History {
  const { history: next, result } = runCommand(history, command, ctx);
  if (!result.ok) throw new Error(result.error);
  return next;
}

const zoneName = (h: History) => h.project.levels[0].zones[0].name;

describe("single commands", () => {
  it("makes each command its own undo step", () => {
    const start = baseProject();
    let h = createHistory(start);
    expect(canUndo(h)).toBe(false);
    h = apply(h, rename("Snowy Path"));
    h = apply(h, rename("Icy Path"));
    expect(zoneName(h)).toBe("Icy Path");
    h = undo(h);
    expect(zoneName(h)).toBe("Snowy Path");
    h = undo(h);
    expect(h.project).toBe(start);
    expect(canUndo(h)).toBe(false);
  });

  it("redoes what was undone", () => {
    let h = apply(createHistory(baseProject()), rename("Snowy Path"));
    const after = h.project;
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.project).toBe(after);
    expect(canRedo(h)).toBe(false);
  });

  it("clears redo when a new command runs", () => {
    let h = apply(createHistory(baseProject()), rename("Snowy Path"));
    h = undo(h);
    h = apply(h, rename("Other"));
    expect(canRedo(h)).toBe(false);
  });

  it("leaves history untouched when a command fails", () => {
    const h = createHistory(baseProject());
    const { history: next, result } = runCommand(h, bad, ctx);
    expect(result.ok).toBe(false);
    expect(next).toBe(h);
  });

  it("does not modify the history passed in", () => {
    const h = createHistory(baseProject());
    apply(h, rename("Snowy Path"));
    expect(zoneName(h)).toBe("Zone 1");
    expect(h.undoStack).toEqual([]);
  });
});

describe("groups", () => {
  it("turns several commands into one undo step", () => {
    const start = baseProject();
    let h = beginGroup(createHistory(start), "AI: add spikes");
    h = apply(h, spike(2));
    h = apply(h, spike(3));
    h = apply(h, rename("Spiky Path"));
    expect(zoneName(h)).toBe("Spiky Path");
    h = commitGroup(h);
    expect(h.undoStack).toHaveLength(1);
    expect(h.undoStack[0].label).toBe("AI: add spikes");
    h = undo(h);
    expect(h.project).toBe(start);
  });

  it("rolls back to the exact original project after a failure partway", () => {
    const start = baseProject();
    let h = beginGroup(createHistory(start), "AI turn");
    h = apply(h, spike(2));
    h = apply(h, spike(3));
    h = apply(h, rename("Spiky Path"));
    const failed = runCommand(h, bad, ctx);
    expect(failed.result.ok).toBe(false);
    h = rollbackGroup(failed.history);
    expect(h.project).toBe(start);
    expect(h.open).toBeNull();
    expect(h.undoStack).toEqual([]);
  });

  it("keeps earlier undo steps and redo when a group is rolled back", () => {
    let h = apply(createHistory(baseProject()), rename("Snowy Path"));
    h = beginGroup(h, "AI turn");
    h = apply(h, spike(2));
    h = rollbackGroup(h);
    expect(zoneName(h)).toBe("Snowy Path");
    expect(h.undoStack).toHaveLength(1);
  });

  it("adds no undo step for a group that changed nothing", () => {
    let h = beginGroup(createHistory(baseProject()), "AI turn");
    h = commitGroup(h);
    expect(h.undoStack).toEqual([]);
    expect(h.open).toBeNull();
  });

  it("throws on misuse", () => {
    const h = createHistory(baseProject());
    const open = beginGroup(h, "a");
    expect(() => beginGroup(open, "b")).toThrow(/already open/);
    expect(() => commitGroup(h)).toThrow(/no open group/);
    expect(() => rollbackGroup(h)).toThrow(/no open group/);
    expect(() => undo(open)).toThrow(/group is open/);
    expect(() => redo(open)).toThrow(/group is open/);
    expect(() => undo(h)).toThrow(/Nothing to undo/);
    expect(() => redo(h)).toThrow(/Nothing to redo/);
  });
});

describe("limits", () => {
  it("keeps at most 200 undo steps", () => {
    let h = createHistory(baseProject());
    for (let i = 0; i < 205; i++) h = apply(h, rename(`Name ${i}`));
    expect(h.undoStack).toHaveLength(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/commands/history.test.ts`
Expected: FAIL, cannot resolve `@/commands/history`.

- [ ] **Step 3: Implement history**

`src/commands/history.ts`:

```ts
import type { Project } from "@/model/schema";
import { applyCommand } from "./registry";
import type { Command, CommandContext, CommandResult } from "./types";

export type HistoryEntry = { label: string; before: Project; after: Project };

export type History = {
  project: Project;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  open: { label: string; before: Project } | null;
};

export const MAX_UNDO = 200;

export function createHistory(project: Project): History {
  return { project, undoStack: [], redoStack: [], open: null };
}

function pushEntry(history: History, entry: HistoryEntry): History {
  return {
    project: entry.after,
    undoStack: [...history.undoStack, entry].slice(-MAX_UNDO),
    redoStack: [],
    open: null,
  };
}

export function runCommand(
  history: History,
  command: Command,
  ctx: CommandContext,
): { history: History; result: CommandResult } {
  const result = applyCommand(history.project, command, ctx);
  if (!result.ok) return { history, result };
  if (history.open) return { history: { ...history, project: result.project }, result };
  const entry = { label: command.name, before: history.project, after: result.project };
  return { history: pushEntry(history, entry), result };
}

export function beginGroup(history: History, label: string): History {
  if (history.open) throw new Error("A command group is already open.");
  return { ...history, open: { label, before: history.project } };
}

export function commitGroup(history: History): History {
  if (!history.open) throw new Error("There is no open group to commit.");
  if (history.project === history.open.before) return { ...history, open: null };
  return pushEntry(history, {
    label: history.open.label,
    before: history.open.before,
    after: history.project,
  });
}

export function rollbackGroup(history: History): History {
  if (!history.open) throw new Error("There is no open group to roll back.");
  return { ...history, project: history.open.before, open: null };
}

export const canUndo = (history: History): boolean =>
  !history.open && history.undoStack.length > 0;

export const canRedo = (history: History): boolean =>
  !history.open && history.redoStack.length > 0;

export function undo(history: History): History {
  if (history.open) throw new Error("Cannot undo while a command group is open.");
  const entry = history.undoStack[history.undoStack.length - 1];
  if (!entry) throw new Error("Nothing to undo.");
  return {
    project: entry.before,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
    open: null,
  };
}

export function redo(history: History): History {
  if (history.open) throw new Error("Cannot redo while a command group is open.");
  const entry = history.redoStack[history.redoStack.length - 1];
  if (!entry) throw new Error("Nothing to redo.");
  return {
    project: entry.after,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
    open: null,
  };
}
```

`src/commands/index.ts`:

```ts
export * from "./history";
export * from "./registry";
export * from "./types";
```

- [ ] **Step 4: Run the history test to verify it passes**

Run: `npm test -- tests/commands/history.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the boundary and registry test**

`tests/boundaries.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commandDefs } from "@/commands/registry";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

const BANNED = [/from "react/, /from "next/, /\bdocument\./, /\bwindow\./, /Math\.random/, /randomUUID/];

describe("headless core", () => {
  it("keeps React, Next.js, the DOM and randomness out of model and commands", () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles("src/model"), ...sourceFiles("src/commands")]) {
      const text = readFileSync(file, "utf8");
      for (const pattern of BANNED) {
        if (pattern.test(text)) offenders.push(`${file} matches ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("command registry", () => {
  it("has every command in the spec, each with a description, and no duplicates", () => {
    const names = commandDefs.map((d) => d.name);
    expect([...names].sort()).toEqual(
      [
        "createLevel", "renameLevel", "setLevelBrief", "deleteLevel",
        "addZone", "removeZone", "moveZone", "renameZone", "resizeZone",
        "setZoneVariant", "setZoneIntent", "setZoneOpenings",
        "setTiles", "fillRect", "clearRect",
        "placeThing", "moveThing", "removeThing", "setThingSettings",
        "insertPiece",
        "addCheckpoint", "removeCheckpoint",
      ].sort(),
    );
    for (const def of commandDefs) expect(def.description.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run build`
Expected: every test file PASSES, typecheck prints nothing, the build completes.

- [ ] **Step 7: Commit**

```bash
git add src/commands/history.ts src/commands/index.ts tests/commands/history.test.ts tests/boundaries.test.ts
git commit -m "feat: add command history with groups, undo and rollback"
```

---

## Done when

- `npm test`, `npm run typecheck` and `npm run build` all succeed.
- All 22 commands from the spec are registered, and every successful command in the tests leaves `structureProblems` empty.
- `src/model/` and `src/commands/` contain no React, Next.js, DOM or random-value code.

Plan 2 (runtime) builds on `Project`, `Zone`, `ContentPack`, `zoneSize`, `tileIndex` and `DEFAULT_PLAYER` from this plan.
