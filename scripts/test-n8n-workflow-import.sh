#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/.." && pwd -P)
compose_file="$repo_root/tests/baseline/infrastructure-smoke.compose.yaml"
workflows_dir="$repo_root/docs/baseline/n8n/workflows"
project_name=rhia-n8n-import-smoke
container_import_dir=/tmp/rhia-workflow-import-smoke

[[ -f "$compose_file" ]] || fail "Falta el Compose de smoke."
[[ -d "$workflows_dir" ]] || fail "Faltan los workflows sanitizados."
[[ $container_import_dir == /tmp/rhia-workflow-import-smoke ]] || fail "Ruta temporal inválida."

existing=$(docker ps -a --filter "label=com.docker.compose.project=$project_name" --format '{{.Names}}')
[[ -z "$existing" ]] || fail "Ya existen recursos del import test; revíselos antes de continuar."

compose=(docker compose --project-name "$project_name" --file "$compose_file")
cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${compose[@]}" up --detach --wait --wait-timeout 180 postgres n8n
n8n_container=$("${compose[@]}" ps --quiet n8n)
[[ -n "$n8n_container" ]] || fail "No se resolvió el contenedor n8n aislado."

docker exec "$n8n_container" mkdir -m 700 -- "$container_import_dir"
expected_ids=''
workflow_count=0
for workflow_file in "$workflows_dir"/*.json; do
  [[ $(basename -- "$workflow_file") != manifest.json ]] || continue
  workflow_id=$(basename -- "$workflow_file" .json)
  [[ $workflow_id =~ ^[A-Za-z0-9_-]+$ ]] || fail "Nombre de workflow inválido: $workflow_id."
  docker cp "$workflow_file" "$n8n_container:$container_import_dir/$workflow_id.json" >/dev/null
  expected_ids+="$workflow_id"$'\n'
  workflow_count=$((workflow_count + 1))
done
[[ $workflow_count -eq 10 ]] || fail "Se esperaban 10 archivos; se observaron $workflow_count."

docker exec "$n8n_container" n8n import:workflow --separate --input="$container_import_dir"

imported_count=$("${compose[@]}" exec -T postgres psql -X -U rhia_test -d n8n -Atc 'SELECT count(*) FROM workflow_entity;')
[[ $imported_count -eq 10 ]] || fail "Se importaron $imported_count workflows; se esperaban 10."

active_count=$("${compose[@]}" exec -T postgres psql -X -U rhia_test -d n8n -Atc 'SELECT count(*) FROM workflow_entity WHERE active;')
[[ $active_count -eq 0 ]] || fail "Los workflows de prueba deben quedar inactivos."

actual_ids=$("${compose[@]}" exec -T postgres psql -X -U rhia_test -d n8n -Atc 'SELECT id FROM workflow_entity;' | sort)
expected_ids=$(printf '%s' "$expected_ids" | sed '/^$/d' | sort)
[[ $actual_ids == "$expected_ids" ]] || fail "Los IDs importados no coinciden con el baseline."

credential_references=$("${compose[@]}" exec -T postgres psql -X -U rhia_test -d n8n -Atc \
  "SELECT count(*) FROM workflow_entity w CROSS JOIN LATERAL json_array_elements(w.nodes) node WHERE node->'credentials' IS NOT NULL;")
[[ $credential_references -eq 0 ]] || fail "El import aislado contiene referencias concretas de credenciales."

"${compose[@]}" stop n8n
"${compose[@]}" run --rm --no-deps n8n execute --id=dYu54NZ7QgYjPBeb --rawOutput >/dev/null

printf 'OK: %s workflows importados e inactivos, con IDs preservados y sin credenciales.\n' "$imported_count"
printf 'OK: workflow manual sin acciones externas ejecutado como smoke test aislado.\n'

"${compose[@]}" down --volumes --remove-orphans
trap - EXIT
