import type { ContentPack } from "@/model/contentPack";
import { TILE_SIZE } from "@/model/geometry";
import type { PlayerSettings, Zone } from "@/model/schema";
import { NO_INPUT, type Input, type Player } from "@/runtime/sim/state";
import { step } from "@/runtime/sim/step";
import { touchingLadder } from "@/runtime/sim/tilemap";
import { MOVES, type Script } from "./moves";
import { createProbe, leftZone, reset, type Probe } from "./probe";

const SCRIPT_STEPS = 1300; // the longest a move's script may run (long ladders)
const SETTLE_STEPS = 120; // after the script, how long to wait for the player to come to rest
const MAX_NODES = 4000;

export type Passage = {
  passable: boolean;
  start: Player | null; // the state the route starts from
  route: Input[]; // every input from the start to the exit, when passable
  moves: string[]; // the names of the moves along the route
  jumps: number; // how many of those moves were jumps
  furthest: Player | null; // the resting state nearest the exit
  explored: number; // how many resting places were searched
};

type Node = { player: Player; parent: Node | null; inputs: Input[]; move: string | null; jump: boolean; origin: Player };

type Outcome =
  | { kind: "exit" | "dead" | "dropped"; inputs: Input[] }
  | { kind: "rest"; inputs: Input[]; player: Player };

const atRest = (p: Player) => p.onLadder || (p.onGround && Math.abs(p.vx) < 0.01);
const keyOf = (p: Player) => `${Math.round(p.x / 8)},${Math.round(p.y / 4)},${p.onLadder ? 1 : 0}`;

// Plays a script from a saved state, then waits for the player to come to rest.
function play(probe: Probe, from: Player, script: Script | null): Outcome {
  reset(probe, from);
  const sim = probe.sim;
  const inputs: Input[] = [];
  let scripted = script !== null;
  let waited = 0;
  for (let t = 0; t < SCRIPT_STEPS + SETTLE_STEPS; t++) {
    let input = NO_INPUT;
    if (scripted && script) {
      const next = script(sim, t);
      if (next) input = next;
      else scripted = false;
    }
    step(sim, input);
    inputs.push(input);
    if (leftZone(sim)) return { kind: "exit", inputs };
    if (sim.phase === "dead") return { kind: "dead", inputs };
    if (!scripted) {
      if (atRest(sim.player)) return { kind: "rest", inputs, player: { ...sim.player } };
      if (++waited > SETTLE_STEPS) break;
    }
  }
  return { kind: "dropped", inputs };
}

// Where the player can start: the normal start, or each column of a top or bottom opening.
function startStates(probe: Probe, fresh: Player): Player[] {
  const entry = probe.zone.entry;
  if (entry.edge === "left" || entry.edge === "right") return [fresh];
  const starts: Player[] = [];
  for (let col = entry.from; col <= entry.to; col++) {
    const p = { ...fresh, x: col * TILE_SIZE + (TILE_SIZE - fresh.w) / 2 };
    p.onLadder = touchingLadder(probe.map, p);
    starts.push(p);
  }
  return starts;
}

function route(node: Node, last: Input[]): { route: Input[]; moves: string[]; jumps: number } {
  const chain: Node[] = [];
  for (let n: Node | null = node; n; n = n.parent) chain.unshift(n);
  return {
    route: [...chain.flatMap((n) => n.inputs), ...last],
    moves: chain.flatMap((n) => (n.move ? [n.move] : [])),
    jumps: chain.filter((n) => n.jump).length,
  };
}

export function findPassage(zone: Zone, pack: ContentPack, settings: PlayerSettings): Passage {
  const probe = createProbe(zone, pack, settings);
  const fresh = { ...probe.sim.player };
  const exit = probe.zone.exit;
  const progress = (p: Player) =>
    !exit ? 0 : exit.edge === "right" ? p.x : exit.edge === "top" ? -p.y : p.y;

  // Searched in order of how many jumps it took to get somewhere, so the route found uses as few
  // jumps as it can. byJumps[k] holds the places reached with k jumps.
  const byJumps: Node[][] = [[]];
  const seen = new Set<string>();
  let furthest: Node | null = null;
  let explored = 0;
  const passed = (node: Node | null, origin: Player, last: Input[], move?: { name: string; jump: boolean }): Passage => {
    const found = node ? route(node, last) : { route: last, moves: [], jumps: 0 };
    if (move) {
      found.moves.push(move.name);
      if (move.jump) found.jumps++;
    }
    return { passable: true, start: origin, ...found, furthest: node?.player ?? null, explored };
  };

  for (const start of startStates(probe, fresh)) {
    const out = play(probe, start, null);
    if (out.kind === "exit") return passed(null, start, out.inputs);
    if (out.kind !== "rest") continue;
    const node: Node = { player: out.player, parent: null, inputs: out.inputs, move: null, jump: false, origin: start };
    if (!exit) return passed(node, start, []);
    byJumps[0].push(node);
  }

  for (let jumps = 0; jumps < byJumps.length && explored < MAX_NODES; jumps++) {
    const queue = byJumps[jumps];
    for (let head = 0; head < queue.length && explored < MAX_NODES; head++) {
      const node = queue[head];
      const key = keyOf(node.player);
      if (seen.has(key)) continue;
      seen.add(key);
      explored++;
      if (!furthest || progress(node.player) > progress(furthest.player)) furthest = node;
      for (const move of MOVES) {
        reset(probe, node.player);
        if (move.when && !move.when(probe.sim)) continue;
        const out = play(probe, node.player, move.start());
        // A move only counts as a jump if jump was actually pressed (a running jump can reach
        // the exit while still running toward an edge).
        const jumped = out.inputs.some((i) => i.jump);
        if (out.kind === "exit") return passed(node, node.origin, out.inputs, { name: move.name, jump: jumped });
        if (out.kind !== "rest" || seen.has(keyOf(out.player))) continue;
        const child: Node = {
          player: out.player,
          parent: node,
          inputs: out.inputs,
          move: move.name,
          jump: jumped,
          origin: node.origin,
        };
        if (jumped) (byJumps[jumps + 1] ??= []).push(child);
        else queue.push(child);
      }
    }
  }

  return {
    passable: false,
    start: furthest?.origin ?? null,
    route: [],
    moves: [],
    jumps: 0,
    furthest: furthest?.player ?? null,
    explored,
  };
}
