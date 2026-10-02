import { applyCommand, type Command } from "@/commands";
import { createProject, type ContentPack, type Project } from "@/model";

const GROUND = 1;
const ICE = 2;
const LADDER = 3;
const SPIKE = 4;
const LEDGE = 5;

// A stand-in pack with tiles only, until the snow pack arrives.
export const demoPack: ContentPack = {
    id: "demo",
    name: "Demo",
    variants: ["outdoor", "cave"],
    groundTileId: GROUND,
    tiles: [
        { id: GROUND, name: "ground", behaviour: "solid" },
        { id: ICE, name: "ice", behaviour: "ice" },
        { id: LADDER, name: "ladder", behaviour: "ladder" },
        { id: SPIKE, name: "spike", behaviour: "spike" },
        { id: LEDGE, name: "ledge", behaviour: "oneWay" },
    ],
    things: [
        { type: "walker", name: "Snow Crawler", category: "enemy", behaviour: "walker", description: "Patrols back and forth.", defaults: { speed: 0.5 } },
        { type: "flyer", name: "Frost Bat", category: "enemy", behaviour: "flyer", description: "Swoops toward you.", defaults: {} },
        { type: "turret", name: "Icicle Cannon", category: "enemy", behaviour: "turret", description: "Fires icicles at you.", defaults: {} },
        { type: "jumper", name: "Hopper", category: "enemy", behaviour: "jumper", description: "Hops toward you.", defaults: {} },
        { type: "shielded", name: "Shield Guard", category: "enemy", behaviour: "shielded", description: "Blocks shots until it opens up.", defaults: {} },
        { type: "dropper", name: "Icicle Dropper", category: "enemy", behaviour: "dropper", description: "Drops when you pass underneath.", defaults: {} },
        { type: "platform", name: "Moving Platform", category: "platform", behaviour: "platform", description: "Slides back and forth.", defaults: { axis: "x", distance: 4, speed: 0.5 } },
        { type: "small-health", name: "Small Health", category: "pickup", behaviour: "health", description: "Restores a little health.", defaults: { amount: 2 } },
        { type: "large-health", name: "Large Health", category: "pickup", behaviour: "health", description: "Restores a lot of health.", defaults: { amount: 10 } },
        { type: "boss", name: "Blizzard Bot", category: "boss", behaviour: "boss", description: "The stage boss.", defaults: { health: 28 } },
    ],
    pieces: [],
};

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
    let project = createProject({ id: "demo-project", name: "Demo" }, demoPack);
    for (const command of COMMANDS) {
        const result = applyCommand(project, command, { pack: demoPack });
        if (!result.ok) throw new Error(`Demo level: ${command.name} failed: ${result.error}`);
        project = result.project;
    }
    return project;
}
