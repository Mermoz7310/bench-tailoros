import { expect, test } from "@playwright/test";
import { addCustomer, newWorkshop, openCustomer } from "./tailor-helpers";

test.describe("S2 — Fiches de mesures", () => {
  test("Étant donné un client, quand j'enregistre deux fiches, alors la plus récente apparaît en premier", async ({ page }) => {
    const slug = await newWorkshop(page);
    await addCustomer(page, slug, "Fatou Diagne");
    await openCustomer(page, slug, "Fatou Diagne");

    const form = page.getByTestId("measurement-form");
    await form.getByLabel("Poitrine (cm)").fill("92");
    await form.getByLabel("Taille (cm)").fill("74");
    await form.getByRole("button", { name: "Enregistrer les mesures" }).click();
    await expect(page.getByTestId("measurement")).toHaveCount(1);

    await form.getByLabel("Poitrine (cm)").fill("94");
    await form.getByLabel("Hanches (cm)").fill("101");
    await form.getByLabel("Notes").fill("Après la fête");
    await form.getByRole("button", { name: "Enregistrer les mesures" }).click();
    await expect(page.getByTestId("measurement")).toHaveCount(2);

    const latest = page.getByTestId("measurement").first();
    await expect(latest).toContainText("94");
    await expect(latest).toContainText("101");
    await expect(latest).toContainText("Après la fête");
  });

  test("Étant donné une fiche vide ou une valeur absurde, quand j'enregistre, alors j'ai une erreur et rien n'est créé", async ({ page }) => {
    const slug = await newWorkshop(page);
    await addCustomer(page, slug, "Client Erreur");
    await openCustomer(page, slug, "Client Erreur");

    const form = page.getByTestId("measurement-form");
    await form.getByRole("button", { name: "Enregistrer les mesures" }).click();
    await expect(page.getByText("Renseignez au moins une mesure.")).toBeVisible();

    await form.getByLabel("Taille (cm)").fill("900");
    await form.getByRole("button", { name: "Enregistrer les mesures" }).click();
    await expect(page.getByText("Chaque mesure doit être comprise entre 1 et 300 cm.")).toBeVisible();
    await expect(page.getByTestId("measurement")).toHaveCount(0);
  });
});
