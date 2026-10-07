import { expect, type Page } from "@playwright/test";
import { createOrg, newEmail, signUp } from "./helpers";

/** Nouvel atelier vierge : inscription + organisation. Renvoie le slug. */
export async function newWorkshop(page: Page, name = "Atelier Test"): Promise<string> {
  await signUp(page, newEmail("tailleur"), "Moussa Ndiaye");
  await createOrg(page, name);
  const slug = new URL(page.url()).pathname.split("/")[2];
  if (!slug) throw new Error("slug introuvable");
  return slug;
}

export async function addCustomer(page: Page, slug: string, name: string, phone = "") {
  await page.goto(`/app/${slug}/customers`);
  const form = page.getByTestId("customer-form");
  await form.getByLabel("Nom").fill(name);
  if (phone) await form.getByLabel("Téléphone").fill(phone);
  await form.getByRole("button", { name: "Ajouter le client" }).click();
  await expect(page.getByTestId("customers-list")).toContainText(name);
}

export async function openCustomer(page: Page, slug: string, name: string) {
  await page.goto(`/app/${slug}/customers`);
  await page.getByTestId("customers-list").getByRole("link", { name }).click();
  await expect(page.getByTestId("customer-name")).toHaveText(name);
}

export function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Crée une commande depuis la fiche client ouverte ; arrive sur la page de la commande. */
export async function createOrder(page: Page, description: string, total: number, dueDate: string) {
  const form = page.getByTestId("order-form");
  await form.getByLabel("Description").fill(description);
  await form.getByLabel("Prix total (FCFA)").fill(String(total));
  await form.getByLabel("Livraison prévue").fill(dueDate);
  await form.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page.getByTestId("order-description")).toHaveText(description);
}

export async function pay(page: Page, amount: number) {
  const form = page.getByTestId("payment-form");
  await form.getByLabel("Montant (FCFA)").fill(String(amount));
  await form.getByRole("button", { name: "Enregistrer le paiement" }).click();
}
