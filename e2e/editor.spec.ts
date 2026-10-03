import { expect, test, type Page } from "@playwright/test";

// The tiles of the first zone of the first saved game, read straight from IndexedDB.
async function savedTiles(page: Page): Promise<number[]> {
  return page.evaluate(
    () =>
      new Promise<number[]>((resolve, reject) => {
        const request = indexedDB.open("megarombuilder");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const all = request.result.transaction("projects").objectStore("projects").getAll();
          all.onsuccess = () => resolve(all.result[0].project.levels[0].zones[0].tiles);
        };
      }),
  );
}

async function clickTile(page: Page, x: number, y: number) {
  const box = await page.getByTestId("zone-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  await page.mouse.click(box.x + x * 32 + 16, box.y + y * 32 + 16);
}

test("make a game, paint, undo, save, play and come back", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No games yet. Make one to start building.")).toBeVisible();
  await page.screenshot({ path: "test-results/home.png", fullPage: true });

  await page.getByRole("textbox", { name: "Game name" }).fill("Snow Fortress");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await expect(page.getByRole("heading", { name: "Snow Fortress" })).toBeVisible();

  // Saving happens a moment after each change, so wait for what is stored to catch up.
  const tileAt = (i: number) => expect.poll(async () => (await savedTiles(page))[i]);

  await page.getByRole("button", { name: "Spike" }).click();
  await clickTile(page, 5, 10);
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  await tileAt(10 * 16 + 5).toBe(4);

  await page.getByRole("button", { name: "Undo" }).click();
  await tileAt(10 * 16 + 5).toBe(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await tileAt(10 * 16 + 5).toBe(4);
  await expect(page.getByText("Saved")).toBeVisible();
  await page.screenshot({ path: "test-results/editor.png", fullPage: true });

  // A drag paints a row in one undo step.
  const box = await page.getByTestId("zone-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  await page.getByRole("button", { name: "Ice" }).click();
  await page.mouse.move(box.x + 1 * 32 + 16, box.y + 6 * 32 + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + 4 * 32 + 16, box.y + 6 * 32 + 16, { steps: 8 });
  await page.mouse.up();
  const row = () => expect.poll(async () => (await savedTiles(page)).slice(6 * 16 + 1, 6 * 16 + 5));
  await row().toEqual([2, 2, 2, 2]);
  await page.getByRole("button", { name: "Undo" }).click();
  await row().toEqual([0, 0, 0, 0]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Snow Fortress" })).toBeVisible();
  expect((await savedTiles(page))[10 * 16 + 5]).toBe(4);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop playing" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.screenshot({ path: "test-results/playing.png", fullPage: true });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("zone-canvas")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open Snow Fortress" })).toBeVisible();
});

test("open a copy of the demo stage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start from the demo stage" }).click();
  await expect(page.getByRole("button", { name: /Snowy Path/ })).toBeVisible();
  await page.getByRole("button", { name: /Frozen Shaft/ }).click();
  await expect(page.getByLabel("Frozen Shaft, 2 screens")).toBeVisible();
});
