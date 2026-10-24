import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test("toutes les pages d'administration s'affichent", async ({ page }) => {
  await loginAsAdmin(page);
  const pages: [string, string][] = [
    ["/tableau-de-bord", "Tableau de bord"],
    ["/sportifs", "Sportifs"],
    ["/abonnements", "Abonnements"],
    ["/abonnements?vue=tous", "Abonnements"],
    ["/frequentation", "Fréquentation"],
    ["/paiements", "Paiements"],
    ["/rapports", "Rapports"],
    ["/journal", "Journal d'audit"],
    ["/personnel", "Personnel"],
    ["/parametres", "Paramètres"],
    ["/mon-compte", "Mon compte"],
  ];
  for (const [path, title] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  }
});

test("export CSV des sportifs (journalisé)", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/rapports");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Sportifs et statut/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^stade26-athletes-.*\.csv$/);
  await page.goto("/journal");
  await expect(page.getByText("Export de données").first()).toBeVisible();
});

test("recherche de sportif sans matricule dans l'URL", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/sportifs");
  await page.getByLabel("Rechercher par matricule").fill("ZZ");
  await expect(page.getByText(/Aucun résultat|sportifs/).first()).toBeVisible();
  expect(page.url()).not.toContain("ZZ");
});
