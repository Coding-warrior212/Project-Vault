#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="projectvault-pg-validation-$$"
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for this local validation script. No cloud database is used."
  exit 2
fi

docker run --rm -d --name "$CONTAINER" -e POSTGRES_PASSWORD=local-only postgres:17-alpine >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres >/dev/null

docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$ROOT/supabase/tests/local-bootstrap.sql"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$ROOT/supabase/migrations/202611140001_projectvault_round3.sql"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$ROOT/supabase/tests/round3_schema_assertions.sql"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$ROOT/supabase/tests/local-adversarial-smoke.sql"

echo "PASS: local PostgreSQL 17 migration and smoke-test run completed."
echo "NOTE: this does not replace testing on a real Supabase project."
