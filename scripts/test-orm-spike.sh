#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/.." && pwd -P)
node_image=node:24.19.0-bookworm-slim
postgres_image=postgres:18
network_name="rhia-orm-spike-net-$$"
container_name="rhia-orm-spike-db-$$"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  docker network rm "$network_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

command -v docker >/dev/null 2>&1 || fail "Docker no está disponible."
docker image inspect "$node_image" >/dev/null 2>&1 || fail "Falta la imagen $node_image."
docker image inspect "$postgres_image" >/dev/null 2>&1 || fail "Falta la imagen $postgres_image."

docker run --rm --network none --read-only \
  -v "$repo_root:/workspace:ro" -w /workspace \
  "$node_image" npm run typecheck

drizzle_sql="$repo_root/spikes/orm-drizzle/generated/drizzle/0000_orm-spike.sql"
if [[ ! -s "$drizzle_sql" ]]; then
  docker run --rm --network none \
    -v "$repo_root:/workspace" -w /workspace \
    "$node_image" npm run orm:drizzle
fi
[[ -s "$drizzle_sql" ]] || fail "Drizzle no generó SQL."

docker network create "$network_name" >/dev/null
docker run -d --name "$container_name" --network "$network_name" \
  -e POSTGRES_PASSWORD=orm_spike_only \
  -e POSTGRES_DB=orm_spike \
  "$postgres_image" >/dev/null

ready=false
for _ in {1..40}; do
  if docker exec "$container_name" pg_isready -U postgres -d orm_spike >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.5
done
[[ $ready == true ]] || fail "El PostgreSQL temporal no inició."

prisma_sql=$(find "$repo_root/spikes/orm-prisma/generated/migrations" -type f -name migration.sql -print -quit 2>/dev/null || true)
[[ -n $prisma_sql && -s $prisma_sql ]] || fail "Prisma no generó SQL."

for database_name in drizzle_spike prisma_spike; do
  docker exec "$container_name" createdb -U postgres "$database_name"
done

docker exec -i "$container_name" psql -X -v ON_ERROR_STOP=1 -U postgres -d drizzle_spike < "$drizzle_sql" >/dev/null
docker exec -i "$container_name" psql -X -v ON_ERROR_STOP=1 -U postgres -d prisma_spike < "$prisma_sql" >/dev/null

catalog_query="SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='orm_spike_records') || '|' || (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='orm_spike_records') || '|' || (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='orm_spike_records');"

drizzle_catalog=$(docker exec "$container_name" psql -X -U postgres -d drizzle_spike -Atc "$catalog_query")
prisma_catalog=$(docker exec "$container_name" psql -X -U postgres -d prisma_spike -Atc "$catalog_query")

[[ $drizzle_catalog == 1\|4\|3 ]] || fail "Catálogo Drizzle inesperado: $drizzle_catalog."
[[ $prisma_catalog == 1\|4\|3 ]] || fail "Catálogo Prisma inesperado: $prisma_catalog."

echo "ORM spike verificado: Drizzle=$drizzle_catalog, Prisma=$prisma_catalog (tabla|columnas|índices)."
echo "Drizzle generó offline; Prisma requirió PostgreSQL temporal, OpenSSL y motor nativo."
