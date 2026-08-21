#!/usr/bin/env bash
set -Eeuo pipefail

# Verificación de solo lectura para PH01-T001.
# No inspecciona valores de variables de entorno ni modifica contenedores.

failures=0

ok() {
  printf 'OK   %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}

check_equal() {
  local label=$1
  local actual=$2
  local expected=$3
  if [[ "$actual" == "$expected" ]]; then
    ok "$label = $actual"
  else
    fail "$label: esperado '$expected', observado '$actual'"
  fi
}

command -v docker >/dev/null 2>&1 || {
  fail 'Docker no está disponible.'
  exit 1
}
command -v curl >/dev/null 2>&1 || {
  fail 'curl no está disponible.'
  exit 1
}
command -v sha256sum >/dev/null 2>&1 || {
  fail 'sha256sum no está disponible.'
  exit 1
}

compose_file=/home/server-rhia-orquestador/rhia-orquestador/infrastructure/compose.yaml
expected_compose_sha=d43106b43a8aa61e0fc346b9422e213de2271af7980774585f9692de33a19797

if [[ -r "$compose_file" ]]; then
  compose_sha=$(sha256sum "$compose_file" | awk '{print $1}')
  check_equal 'SHA-256 de compose.yaml' "$compose_sha" "$expected_compose_sha"
else
  fail "No se puede leer $compose_file"
fi

check_equal 'Docker Engine' "$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)" '29.7.2'
check_equal 'Docker Compose' "$(docker compose version --short 2>/dev/null || true)" '5.4.0'

declare -A expected_images=(
  [rhia-postgres]='postgres:18'
  [rhia-n8n]='docker.n8n.io/n8nio/n8n'
  [rhia-searxng]='docker.io/searxng/searxng:latest'
  [rhia-ollama]='ollama/ollama:latest'
)

for container_name in rhia-postgres rhia-n8n rhia-searxng rhia-ollama; do
  running=$(docker inspect --format '{{.State.Running}}' "$container_name" 2>/dev/null || true)
  image=$(docker inspect --format '{{.Config.Image}}' "$container_name" 2>/dev/null || true)
  network=$(docker inspect --format '{{if .NetworkSettings.Networks.rhia_internal}}rhia_internal{{end}}' "$container_name" 2>/dev/null || true)
  check_equal "$container_name activo" "$running" 'true'
  check_equal "$container_name imagen" "$image" "${expected_images[$container_name]}"
  check_equal "$container_name red" "$network" 'rhia_internal'
done

for volume_name in \
  infrastructure_rhia_postgres_data \
  infrastructure_rhia_n8n_data \
  infrastructure_rhia_searxng_cache \
  infrastructure_rhia_ollama_data; do
  observed_volume=$(docker volume inspect --format '{{.Name}}' "$volume_name" 2>/dev/null || true)
  check_equal "volumen $volume_name" "$observed_volume" "$volume_name"
done

n8n_port=$(docker port rhia-n8n 5678/tcp 2>/dev/null || true)
check_equal 'publicación n8n' "$n8n_port" '127.0.0.1:5678'

if docker exec rhia-postgres pg_isready -q >/dev/null 2>&1; then
  ok 'PostgreSQL acepta conexiones.'
else
  fail 'PostgreSQL no respondió a pg_isready.'
fi

if [[ $(curl -fsS --max-time 5 http://127.0.0.1:5678/healthz 2>/dev/null || true) == '{"status":"ok"}' ]]; then
  ok 'n8n /healthz respondió correctamente.'
else
  fail 'n8n /healthz no respondió como se esperaba.'
fi

if [[ $(docker exec rhia-searxng wget -qO- http://127.0.0.1:8080/healthz 2>/dev/null || true) == 'OK' ]]; then
  ok 'SearXNG /healthz respondió correctamente.'
else
  fail 'SearXNG /healthz no respondió como se esperaba.'
fi

if docker exec rhia-ollama ollama list >/dev/null 2>&1; then
  ok 'Ollama respondió a ollama list.'
else
  fail 'Ollama no respondió a ollama list.'
fi

if (( failures > 0 )); then
  printf '\nBaseline con %d desviación(es).\n' "$failures" >&2
  exit 1
fi

printf '\nBaseline de infraestructura verificado sin desviaciones.\n'
