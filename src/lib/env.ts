import { z } from "zod";

/**
 * Variables publiques : lues avec des accès littéraux pour que Next.js puisse
 * les injecter au build. Ne jamais mettre de secret dans une variable NEXT_PUBLIC_.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().startsWith("price_").optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("SaaS <no-reply@example.com>"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const parsed = publicSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Variables d'environnement publiques invalides : ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const cleaned = Object.fromEntries(Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = serverSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error(`Variables d'environnement serveur invalides : ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export function publicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
}

let cachedServerEnv: ServerEnv | undefined;

/** À appeler uniquement côté serveur. Validation paresseuse : le build passe sans secrets. */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") throw new Error("serverEnv() appelé côté client");
  cachedServerEnv ??= parseServerEnv(process.env);
  return cachedServerEnv;
}

export function isBillingConfigured(env: ServerEnv): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_PRO_MONTHLY);
}
