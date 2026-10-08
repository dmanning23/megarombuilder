import { TILE_SIZE } from "@/model/geometry";
import { moveX, moveY } from "./body";
import { landOnPlatforms } from "./entities/platforms";
import { ICE_ACCEL, JUMP_CUT_SPEED, KNOCKBACK_SPEED, SLIDE_SPEED } from "./constants";
import { clamp } from "./math";
import { roomToStand, sliding, standUp, startSlide } from "./slide";
import type { Input, Sim } from "./state";
import { firstTile, ladderAtPx, touchingLadder } from "./tilemap";

// One step on a ladder: no gravity, up and down only.
function climb(sim: Sim, input: Input, jumpPressed: boolean): void {
  const { map, player: p, settings } = sim;
  p.vx = 0;
  p.vy = 0;
  p.ridingId = null;
  if (jumpPressed) {
    p.onLadder = false;
    return;
  }
  const dy = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * settings.ladderSpeed;
  p.onGround = false;
  p.onIce = false;
  moveY(map, p, dy, true);
  // The bottom of the zone is a floor for a climber unless the exit is there.
  const exit = map.zone.exit;
  const cx = p.x + p.w / 2;
  const exitBelow =
    exit?.edge === "bottom" && cx >= exit.from * TILE_SIZE && cx < (exit.to + 1) * TILE_SIZE;
  if (!exitBelow) p.y = Math.min(p.y, map.heightPx - p.h);
  if (p.onGround) {
    p.onLadder = false; // climbed down onto solid ground
    return;
  }
  if (touchingLadder(map, p)) return;
  p.onLadder = false;
  if (dy < 0) {
    // Climbed off the top: stand on the ladder's top tile.
    p.y = (firstTile(p.y + p.h - 1) + 1) * TILE_SIZE - p.h;
    p.onGround = true;
  }
}

// Gravity and movement for a player who is not on a ladder.
function physics(sim: Sim): void {
  const { map, player: p, settings } = sim;
  const prevBottom = p.y + p.h;
  p.vy = Math.min(p.vy + settings.gravity, settings.maxFallSpeed);
  p.onGround = false;
  p.onIce = false;
  p.ridingId = null;
  moveX(map, p, p.vx);
  moveY(map, p, p.vy, false);
  if (!p.onGround) landOnPlatforms(sim, prevBottom);
}

// One step of a slide: low and fast in the direction the player faces (pressing the other way turns
// it round). It ends when its time is up, when it hits a wall, when the player leaves the ground or
// presses jump, but only where there is room to stand; until then it carries on.
function slideStep(sim: Sim, dir: number, jumpPressed: boolean): void {
  const { map, player: p, settings } = sim;
  if (p.slide > 0) p.slide--;
  const ending = p.slide === 0 || !p.onGround || jumpPressed;
  if (ending && roomToStand(map, p, p.standH)) {
    standUp(p);
    p.vx = dir * settings.runSpeed;
    if (jumpPressed && p.onGround) p.vy = -settings.jumpVelocity;
    physics(sim);
    return;
  }
  p.vx = p.facing * SLIDE_SPEED;
  physics(sim);
  if (p.vx === 0) p.slide = 0; // hit a wall: stand up as soon as there is room
}

export function updatePlayer(sim: Sim, input: Input): void {
  const { map, player: p, settings, prev } = sim;

  if (p.hurt > 0) {
    if (sliding(p) && roomToStand(map, p, p.standH)) standUp(p);
    // Knocked back: no control, but still falling.
    p.hurt--;
    p.vx = p.knockback * KNOCKBACK_SPEED;
    if (p.vy < 0) p.vy = 0;
    physics(sim);
    return;
  }

  const jumpPressed = input.jump && !prev.jump;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

  if (sliding(p)) {
    slideStep(sim, dir, jumpPressed);
    return;
  }

  if (!p.onLadder) {
    const cx = p.x + p.w / 2;
    const grabUp = input.up && ladderAtPx(map, cx, p.y + p.h / 2);
    const grabDown = input.down && p.onGround && ladderAtPx(map, cx, p.y + p.h);
    if (grabUp || grabDown) {
      p.onLadder = true;
      p.x = firstTile(cx) * TILE_SIZE + (TILE_SIZE - p.w) / 2;
    }
  }
  if (p.onLadder) {
    climb(sim, input, jumpPressed);
    return;
  }

  if (settings.slide && p.onGround && input.down && jumpPressed) {
    startSlide(p);
    slideStep(sim, dir, false);
    return;
  }

  const target = dir * settings.runSpeed;
  if (p.onGround && p.onIce) p.vx += clamp(target - p.vx, -ICE_ACCEL, ICE_ACCEL);
  else p.vx = target;

  if (jumpPressed && p.onGround) p.vy = -settings.jumpVelocity;
  else if (!input.jump && p.vy < -JUMP_CUT_SPEED) p.vy = -JUMP_CUT_SPEED;

  physics(sim);
}
