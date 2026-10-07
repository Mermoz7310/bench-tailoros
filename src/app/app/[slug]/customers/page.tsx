import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/tailor";
import { createCustomer } from "../../tailor-actions";

export const metadata = { title: "Clients" };

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const q = sanitizeSearch((await searchParams).q);
  const { org } = await requireOrg(slug);
  const supabase = await createClient();

  let query = supabase.from("customers").select("id, name, phone").eq("org_id", org.id).order("name").limit(200);
  if (q) query = query.or(`name.ilike.*${q}*,phone.ilike.*${q}*`);
  const { data: customers } = await query;
  const { count: total } = await supabase.from("customers").select("*", { count: "exact", head: true }).eq("org_id", org.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Clients</CardTitle>
          <form method="get" className="flex gap-2" role="search">
            <Label htmlFor="q" className="sr-only">
              Rechercher
            </Label>
            <Input id="q" name="q" defaultValue={q} placeholder="Nom ou téléphone" className="w-56" />
          </form>
        </div>
        {!total ? (
          <p className="mt-6 text-sm text-muted-foreground" data-testid="customers-empty">
            Aucun client pour l&apos;instant. Ajoutez le premier avec le formulaire.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border" data-testid="customers-list">
            {(customers ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <Link href={`/app/${org.slug}/customers/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
                <span className="text-sm text-muted-foreground">{c.phone}</span>
              </li>
            ))}
            {customers?.length === 0 ? <li className="py-3 text-sm text-muted-foreground">Aucun résultat pour « {q} ».</li> : null}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Nouveau client</CardTitle>
        <CardDescription>Le téléphone sert à le retrouver rapidement.</CardDescription>
        <ActionForm action={createCustomer.bind(null, org.slug)} className="mt-4 flex flex-col gap-3" testId="customer-form">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" maxLength={120} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" type="tel" maxLength={30} />
          </div>
          <SubmitButton>Ajouter le client</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
