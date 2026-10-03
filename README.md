# factory-template

Gabarit « voie dorée » de SaaS Factory AI : Next.js 16 + Supabase + Stripe, multi-organisations, testé.
Chaque SaaS construit par l'usine part de ce dépôt.

## Ce qui est inclus

- Comptes (inscription, connexion, déconnexion) avec Supabase Auth
- Organisations, rôles `owner` / `admin` / `member`, invitations par e-mail
- Sécurité en base : RLS sur toutes les tables, écritures sensibles via fonctions SQL, privilèges fermés par défaut
- Abonnements Stripe (paiement, portail client, webhook signé et idempotent) — désactivés proprement sans clés
- Journal d'audit non modifiable, console d'administration plateforme, sonde `/api/health`
- Tests : unitaires (Vitest), RLS sur vraie base, parcours utilisateur (Playwright)
- CI GitHub Actions : garde-fous anti-triche, migrations additives, lint, types, tests, build, scan de secrets

## Démarrer en local

Prérequis : Node 22, Docker.

```bash
# À LANCER — dans un terminal, à la racine du projet
npm install
npx supabase start            # base locale + migrations + compte démo
cp .env.example .env.local    # puis remplir avec : npx supabase status -o env
npm run dev                   # http://localhost:3000
```

Compte de démo : `demo@example.com` / `demo-password-123`.

## Vérifier

```bash
# À LANCER — à la racine du projet
npm run check        # lint + types + migrations + tests unitaires
npm run test:db      # tests RLS (Supabase local démarré)
npm run build && npm run test:e2e   # parcours utilisateur
```

## Règles

Voir [FACTORY.md](./FACTORY.md) : conventions et interdits pour les agents (et les humains).
