import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { requireOrg } from "@/lib/auth";
import { can, ROLES, canAssignRole, type Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation } from "../../actions";

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role, userId } = await requireOrg(slug, "members.view");
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("org_id", org.id)
    .order("created_at");
  const ids = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  const canManage = can(role, "members.manage");
  const canInvite = can(role, "members.invite");
  const { data: invitations } = canInvite
    ? await supabase
        .from("invitations")
        .select("id, email, role, expires_at")
        .eq("org_id", org.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      {canInvite ? (
        <Card>
          <CardTitle>Inviter un membre</CardTitle>
          <ActionForm action={inviteMember.bind(null, org.slug)} className="mt-4 flex flex-wrap items-end gap-3" testId="invite-form">
            <div className="flex min-w-60 flex-1 flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Rôle</Label>
              <Select id="role" name="role" defaultValue="member">
                <option value="member">member</option>
                <option value="admin">admin</option>
              </Select>
            </div>
            <SubmitButton>Inviter</SubmitButton>
          </ActionForm>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Membres</CardTitle>
        <ul className="mt-4 divide-y divide-border" data-testid="members-list">
          {(memberships ?? []).map((m) => {
            const p = byId.get(m.user_id);
            const memberRole = m.role as Role;
            const editable = canManage && m.user_id !== userId && (memberRole !== "owner" || role === "owner");
            return (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{p?.full_name || p?.email}</p>
                  <p className="text-sm text-muted-foreground">{p?.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {editable ? (
                    <ActionForm action={changeMemberRole.bind(null, org.slug)} className="flex items-center gap-2">
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <Select name="role" defaultValue={memberRole} aria-label="Rôle">
                        {ROLES.filter((r) => canAssignRole(role, r)).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                      <SubmitButton size="sm" variant="outline">
                        Changer
                      </SubmitButton>
                    </ActionForm>
                  ) : (
                    <Badge>{memberRole}</Badge>
                  )}
                  {editable || m.user_id === userId ? (
                    <ActionForm action={removeMember.bind(null, org.slug)}>
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <SubmitButton size="sm" variant="ghost">
                        {m.user_id === userId ? "Quitter" : "Retirer"}
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {canInvite && (invitations ?? []).length > 0 ? (
        <Card>
          <CardTitle>Invitations en attente</CardTitle>
          <CardDescription>Elles expirent au bout de 7 jours.</CardDescription>
          <ul className="mt-4 divide-y divide-border" data-testid="pending-invitations">
            {(invitations ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                <span>
                  {i.email} <Badge>{i.role}</Badge>
                </span>
                <form action={revokeInvitation.bind(null, org.slug, i.id)}>
                  <Button size="sm" variant="ghost" type="submit">
                    Annuler
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
