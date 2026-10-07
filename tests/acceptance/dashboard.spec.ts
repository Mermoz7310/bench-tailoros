import { expect, test } from "@playwright/test";
import { addCustomer, createOrder, isoDate, newWorkshop, openCustomer, pay } from "./tailor-helpers";

test.describe("S5 — Statuts et tableau de bord", () => {
  test("Étant donné une commande reçue, quand je la fais avancer, alors elle passe par En cours, Prête, Livrée, puis ne bouge plus", async ({ page }) => {
    const slug = await newWorkshop(page);
    await addCustomer(page, slug, "Awa Ndiaye");
    await openCustomer(page, slug, "Awa Ndiaye");
    await createOrder(page, "Tailleur pagne", 30000, isoDate(5));

    const status = page.getByTestId("order-status");
    for (const next of ["En cours", "Prête", "Livrée"]) {
      await page.getByRole("button", { name: `Passer à : ${next}` }).click();
      await expect(status).toHaveText(next);
    }
    await expect(page.getByRole("button", { name: /Passer à/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Annuler la commande" })).toHaveCount(0);
  });

  test("Étant donné une commande en retard et une à l'heure, alors le tableau de bord montre seulement la commande en retard et le total à encaisser", async ({ page }) => {
    const slug = await newWorkshop(page);
    await addCustomer(page, slug, "Cheikh Sarr");
    await openCustomer(page, slug, "Cheikh Sarr");
    await createOrder(page, "Costume en retard", 40000, isoDate(-2));
    await pay(page, 15000);

    await openCustomer(page, slug, "Cheikh Sarr");
    await createOrder(page, "Chemise à l'heure", 8000, isoDate(10));

    await page.goto(`/app/${slug}`);
    const late = page.getByTestId("late-orders");
    await expect(late).toContainText("Costume en retard");
    await expect(late).not.toContainText("Chemise à l'heure");
    await expect(page.getByTestId("outstanding-total")).toHaveText("33 000 FCFA");
  });

  test("Étant donné une commande annulée, alors elle sort des retards et du total à encaisser", async ({ page }) => {
    const slug = await newWorkshop(page);
    await addCustomer(page, slug, "Ndeye Faye");
    await openCustomer(page, slug, "Ndeye Faye");
    await createOrder(page, "Commande abandonnée", 20000, isoDate(-1));
    await page.getByRole("button", { name: "Annuler la commande" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Annulée");

    await page.goto(`/app/${slug}`);
    await expect(page.getByTestId("late-orders-empty")).toBeVisible();
    await expect(page.getByTestId("outstanding-total")).toHaveText("0 FCFA");
  });
});
