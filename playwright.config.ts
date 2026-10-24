import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout. Prérequis : Supabase local démarré et données de
 * démonstration chargées (`npx supabase start` puis `npm run seed:dev`).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "fr-FR",
    timezoneId: "Africa/Bamako",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "ordinateur", use: { ...devices["Desktop Chrome"] } },
    { name: "telephone", use: { ...devices["Pixel 7"] }, testMatch: /controle\.spec\.ts/ },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/connexion",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
