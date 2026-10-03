import { describe, expect, it } from "vitest";
import { isValidSlug, safeRedirectPath, slugify } from "@/lib/utils";

describe("slugify", () => {
  it.each([
    ["Atelier Fatou & Fils", "atelier-fatou-fils"],
    ["  Hôtel Téranga  ", "hotel-teranga"],
    ["---", ""],
    ["Ça marche !!", "ca-marche"],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("ne dépasse jamais 48 caractères et ne finit pas par un tiret", () => {
    const s = slugify("a".repeat(47) + " b c d e");
    expect(s.length).toBeLessThanOrEqual(48);
    expect(s.endsWith("-")).toBe(false);
  });

  it("produit un slug accepté par la contrainte SQL", () => {
    expect(isValidSlug(slugify("Boutique de Dakar"))).toBe(true);
  });
});

describe("isValidSlug (doit rester identique à la contrainte SQL organizations.slug)", () => {
  it.each(["abc", "atelier-demo", "a1-b2"])("accepte %s", (s) => expect(isValidSlug(s)).toBe(true));
  it.each(["ab", "-abc", "abc-", "ABC", "a_b", "a".repeat(49)])("refuse %s", (s) => expect(isValidSlug(s)).toBe(false));
});

describe("safeRedirectPath (anti redirection ouverte)", () => {
  it.each([
    [null, "/app"],
    ["/app/x", "/app/x"],
    ["https://evil.com", "/app"],
    ["//evil.com", "/app"],
    ["/\\evil.com", "/app"],
    ["app", "/app"],
  ])("%s -> %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
