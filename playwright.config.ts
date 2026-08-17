import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4321";
const webServerCommand = process.env.E2E_WEB_SERVER_COMMAND;

export default defineConfig({
  testDir: "./apps/funnels/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  ...(webServerCommand
    ? {
        webServer: {
          command: webServerCommand,
          url: new URL("/visibility-audit/law-firms/", baseURL).toString(),
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
