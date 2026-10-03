import "server-only";
import Stripe from "stripe";
import { isBillingConfigured, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingDeps } from "@/lib/billing-sync";

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  const env = serverEnv();
  if (!isBillingConfigured(env) || !env.STRIPE_SECRET_KEY) throw new Error("Facturation non configurée");
  stripe ??= new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, appInfo: { name: "factory-template" } });
  return stripe;
}

export function billingDeps(): BillingDeps {
  const admin = createAdminClient();
  return {
    retrieveSubscription: (id) => getStripe().subscriptions.retrieve(id),
    orgCustomerMatches: async (orgId, customerId) => {
      const { data } = await admin.from("organizations").select("stripe_customer_id").eq("id", orgId).maybeSingle();
      return data?.stripe_customer_id === customerId;
    },
    upsertSubscription: async (row) => {
      const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "org_id" });
      if (error) throw new Error(`upsert subscription: ${error.message}`);
    },
  };
}

/** Récupère ou crée le client Stripe de l'organisation (écrit via service_role : jamais par l'utilisateur). */
export async function ensureStripeCustomer(org: { id: string; name: string; stripe_customer_id: string | null }, email: string) {
  if (org.stripe_customer_id) return org.stripe_customer_id;
  const customer = await getStripe().customers.create(
    { name: org.name, email, metadata: { org_id: org.id } },
    { idempotencyKey: `customer-${org.id}` },
  );
  const { error } = await createAdminClient()
    .from("organizations")
    .update({ stripe_customer_id: customer.id })
    .eq("id", org.id)
    .is("stripe_customer_id", null);
  if (error) throw new Error(`save customer: ${error.message}`);
  return customer.id;
}
