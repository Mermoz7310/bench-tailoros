"use server";

import { redirect } from "next/navigation";
import { requireOrg, requireUser } from "@/lib/auth";
import { ensureStripeCustomer, getStripe } from "@/lib/billing";
import { publicEnv, serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function startCheckout(slug: string): Promise<void> {
  const user = await requireUser();
  const { org } = await requireOrg(slug, "billing.manage");
  const env = serverEnv();
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;

  const customer = await ensureStripeCustomer(org, user.email ?? "");
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: org.id,
    line_items: [{ price: env.STRIPE_PRICE_PRO_MONTHLY!, quantity: 1 }],
    subscription_data: { metadata: { org_id: org.id } },
    allow_promotion_codes: true,
    success_url: `${site}/app/${org.slug}/billing?checkout=success`,
    cancel_url: `${site}/app/${org.slug}/billing?checkout=cancel`,
  });

  const supabase = await createClient();
  await supabase.rpc("log_event", { p_org: org.id, p_action: "billing.checkout_started", p_target: org.slug });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
  redirect(session.url);
}

export async function openBillingPortal(slug: string): Promise<void> {
  const { org } = await requireOrg(slug, "billing.manage");
  if (!org.stripe_customer_id) redirect(`/app/${org.slug}/billing`);
  const portal = await getStripe().billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${publicEnv().NEXT_PUBLIC_SITE_URL}/app/${org.slug}/billing`,
  });
  redirect(portal.url);
}
