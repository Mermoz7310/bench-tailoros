"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireOrg, requireUser } from "@/lib/auth";
import { friendlyDbError, type ActionState } from "@/lib/errors";
import { sendEmail } from "@/lib/email";
import { invitationEmail } from "@/lib/email-templates";
import { publicEnv } from "@/lib/env";
import { canAssignRole, isRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const orgName = z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(80);

export async function createOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = orgName.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const base = slugify(parsed.data).slice(0, 40) || "organisation";
  const supabase = await createClient();
  let slug = base.length >= 3 ? base : `${base}-org`;

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase.rpc("create_organization", { p_name: parsed.data, p_slug: slug });
    if (!error && data) redirect(`/app/${(data as { slug: string }).slug}`);
    if (error?.code !== "23505") return { error: friendlyDbError(error) };
    slug = `${base}-${randomBytes(2).toString("hex")}`;
  }
  return { error: "Impossible de générer une adresse unique. Essayez un autre nom." };
}

export async function renameOrganization(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org } = await requireOrg(slug, "org.update");
  const parsed = orgName.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ name: parsed.data }).eq("id", org.id);
  if (error) return { error: friendlyDbError(error) };
  await supabase.rpc("log_event", { p_org: org.id, p_action: "org.renamed", p_target: org.slug, p_metadata: { name: parsed.data } });
  revalidatePath(`/app/${slug}`, "layout");
  return { success: "Nom mis à jour." };
}

const inviteSchema = z.object({
  email: z.email("Adresse e-mail invalide.").transform((v) => v.toLowerCase().trim()),
  role: z.enum(["admin", "member"]),
});

export async function inviteMember(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org, userId } = await requireOrg(slug, "members.invite");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .insert({ org_id: org.id, email: parsed.data.email, role: parsed.data.role, invited_by: userId })
    .select("token")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "Une invitation est déjà en attente pour cette adresse." : friendlyDbError(error) };
  }

  const { data: me } = await supabase.from("profiles").select("full_name, email").eq("id", userId).single();
  const link = `${publicEnv().NEXT_PUBLIC_SITE_URL}/app/invite/${data.token}`;
  await sendEmail({ to: parsed.data.email, ...invitationEmail({ orgName: org.name, inviterName: me?.full_name || me?.email || "Un membre", link }) });
  await supabase.rpc("log_event", { p_org: org.id, p_action: "invitation.sent", p_target: parsed.data.email, p_metadata: { role: parsed.data.role } });

  revalidatePath(`/app/${slug}/members`);
  return { success: `Invitation envoyée à ${parsed.data.email}.` };
}

export async function revokeInvitation(slug: string, invitationId: string): Promise<void> {
  const { org } = await requireOrg(slug, "members.invite");
  const supabase = await createClient();
  await supabase.from("invitations").delete().eq("id", invitationId).eq("org_id", org.id);
  revalidatePath(`/app/${slug}/members`);
}

export async function changeMemberRole(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org, role } = await requireOrg(slug, "members.manage");
  const target = z.uuid().safeParse(formData.get("user_id"));
  const newRole = formData.get("role");
  if (!target.success || !isRole(newRole)) return { error: "Requête invalide." };
  if (!canAssignRole(role, newRole)) return { error: "Seul un propriétaire peut attribuer ce rôle." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member_role", { p_org: org.id, p_user: target.data, p_role: newRole });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/app/${slug}/members`);
  return { success: "Rôle mis à jour." };
}

export async function removeMember(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org, userId } = await requireOrg(slug, "org.view");
  const target = z.uuid().safeParse(formData.get("user_id"));
  if (!target.success) return { error: "Requête invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_org: org.id, p_user: target.data });
  if (error) return { error: friendlyDbError(error) };
  if (target.data === userId) redirect("/app");
  revalidatePath(`/app/${slug}/members`);
  return { success: "Membre retiré." };
}

export async function acceptInvitation(token: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const parsed = z.uuid().safeParse(token);
  if (!parsed.success) return { error: "Lien d'invitation invalide." };

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token: parsed.data });
  if (error) return { error: "Invitation invalide, expirée, ou destinée à une autre adresse e-mail." };

  const { data: org } = await supabase.from("organizations").select("slug").eq("id", orgId as string).single();
  redirect(org ? `/app/${org.slug}` : "/app");
}
