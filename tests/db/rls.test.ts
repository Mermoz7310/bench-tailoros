import { afterAll, describe, expect, it } from "vitest";
import { addMember, asUser, cleanup, createOrg, createUser, pool } from "./helpers";

afterAll(async () => {
  await cleanup();
  await pool.end();
});

const DENIED = { code: "42501" };

describe("garde-fous globaux (s'appliquent aussi aux futures tables)", () => {
  it("toutes les tables du schéma public ont la RLS activée", async () => {
    const { rows } = await pool.query(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("le rôle anon n'a aucun privilège sur les tables publiques", async () => {
    const { rows } = await pool.query(`
      select distinct table_name from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'`);
    expect(rows).toEqual([]);
  });

  it("un visiteur anonyme ne peut rien lire", async () => {
    await expect(asUser(null, (q) => q("select * from public.organizations"))).rejects.toMatchObject(DENIED);
  });

  it("la fonction interne _audit n'est pas appelable par un utilisateur", async () => {
    const u = await createUser("auditor");
    const org = await createOrg(u);
    await expect(
      asUser(u, (q) => q("select public._audit($1, 'org.hacked', null, '{}')", [org.id])),
    ).rejects.toMatchObject(DENIED);
  });
});

describe("profils", () => {
  it("un profil est créé automatiquement à l'inscription", async () => {
    const u = await createUser("alice");
    const { rows } = await pool.query("select email, full_name, is_platform_admin from public.profiles where id = $1", [u.id]);
    expect(rows[0]).toEqual({ email: u.email, full_name: "alice", is_platform_admin: false });
  });

  it("un utilisateur ne peut pas se nommer administrateur de la plateforme", async () => {
    const u = await createUser("mallory");
    await expect(
      asUser(u, (q) => q("update public.profiles set is_platform_admin = true where id = $1", [u.id])),
    ).rejects.toMatchObject(DENIED);
  });

  it("on ne voit que les profils des personnes de ses organisations", async () => {
    const a = await createUser("a");
    const b = await createUser("b");
    const stranger = await createUser("stranger");
    const org = await createOrg(a);
    await addMember(org.id, b, "member");
    const ids = await asUser(a, async (q) => (await q<{ id: string }>("select id from public.profiles")).rows.map((r) => r.id));
    expect(ids).toContain(b.id);
    expect(ids).not.toContain(stranger.id);
  });
});

describe("isolation entre organisations", () => {
  it("un membre de A ne voit ni l'organisation, ni les membres, ni le journal de B", async () => {
    const a = await createUser("owner-a");
    const b = await createUser("owner-b");
    const orgA = await createOrg(a, "Org A");
    const orgB = await createOrg(b, "Org B");

    const seen = await asUser(a, async (q) => ({
      orgs: (await q("select id from public.organizations")).rows.map((r) => r.id),
      memberships: (await q("select org_id from public.memberships where org_id = $1", [orgB.id])).rowCount,
      audit: (await q("select id from public.audit_logs where org_id = $1", [orgB.id])).rowCount,
    }));
    expect(seen.orgs).toEqual([orgA.id]);
    expect(seen.memberships).toBe(0);
    expect(seen.audit).toBe(0);
  });

  it("impossible de s'ajouter soi-même dans une autre organisation", async () => {
    const victim = await createUser("victim");
    const attacker = await createUser("attacker");
    const org = await createOrg(victim);
    await expect(
      asUser(attacker, (q) =>
        q("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'owner')", [org.id, attacker.id]),
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it("impossible de créer une organisation sans passer par create_organization", async () => {
    const u = await createUser("direct");
    await expect(
      asUser(u, (q) => q("insert into public.organizations (name, slug) values ('X', 'x-direct')")),
    ).rejects.toMatchObject(DENIED);
  });
});

describe("création d'organisation", () => {
  it("le créateur devient owner et l'action est journalisée", async () => {
    const u = await createUser("founder");
    const org = await createOrg(u, "Atelier Fatou");
    const { rows } = await pool.query("select role from public.memberships where org_id = $1 and user_id = $2", [org.id, u.id]);
    expect(rows[0]?.role).toBe("owner");
    const audit = await pool.query("select actor_id, action from public.audit_logs where org_id = $1", [org.id]);
    expect(audit.rows).toEqual([{ actor_id: u.id, action: "org.created" }]);
  });

  it("refuse un slug invalide", async () => {
    const u = await createUser("badslug");
    await expect(
      asUser(u, (q) => q("select public.create_organization('Nom valide', 'Pas Valide!')")),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("refuse un visiteur non connecté", async () => {
    await expect(asUser(null, (q) => q("select public.create_organization('Org', 'org-anon')"))).rejects.toMatchObject(DENIED);
  });
});

describe("rôles dans une organisation", () => {
  it("un member ne peut pas renommer l'organisation, un admin oui", async () => {
    const owner = await createUser("o");
    const member = await createUser("m");
    const admin = await createUser("ad");
    const org = await createOrg(owner);
    await addMember(org.id, member, "member");
    await addMember(org.id, admin, "admin");

    const byMember = await asUser(member, async (q) => (await q("update public.organizations set name = 'Piraté' where id = $1", [org.id])).rowCount);
    expect(byMember).toBe(0);
    const byAdmin = await asUser(admin, async (q) => (await q("update public.organizations set name = 'Renommée' where id = $1", [org.id])).rowCount);
    expect(byAdmin).toBe(1);
  });

  it("personne ne peut modifier le slug ou le client Stripe directement", async () => {
    const owner = await createUser("o2");
    const org = await createOrg(owner);
    await expect(
      asUser(owner, (q) => q("update public.organizations set stripe_customer_id = 'cus_x' where id = $1", [org.id])),
    ).rejects.toMatchObject(DENIED);
  });

  it("abonnement, invitations et journal : visibles par admin, pas par member", async () => {
    const owner = await createUser("o3");
    const member = await createUser("m3");
    const org = await createOrg(owner);
    await addMember(org.id, member, "member");
    await pool.query("insert into public.subscriptions (org_id, stripe_subscription_id, status) values ($1, $2, 'active')", [org.id, `sub_${org.id}`]);

    const count = (u: typeof owner) =>
      asUser(u, async (q) => ({
        subs: (await q("select 1 from public.subscriptions where org_id = $1", [org.id])).rowCount,
        audit: (await q("select 1 from public.audit_logs where org_id = $1", [org.id])).rowCount,
      }));
    expect(await count(member)).toEqual({ subs: 0, audit: 0 });
    expect(await count(owner)).toEqual({ subs: 1, audit: 1 });
  });

  it("un admin ne peut pas promouvoir quelqu'un owner ; un owner peut", async () => {
    const owner = await createUser("o4");
    const admin = await createUser("a4");
    const member = await createUser("m4");
    const org = await createOrg(owner);
    await addMember(org.id, admin, "admin");
    await addMember(org.id, member, "member");

    await expect(
      asUser(admin, (q) => q("select public.update_member_role($1, $2, 'owner')", [org.id, member.id])),
    ).rejects.toMatchObject(DENIED);
    const role = await asUser(owner, async (q) => {
      await q("select public.update_member_role($1, $2, 'owner')", [org.id, member.id]);
      return (await q<{ role: string }>("select role from public.memberships where org_id = $1 and user_id = $2", [org.id, member.id])).rows[0]?.role;
    });
    expect(role).toBe("owner");
  });

  it("un member ne peut changer aucun rôle", async () => {
    const owner = await createUser("o5");
    const member = await createUser("m5");
    const org = await createOrg(owner);
    await addMember(org.id, member, "member");
    await expect(
      asUser(member, (q) => q("select public.update_member_role($1, $2, 'admin')", [org.id, member.id])),
    ).rejects.toMatchObject(DENIED);
  });

  it("le dernier owner ne peut être ni rétrogradé ni retiré", async () => {
    const owner = await createUser("o6");
    const org = await createOrg(owner);
    await expect(
      asUser(owner, (q) => q("select public.update_member_role($1, $2, 'admin')", [org.id, owner.id])),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      asUser(owner, (q) => q("select public.remove_member($1, $2)", [org.id, owner.id])),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("un member peut quitter l'organisation, un admin ne peut pas retirer un owner", async () => {
    const owner = await createUser("o7");
    const admin = await createUser("a7");
    const member = await createUser("m7");
    const org = await createOrg(owner);
    await addMember(org.id, admin, "admin");
    await addMember(org.id, member, "member");

    const left = await asUser(member, async (q) => {
      await q("select public.remove_member($1, $2)", [org.id, member.id]);
      return (await q("select 1 from public.memberships where org_id = $1 and user_id = $2", [org.id, member.id])).rowCount;
    });
    expect(left).toBe(0);
    await expect(
      asUser(admin, (q) => q("select public.remove_member($1, $2)", [org.id, owner.id])),
    ).rejects.toMatchObject(DENIED);
  });
});

describe("invitations", () => {
  it("un admin peut inviter, un member non", async () => {
    const owner = await createUser("io");
    const member = await createUser("im");
    const org = await createOrg(owner);
    await addMember(org.id, member, "member");

    const ok = await asUser(owner, async (q) =>
      (await q("insert into public.invitations (org_id, email, role, invited_by) values ($1, 'new@test.local', 'member', $2)", [org.id, owner.id])).rowCount,
    );
    expect(ok).toBe(1);
    await expect(
      asUser(member, (q) =>
        q("insert into public.invitations (org_id, email, role, invited_by) values ($1, 'x@test.local', 'member', $2)", [org.id, member.id]),
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it("impossible d'inviter directement comme owner", async () => {
    const owner = await createUser("io2");
    const org = await createOrg(owner);
    await expect(
      asUser(owner, (q) =>
        q("insert into public.invitations (org_id, email, role, invited_by) values ($1, 'boss@test.local', 'owner', $2)", [org.id, owner.id]),
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("l'invitation ne fonctionne qu'avec la bonne adresse e-mail et avant expiration", async () => {
    const owner = await createUser("io3");
    const invitee = await createUser("invitee");
    const other = await createUser("other");
    const org = await createOrg(owner);
    const { rows } = await pool.query<{ token: string }>(
      "insert into public.invitations (org_id, email, role, invited_by) values ($1, $2, 'admin', $3) returning token",
      [org.id, invitee.email, owner.id],
    );
    const token = rows[0]!.token;

    await expect(asUser(other, (q) => q("select public.accept_invitation($1)", [token]))).rejects.toMatchObject({ code: "P0002" });

    await asUser(invitee, (q) => q("select public.accept_invitation($1)", [token]), true);
    const m = await pool.query("select role from public.memberships where org_id = $1 and user_id = $2", [org.id, invitee.id]);
    expect(m.rows[0]?.role).toBe("admin");

    await expect(asUser(invitee, (q) => q("select public.accept_invitation($1)", [token]))).rejects.toMatchObject({ code: "P0002" });
  });

  it("une invitation expirée est refusée", async () => {
    const owner = await createUser("io4");
    const invitee = await createUser("late");
    const org = await createOrg(owner);
    const { rows } = await pool.query<{ token: string }>(
      "insert into public.invitations (org_id, email, role, invited_by, expires_at) values ($1, $2, 'member', $3, now() - interval '1 minute') returning token",
      [org.id, invitee.email, owner.id],
    );
    await expect(asUser(invitee, (q) => q("select public.accept_invitation($1)", [rows[0]!.token]))).rejects.toMatchObject({ code: "P0002" });
  });
});

describe("journal d'audit", () => {
  it("log_event enregistre l'utilisateur connecté comme acteur", async () => {
    const owner = await createUser("lo");
    const org = await createOrg(owner);
    await asUser(owner, (q) => q("select public.log_event($1, 'customer.created', 'cust_1', '{}')", [org.id]), true);
    const { rows } = await pool.query("select actor_id from public.audit_logs where org_id = $1 and action = 'customer.created'", [org.id]);
    expect(rows[0]?.actor_id).toBe(owner.id);
  });

  it("un non-membre ne peut pas écrire dans le journal d'une organisation", async () => {
    const owner = await createUser("lo2");
    const stranger = await createUser("ls2");
    const org = await createOrg(owner);
    await expect(
      asUser(stranger, (q) => q("select public.log_event($1, 'org.hacked')", [org.id])),
    ).rejects.toMatchObject(DENIED);
  });

  it("personne ne peut modifier ou effacer le journal", async () => {
    const owner = await createUser("lo3");
    const org = await createOrg(owner);
    await expect(asUser(owner, (q) => q("delete from public.audit_logs where org_id = $1", [org.id]))).rejects.toMatchObject(DENIED);
  });
});
