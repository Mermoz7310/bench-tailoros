import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const DEMO = { email: "demo@example.com", password: "demo-password-123", org: "Atelier Démo", slug: "atelier-demo" };

export function newEmail(label: string) {
  return `${label}-${randomUUID().slice(0, 8)}@e2e.test`;
}

export async function signUp(page: Page, email: string, name = "Utilisateur Test", password = "motdepasse-solide-1") {
  await page.goto("/signup");
  await page.getByLabel("Nom complet").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
}

export async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export async function createOrg(page: Page, name: string) {
  await expect(page).toHaveURL(/\/app\/onboarding$/);
  await page.getByLabel("Nom de l'organisation").fill(name);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByTestId("org-name")).toHaveText(name);
}
