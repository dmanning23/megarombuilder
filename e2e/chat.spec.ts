import { expect, test, type Page } from "@playwright/test";

type SavedProject = { levels: { zones: { tiles: number[] }[] }[]; chat: { text: string }[] };

// The first saved game, read straight from IndexedDB.
async function saved(page: Page): Promise<SavedProject> {
  return page.evaluate(
    () =>
      new Promise<SavedProject>((resolve, reject) => {
        const request = indexedDB.open("megarombuilder");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const all = request.result.transaction("projects").objectStore("projects").getAll();
          all.onsuccess = () => resolve(all.result[0].project);
        };
      }),
  );
}

const line = (value: unknown) => `${JSON.stringify(value)}\n`;
const done = (content: unknown[], stop_reason: string) => line({ type: "done", content, stop_reason });

async function makeGame(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Game name" }).fill("Snow Fortress");
  await page.getByRole("button", { name: "Make a new game" }).click();
  await expect(page.getByRole("heading", { name: "Snow Fortress" })).toBeVisible();
}

test("ask the assistant for spikes, see them saved, and undo them in one step", async ({ page }) => {
  const replies = [
    done([{ type: "tool_use", id: "tu-1", name: "fill_rect", input: { zone: "Zone 1", x: 3, y: 13, w: 2, h: 1, tile: 4 } }], "tool_use"),
    done([{ type: "tool_use", id: "tu-2", name: "check_zone", input: { zone: "Zone 1" } }], "tool_use"),
    line({ type: "text", text: "I added two spikes " }) +
      line({ type: "text", text: "to Zone 1." }) +
      done([{ type: "text", text: "I added two spikes to Zone 1." }], "end_turn"),
  ];
  const requests: unknown[] = [];
  await page.route("**/api/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: replies.shift() ?? "" });
  });

  await makeGame(page);
  await expect(page.getByText(/Ask for a change/)).toBeVisible();
  await page.getByRole("textbox", { name: "Message" }).fill("Add spikes to Zone 1");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("I added two spikes to Zone 1.")).toBeVisible();
  expect(requests).toHaveLength(3);

  const spike = () => expect.poll(async () => (await saved(page)).levels[0].zones[0].tiles[13 * 16 + 4]);
  await spike().toBe(4);
  await expect.poll(async () => (await saved(page)).chat.length).toBe(2);
  await page.screenshot({ path: "test-results/chat.png", fullPage: true });

  await page.getByRole("button", { name: "Undo" }).click();
  await spike().toBe(1); // the floor is back
  await expect(page.getByText("I added two spikes to Zone 1.")).toBeVisible();
});

test("the editor keeps working when the assistant is unavailable", async ({ page }) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) }),
  );
  await makeGame(page);
  await page.getByRole("textbox", { name: "Message" }).fill("Build me a level");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("The assistant isn't available right now.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Add a zone" }).click();
  await expect(page.getByRole("button", { name: /Zone 2/ })).toBeVisible();
});
