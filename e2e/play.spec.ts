import { expect, test } from "@playwright/test";

test("the demo stage page shows the game", async ({ page }) => {
  await page.goto("/play");
  await expect(page.locator("canvas")).toHaveAttribute("width", "256");
});
