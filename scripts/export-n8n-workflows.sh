#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/.." && pwd -P)
output_parent="$repo_root/docs/baseline/n8n"
output_dir="$output_parent/workflows"
sanitizer="$script_dir/sanitize-n8n-export.mjs"
container_name=rhia-n8n
container_temp="/tmp/rhia-ph01-t003-export-$$"

[[ $container_temp == /tmp/rhia-ph01-t003-export-* ]] || fail "Ruta temporal inválida."
[[ -f "$sanitizer" ]] || fail "Falta el sanitizador."
[[ ! -e "$output_dir" ]] || fail "El destino ya existe; no se sobrescribirá."
[[ $(docker inspect --format '{{.State.Running}}' "$container_name" 2>/dev/null || true) == true ]] || fail "rhia-n8n no está activo."

cleanup() {
  if [[ $container_temp == /tmp/rhia-ph01-t003-export-* ]]; then
    docker exec "$container_name" rm -rf -- "$container_temp" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

docker exec "$container_name" mkdir -m 700 -- "$container_temp"
docker exec "$container_name" n8n export:workflow --backup --output="$container_temp/raw"
docker cp "$sanitizer" "$container_name:$container_temp/sanitize.mjs" >/dev/null
docker exec "$container_name" node "$container_temp/sanitize.mjs" "$container_temp/raw" "$container_temp/sanitized"

install -d -m 700 -- "$output_parent"
docker cp "$container_name:$container_temp/sanitized" "$output_dir" >/dev/null

workflow_count=$(find "$output_dir" -maxdepth 1 -type f -name '*.json' ! -name manifest.json | wc -l)
[[ $workflow_count -eq 10 ]] || fail "Se esperaban 10 workflows sanitizados; se obtuvieron $workflow_count."

trap - EXIT
cleanup
printf 'OK: %s workflows sanitizados en %s\n' "$workflow_count" "$output_dir"
