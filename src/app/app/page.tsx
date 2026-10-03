import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { listMyOrgs } from "@/lib/auth";

export default async function AppHome() {
  const orgs = await listMyOrgs();
  if (orgs.length === 0) redirect("/app/onboarding");
  if (orgs.length === 1) redirect(`/app/${orgs[0]!.slug}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vos organisations</h1>
        <Button asChild variant="outline">
          <Link href="/app/onboarding">Nouvelle organisation</Link>
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {orgs.map((o) => (
          <Link key={o.id} href={`/app/${o.slug}`}>
            <Card className="hover:bg-muted">
              <CardTitle>{o.name}</CardTitle>
              <CardDescription>Rôle : {o.role}</CardDescription>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
