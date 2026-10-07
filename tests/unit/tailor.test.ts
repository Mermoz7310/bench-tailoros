import { describe, expect, it } from "vitest";
import {
  customerSchema,
  formatDay,
  formatXof,
  isFinal,
  nextStatus,
  orderSchema,
  parseMeasurements,
  parseXof,
  sanitizeSearch,
} from "@/lib/tailor";

describe("montants FCFA", () => {
  it.each([
    [0, "0 FCFA"],
    [999, "999 FCFA"],
    [25000, "25 000 FCFA"],
    [1500000, "1 500 000 FCFA"],
    [-4000, "-4 000 FCFA"],
  ])("formatXof(%d) = %s", (n, s) => expect(formatXof(n)).toBe(s));

  it.each([
    ["25000", 25000],
    ["25 000", 25000],
    ["25.000", 25000],
    ["25 000 FCFA", 25000],
    ["0", 0],
  ])("parseXof(%s) = %d", (s, n) => expect(parseXof(s)).toBe(n));

  it.each(["", "abc", "-5", "12,5", "1e5", "1234567890123"])("parseXof refuse %s", (s) => expect(parseXof(s)).toBeNull());
});

describe("dates", () => {
  it("affiche une date de livraison au format belge/sénégalais sans décalage de fuseau", () => {
    expect(formatDay("2026-10-14")).toBe("14/10/2026");
    expect(formatDay("2026-01-01T00:00:00Z")).toBe("01/01/2026");
  });
});

describe("statuts de commande", () => {
  it("avance d'un pas jusqu'à livrée", () => {
    expect(nextStatus("received")).toBe("in_progress");
    expect(nextStatus("in_progress")).toBe("ready");
    expect(nextStatus("ready")).toBe("delivered");
    expect(nextStatus("delivered")).toBeNull();
    expect(nextStatus("cancelled")).toBeNull();
  });
  it("livrée et annulée sont finales", () => {
    expect(isFinal("delivered")).toBe(true);
    expect(isFinal("cancelled")).toBe(true);
    expect(isFinal("ready")).toBe(false);
  });
});

describe("formulaires", () => {
  it("client : nom obligatoire, téléphone vide = null", () => {
    expect(customerSchema.safeParse({ name: "   ", phone: "" }).success).toBe(false);
    expect(customerSchema.parse({ name: " Awa ", phone: "" })).toEqual({ name: "Awa", phone: null });
  });

  it("mesures : virgule acceptée, valeurs hors limites refusées, au moins une mesure", () => {
    expect(parseMeasurements({ chest: "92,5", notes: " " })).toEqual({
      data: { chest: 92.5, waist: null, hips: null, shoulder: null, sleeve: null, length: null, notes: null },
    });
    expect(parseMeasurements({})).toEqual({ error: "Renseignez au moins une mesure." });
    expect(parseMeasurements({ waist: "900" })).toEqual({ error: "Chaque mesure doit être comprise entre 1 et 300 cm." });
    expect(parseMeasurements({ waist: "0" })).toHaveProperty("error");
    expect(parseMeasurements({ waist: "abc" })).toHaveProperty("error");
  });

  it("commande : prix entier, date ISO", () => {
    expect(orderSchema.parse({ description: "Boubou", total: "25 000", due_date: "2026-10-14" })).toEqual({
      description: "Boubou",
      total: 25000,
      due_date: "2026-10-14",
    });
    expect(orderSchema.safeParse({ description: "Boubou", total: "25,5", due_date: "2026-10-14" }).success).toBe(false);
    expect(orderSchema.safeParse({ description: "Boubou", total: "100", due_date: "14/10/2026" }).success).toBe(false);
  });

  it("recherche : neutralise les caractères qui casseraient le filtre", () => {
    expect(sanitizeSearch("awa,phone.eq.1)")).toBe("awa phone.eq.1");
    expect(sanitizeSearch("  77 123  ")).toBe("77 123");
    expect(sanitizeSearch(undefined)).toBe("");
  });
});
