import Link from "next/link";
import { Badge, Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDay, formatXof, isOrderStatus, STATUS_LABEL } from "@/lib/tailor";

export default async function OrgDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org } = await requireOrg(slug);
  const supabase = await createClient();

  const { data: open } = await supabase
    .from("order_balances")
    .select("id, customer_id, description, due_date, status, balance_xof, is_late")
    .eq("org_id", org.id)
    .neq("status", "cancelled")
    .or("status.neq.delivered,balance_xof.gt.0")
    .order("due_date", { ascending: true })
    .limit(500);

  const orders = open ?? [];
  const outstanding = orders.reduce((sum, o) => sum + Number(o.balance_xof), 0);
  const late = orders.filter((o) => o.is_late);
  const active = orders.filter((o) => o.status !== "delivered");

  const row = (o: (typeof orders)[number]) => (
    <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
      <Link href={`/app/${org.slug}/orders/${o.id}`} className="hover:underline">
        {o.description}
      </Link>
      <span className="flex items-center gap-2 text-muted-foreground">
        {formatDay(o.due_date)}
        <Badge>{isOrderStatus(o.status) ? STATUS_LABEL[o.status] : o.status}</Badge>
      </span>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardDescription>Reste à encaisser</CardDescription>
          <p className="mt-2 text-3xl font-semibold" data-testid="outstanding-total">{formatXof(outstanding)}</p>
        </Card>
        <Card>
          <CardDescription>Commandes en cours</CardDescription>
          <p className="mt-2 text-3xl font-semibold">{active.length}</p>
        </Card>
        <Card>
          <CardDescription>En retard</CardDescription>
          <p className="mt-2 text-3xl font-semibold text-danger">{late.length}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>En retard</CardTitle>
          {late.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground" data-testid="late-orders-empty">Aucune commande en retard.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border" data-testid="late-orders">{late.map(row)}</ul>
          )}
        </Card>
        <Card>
          <CardTitle>À livrer</CardTitle>
          {active.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune commande. <Link className="underline" href={`/app/${org.slug}/customers`}>Ouvrir un client</Link> pour en créer une.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border" data-testid="active-orders">{active.map(row)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
