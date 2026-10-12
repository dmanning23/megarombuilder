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

// The tab row (enemy chips, New enemy, How it plays) sits up beside the tabs on a wide screen; on a
// phone it drops below them, and an alert above it pushes it down rather than hiding under it.
async function twoEnemies(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("Rows");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Characters" }).click();
  await page.getByRole("tab", { name: "Enemies" }).click();
  for (const name of ["Frost Fang", "Ice Bat"]) {
    await page.getByRole("button", { name: "New enemy" }).click();
    await page.getByRole("textbox", { name: "Enemy name" }).fill(name);
    await page.getByRole("group", { name: "Choose how it behaves" }).getByRole("button", { name: "Walker" }).click();
  }
}
const bottom = async (l: import("@playwright/test").Locator) => {
  const box = (await l.boundingBox())!;
  return box.y + box.height;
};
const top = async (l: import("@playwright/test").Locator) => (await l.boundingBox())!.y;

test("on a phone the tab row sits under the tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await twoEnemies(page);
  expect(await top(page.getByRole("list", { name: "Enemies" }))).toBeGreaterThanOrEqual(
    await bottom(page.getByRole("tab", { name: "Boss" })),
  );
});

test("an alert pushes the tab row down", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await twoEnemies(page);
  await page.getByRole("button", { name: "How it plays" }).click();
  const name = page.getByRole("textbox", { name: "Name" });
  await name.fill("frost fang");
  await name.press("Enter");
  await page.getByRole("button", { name: "Done" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "There is already an enemy called" });
  await expect(alert).toBeVisible();
  expect(await top(page.getByRole("list", { name: "Enemies" }))).toBeGreaterThanOrEqual(await bottom(alert));
});

test("a bigger Jump and shoot keeps the pixels the same size, and its thumbnail fits", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("Big jump");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Characters" }).click();
  const canvas = page.getByTestId("hero-canvas");
  const animations = page.getByRole("group", { name: "Animations" });
  const jump = animations.getByRole("button", { name: /^Jump and shoot,/ });
  await jump.click();
  const sizeGroup = page.getByRole("group", { name: "Size" });
  for (let i = 0; i < 4; i++) await sizeGroup.getByRole("button", { name: "Wider" }).click();
  for (let i = 0; i < 2; i++) await sizeGroup.getByRole("button", { name: "Taller" }).click();
  await expect(sizeGroup.getByText("24 × 28")).toBeVisible();
  const jumpWidth = (await canvas.boundingBox())!.width;
  expect((await jump.locator("canvas").boundingBox())!.width).toBeLessThanOrEqual(32); // the thumbnail is scaled to fit
  await page.screenshot({ path: "test-results/characters-big-jump.png" });
  await animations.getByRole("button", { name: /^Stand,/ }).click();
  // The same pixel size in both poses (a new canvas takes its zoom once its area is measured).
  await expect.poll(async () => (await canvas.boundingBox())!.width / 16).toBe(jumpWidth / 24);
});

test("the charge shot's Level 2 and its picture", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("Level two");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await page.getByRole("button", { name: "Characters" }).click();
  await page.getByRole("button", { name: "How it plays" }).click();
  await page.getByRole("group", { name: "Charge shot" }).getByRole("button", { name: "Level 2" }).click();
  await expect(page.getByRole("group", { name: "Charge shot" }).getByRole("button", { name: "Level 2" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(300); // let the drawer finish sliding in
  await page.screenshot({ path: "test-results/level2-drawer.png" });
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("group", { name: "Animations" }).getByRole("button", { name: /^Level 2 shot,/ }).click();
  await expect(page.getByRole("group", { name: "Size" })).toHaveCount(0); // a fixed size
  await page.screenshot({ path: "test-results/level2-picture.png" });
});
