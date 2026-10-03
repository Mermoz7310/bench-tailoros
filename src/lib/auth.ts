import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { can, isRole, type Action, type Role } from "@/lib/permissions";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export type OrgContext = {
  org: { id: string; name: string; slug: string; stripe_customer_id: string | null };
  role: Role;
  userId: string;
};

/**
 * Charge l'organisation par son slug pour l'utilisateur connecté.
 * Renvoie 404 si l'utilisateur n'en est pas membre (on ne révèle pas son existence)
 * ou s'il n'a pas le rôle requis pour `action`.
 */
export const requireOrg = cache(async (slug: string, action: Action = "org.view"): Promise<OrgContext> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, stripe_customer_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!org) notFound();

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !isRole(membership.role) || !can(membership.role, action)) notFound();

  return { org, role: membership.role, userId: user.id };
});

export async function listMyOrgs() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return (data ?? []).flatMap((m) => {
    const o = m.organizations as unknown as { id: string; name: string; slug: string } | null;
    return o ? [{ ...o, role: m.role as Role }] : [];
  });
}
