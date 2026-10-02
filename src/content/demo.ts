import { applyCommand, type Command } from "@/commands";
import { createProject, type Project } from "@/model";
import { GROUND, ICE, LADDER, LEDGE, SPIKE, snowPack } from "./snow/pack";

export const DEMO_LEVEL_ID = "demo";

const L = DEMO_LEVEL_ID;
const fill = (zoneId: string, x: number, y: number, w: number, h: number, tile: number): Command => ({
    name: "fillRect",
    args: { levelId: L, zoneId, x, y, w, h, tile },
});

const place = (zoneId: string, thingId: string, type: string, x: number, y: number): Command => ({
    name: "placeThing",
    args: { levelId: L, zoneId, thingId, type, x, y },
});

const COMMANDS: Command[] = [
    {
        name: "createLevel",
        args: {
            levelId: L,
            name: "Demo Stage",
            brief: "A short tour of running, jumping, ice, spikes and ladders.",
            zoneIds: ["path", "corridor", "boss"],
        },
    },

    // Snowy Path: three screens of running and jumping.
    { name: "renameZone", args: { levelId: L, zoneId: "path", name: "Snowy Path" } },
    { name: "resizeZone", args: { levelId: L, zoneId: "path", screens: 3 } },
    fill("path", 10, 12, 3, 1, GROUND), // a one-tile step
    { name: "clearRect", args: { levelId: L, zoneId: "path", x: 18, y: 13, w: 2, h: 2 } }, // a pit
    fill("path", 24, 13, 10, 1, ICE),
    { name: "addCheckpoint", args: { levelId: L, zoneId: "path", x: 36, y: 12 } },
    fill("path", 38, 11, 4, 2, GROUND), // a two-tile-high step

    // Ice Cave: spikes, then a ladder up and out.
    {
        name: "addZone",
        args: { levelId: L, zoneId: "cave", name: "Ice Cave", screens: 2, variant: "cave" },
    },
    fill("cave", 8, 13, 2, 1, SPIKE),
    fill("cave", 14, 10, 3, 1, LEDGE),
    fill("cave", 28, 0, 1, 13, LADDER),
    {
        name: "setZoneOpenings",
        args: { levelId: L, zoneId: "cave", exit: { edge: "top", from: 28, to: 29 } },
    },

    // Frozen Shaft: climb to a floor near the top and leave to the right.
    {
        name: "addZone",
        args: {
            levelId: L,
            zoneId: "shaft",
            name: "Frozen Shaft",
            scroll: "vertical",
            screens: 2,
            variant: "cave",
        },
    },
    fill("shaft", 7, 4, 1, 26, LADDER),
    fill("shaft", 8, 4, 8, 1, GROUND),
    {
        name: "setZoneOpenings",
        args: { levelId: L, zoneId: "shaft", exit: { edge: "right", from: 0, to: 3 } },
    },

    // Things.
    place("path", "crawler", "walker", 14, 12),
    place("path", "health", "small-health", 22, 12),
    place("path", "lift", "platform", 26, 8),
    place("path", "bat", "flyer", 30, 6),
    place("path", "hopper", "jumper", 44, 12),
    place("cave", "health", "large-health", 5, 12),
    place("cave", "cannon", "turret", 15, 9),
    place("cave", "guard", "shielded", 20, 12),
    place("cave", "dropper", "dropper", 24, 4),
    place("corridor", "health", "small-health", 8, 12),
    place("boss", "boss", "boss", 12, 12),
];

// Builds the demo project through the same commands the editor and the AI use.
export function createDemoProject(): Project {
    let project = createProject({ id: "demo-project", name: "Demo" }, snowPack);
    for (const command of COMMANDS) {
        const result = applyCommand(project, command, { pack: snowPack });
        if (!result.ok) throw new Error(`Demo level: ${command.name} failed: ${result.error}`);
        project = result.project;
    }
    return project;
}
