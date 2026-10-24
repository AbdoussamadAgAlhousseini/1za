import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginAsAgent, randomMatricule } from "./helpers";

test("parcours complet : enregistrement, entrée, double entrée refusée, sortie", async ({ browser }) => {
  // L'administrateur enregistre un sportif avec un premier abonnement.
  const adminPage = await (await browser.newContext()).newPage();
  await loginAsAdmin(adminPage);
  await adminPage.goto("/sportifs?nouveau=1");
  const matricule = randomMatricule();
  await adminPage.getByLabel("Matricule", { exact: true }).fill(matricule.toLowerCase());
  await adminPage.getByRole("button", { name: "Enregistrer le sportif" }).click();
  await expect(adminPage).toHaveURL(/\/sportifs\/[0-9a-f-]{36}$/);
  await expect(adminPage.getByRole("heading", { name: `${matricule.slice(0, 2)} ${matricule.slice(2)}` })).toBeVisible();
  // Le matricule n'apparaît jamais dans l'URL.
  expect(adminPage.url()).not.toContain(matricule);

  // L'agent contrôle et enregistre l'entrée.
  const page = await (await browser.newContext()).newPage();
  await loginAsAgent(page);
  const input = page.getByLabel("Matricule du sportif");
  await input.fill(matricule);
  await input.press("Enter");
  await expect(page.getByText("Entrée autorisée")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer l'entrée" }).click();
  await expect(page.getByText("Entrée enregistrée", { exact: true })).toBeVisible();

  // Nouveau contrôle : déjà à l'intérieur, sortie proposée.
  await input.fill(matricule);
  await input.press("Enter");
  await expect(page.getByText("Déjà à l'intérieur")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer l'entrée" })).toHaveCount(0);
  await page.getByRole("button", { name: "Enregistrer la sortie", exact: true }).click();
  await expect(page.getByText("Sortie enregistrée", { exact: true })).toBeVisible();
});

test("matricule inconnu et format invalide", async ({ page }) => {
  await loginAsAgent(page);
  const input = page.getByLabel("Matricule du sportif");
  await input.fill("QQ00001");
  await input.press("Enter");
  await expect(page.getByText(/Sportif introuvable|Entrée/).first()).toBeVisible();
  await input.fill("12");
  await input.press("Enter");
  await expect(page.getByText("Vérification impossible")).toBeVisible();
});

test("hors ligne : vérification sur l'appareil, file d'attente, synchronisation au retour du réseau", async ({ browser }) => {
  const adminPage = await (await browser.newContext()).newPage();
  await loginAsAdmin(adminPage);
  await adminPage.goto("/sportifs?nouveau=1");
  const matricule = randomMatricule();
  await adminPage.getByLabel("Matricule", { exact: true }).fill(matricule);
  await adminPage.getByRole("button", { name: "Enregistrer le sportif" }).click();
  await expect(adminPage).toHaveURL(/\/sportifs\/[0-9a-f-]{36}$/);
  const athleteUrl = adminPage.url();

  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAsAgent(page);
  await expect(page.getByText("Hors ligne prêt")).toBeVisible({ timeout: 20_000 });

  await context.setOffline(true);
  const input = page.getByLabel("Matricule du sportif");
  await input.fill(matricule);
  await input.press("Enter");
  await expect(page.locator("[data-offline=true][data-outcome=authorized]")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer l'entrée" }).click();
  await expect(page.getByText("sera transmise au retour du réseau")).toBeVisible();
  await expect(page.getByText("1 opération(s) en attente")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("1 opération(s) en attente")).toHaveCount(0, { timeout: 30_000 });

  await adminPage.goto(athleteUrl);
  await expect(adminPage.getByText("En cours").first()).toBeVisible();
  await adminPage.goto("/frequentation");
  await expect(adminPage.getByText("Hors ligne").first()).toBeVisible();
});
