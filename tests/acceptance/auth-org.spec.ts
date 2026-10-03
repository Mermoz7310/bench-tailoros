import { expect, test } from "@playwright/test";
import { createOrg, DEMO, logIn, newEmail, signUp } from "./helpers";

test.describe("Comptes et organisations", () => {
  test("Étant donné un visiteur, quand il s'inscrit et crée son organisation, alors il en est propriétaire", async ({ page }) => {
    const email = newEmail("owner");
    await signUp(page, email, "Awa Diop");
    await createOrg(page, "Atelier Awa");

    await page.getByRole("link", { name: "Membres" }).click();
    const list = page.getByTestId("members-list");
    await expect(list).toContainText(email);
    await expect(list).toContainText("owner");
  });

  test("Étant donné un propriétaire, quand il invite un collègue, alors l'invitation apparaît en attente", async ({ page }) => {
    await signUp(page, newEmail("inviter"));
    await createOrg(page, "Org Invitations");
    await page.getByRole("link", { name: "Membres" }).click();

    const invited = newEmail("guest");
    const form = page.getByTestId("invite-form");
    await form.getByLabel("E-mail").fill(invited);
    await form.getByRole("button", { name: "Inviter" }).click();
    await expect(page.getByText(`Invitation envoyée à ${invited}.`)).toBeVisible();
    await expect(page.getByTestId("pending-invitations")).toContainText(invited);
  });

  test("Étant donné le compte de démo, quand il se connecte, alors il arrive sur son organisation", async ({ page }) => {
    await logIn(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(new RegExp(`/app/${DEMO.slug}$`));
    await expect(page.getByTestId("org-name")).toHaveText(DEMO.org);
  });

  test("Étant donné un mauvais mot de passe, quand on se connecte, alors un message d'erreur s'affiche", async ({ page }) => {
    await logIn(page, DEMO.email, "mauvais-mot-de-passe");
    await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("Étant donné un utilisateur connecté, quand il se déconnecte, alors l'application redevient inaccessible", async ({ page }) => {
    await logIn(page, DEMO.email, DEMO.password);
    await expect(page.getByTestId("org-name")).toBeVisible();
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto(`/app/${DEMO.slug}`);
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
