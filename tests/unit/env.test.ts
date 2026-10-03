import { describe, expect, it } from "vitest";
import { isBillingConfigured, parsePublicEnv, parseServerEnv } from "@/lib/env";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "x".repeat(40),
};

describe("variables d'environnement", () => {
  it("accepte une configuration publique valide et applique la valeur par défaut du site", () => {
    expect(parsePublicEnv(validPublic).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("refuse une URL Supabase invalide avec un message explicite", () => {
    expect(() => parsePublicEnv({ ...validPublic, NEXT_PUBLIC_SUPABASE_URL: "pas-une-url" })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("exige la clé service_role côté serveur", () => {
    expect(() => parseServerEnv({})).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("refuse une clé Stripe mal formée (ex. clé publique à la place de la secrète)", () => {
    expect(() => parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "x".repeat(40), STRIPE_SECRET_KEY: "pk_test_123" })).toThrow();
  });

  it("traite les chaînes vides comme absentes et désactive la facturation incomplète", () => {
    const env = parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "x".repeat(40), STRIPE_SECRET_KEY: "" });
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(isBillingConfigured(env)).toBe(false);
  });

  it("active la facturation quand les trois variables Stripe sont présentes", () => {
    const env = parseServerEnv({
      SUPABASE_SERVICE_ROLE_KEY: "x".repeat(40),
      STRIPE_SECRET_KEY: "sk_test_abc",
      STRIPE_WEBHOOK_SECRET: "whsec_abc",
      STRIPE_PRICE_PRO_MONTHLY: "price_abc",
    });
    expect(isBillingConfigured(env)).toBe(true);
  });
});
