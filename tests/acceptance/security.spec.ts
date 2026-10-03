import { expect, test } from "@playwright/test";
import { createOrg, DEMO, newEmail, signUp } from "./helpers";

test.describe("Sécurité", () => {
  test("Étant donné un visiteur anonyme, quand il ouvre l'application, alors il est redirigé vers la connexion", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp/);
  });

  test("Étant donné un utilisateur d'une autre organisation, quand il ouvre l'organisation de démo, alors il obtient une page introuvable", async ({ page }) => {
    await signUp(page, newEmail("intruder"));
    await createOrg(page, "Org Intrus");
    const response = await page.goto(`/app/${DEMO.slug}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Page introuvable")).toBeVisible();
  });

  test("Étant donné un utilisateur normal, quand il ouvre la console d'administration, alors il obtient une page introuvable", async ({ page }) => {
    await signUp(page, newEmail("notadmin"));
    await createOrg(page, "Org Normale");
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
  });

  test("Étant donné une redirection externe dans ?next, quand on se connecte, alors on reste sur le site", async ({ page }) => {
    await page.goto("/login?next=https://evil.example.com");
    await page.getByLabel("E-mail").fill(DEMO.email);
    await page.getByLabel("Mot de passe").fill(DEMO.password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/app/);
  });

  test("Les en-têtes de sécurité sont présents et la sonde de santé répond", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ status: "ok", db: "ok" });

    const home = await request.get("/");
    expect(home.headers()["x-frame-options"]).toBe("DENY");
    expect(home.headers()["x-content-type-options"]).toBe("nosniff");
    expect(home.headers()["x-powered-by"]).toBeUndefined();
  });

  test("Le webhook Stripe refuse une requête sans signature valide", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", { data: { type: "customer.subscription.updated" } });
    expect([400, 503]).toContain(res.status());
  });
});
