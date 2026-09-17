#!/usr/bin/env bash
# Applies the migrations to a pristine Supabase Postgres container and runs the SQL tests.
#   bash supabase/tests/run.sh [--keep] [--with-worker]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE="supabase/postgres:17.6.1.173"
CONTAINER="vozia-pg-test"
PORT=54329
KEEP=0
WITH_WORKER=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep) KEEP=1 ;;
    --with-worker) WITH_WORKER=1 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

# Always start from a pristine container: the image's postgres database already carries the
# auth/storage/realtime schemas and roles the migrations depend on, so the tests run directly in it.
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
  sleep 1
done
sleep 2
DATABASE_URL="postgres://postgres:postgres@localhost:$PORT/postgres"

# Shims run as the image superuser (they stand in for the platform's Storage service);
# migrations and tests run as `postgres`, the same role `supabase db push` uses.
psql_as() {
  local user="$1"; shift
  docker exec -i "$CONTAINER" psql -U "$user" -d postgres -X -q -v ON_ERROR_STOP=1 "$@"
}

apply() {
  local user="$1" file="$2"
  if ! psql_as "$user" < "$file" > /tmp/vozia-sql-test.log 2>&1; then
    echo "FAIL $(basename "$file")"
    cat /tmp/vozia-sql-test.log
    exit 1
  fi
}

apply supabase_admin "$ROOT/supabase/tests/00_shims.sql"
for m in "$ROOT"/supabase/migrations/*.sql; do apply postgres "$m"; done
echo "migrations applied"

for t in "$ROOT"/supabase/tests/[1-9]*.sql; do
  apply postgres "$t"
  echo "PASS $(basename "$t")"
done

if [[ "$WITH_WORKER" -eq 1 && -f "$ROOT/apps/worker/package.json" ]]; then
  VOZIA_TEST_DATABASE_URL="$DATABASE_URL" pnpm --filter @vozia/worker test:integration
fi

if [[ "$KEEP" -eq 0 ]]; then
  docker rm -f "$CONTAINER" >/dev/null
fi
echo "sql tests passed"
