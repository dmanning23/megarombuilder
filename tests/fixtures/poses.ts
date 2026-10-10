import { KINDS, type LookKind } from "@/model/look";

// Every pose of a kind that carries the standing hitbox.
export const standingPoses = (kind: LookKind): string[] =>
  Object.entries(KINDS[kind].animations)
    .filter(([, rule]) => rule.body === "main")
    .map(([animation]) => animation);

// Commands resizing every standing pose of a character, as resizing its one canvas used to.
export const resizeStanding = (target: unknown, kind: LookKind, w: number, h: number): [string, Record<string, unknown>][] =>
  standingPoses(kind).map((animation) => ["resizePose", { target, animation, w, h }]);
