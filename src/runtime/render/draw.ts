import type { ContentPack, ThingBehaviour, TileBehaviour } from "@/model/contentPack";
import { TILE_SIZE, tileIndex, zoneSize } from "@/model/geometry";
import type { Zone } from "@/model/schema";
import { ENEMY_SHOT_SIZE, SCREEN_H, SCREEN_W, SHOT_H, SHOT_W } from "@/runtime/sim/constants";
import { num } from "@/runtime/sim/entities/types";
import type { Camera, Sim } from "@/runtime/sim/state";
import { firstTile, lastTile } from "@/runtime/sim/tilemap";
import { viewFor } from "@/runtime/sim/view";

export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  "fillStyle" | "fillRect" | "font" | "textAlign" | "fillText"
>;

// Placeholder colours until the content pack supplies sprite art.
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

// A vertical bar of one-pixel ticks, filled from the bottom.
function healthBar(ctx: Ctx2D, x: number, value: number, max: number, colour: string): void {
  rect(ctx, "#000000", x - 1, 15, 8, max * 2 + 1);
  for (let i = 0; i < value; i++) rect(ctx, colour, x, 14 + (max - i) * 2, 6, 1);
}
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

function drawZone(
  ctx: Ctx2D,
  zone: Zone,
  pack: ContentPack,
  camera: Camera,
  dx: number,
  dy: number,
): void {
  const size = zoneSize(zone.scroll, zone.screens);
  const behaviours = new Map(pack.tiles.map((t) => [t.id, t.behaviour]));
  const camX = Math.round(camera.x);
  const camY = Math.round(camera.y);
  rect(ctx, BACKGROUNDS[zone.variant] ?? "#404040", dx, dy, SCREEN_W, SCREEN_H);

  const x0 = Math.max(0, firstTile(camX));
  const x1 = Math.min(size.width - 1, lastTile(camX + SCREEN_W));
  const y0 = Math.max(0, firstTile(camY));
  const y1 = Math.min(size.height - 1, lastTile(camY + SCREEN_H));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const behaviour = behaviours.get(zone.tiles[tileIndex(size, tx, ty)]);
      if (!behaviour) continue;
      const height = behaviour === "oneWay" ? 4 : TILE_SIZE;
      rect(
        ctx,
        TILE_COLOURS[behaviour],
        tx * TILE_SIZE - camX + dx,
        ty * TILE_SIZE - camY + dy,
        TILE_SIZE,
        height,
      );
    }
  }
}

export function draw(ctx: Ctx2D, sim: Sim): void {
  const view = viewFor(sim);
  rect(ctx, "#000000", 0, 0, SCREEN_W, SCREEN_H);
  if (view.outgoing) {
    const { zoneIndex, camera, dx, dy } = view.outgoing;
    drawZone(ctx, sim.level.zones[zoneIndex], sim.pack, camera, Math.round(dx), Math.round(dy));
  }
  const offsetX = Math.round(view.incoming.dx);
  const offsetY = Math.round(view.incoming.dy);
  drawZone(ctx, sim.map.zone, sim.pack, view.camera, offsetX, offsetY);

  const originX = offsetX - Math.round(view.camera.x);
  const originY = offsetY - Math.round(view.camera.y);
  const p = sim.player;
  for (const slot of sim.slots) {
    const e = slot.entity;
    if (!e) continue;
    const flashing = e.flash > 0 && e.flash % 4 < 2;
    rect(
      ctx,
      flashing ? "#ffffff" : ENTITY_COLOURS[e.behaviour],
      Math.round(e.x) + originX,
      Math.round(e.y) + originY,
      e.w,
      e.h,
    );
  }

  const blinkedOut = p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 1;
  if (sim.phase !== "dead" && !blinkedOut) {
    const px = Math.round(p.x) + originX;
    const py = Math.round(p.y) + originY;
    rect(ctx, PLAYER_COLOUR, px, py, p.w, p.h);
    rect(ctx, "#ffffff", p.facing > 0 ? px + p.w - 4 : px + 1, py + 4, 3, 3);
  }
  for (const shot of sim.shots) {
    rect(ctx, SHOT_COLOUR, Math.round(shot.x) + originX, Math.round(shot.y) + originY, SHOT_W, SHOT_H);
  }
  for (const shot of sim.enemyShots) {
    const size = ENEMY_SHOT_SIZE;
    rect(ctx, ENEMY_SHOT_COLOUR, Math.round(shot.x) + originX, Math.round(shot.y) + originY, size, size);
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
