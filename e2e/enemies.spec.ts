import { expect, test, type Page } from "@playwright/test";

type Saved = {
  enemies: {
    id: string;
    name: string;
    behaviour: string;
    look: {
      animations: { walk: { frames: string[][]; size: { w: number; h: number } } };
    };
  }[];
  levels: { zones: { things: { type: string }[] }[] }[];
};

async function saved(page: Page): Promise<Saved> {
  return page.evaluate(
    () =>
      new Promise<Saved>((resolve, reject) => {
        const request = indexedDB.open("megarombuilder");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const all = request.result
            .transaction("projects")
            .objectStore("projects")
            .getAll();
          all.onsuccess = () => resolve(all.result[0].project);
        };
      }),
  );
}

test("make an enemy, place it, and play against it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("My Enemies");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Characters" }).click();
  await page.getByRole("tab", { name: "Enemies" }).click();
  await page.getByRole("button", { name: "New enemy" }).click();
  await page.getByRole("textbox", { name: "Enemy name" }).fill("Frost Fang");
  await page
    .getByRole("group", { name: "Choose how it behaves" })
    .getByRole("button", { name: "Walker" })
    .click();
  await page.getByRole("button", { name: "How it plays" }).click();
  await page
    .getByRole("group", { name: "Speed", exact: true })
    .getByRole("button", { name: "Fast" })
    .click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect
    .poll(async () => (await saved(page)).enemies.map((e) => e.name))
    .toEqual(["Frost Fang"]);
  await page.screenshot({ path: "test-results/enemies.png", fullPage: true });

  await page
    .getByRole("group", { name: "Frames" })
    .getByRole("button", { name: "Frame 2" })
    .click();
  await page.getByRole("button", { name: "Copy frame" }).click();
  await page.getByRole("button", { name: "Copy frame" }).click();
  await page.getByRole("button", { name: "Play animation" }).click();
  await expect
    .poll(
      async () =>
        (await saved(page)).enemies[0].look.animations.walk.frames.length,
    )
    .toBe(4);
  await page.screenshot({
    path: "test-results/enemy-frames.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Stop animation" }).click();
  await page
    .getByRole("group", { name: "Size" })
    .getByRole("button", { name: "Taller" })
    .click();
  await page
    .getByRole("group", { name: "Size" })
    .getByRole("button", { name: "Wider" })
    .click();
  await expect
    .poll(async () => (await saved(page)).enemies[0].look.animations.walk.size)
    .toEqual({ w: 18, h: 18 });
  await page.getByRole("button", { name: "Hitbox" }).click();
  await page.screenshot({
    path: "test-results/enemy-resized.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Level" }).click();
  await page.getByRole("tab", { name: "Enemies and items" }).click();
  await page.getByRole("button", { name: "Frost Fang Yours" }).click();
  const box = await page.getByTestId("zone-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  const t = box.height / 15;
  await page.mouse.click(box.x + 8.5 * t, box.y + 12.5 * t);
  await expect
    .poll(async () =>
      (await saved(page)).levels[0].zones[0].things.map((th) => th.type),
    )
    .toContainEqual(expect.stringMatching(/^own-/));

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop playing" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/enemies-playing.png" });
});
