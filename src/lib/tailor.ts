import { z } from "zod";

// ---------------------------------------------------------------------------
// Montants (francs CFA, entiers)
// ---------------------------------------------------------------------------

/** 25000 -> "25 000 FCFA" (espaces normales, pour un affichage et des tests stables). */
export function formatXof(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.abs(Math.trunc(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${digits} FCFA`;
}

/** "25 000", "25.000", "25000" -> 25000. Renvoie null si ce n'est pas un entier positif ou nul. */
export function parseXof(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[\s  .]/g, "").replace(/fcfa$/i, "");
  if (!/^\d{1,12}$/.test(cleaned)) return null;
  return Number(cleaned);
}

// ---------------------------------------------------------------------------
// Dates (les dates de livraison sont des jours calendaires, sans fuseau horaire)
// ---------------------------------------------------------------------------

/** "2026-10-14" -> "14/10/2026" */
export function formatDay(isoDay: string): string {
  const [y, m, d] = isoDay.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : isoDay;
}

// ---------------------------------------------------------------------------
// Statuts de commande (miroir de advance_order_status / cancel_order en SQL)
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = ["received", "in_progress", "ready", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: "Reçue",
  in_progress: "En cours",
  ready: "Prête",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  received: "in_progress",
  in_progress: "ready",
  ready: "delivered",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  return NEXT[status] ?? null;
}

export function isFinal(status: OrderStatus): boolean {
  return status === "delivered" || status === "cancelled";
}

// ---------------------------------------------------------------------------
// Formulaires
// ---------------------------------------------------------------------------

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(120, "Nom trop long (120 caractères maximum)."),
  phone: z
    .string()
    .trim()
    .max(30, "Téléphone trop long.")
    .transform((v) => (v === "" ? null : v)),
});

export const MEASUREMENT_FIELDS = [
  { key: "chest", label: "Poitrine" },
  { key: "waist", label: "Taille" },
  { key: "hips", label: "Hanches" },
  { key: "shoulder", label: "Épaule" },
  { key: "sleeve", label: "Manche" },
  { key: "length", label: "Longueur" },
] as const;

export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]["key"];
export type MeasurementInput = Record<MeasurementKey, number | null> & { notes: string | null };

/** Valide une fiche de mesures saisie (virgule décimale acceptée). */
export function parseMeasurements(raw: Record<string, unknown>): { data: MeasurementInput } | { error: string } {
  const data = { notes: null } as MeasurementInput;
  let filled = 0;
  for (const { key } of MEASUREMENT_FIELDS) {
    const value = typeof raw[key] === "string" ? (raw[key] as string).trim().replace(",", ".") : "";
    if (value === "") {
      data[key] = null;
      continue;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1 || n > 300) return { error: "Chaque mesure doit être comprise entre 1 et 300 cm." };
    data[key] = Math.round(n * 10) / 10;
    filled++;
  }
  if (filled === 0) return { error: "Renseignez au moins une mesure." };
  const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
  if (notes.length > 500) return { error: "Notes trop longues (500 caractères maximum)." };
  data.notes = notes || null;
  return { data };
}

export const orderSchema = z.object({
  description: z.string().trim().min(1, "La description est obligatoire.").max(200, "Description trop longue."),
  total: z.string().transform((v, ctx) => {
    const n = parseXof(v);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: "Prix invalide : saisissez un montant entier en FCFA." });
      return z.NEVER;
    }
    return n;
  }),
  due_date: z.iso.date("Date de livraison invalide."),
});

/** Nettoie une recherche avant de l'insérer dans un filtre PostgREST (pas de virgule, parenthèse, joker…). */
export function sanitizeSearch(q: unknown): string {
  if (typeof q !== "string") return "";
  return q.replace(/[,()%*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}
