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
