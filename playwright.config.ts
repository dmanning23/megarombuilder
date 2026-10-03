import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3100" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build: Next.js allows only one dev server per project, and one may already be running.
    command: "npm run build && npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
