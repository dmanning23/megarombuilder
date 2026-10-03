import type { ContentPack, ThingBehaviour, TileBehaviour } from "@/model/contentPack";
import { TILE_SIZE, tileIndex, zoneSize } from "@/model/geometry";
import type { Zone } from "@/model/schema";
import { ENEMY_SHOT_SIZE, SCREEN_H, SCREEN_W, SHOT_H, SHOT_W } from "@/runtime/sim/constants";
import { num, type Box, type Entity } from "@/runtime/sim/entities/types";
import type { Camera, Sim } from "@/runtime/sim/state";
import { firstTile, lastTile } from "@/runtime/sim/tilemap";
import { viewFor } from "@/runtime/sim/view";
import { playerPose, thingFrame, type ArtSet, type Sprite } from "./art";

export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  "fillStyle" | "fillRect" | "font" | "textAlign" | "fillText" | "drawImage"
>;

// Sprite art, and a way to turn a sprite into something drawImage can draw.
export type Skin = { set: ArtSet; image: (s: Sprite, flip: boolean) => CanvasImageSource };

// Colours for anything drawn without art.
export const BACKGROUNDS: Record<string, string> = { outdoor: "#9bd4ff", cave: "#1c2740" };
export const PLAYER_COLOUR = "#2f6bff";
export const SHOT_COLOUR = "#fff275";
export const ENEMY_SHOT_COLOUR = "#f72585";
export const BOSS_BAR_COLOUR = "#ff9e9e";
export const ENTITY_COLOURS: Record<ThingBehaviour, string> = {
  walker: "#ff8c42",
  flyer: "#c77dff",
  turret: "#8d99ae",
  jumper: "#80ed99",
  shielded: "#ffd166",
  dropper: "#ef476f",
  platform: "#adb5bd",
  health: "#ff006e",
  boss: "#00b4d8",
};
const TILE_COLOURS: Record<TileBehaviour, string> = {
  solid: "#e8f4ff",
  ice: "#7fd6f5",
  ladder: "#c9853a",
  spike: "#ff4d6d",
  oneWay: "#a8b8c8",
};

function rect(ctx: Ctx2D, colour: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

// Draws a sprite with its bottom centre on the bottom centre of a box.
function onBox(ctx: Ctx2D, skin: Skin, s: Sprite, flip: boolean, box: Box, ox: number, oy: number) {
  const x = Math.round(box.x + box.w / 2 - s.w / 2) + ox;
  const y = Math.round(box.y + box.h - s.h) + oy;
  ctx.drawImage(skin.image(s, flip), x, y);
}

// A vertical bar of one-pixel ticks, filled from the bottom.
function healthBar(ctx: Ctx2D, x: number, value: number, max: number, colour: string): void {
  rect(ctx, "#000000", x - 1, 15, 8, max * 2 + 1);
  for (let i = 0; i < value; i++) rect(ctx, colour, x, 14 + (max - i) * 2, 6, 1);
}

export function drawZone(
  ctx: Ctx2D,
  zone: Zone,
  pack: ContentPack,
  camera: Camera,
  dx: number,
  dy: number,
  skin: Skin | undefined,
  width = SCREEN_W,
  height = SCREEN_H,
): void {
  const size = zoneSize(zone.scroll, zone.screens);
  const behaviours = new Map(pack.tiles.map((t) => [t.id, t.behaviour]));
  const tileArt = skin?.set.tiles[zone.variant];
  const camX = Math.round(camera.x);
  const camY = Math.round(camera.y);
  const background = skin?.set.backgrounds[zone.variant] ?? BACKGROUNDS[zone.variant] ?? "#404040";
  rect(ctx, background, dx, dy, width, height);

  const x0 = Math.max(0, firstTile(camX));
  const x1 = Math.min(size.width - 1, lastTile(camX + width));
  const y0 = Math.max(0, firstTile(camY));
  const y1 = Math.min(size.height - 1, lastTile(camY + height));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const id = zone.tiles[tileIndex(size, tx, ty)];
      const behaviour = behaviours.get(id);
      if (!behaviour) continue;
      const px = tx * TILE_SIZE - camX + dx;
      const py = ty * TILE_SIZE - camY + dy;
      const art = tileArt?.[id];
      if (skin && art) {
        const above = ty > 0 ? zone.tiles[tileIndex(size, tx, ty - 1)] : -1;
        ctx.drawImage(skin.image(above !== id && art.top ? art.top : art.fill, false), px, py);
      } else {
        rect(ctx, TILE_COLOURS[behaviour], px, py, TILE_SIZE, behaviour === "oneWay" ? 4 : TILE_SIZE);
      }
    }
  }
}

function drawEntity(ctx: Ctx2D, sim: Sim, e: Entity, skin: Skin | undefined, ox: number, oy: number) {
  const flashing = e.flash > 0 && e.flash % 4 < 2;
  const frames = skin?.set.things[e.type];
  if (skin && frames && frames.length > 0) {
    if (flashing) return; // blink
    const frame = frames[thingFrame(e, sim.steps, frames.length)];
    onBox(ctx, skin, frame, e.facing < 0, e, ox, oy);
    return;
  }
  rect(
    ctx,
    flashing ? "#ffffff" : ENTITY_COLOURS[e.behaviour],
    Math.round(e.x) + ox,
    Math.round(e.y) + oy,
    e.w,
    e.h,
  );
}

export function draw(ctx: Ctx2D, sim: Sim, skin?: Skin): void {
  const view = viewFor(sim);
  rect(ctx, "#000000", 0, 0, SCREEN_W, SCREEN_H);
  if (view.outgoing) {
    const { zoneIndex, camera, dx, dy } = view.outgoing;
    drawZone(ctx, sim.level.zones[zoneIndex], sim.pack, camera, Math.round(dx), Math.round(dy), skin);
  }
  const offsetX = Math.round(view.incoming.dx);
  const offsetY = Math.round(view.incoming.dy);
  drawZone(ctx, sim.map.zone, sim.pack, view.camera, offsetX, offsetY, skin);

  const originX = offsetX - Math.round(view.camera.x);
  const originY = offsetY - Math.round(view.camera.y);
  const p = sim.player;

  for (const slot of sim.slots) {
    if (slot.entity) drawEntity(ctx, sim, slot.entity, skin, originX, originY);
  }

  const blinkedOut = p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 1;
  if (sim.phase !== "dead" && !blinkedOut) {
    if (skin) {
      const { pose, flip } = playerPose(p, sim.steps);
      onBox(ctx, skin, skin.set.player[pose], flip, p, originX, originY);
    } else {
      const px = Math.round(p.x) + originX;
      const py = Math.round(p.y) + originY;
      rect(ctx, PLAYER_COLOUR, px, py, p.w, p.h);
      rect(ctx, "#ffffff", p.facing > 0 ? px + p.w - 4 : px + 1, py + 4, 3, 3);
    }
  }

  for (const shot of sim.shots) {
    const x = Math.round(shot.x) + originX;
    const y = Math.round(shot.y) + originY;
    if (skin) ctx.drawImage(skin.image(skin.set.playerShot, shot.vx < 0), x, y);
    else rect(ctx, SHOT_COLOUR, x, y, SHOT_W, SHOT_H);
  }
  for (const shot of sim.enemyShots) {
    const x = Math.round(shot.x) + originX;
    const y = Math.round(shot.y) + originY;
    if (skin) ctx.drawImage(skin.image(skin.set.enemyShot, shot.vx < 0), x, y);
    else rect(ctx, ENEMY_SHOT_COLOUR, x, y, ENEMY_SHOT_SIZE, ENEMY_SHOT_SIZE);
  }

  healthBar(ctx, 16, p.health, sim.settings.maxHealth, "#ffe08a");
  const boss = sim.slots.find((s) => s.entity?.behaviour === "boss")?.entity;
  if (boss) healthBar(ctx, 234, boss.health, num(boss.settings, "health", 28), BOSS_BAR_COLOUR);

  if (sim.phase === "won") {
    rect(ctx, "#000000", 0, 100, SCREEN_W, 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("STAGE CLEAR", SCREEN_W / 2, 126);
  }
}
