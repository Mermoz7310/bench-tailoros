import { expect, test } from "@playwright/test";
import { addCustomer, newWorkshop } from "./tailor-helpers";

test.describe("S1 — Clients", () => {
  test("Étant donné un atelier, quand j'ajoute deux clients, alors ils apparaissent et je les retrouve par nom ou téléphone", async ({ page }) => {
    const slug = await newWorkshop(page);
    await addCustomer(page, slug, "Aminata Sow", "77 123 45 67");
    await addCustomer(page, slug, "Ibrahima Fall", "76 999 00 11");

    const list = page.getByTestId("customers-list");
    await expect(list).toContainText("Aminata Sow");
    await expect(list).toContainText("Ibrahima Fall");

    await page.getByLabel("Rechercher").fill("aminata");
    await page.getByLabel("Rechercher").press("Enter");
    await expect(list).toContainText("Aminata Sow");
    await expect(list).not.toContainText("Ibrahima Fall");

    await page.getByLabel("Rechercher").fill("999");
    await page.getByLabel("Rechercher").press("Enter");
    await expect(list).toContainText("Ibrahima Fall");
    await expect(list).not.toContainText("Aminata Sow");
  });

  test("Étant donné le formulaire client, quand le nom est vide, alors le client n'est pas créé", async ({ page }) => {
    const slug = await newWorkshop(page);
    await page.goto(`/app/${slug}/customers`);
    const form = page.getByTestId("customer-form");
    await form.getByLabel("Nom").fill("   ");
    await form.getByRole("button", { name: "Ajouter le client" }).click();
    await expect(page.getByText("Le nom est obligatoire.")).toBeVisible();
    await expect(page.getByTestId("customers-empty")).toBeVisible();
  });

  test("Étant donné deux ateliers, quand le second consulte ses clients, alors il ne voit pas ceux du premier", async ({ browser }) => {
    const a = await browser.newPage();
    const slugA = await newWorkshop(a, "Atelier A");
    await addCustomer(a, slugA, "Cliente Secrète");

    const b = await browser.newPage();
    const slugB = await newWorkshop(b, "Atelier B");
    await b.goto(`/app/${slugB}/customers`);
    await expect(b.getByTestId("customers-empty")).toBeVisible();
    const res = await b.goto(`/app/${slugA}/customers`);
    expect(res?.status()).toBe(404);
  });
});
