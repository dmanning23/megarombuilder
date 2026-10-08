import { expect, test, type Page } from "@playwright/test";

type Saved = { hero: { abilities: { jump: string; slide: boolean }; look: { animations: { stand: { frames: string[][] } } } } };

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

test("draw on the hero, give it abilities, and play as it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("My Hero");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Characters" }).click();
  await page.screenshot({ path: "test-results/hero-open.png" });

  const canvas = page.getByTestId("hero-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas");
  const px = box.width / 16;
  await page.screenshot({ path: "test-results/hero-canvas.png" });
  await page.mouse.click(box.x + 0.5 * px, box.y + 0.5 * px); // the top-left pixel of the stand pose
  await expect.poll(async () => (await saved(page)).hero.look.animations.stand.frames[0][0][0]).toBe("1");

  await page.getByRole("group", { name: "Jump" }).getByRole("button", { name: "Very high" }).click();
  await page.getByRole("group", { name: "Slide" }).getByRole("button", { name: "On" }).click();
  await expect.poll(async () => (await saved(page)).hero.abilities).toMatchObject({ jump: "veryHigh", slide: true });
  await expect(page.getByText("All zones can still be finished.")).toBeVisible();
  await page.screenshot({ path: "test-results/hero.png", fullPage: true });

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop playing" })).toBeVisible();
  await page.screenshot({ path: "test-results/hero-playing.png" });
});

test("import a picture into the hero", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("Imported Hero");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Characters" }).click();

  // A real PNG: 32 by 48, see-through, with a red block in the lower half.
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f83800";
    ctx.fillRect(8, 16, 16, 32);
    return canvas.toDataURL("image/png");
  });
  await page.getByLabel("Picture file").setInputFiles({
    name: "hero.png",
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByRole("dialog", { name: "Import a picture into Stand frame 1" })).toBeVisible();
  await page.screenshot({ path: "test-results/hero-import.png" });
  await page.getByRole("button", { name: "Use this" }).click();
  await expect.poll(async () => (await saved(page)).hero.look.animations.stand.frames[0][8]).toBe("....88888888....");
});
