#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Uso: $0 /ruta/a/backups-rhia [--max-age-hours N]" >&2
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ $# -ge 1 ]] || { usage; exit 2; }

backups_dir=$1
shift
max_age_hours=26

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-age-hours)
      [[ $# -ge 2 ]] || fail "Falta el valor de --max-age-hours."
      max_age_hours=$2
      shift 2
      ;;
    *)
      fail "Argumento desconocido: $1"
      ;;
  esac
done

[[ $max_age_hours =~ ^[0-9]+$ ]] || fail "--max-age-hours debe ser un entero no negativo."

for required_command in find date sort; do
  command -v "$required_command" >/dev/null 2>&1 || fail "Falta el comando requerido: $required_command."
done

[[ -d $backups_dir ]] || fail "El directorio de backups no existe: $backups_dir"
backups_dir=$(realpath -e -- "$backups_dir")

required_files=(rhia_core.dump.gpg n8n.dump.gpg counts.tsv metadata.txt SHA256SUMS)

is_complete_bundle() {
  local dir=$1
  local required_file
  for required_file in "${required_files[@]}"; do
    [[ -f "$dir/$required_file" ]] || return 1
  done
  return 0
}

# Los bundles codifican su propio timestamp UTC en el nombre
# (rhia-postgres-YYYYMMDDTHHMMSSZ), igual que backup-postgres.sh lo genera.
# Se usa el nombre como fuente de verdad del timestamp -- no el mtime del
# directorio, que puede alterarse al copiar/mover el bundle a otro disco.
bundle_pattern='^rhia-postgres-([0-9]{8}T[0-9]{6}Z)$'

latest_name=""
latest_epoch=0
complete_count=0
incomplete_count=0

for entry in "$backups_dir"/*/; do
  [[ -d $entry ]] || continue
  entry_name=$(basename -- "$entry")
  [[ $entry_name =~ $bundle_pattern ]] || continue
  bundle_timestamp=${BASH_REMATCH[1]}

  if ! is_complete_bundle "$entry"; then
    incomplete_count=$((incomplete_count + 1))
    continue
  fi
  complete_count=$((complete_count + 1))

  iso_timestamp="${bundle_timestamp:0:4}-${bundle_timestamp:4:2}-${bundle_timestamp:6:2}T${bundle_timestamp:9:2}:${bundle_timestamp:11:2}:${bundle_timestamp:13:2}Z"
  bundle_epoch=$(date -u -d "$iso_timestamp" +%s 2>/dev/null) || \
    fail "No se pudo interpretar el timestamp del bundle $entry_name."

  if (( bundle_epoch > latest_epoch )); then
    latest_epoch=$bundle_epoch
    latest_name=$entry_name
  fi
done

if [[ $incomplete_count -gt 0 ]]; then
  echo "AVISO: $incomplete_count bundle(s) incompletos ignorados (no cuentan como backup válido)." >&2
fi

if [[ $complete_count -eq 0 ]]; then
  echo "ALERTA: no se encontró ningún bundle de backup válido en $backups_dir."
  exit 1
fi

now_epoch=$(date -u +%s)
age_seconds=$(( now_epoch - latest_epoch ))
(( age_seconds >= 0 )) || fail "El bundle más reciente ($latest_name) tiene un timestamp en el futuro."
age_hours_int=$(( age_seconds / 3600 ))

if (( age_seconds > max_age_hours * 3600 )); then
  echo "ALERTA: el backup más reciente ($latest_name) tiene ${age_hours_int}h de antigüedad, supera el máximo permitido de ${max_age_hours}h."
  exit 1
fi

echo "OK: backup más reciente = $latest_name (${age_hours_int}h de antigüedad, máximo ${max_age_hours}h). Bundles válidos totales: $complete_count."
exit 0
