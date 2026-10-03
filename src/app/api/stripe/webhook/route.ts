import { NextResponse, type NextRequest } from "next/server";
import { getStripe, billingDeps } from "@/lib/billing";
import { handleStripeEvent } from "@/lib/billing-sync";
import { isBillingConfigured, serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const env = serverEnv();
  if (!isBillingConfigured(env) || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "billing disabled" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const payload = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event, billingDeps());
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error("[stripe] échec du traitement", event.type, error instanceof Error ? error.message : error);
    // 500 => Stripe réessaiera automatiquement.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
