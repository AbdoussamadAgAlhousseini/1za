import { expect, type Page } from "@playwright/test";

/** Comptes créés par `npm run seed:dev` (instance locale uniquement). */
export const ADMIN_PASSWORD = "Admin-Stade-2026";
export const AGENT_PHONE = "70 00 00 01";
export const AGENT_PASSWORD = "Agent-Stade-2026";

export async function loginAsAdmin(page: Page) {
  await page.goto("/connexion");
  await page.getByRole("tab", { name: /Administration/ }).click();
  await page.getByLabel("Mot de passe administrateur").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/tableau-de-bord/);
}

export async function loginAsAgent(page: Page) {
  await page.goto("/connexion");
  await page.getByLabel("Numéro de téléphone").fill(AGENT_PHONE);
  await page.getByLabel("Mot de passe", { exact: true }).fill(AGENT_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/controle/);
}

export function randomMatricule() {
  const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const l = () => L[Math.floor(Math.random() * 26)];
  return `${l()}${l()}${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
}
