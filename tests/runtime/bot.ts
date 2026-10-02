import {
  firstTile,
  isPlatform,
  isSolid,
  NO_INPUT,
  type Input,
  type Sim,
} from "@/runtime/sim";

// A simple scripted player: runs right, jumps walls and gaps, and climbs any ladder
// it reaches in a zone whose exit is at the top.
export function botInput(sim: Sim): Input {
  const { map, player: p, prev } = sim;
  const input = { ...NO_INPUT };
  const solidAt = (px: number, py: number) =>
    isSolid(map.behaviourAt(firstTile(px), firstTile(py)));

  const cx = p.x + p.w / 2;
  const ladderHere = map.behaviourAt(firstTile(cx), firstTile(p.y + p.h / 2)) === "ladder";
  if (p.onLadder || (map.zone.exit?.edge === "top" && ladderHere)) {
    input.up = true;
    return input;
  }

  input.right = true;
  if (!p.onGround) {
    input.jump = prev.jump; // keep holding for a full-height jump
    return input;
  }
  const front = p.x + p.w + 2;
  const feet = p.y + p.h;
  const wall = solidAt(front, feet - 1) || solidAt(front, p.y);
  const gap = !solidAt(front, feet + 1) && !isPlatform(map, firstTile(front), firstTile(feet + 1));
  if (wall || gap) input.jump = !prev.jump;
  return input;
}
