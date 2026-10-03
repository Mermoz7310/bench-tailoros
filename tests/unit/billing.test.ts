import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { handleStripeEvent, isActiveStatus, subscriptionToRow, type BillingDeps, type SubscriptionRow } from "@/lib/billing-sync";

function fakeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: "sub_123",
    object: "subscription",
    status: "active",
    customer: "cus_123",
    cancel_at_period_end: false,
    metadata: { org_id: "org-1" },
    items: { object: "list", data: [{ id: "si_1", current_period_end: 1_800_000_000, price: { id: "price_pro" } }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function event(type: string, object: unknown): Stripe.Event {
  return { id: "evt_1", object: "event", type, data: { object } } as unknown as Stripe.Event;
}

function deps(sub = fakeSubscription(), matches = true) {
  return {
    retrieveSubscription: vi.fn(async (_id: string) => sub),
    orgCustomerMatches: vi.fn(async (_org: string, _customer: string) => matches),
    upsertSubscription: vi.fn(async (_row: SubscriptionRow) => undefined),
  } satisfies BillingDeps;
}

describe("synchronisation Stripe", () => {
  it("convertit un abonnement Stripe en ligne SQL", () => {
    const row = subscriptionToRow(fakeSubscription(), new Date("2026-01-01T00:00:00Z"));
    expect(row).toEqual({
      org_id: "org-1",
      stripe_subscription_id: "sub_123",
      stripe_price_id: "price_pro",
      status: "active",
      current_period_end: new Date(1_800_000_000 * 1000).toISOString(),
      cancel_at_period_end: false,
      updated_at: "2026-01-01T00:00:00.000Z",
    });
  });

  it("ignore un abonnement sans org_id", () => {
    expect(subscriptionToRow(fakeSubscription({ metadata: {} }))).toBeNull();
  });

  it("seuls active et trialing donnent accès aux fonctions payantes", () => {
    expect(isActiveStatus("active")).toBe(true);
    expect(isActiveStatus("trialing")).toBe(true);
    expect(isActiveStatus("past_due")).toBe(false);
    expect(isActiveStatus(null)).toBe(false);
  });

  it("relit l'abonnement chez Stripe (et non la copie de l'événement) avant d'écrire", async () => {
    const d = deps(fakeSubscription({ status: "canceled" }));
    const stale = fakeSubscription({ status: "active" });
    expect(await handleStripeEvent(event("customer.subscription.updated", stale), d)).toBe("synced");
    expect(d.retrieveSubscription).toHaveBeenCalledWith("sub_123");
    expect(d.upsertSubscription.mock.calls[0]?.[0]).toMatchObject({ status: "canceled" });
  });

  it("checkout.session.completed synchronise l'abonnement créé", async () => {
    const d = deps();
    const result = await handleStripeEvent(event("checkout.session.completed", { mode: "subscription", subscription: "sub_123" }), d);
    expect(result).toBe("synced");
  });

  it("refuse d'attacher un abonnement dont le client ne correspond pas à l'organisation", async () => {
    const d = deps(fakeSubscription(), false);
    expect(await handleStripeEvent(event("customer.subscription.created", fakeSubscription()), d)).toBe("ignored");
    expect(d.upsertSubscription).not.toHaveBeenCalled();
  });

  it("ignore les événements non gérés", async () => {
    const d = deps();
    expect(await handleStripeEvent(event("invoice.paid", {}), d)).toBe("ignored");
    expect(d.retrieveSubscription).not.toHaveBeenCalled();
  });

  it("la vérification de signature rejette un corps modifié", () => {
    const stripe = new Stripe("sk_test_dummy");
    const secret = "whsec_test_secret";
    const payload = JSON.stringify({ id: "evt_1", object: "event", type: "invoice.paid", data: { object: {} } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(stripe.webhooks.constructEvent(payload, header, secret).id).toBe("evt_1");
    expect(() => stripe.webhooks.constructEvent(payload.replace("invoice", "hacked"), header, secret)).toThrow();
  });
});
