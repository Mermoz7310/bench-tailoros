#!/usr/bin/env bash
# Lance un PostgreSQL local (port 54322) avec l'émulation Supabase, puis applique les migrations.
# Usage : bash scripts/db-shim.sh   (puis : npm run test:db)
# Nécessite les binaires PostgreSQL 15+ (initdb, pg_ctl). Pour les postes avec Docker,
# préférer : npx supabase start
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="${PGDATA_DIR:-.tmp/pgdata}"
PORT=54322
export PGPASSWORD=postgres

# initdb refuse de tourner en root : on passe alors par l'utilisateur système postgres.
AS=()
if [ "$(id -u)" = "0" ]; then AS=(runuser -u postgres --); DATA="/tmp/factory-pgdata"; fi

if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PORT" -q; then
  mkdir -p .tmp
  "${AS[@]}" rm -rf "$DATA"
  "${AS[@]}" mkdir -p "$DATA"
  echo postgres > /tmp/factory-pwfile && chmod 644 /tmp/factory-pwfile
  "${AS[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres --pwfile=/tmp/factory-pwfile -A md5 >/dev/null
  "${AS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l /tmp/factory-postgres.log start >/dev/null
  for _ in $(seq 1 30); do "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PORT" -q && break; sleep 0.5; done
fi

PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "drop database if exists app with (force)" -c "create database app"
"${PSQL[@]}" -d app -f tests/db/supabase-shim.sql
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -d app -f "$f"
done
echo "OK : base de test prête -> DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${PORT}/app"
