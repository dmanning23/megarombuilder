import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

async function tileClick(page: Page, x: number, y: number) {
  const box = await page.getByTestId("zone-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  // The canvas zooms to fit, so measure a tile rather than assume a size.
  const t = box.height / 15;
  await page.mouse.click(box.x + (x + 0.5) * t, box.y + (y + 0.5) * t);
}

test("build with every tool, check, change a zone, export and import", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("Tool Test");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await expect(page.getByText("This zone can be crossed. Difficulty 1 of 10.")).toBeVisible();

  // Pieces: a gap the checker accepts, then one it does not.
  await page.getByRole("tab", { name: "Pieces" }).click();
  await page.getByRole("button", { name: "Gap", exact: true }).click();
  await tileClick(page, 4, 5);
  await expect(page.getByText(/This zone can be crossed/)).toBeVisible();
  await page.getByRole("button", { name: "Erase" }).click();
  for (const x of [8, 9]) {
    await tileClick(page, x, 13);
    await tileClick(page, x, 14);
  }
  await expect(page.getByText("This zone can't be crossed.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Zone 1.*can't be crossed/ })).toBeVisible();
  await page.screenshot({ path: "test-results/tools-blocked.png", fullPage: true });
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(/This zone can be crossed/)).toBeVisible();

  // Enemies: place one, then drag it along.
  await page.getByRole("tab", { name: "Enemies and items" }).click();
  await page.getByRole("button", { name: "Snow Crawler" }).click();
  await tileClick(page, 12, 12);
  const box = await page.getByTestId("zone-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  const t = box.height / 15;
  await page.mouse.move(box.x + 12.5 * t, box.y + 12.6 * t);
  await page.mouse.down();
  await page.mouse.move(box.x + 14.5 * t, box.y + 12.6 * t, { steps: 6 });
  await page.mouse.up();

  // Zone settings: two screens long, cave look.
  await page.getByRole("combobox", { name: "Length" }).selectOption("2");
  await expect(page.getByLabel("Zone 1, 2 screens")).toBeVisible();
  await page.getByRole("combobox", { name: "Look" }).selectOption("cave");
  await page.getByRole("button", { name: "Add a climbing zone" }).click();
  await expect(page.getByLabel("Zone 2, 2 screens")).toBeVisible();
  await page.screenshot({ path: "test-results/tools-editor.png", fullPage: true });

  // Export, then import the file as a new game.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tool-test.megarom.json");
  const path = await download.path();
  const exported = JSON.parse(readFileSync(path, "utf8"));
  expect(exported.levels[0].zones[0].things[0]).toMatchObject({ type: "walker", x: 14, y: 12 });

  await page.goto("/");
  await page.getByLabel("Import a game file").setInputFiles(path);
  await expect(page.getByRole("heading", { name: "Tool Test" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Zone 2/ })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open Tool Test" })).toHaveCount(2);
});

test("a file that isn't a game is refused on the home page", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Import a game file").setInputFiles({
    name: "notes.json",
    mimeType: "application/json",
    buffer: Buffer.from("hello"),
  });
  // Next.js adds its own hidden alert region to every page, so find ours by its text.
  await expect(page.getByText("That file can't be opened. This file isn't a MegaRomBuilder game.")).toBeVisible();
});

test("narrow screens keep the zone at full size", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 1000 });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("Narrow");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await expect(page.getByTestId("zone-canvas")).toBeVisible();
  await page.waitForTimeout(800);
  const box = await page.getByTestId("zone-canvas").boundingBox();
  expect(box?.height).toBe(480);
});
