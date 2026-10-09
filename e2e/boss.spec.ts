import { expect, test, type Page } from "@playwright/test";

type Saved = { boss: { name: string; attacks: string[] } | null; levels: { zones: { things: { type: string }[] }[] }[] };

async function saved(page: Page): Promise<Saved> {
  return page.evaluate(
    () =>
      new Promise<Saved>((resolve, reject) => {
        const request = indexedDB.open("megarombuilder");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const all = request.result.transaction("projects").objectStore("projects").getAll();
          all.onsuccess = () => resolve(all.result[0].project);
        };
      }),
  );
}

test("make a boss, put it in the boss room, and fight it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("My Boss");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Characters" }).click();
  await page.getByRole("tab", { name: "Boss" }).click();
  await page.getByRole("button", { name: "Make your own boss" }).click();
  await page.getByRole("button", { name: "How it plays" }).click();
  await page.getByRole("combobox", { name: "Attack 1" }).selectOption({ label: "Rain" });
  await page.getByRole("combobox", { name: "Attack 2" }).selectOption({ label: "Big shot" });
  await page.getByRole("group", { name: "Use in the boss room" }).getByRole("button", { name: "Your boss" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect.poll(async () => (await saved(page)).boss?.attacks).toEqual(["rain", "big", "dash"]);
  await expect.poll(async () => (await saved(page)).levels[0].zones[2].things.map((t) => t.type)).toEqual(["own-boss"]);
  await page.screenshot({ path: "test-results/boss.png", fullPage: true });

  await page.getByRole("button", { name: "Level" }).click();
  await page.getByRole("button", { name: /Boss Room/ }).click();
  await page.getByRole("button", { name: "Play from this zone" }).click();
  await expect(page.getByRole("button", { name: "Stop playing" })).toBeVisible();
  await page.waitForTimeout(2000); // into the fight
  await page.screenshot({ path: "test-results/boss-fight.png" });
});
