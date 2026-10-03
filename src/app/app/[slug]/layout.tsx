import Link from "next/link";
import type { ReactNode } from "react";
import { requireOrg } from "@/lib/auth";
import { can } from "@/lib/permissions";

export default async function OrgLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role } = await requireOrg(slug);
  const base = `/app/${org.slug}`;
  const links = [
    { href: base, label: "Tableau de bord", show: true },
    { href: `${base}/members`, label: "Membres", show: can(role, "members.view") },
    { href: `${base}/billing`, label: "Facturation", show: can(role, "billing.view") },
    { href: `${base}/audit`, label: "Journal", show: can(role, "audit.view") },
    { href: `${base}/settings`, label: "Paramètres", show: can(role, "org.update") },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Organisation</p>
        <h1 className="text-2xl font-semibold" data-testid="org-name">
          {org.name}
        </h1>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-border text-sm">
        {links
          .filter((l) => l.show)
          .map((l) => (
            <Link key={l.href} href={l.href} className="rounded-t-md px-3 py-2 hover:bg-muted">
              {l.label}
            </Link>
          ))}
      </nav>
      {children}
    </div>
  );
}
