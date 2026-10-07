import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { Badge, Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { requireOrg } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDay, formatXof, isOrderStatus, MEASUREMENT_FIELDS, STATUS_LABEL } from "@/lib/tailor";
import { addMeasurement, createOrder, deleteCustomer } from "../../../tailor-actions";

export default async function CustomerPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { org, role } = await requireOrg(slug);
  const supabase = await createClient();

  const { data: customer } = await supabase.from("customers").select("id, name, phone").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!customer) notFound();

  const [{ data: measurements }, { data: orders }] = await Promise.all([
    supabase
      .from("measurements")
      .select("id, chest, waist, hips, shoulder, sleeve, length, notes, taken_at")
      .eq("customer_id", id)
      .order("taken_at", { ascending: false })
      .limit(50),
    supabase
      .from("order_balances")
      .select("id, description, total_xof, balance_xof, due_date, status, is_late")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/app/${org.slug}/customers`} className="text-sm text-muted-foreground hover:underline">
            ← Clients
          </Link>
          <h2 className="text-xl font-semibold" data-testid="customer-name">
            {customer.name}
          </h2>
          {customer.phone ? <p className="text-sm text-muted-foreground">{customer.phone}</p> : null}
        </div>
        {can(role, "members.manage") ? (
          <ActionForm action={deleteCustomer.bind(null, org.slug, customer.id)}>
            <SubmitButton variant="ghost" size="sm">
              Supprimer le client
            </SubmitButton>
          </ActionForm>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Mesures</CardTitle>
          <CardDescription>En centimètres. La fiche la plus récente est en haut.</CardDescription>
          <ActionForm action={addMeasurement.bind(null, org.slug, customer.id)} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" testId="measurement-form">
            {MEASUREMENT_FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`m-${f.key}`}>{f.label} (cm)</Label>
                <Input id={`m-${f.key}`} name={f.key} inputMode="decimal" autoComplete="off" />
              </div>
            ))}
            <div className="col-span-full flex flex-col gap-1.5">
              <Label htmlFor="m-notes">Notes</Label>
              <Input id="m-notes" name="notes" maxLength={500} />
            </div>
            <div className="col-span-full">
              <SubmitButton>Enregistrer les mesures</SubmitButton>
            </div>
          </ActionForm>

          <ul className="mt-6 flex flex-col gap-3" data-testid="measurements-list">
            {(measurements ?? []).map((m) => (
              <li key={m.id} className="rounded-md border border-border p-3 text-sm" data-testid="measurement">
                <p className="mb-1 text-xs text-muted-foreground">{new Date(m.taken_at).toLocaleDateString("fr-BE")}</p>
                <p className="flex flex-wrap gap-x-4 gap-y-1">
                  {MEASUREMENT_FIELDS.filter((f) => m[f.key] !== null).map((f) => (
                    <span key={f.key}>
                      {f.label} <strong>{Number(m[f.key])}</strong> cm
                    </span>
                  ))}
                </p>
                {m.notes ? <p className="mt-1 text-muted-foreground">{m.notes}</p> : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Nouvelle commande</CardTitle>
          <ActionForm action={createOrder.bind(null, org.slug, customer.id)} className="mt-4 flex flex-col gap-3" testId="order-form">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="o-description">Description</Label>
              <Input id="o-description" name="description" maxLength={200} required placeholder="Grand boubou bazin" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="o-total">Prix total (FCFA)</Label>
                <Input id="o-total" name="total" inputMode="numeric" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="o-due">Livraison prévue</Label>
                <Input id="o-due" name="due_date" type="date" required />
              </div>
            </div>
            <SubmitButton>Créer la commande</SubmitButton>
          </ActionForm>

          <h3 className="mt-6 text-sm font-semibold">Historique des commandes</h3>
          <ul className="mt-2 divide-y divide-border text-sm" data-testid="customer-orders">
            {(orders ?? []).length === 0 ? <li className="py-2 text-muted-foreground">Aucune commande.</li> : null}
            {(orders ?? []).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/app/${org.slug}/orders/${o.id}`} className="hover:underline">
                  {o.description}
                </Link>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {formatDay(o.due_date)}
                  <Badge>{isOrderStatus(o.status) ? STATUS_LABEL[o.status] : o.status}</Badge>
                  {o.balance_xof > 0 ? <span>reste {formatXof(o.balance_xof)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
