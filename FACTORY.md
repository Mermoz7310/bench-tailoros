# FACTORY.md — Règles pour tout agent qui modifie ce dépôt

Ce fichier est lu par chaque agent avant chaque tâche. Il est protégé : un agent ne peut pas le modifier.

## 1. Définition de « terminé »

Une tâche est terminée **uniquement** quand la CI est verte sur sa branche. Ce que tu affirmes ne compte pas.
Avant de pousser, lance localement : `npm run check` puis, si tu as touché à la base, `npm run test:db`.

## 2. Ce que tu n'as jamais le droit de faire (bloqué par la CI)

- Modifier `tests/acceptance/`, `.github/`, `scripts/ci/`, ce fichier, ou les fichiers de config (`vitest`, `playwright`, `eslint`, `tsconfig`, `supabase/config.toml`).
- Ajouter `.only`, `.skip`, `.todo`, `.fixme` dans un test.
- Modifier ou supprimer une migration existante. Toujours **créer** une nouvelle migration.
- Écrire `DROP`, `TRUNCATE`, `DELETE FROM`, `ALTER TABLE … DROP/RENAME`, `ALTER COLUMN … TYPE`, `DISABLE ROW LEVEL SECURITY` dans une migration.
- Commiter un secret ou un fichier `.env*` (sauf `.env.example`).

Si une tâche semble exiger l'une de ces actions, arrête-toi et signale-le : c'est une décision humaine.

## 3. Architecture

| Besoin | Où | Règle |
| --- | --- | --- |
| Page | `src/app/app/[slug]/<module>/page.tsx` | Commencer par `await requireOrg(slug, "<action>")` |
| Écriture de données | Server Action dans `src/app/app/<module>/actions.ts` | Valider l'entrée avec `zod`, renvoyer `{ error }` ou `{ success }` (type `ActionState`) |
| Droits côté interface | `src/lib/permissions.ts` (`can`) | Miroir des règles SQL, jamais la seule protection |
| Droits réels | RLS + fonctions SQL dans `supabase/migrations/` | Toute table a la RLS et des `GRANT` explicites |
| Accès base | `createClient()` de `src/lib/supabase/server.ts` | `createAdminClient()` (service_role) seulement pour webhooks et tâches système |
| Journal | `supabase.rpc("log_event", …)` après chaque action métier importante | Action au format `module.verbe` (ex. `customer.created`) |
| Variables d'environnement | `src/lib/env.ts` | Ajouter la variable au schéma zod et à `.env.example` |
| Composants UI | `src/components/ui/` | Réutiliser `Button`, `Input`, `Card`… avant d'en créer |

## 4. Ajouter une table métier (modèle à suivre)

```sql
-- supabase/migrations/AAAAMMJJHHMMSS_customers.sql
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index customers_org_id_idx on public.customers (org_id);

alter table public.customers enable row level security;
create policy customers_select on public.customers for select to authenticated using (public.is_org_member(org_id));
create policy customers_insert on public.customers for insert to authenticated with check (public.is_org_member(org_id));
create policy customers_update on public.customers for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy customers_delete on public.customers for delete to authenticated using (public.has_org_role(org_id, 'admin'));

grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
```

Puis ajouter dans `tests/db/` un test qui prouve qu'un membre d'une autre organisation ne voit pas ces lignes.

Les privilèges par défaut sont fermés : sans `GRANT`, la table est inaccessible (erreur 42501), jamais exposée.

## 5. Tests

- `tests/unit/` : logique pure (Vitest). Toute fonction de `src/lib/` a ses tests.
- `tests/db/` : règles RLS contre une vraie base (Vitest + `pg`). Helpers : `createUser`, `createOrg`, `asUser`.
- `tests/acceptance/` : parcours utilisateur (Playwright), écrits **avant** le code par un autre agent. Ne pas les modifier : faire passer le code.

Base de test sans Docker : `bash scripts/db-shim.sh` puis
`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/app npm run test:db`.

## 6. Style

- TypeScript strict, aucun `any`. Pas de `console.log` (utiliser `console.info|warn|error`).
- Textes de l'interface en français.
- Petits changements : une tâche = un module, 400 lignes de diff maximum.
- Commits : `feat(module): …`, `fix(module): …`, `test(module): …`.
