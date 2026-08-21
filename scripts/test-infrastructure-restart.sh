#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/.." && pwd -P)
compose_file="$repo_root/tests/baseline/infrastructure-smoke.compose.yaml"
project_name=rhia-baseline-smoke

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail "Docker no está disponible."
[[ -f "$compose_file" ]] || fail "Falta $compose_file."

existing=$(docker ps -a --filter "label=com.docker.compose.project=$project_name" --format '{{.Names}}')
[[ -z "$existing" ]] || fail "Ya existen recursos del smoke test; revíselos antes de continuar."

compose=(docker compose --project-name "$project_name" --file "$compose_file")

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${compose[@]}" config --quiet
"${compose[@]}" up --detach --wait --wait-timeout 180

service_count=$("${compose[@]}" ps --all --format json | grep -c '"Service"')
[[ $service_count -eq 4 ]] || fail "Se esperaban 4 servicios, se observaron $service_count."

unhealthy=$("${compose[@]}" ps --format json | grep -vc '"Health":"healthy"' || true)
[[ $unhealthy -eq 0 ]] || fail "No todos los servicios iniciales están saludables."

"${compose[@]}" restart
"${compose[@]}" up --detach --wait --wait-timeout 180

unhealthy=$("${compose[@]}" ps --format json | grep -vc '"Health":"healthy"' || true)
[[ $unhealthy -eq 0 ]] || fail "No todos los servicios se recuperaron después del reinicio."

printf 'OK: 4 servicios aislados iniciaron, reiniciaron y recuperaron health.\n'
printf 'OK: no se publicaron puertos ni se utilizaron volúmenes RHIA activos.\n'

"${compose[@]}" down --volumes --remove-orphans
trap - EXIT
