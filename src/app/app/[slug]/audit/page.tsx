import { Card, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AuditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org } = await requireOrg(slug, "audit.view");
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, target, created_at, actor_id")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <Card>
      <CardTitle>Journal d&apos;audit</CardTitle>
      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2">Date</th>
            <th>Action</th>
            <th>Cible</th>
          </tr>
        </thead>
        <tbody>
          {(logs ?? []).map((l) => (
            <tr key={l.id} className="border-t border-border">
              <td className="py-2">{new Date(l.created_at).toLocaleString("fr-BE")}</td>
              <td className="font-mono">{l.action}</td>
              <td className="max-w-48 truncate">{l.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
