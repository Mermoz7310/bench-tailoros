import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/lib/auth";
import { isActiveStatus } from "@/lib/billing-sync";
import { isBillingConfigured, serverEnv } from "@/lib/env";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { openBillingPortal, startCheckout } from "../../billing-actions";

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { slug } = await params;
  const { checkout } = await searchParams;
  const { org, role } = await requireOrg(slug, "billing.view");

  if (!isBillingConfigured(serverEnv())) {
    return (
      <Card>
        <CardTitle>Facturation</CardTitle>
        <CardDescription data-testid="billing-disabled">
          La facturation n&apos;est pas encore configurée (variables STRIPE_* absentes).
        </CardDescription>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("org_id", org.id)
    .maybeSingle();
  const active = isActiveStatus(sub?.status);
  const canManage = can(role, "billing.manage");

  return (
    <Card className="flex max-w-lg flex-col gap-4">
      <CardTitle>Facturation</CardTitle>
      {checkout === "success" ? <Alert tone="success">Paiement reçu. L&apos;abonnement s&apos;active dans quelques secondes.</Alert> : null}
      <p>
        Formule : <Badge>{active ? "Pro" : "Gratuite"}</Badge>{" "}
        {sub ? <span className="text-sm text-muted-foreground">(statut Stripe : {sub.status})</span> : null}
      </p>
      {sub?.current_period_end ? (
        <p className="text-sm text-muted-foreground">
          {sub.cancel_at_period_end ? "Se termine le " : "Prochain renouvellement le "}
          {new Date(sub.current_period_end).toLocaleDateString("fr-BE")}
        </p>
      ) : null}
      {canManage ? (
        active || org.stripe_customer_id ? (
          <form action={openBillingPortal.bind(null, org.slug)}>
            <Button type="submit" variant="outline">Gérer l&apos;abonnement et les factures</Button>
          </form>
        ) : null
      ) : (
        <p className="text-sm text-muted-foreground">Seul un propriétaire peut modifier l&apos;abonnement.</p>
      )}
      {canManage && !active ? (
        <form action={startCheckout.bind(null, org.slug)}>
          <Button type="submit">Passer à Pro</Button>
        </form>
      ) : null}
    </Card>
  );
}
