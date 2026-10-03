import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Administration" };

/** Console plateforme : réservée aux profils is_platform_admin (activé à la main en base). */
export default async function AdminPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin !== true) notFound();

  const admin = createAdminClient();
  const [{ count: users }, { count: orgs }, { data: recent }] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("organizations").select("*", { count: "exact", head: true }),
    admin.from("organizations").select("id, name, slug, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>{users ?? 0} utilisateurs</CardTitle>
        </Card>
        <Card>
          <CardTitle>{orgs ?? 0} organisations</CardTitle>
        </Card>
      </div>
      <Card>
        <CardTitle>Dernières organisations</CardTitle>
        <ul className="mt-4 divide-y divide-border text-sm">
          {(recent ?? []).map((o) => (
            <li key={o.id} className="flex justify-between py-2">
              <span>{o.name}</span>
              <span className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("fr-BE")}</span>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
