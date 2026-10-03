import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function OrgDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role } = await requireOrg(slug);
  const supabase = await createClient();
  const { count } = await supabase.from("memberships").select("*", { count: "exact", head: true }).eq("org_id", org.id);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardDescription>Membres</CardDescription>
        <CardTitle className="mt-2 text-3xl">{count ?? 0}</CardTitle>
      </Card>
      <Card>
        <CardDescription>Votre rôle</CardDescription>
        <CardTitle className="mt-2 text-3xl">{role}</CardTitle>
      </Card>
      <Card>
        <CardDescription>Prochaine étape</CardDescription>
        <p className="mt-2 text-sm">Les fonctionnalités métier du SaaS s&apos;ajoutent ici.</p>
      </Card>
    </div>
  );
}
