import { expect, test } from "@playwright/test";

const SIZES = [
  { name: "1280", width: 1280, height: 800 },
  { name: "1600", width: 1600, height: 1000 },
  { name: "phone", width: 390, height: 844 },
];

for (const size of SIZES) {
  test(`the Characters screen at ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    // The Characters screen scrolls inside its own panel: let it grow so a screenshot shows the whole tab.
    const shoot = async (path: string) => {
      await page.evaluate(() => {
        for (const el of [document.body, document.querySelector("main"), document.querySelector("main")?.parentElement]) {
          if (!(el instanceof HTMLElement)) continue;
          el.style.height = "auto";
          el.style.overflow = "visible";
        }
      });
      await page.screenshot({ path, fullPage: true });
    };
    await page.goto("/");
    await page.getByRole("textbox", { name: "Game name" }).fill("Look");
    await page.getByRole("button", { name: "Make a new game" }).click();
    await page.getByRole("button", { name: "Characters" }).click();
    await shoot(`test-results/characters-hero-${size.name}.png`);
    await page.getByRole("tab", { name: "Enemies" }).click();
    await page.getByRole("button", { name: "New enemy" }).click();
    await page.getByRole("textbox", { name: "Enemy name" }).fill("Frost Fang");
    await page.getByRole("group", { name: "Choose how it behaves" }).getByRole("button", { name: "Turret" }).click();
    await shoot(`test-results/characters-enemies-${size.name}.png`);
    await page.getByRole("button", { name: "How it plays" }).click();
    await expect(page.getByRole("complementary", { name: "How it plays" })).toBeVisible();
    await page.waitForTimeout(300); // let it finish sliding in
    await page.screenshot({ path: `test-results/characters-drawer-${size.name}.png` });
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("tab", { name: "Boss" }).click();
    await page.getByRole("button", { name: "Make your own boss" }).click();
    await shoot(`test-results/characters-boss-${size.name}.png`);
    // Nothing spills sideways off the page.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
