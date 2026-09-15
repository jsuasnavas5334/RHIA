#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Uso: $0 /ruta/a/backups-rhia [--keep N] [--apply]" >&2
  echo "  Por defecto corre en modo dry-run (solo reporta, no borra nada)." >&2
  echo "  --apply es obligatorio y explícito para borrar bundles reales." >&2
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ $# -ge 1 ]] || { usage; exit 2; }

backups_dir=$1
shift
keep=7
apply=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep)
      [[ $# -ge 2 ]] || fail "Falta el valor de --keep."
      keep=$2
      shift 2
      ;;
    --apply)
      apply=true
      shift
      ;;
    *)
      fail "Argumento desconocido: $1"
      ;;
  esac
done

[[ $keep =~ ^[0-9]+$ && $keep -ge 1 ]] || fail "--keep debe ser un entero mayor o igual a 1."

for required_command in find sort; do
  command -v "$required_command" >/dev/null 2>&1 || fail "Falta el comando requerido: $required_command."
done

[[ -d $backups_dir ]] || fail "El directorio de backups no existe: $backups_dir"
backups_dir=$(realpath -e -- "$backups_dir")

# Nunca operar sobre un directorio dentro del propio repositorio RHIA --
# mismo guardrail que backup-postgres.sh.
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/.." && pwd -P)
case "$backups_dir/" in
  "$repo_root/"*) fail "El directorio de backups no puede estar dentro del repositorio RHIA." ;;
esac

required_files=(rhia_core.dump.gpg n8n.dump.gpg counts.tsv metadata.txt SHA256SUMS)
bundle_pattern='^rhia-postgres-([0-9]{8}T[0-9]{6}Z)$'

is_complete_bundle() {
  local dir=$1
  local required_file
  for required_file in "${required_files[@]}"; do
    [[ -f "$dir/$required_file" ]] || return 1
  done
  return 0
}

complete_names=()
incomplete_names=()
part_names=()

for entry in "$backups_dir"/*/; do
  [[ -d $entry ]] || continue
  entry_name=$(basename -- "$entry")

  if [[ $entry_name == *.part ]]; then
    part_names+=("$entry_name")
    continue
  fi

  [[ $entry_name =~ $bundle_pattern ]] || continue

  if is_complete_bundle "$entry"; then
    complete_names+=("$entry_name")
  else
    incomplete_names+=("$entry_name")
  fi
done

if [[ ${#part_names[@]} -gt 0 ]]; then
  echo "AVISO: ${#part_names[@]} directorio(s) *.part encontrados -- posibles backups interrumpidos. No se tocan automáticamente:"
  printf '  %s\n' "${part_names[@]}"
fi

if [[ ${#incomplete_names[@]} -gt 0 ]]; then
  echo "AVISO: ${#incomplete_names[@]} bundle(s) incompletos (faltan archivos requeridos). No se borran automáticamente, requieren revisión manual:"
  printf '  %s\n' "${incomplete_names[@]}"
fi

if [[ ${#complete_names[@]} -eq 0 ]]; then
  echo "No hay bundles completos y válidos en $backups_dir. Nada que podar."
  exit 0
fi

# Orden descendente por timestamp embebido en el nombre (más reciente primero).
sorted_names=($(printf '%s\n' "${complete_names[@]}" | sort -r))

kept_names=("${sorted_names[@]:0:keep}")
prune_names=()
if [[ ${#sorted_names[@]} -gt keep ]]; then
  prune_names=("${sorted_names[@]:keep}")
fi

echo "Bundles válidos totales: ${#sorted_names[@]}. Retención solicitada: $keep."
echo "Se conservan (${#kept_names[@]}):"
printf '  %s\n' "${kept_names[@]}"

if [[ ${#prune_names[@]} -eq 0 ]]; then
  echo "No hay bundles por encima de la retención solicitada. Nada que podar."
  exit 0
fi

if [[ $apply == false ]]; then
  echo "DRY-RUN: se borrarían (${#prune_names[@]}) -- vuelve a correr con --apply para borrar de verdad:"
  printf '  %s\n' "${prune_names[@]}"
  exit 0
fi

echo "APLICANDO: borrando ${#prune_names[@]} bundle(s) más allá de la retención de $keep..."
for prune_name in "${prune_names[@]}"; do
  prune_path="$backups_dir/$prune_name"
  # Cinturón y tirantes: re-validar el patrón y que sigue siendo un bundle
  # completo justo antes de borrar, y que la ruta resuelta sigue dentro de
  # backups_dir (protege contra symlinks maliciosos o cambios concurrentes).
  [[ $prune_name =~ $bundle_pattern ]] || fail "Nombre de bundle inesperado, abortando: $prune_name"
  resolved_prune_path=$(realpath -e -- "$prune_path")
  case "$resolved_prune_path/" in
    "$backups_dir/"*) ;;
    *) fail "Ruta de bundle fuera del directorio de backups, abortando: $prune_path" ;;
  esac
  is_complete_bundle "$prune_path" || fail "El bundle $prune_name ya no está completo, abortando antes de borrar."
  rm -rf -- "$prune_path"
  echo "  borrado: $prune_name"
done
echo "Poda completa."
