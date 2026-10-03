import type Stripe from "stripe";

export type SubscriptionRow = {
  org_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isActiveStatus(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_STATUSES.has(status));
}

/** Traduit un abonnement Stripe en ligne de la table subscriptions. Renvoie null si l'organisation est inconnue. */
export function subscriptionToRow(sub: Stripe.Subscription, now: Date = new Date()): SubscriptionRow | null {
  const orgId = sub.metadata?.org_id;
  if (!orgId) return null;
  const item = sub.items?.data?.[0];
  const periodEnd = item?.current_period_end;
  return {
    org_id: orgId,
    stripe_subscription_id: sub.id,
    stripe_price_id: item?.price?.id ?? null,
    status: sub.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    updated_at: now.toISOString(),
  };
}

export type BillingDeps = {
  retrieveSubscription: (id: string) => Promise<Stripe.Subscription>;
  orgCustomerMatches: (orgId: string, customerId: string) => Promise<boolean>;
  upsertSubscription: (row: SubscriptionRow) => Promise<void>;
};

export const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/**
 * Traite un événement Stripe vérifié. Idempotent et insensible à l'ordre d'arrivée :
 * on relit toujours l'état courant de l'abonnement chez Stripe plutôt que la copie contenue dans l'événement.
 */
export async function handleStripeEvent(event: Stripe.Event, deps: BillingDeps): Promise<"synced" | "ignored"> {
  if (!HANDLED_EVENTS.has(event.type)) return "ignored";

  let subscriptionId: string | null = null;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || !session.subscription) return "ignored";
    subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  } else {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  }

  const sub = await deps.retrieveSubscription(subscriptionId);
  const row = subscriptionToRow(sub);
  if (!row) return "ignored";

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (!(await deps.orgCustomerMatches(row.org_id, customerId))) return "ignored";

  await deps.upsertSubscription(row);
  return "synced";
}
