import { expect, test } from "@playwright/test";
import { addCustomer, createOrder, isoDate, newWorkshop, openCustomer, pay } from "./tailor-helpers";

test.describe("S3/S4 — Commandes et paiements", () => {
  test("Étant donné une commande de 25 000 FCFA, quand le client verse un acompte de 10 000, alors il reste 15 000 à payer", async ({ page }) => {
    const slug = await newWorkshop(page);
    await addCustomer(page, slug, "Khady Ba");
    await openCustomer(page, slug, "Khady Ba");
    await createOrder(page, "Grand boubou bazin", 25000, isoDate(7));

    await expect(page.getByTestId("order-status")).toHaveText("Reçue");
    await expect(page.getByTestId("order-total")).toHaveText("25 000 FCFA");
    await expect(page.getByTestId("order-balance")).toHaveText("25 000 FCFA");

    await pay(page, 10000);
    await expect(page.getByTestId("order-paid")).toHaveText("10 000 FCFA");
    await expect(page.getByTestId("order-balance")).toHaveText("15 000 FCFA");
    await expect(page.getByTestId("payments-list")).toContainText("10 000 FCFA");
  });

  test("Étant donné un reste de 4 000 FCFA, quand je saisis 5 000, alors le paiement est refusé", async ({ page }) => {
    const slug = await newWorkshop(page);
    await addCustomer(page, slug, "Ousmane Diallo");
    await openCustomer(page, slug, "Ousmane Diallo");
    await createOrder(page, "Chemise lin", 10000, isoDate(3));

    await pay(page, 6000);
    await expect(page.getByTestId("order-balance")).toHaveText("4 000 FCFA");
    await pay(page, 5000);
    await expect(page.getByText("Le montant dépasse le reste à payer.")).toBeVisible();
    await expect(page.getByTestId("order-paid")).toHaveText("6 000 FCFA");

    await pay(page, 4000);
    await expect(page.getByTestId("order-balance")).toHaveText("0 FCFA");
  });

  test("Étant donné une fiche client, quand je crée une commande, alors elle apparaît dans l'historique du client", async ({ page }) => {
    const slug = await newWorkshop(page);
    await addCustomer(page, slug, "Mariama Cissé");
    await openCustomer(page, slug, "Mariama Cissé");
    await createOrder(page, "Robe de mariée", 150000, isoDate(30));
    await openCustomer(page, slug, "Mariama Cissé");
    await expect(page.getByTestId("customer-orders")).toContainText("Robe de mariée");
  });
});
