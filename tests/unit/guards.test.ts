import { describe, expect, it } from "vitest";
import { evaluateChanges, findDestructiveSql } from "../../scripts/ci/rules.mjs";

describe("garde-fous des migrations", () => {
  it.each([
    "drop table public.customers;",
    "ALTER TABLE public.x DROP COLUMN y;",
    "alter table public.x rename column a to b;",
    "truncate public.audit_logs;",
    "delete from public.organizations;",
    "alter table public.x alter column y type bigint;",
    "alter table public.x disable row level security;",
  ])("refuse : %s", (sql) => {
    expect(findDestructiveSql("m.sql", sql)).not.toEqual([]);
  });

  it("accepte une migration additive, y compris des mots-clés dans les commentaires et chaînes", () => {
    const sql = `-- on ne fait pas de drop table ici
      create table public.customers (id uuid primary key, note text default 'delete from x');
      alter table public.customers add column phone text;
      create policy p on public.customers for select using (true);`;
    expect(findDestructiveSql("m.sql", sql)).toEqual([]);
  });

  it("autorise DELETE dans le corps d'une fonction, mais pas dans un bloc do exécuté à la migration", () => {
    const fn = "create function public.f() returns void language sql as $$ delete from public.t where id = 1 $$;";
    expect(findDestructiveSql("m.sql", fn)).toEqual([]);
    expect(findDestructiveSql("m.sql", "do $$ begin delete from public.t; end $$;")).not.toEqual([]);
  });

  it("la migration du noyau passe le contrôle", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/20261003000001_core.sql", "utf8");
    expect(findDestructiveSql("core.sql", sql)).toEqual([]);
  });
});

describe("garde-fous des branches", () => {
  it("interdit de modifier ou supprimer une migration existante", () => {
    expect(evaluateChanges([{ status: "M", path: "supabase/migrations/20261003000001_core.sql" }], [], { agent: false })).toHaveLength(1);
    expect(evaluateChanges([{ status: "D", path: "supabase/migrations/20261003000001_core.sql" }], [], { agent: false })).toHaveLength(1);
  });

  it("autorise une nouvelle migration bien nommée, refuse un mauvais nom", () => {
    expect(evaluateChanges([{ status: "A", path: "supabase/migrations/20261010120000_customers.sql" }], [], { agent: true })).toEqual([]);
    expect(evaluateChanges([{ status: "A", path: "supabase/migrations/customers.sql" }], [], { agent: true })).toHaveLength(1);
  });

  it("un agent ne peut pas toucher aux tests d'acceptation ni à la CI", () => {
    const changes = [
      { status: "M", path: "tests/acceptance/auth-org.spec.ts" },
      { status: "M", path: ".github/workflows/ci.yml" },
      { status: "R100", path: "scripts/x.mjs", oldPath: "scripts/ci/rules.mjs" },
    ];
    expect(evaluateChanges(changes, [], { agent: true })).toHaveLength(3);
    expect(evaluateChanges(changes, [], { agent: false })).toEqual([]);
  });

  it("un agent peut modifier le code applicatif et ajouter des tests unitaires", () => {
    const changes = [
      { status: "M", path: "src/app/page.tsx" },
      { status: "A", path: "tests/unit/customers.test.ts" },
    ];
    expect(evaluateChanges(changes, [], { agent: true })).toEqual([]);
  });

  it("refuse .only / .skip / .fixme ajoutés dans un test, pour tout le monde", () => {
    const lines = [
      { path: "tests/unit/a.test.ts", line: "it.only('x', () => {})" },
      { path: "tests/unit/b.test.ts", line: "  describe.skip('y', () => {})" },
      { path: "tests/acceptance/c.spec.ts", line: "test.fixme('z', async () => {})" },
      { path: "tests/unit/d.test.ts", line: "xit('w', () => {})" },
      { path: "src/lib/skip.ts", line: "export const it = { skip() {} }; it.skip()" },
    ];
    expect(evaluateChanges([], lines, { agent: false })).toHaveLength(4);
  });
});
