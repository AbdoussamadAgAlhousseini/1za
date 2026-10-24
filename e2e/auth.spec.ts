import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginAsAgent } from "./helpers";

test("visiteur non connecté redirigé vers la connexion", async ({ page }) => {
  await page.goto("/sportifs");
  await expect(page).toHaveURL(/\/connexion/);
});

test("identifiants incorrects : message générique", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Numéro de téléphone").fill("70 99 99 99");
  await page.getByLabel("Mot de passe", { exact: true }).fill("Mauvais-Pass-1");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Identifiants incorrects")).toBeVisible();
});

test("administrateur : connexion par mot de passe seul", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
});

test("agent : connexion par téléphone et accès limité au contrôle", async ({ page }) => {
  await loginAsAgent(page);
  await expect(page.getByRole("link", { name: "Sportifs" })).toHaveCount(0);
  for (const path of ["/tableau-de-bord", "/sportifs", "/paiements", "/personnel", "/journal"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/acces-refuse/);
  }
});

test("export CSV refusé à un agent par appel direct", async ({ page }) => {
  await loginAsAgent(page);
  const res = await page.request.post("/api/exports", {
    form: { kind: "athletes", from: "2026-01-01", to: "2026-01-31" },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.status()).toBe(403);
});
