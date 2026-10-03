import pg from "pg";
import { randomUUID } from "node:crypto";

/**
 * Connexion super-utilisateur à la base locale.
 * - Supabase local (npx supabase start / CI) : postgresql://postgres:postgres@127.0.0.1:54322/postgres
 * - Émulation sans Docker (bash scripts/db-shim.sh) : DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/app
 */
export const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });

export type TestUser = { id: string; email: string };

const created: string[] = [];

export async function createUser(label = "user"): Promise<TestUser> {
  const id = randomUUID();
  const email = `${label}-${id.slice(0, 8)}@test.local`;
  await pool.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    email,
    { full_name: label },
  ]);
  created.push(id);
  return { id, email };
}

type Q = <R extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]) => Promise<pg.QueryResult<R>>;

/**
 * Exécute `fn` dans une transaction avec le rôle `authenticated` et les claims JWT de `user`,
 * exactement comme une requête PostgREST de Supabase. Tout est annulé à la fin, sauf si commit = true.
 */
export async function asUser<T>(user: TestUser | null, fn: (q: Q) => Promise<T>, commit = false): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (user) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" }),
      ]);
      await client.query("set local role authenticated");
    } else {
      await client.query("set local role anon");
    }
    const q: Q = (sql, params) => client.query(sql, params as unknown[]);
    const result = await fn(q);
    await client.query(commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Crée une organisation dont `owner` est propriétaire (via la vraie fonction, validée). */
export async function createOrg(owner: TestUser, name = "Org Test"): Promise<{ id: string; slug: string }> {
  const slug = `org-${randomUUID().slice(0, 8)}`;
  return asUser(
    owner,
    async (q) => (await q<{ id: string; slug: string }>("select id, slug from public.create_organization($1, $2)", [name, slug])).rows[0]!,
    true,
  );
}

/** Ajoute directement un membre (super-utilisateur) : uniquement pour préparer les tests. */
export async function addMember(orgId: string, user: TestUser, role: "owner" | "admin" | "member") {
  await pool.query("insert into public.memberships (org_id, user_id, role) values ($1, $2, $3)", [orgId, user.id, role]);
}

export async function cleanup() {
  if (created.length) {
    await pool.query("delete from public.organizations where created_by = any($1::uuid[])", [created]);
    await pool.query("delete from auth.users where id = any($1::uuid[])", [created]);
    created.length = 0;
  }
}
