import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { Badge, Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { requireOrg } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDay, formatXof, isFinal, isOrderStatus, nextStatus, STATUS_LABEL } from "@/lib/tailor";
import { advanceOrder, cancelOrder, recordPayment } from "../../../tailor-actions";

export default async function OrderPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { org, role } = await requireOrg(slug);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("order_balances")
    .select("id, customer_id, description, total_xof, paid_xof, balance_xof, due_date, status, is_late")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!order || !isOrderStatus(order.status)) notFound();

  const [{ data: customer }, { data: payments }] = await Promise.all([
    supabase.from("customers").select("id, name").eq("id", order.customer_id).single(),
    supabase.from("payments").select("id, amount_xof, paid_at").eq("order_id", id).order("paid_at", { ascending: false }),
  ]);

  const status = order.status;
  const next = nextStatus(status);
  const canCancel = can(role, "members.manage") && !isFinal(status);
  const canPay = status !== "cancelled" && order.balance_xof > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        {customer ? (
          <Link href={`/app/${org.slug}/customers/${customer.id}`} className="text-sm text-muted-foreground hover:underline">
            ← {customer.name}
          </Link>
        ) : null}
        <h2 className="text-xl font-semibold" data-testid="order-description">
          {order.description}
        </h2>
        <p className="mt-1 flex items-center gap-2 text-sm">
          <Badge data-testid="order-status">{STATUS_LABEL[status]}</Badge>
          <span className="text-muted-foreground">Livraison prévue le {formatDay(order.due_date)}</span>
          {order.is_late ? <Badge className="bg-danger text-white">En retard</Badge> : null}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted-foreground">Prix total</p>
          <p className="mt-1 text-2xl font-semibold" data-testid="order-total">{formatXof(order.total_xof)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Déjà payé</p>
          <p className="mt-1 text-2xl font-semibold" data-testid="order-paid">{formatXof(order.paid_xof)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Reste à payer</p>
          <p className="mt-1 text-2xl font-semibold" data-testid="order-balance">{formatXof(order.balance_xof)}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardTitle>Avancement</CardTitle>
          <div className="flex flex-wrap gap-2">
            {next ? (
              <ActionForm action={advanceOrder.bind(null, org.slug, order.id)}>
                <SubmitButton>Passer à : {STATUS_LABEL[next]}</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted-foreground">Commande terminée.</p>
            )}
            {canCancel ? (
              <ActionForm action={cancelOrder.bind(null, org.slug, order.id)}>
                <SubmitButton variant="outline">Annuler la commande</SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Paiements</CardTitle>
          {canPay ? (
            <ActionForm action={recordPayment.bind(null, org.slug, order.id)} className="flex flex-wrap items-end gap-3" testId="payment-form">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount">Montant (FCFA)</Label>
                <Input id="amount" name="amount" inputMode="numeric" required className="w-40" />
              </div>
              <SubmitButton>Enregistrer le paiement</SubmitButton>
            </ActionForm>
          ) : null}
          <ul className="divide-y divide-border text-sm" data-testid="payments-list">
            {(payments ?? []).length === 0 ? <li className="py-2 text-muted-foreground">Aucun paiement.</li> : null}
            {(payments ?? []).map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{new Date(p.paid_at).toLocaleDateString("fr-BE")}</span>
                <span className="font-medium">{formatXof(p.amount_xof)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
