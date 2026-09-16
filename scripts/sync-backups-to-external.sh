#!/usr/bin/env bash
# Copia bundles de backup ya cifrados (creados por backup-postgres.sh) desde
# el directorio local de backups hacia un disco externo (u otra ruta que el
# usuario indique al conectarlo), verificando checksums antes y después de
# copiar. No requiere Docker, PostgreSQL ni GnuPG -- opera solo sobre los
# archivos ya cifrados y su SHA256SUMS existente, igual que
# check-backup-age.sh y prune-postgres-backups.sh.
#
# Contexto: docs/architecture/adr/ADR-0002-produccion-pc-local.md, punto 5 --
# con producción en una sola PC, la "segunda copia" (Task Packet PH10-T004,
# "Errores que debe evitar": "Mismo disco como única copia") debe vivir en un
# disco externo separado. Este script no puede automatizarse por completo
# porque el disco no siempre está conectado -- se corre a mano (o vía un
# acceso directo) cada vez que el usuario lo conecta.
set -Eeuo pipefail

usage() {
  echo "Uso: $0 /ruta/a/backups-rhia /ruta/al/disco-externo [--latest-only] [--dry-run]" >&2
  echo "  Por defecto sincroniza TODOS los bundles válidos que falten en el destino" >&2
  echo "  (no solo el más reciente), para no dejar huecos si el disco se conecta" >&2
  echo "  con menos frecuencia que la cadencia de backups." >&2
  echo "  --latest-only  Copia solo el bundle válido más reciente." >&2
  echo "  --dry-run      Reporta qué se copiaría, sin copiar nada." >&2
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ $# -ge 2 ]] || { usage; exit 2; }

source_dir=$1
destination_dir=$2
shift 2
latest_only=false
dry_run=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --latest-only)
      latest_only=true
      shift
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    *)
      fail "Argumento desconocido: $1"
      ;;
  esac
done

for required_command in find sort sha256sum cp realpath; do
  command -v "$required_command" >/dev/null 2>&1 || fail "Falta el comando requerido: $required_command."
done

[[ -d $source_dir ]] || fail "El directorio de backups de origen no existe: $source_dir"
source_dir=$(realpath -e -- "$source_dir")

# El destino (disco externo) puede no estar montado en la misma ruta siempre
# -- se exige que ya exista (el usuario debe conectarlo y, si hace falta,
# crear la carpeta destino) en vez de crearlo solo, para evitar escribir por
# accidente en el disco interno por una ruta mal tecleada.
[[ -d $destination_dir ]] || fail "El destino no existe o no está montado: $destination_dir (¿el disco externo está conectado?)"
destination_dir=$(realpath -e -- "$destination_dir")

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/.." && pwd -P)
case "$destination_dir/" in
  "$repo_root/"*) fail "El destino no puede estar dentro del repositorio RHIA." ;;
esac

[[ "$destination_dir" != "$source_dir" ]] || fail "El destino no puede ser el mismo directorio que el origen (la segunda copia no puede ser el mismo disco)."
case "$destination_dir/" in
  "$source_dir/"*) fail "El destino no puede estar dentro del directorio de backups de origen." ;;
esac
case "$source_dir/" in
  "$destination_dir/"*) fail "El origen no puede estar dentro del directorio destino." ;;
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

verify_bundle_checksums() {
  # Verifica SHA256SUMS dentro de un bundle ya copiado (cinturón y tirantes
  # tanto para el origen antes de copiar como para el destino después).
  local dir=$1
  (cd -- "$dir" && sha256sum --status --check SHA256SUMS)
}

source_names=()
for entry in "$source_dir"/*/; do
  [[ -d $entry ]] || continue
  entry_name=$(basename -- "$entry")
  [[ $entry_name =~ $bundle_pattern ]] || continue
  is_complete_bundle "$entry" || continue
  source_names+=("$entry_name")
done

if [[ ${#source_names[@]} -eq 0 ]]; then
  echo "No hay bundles válidos y completos en $source_dir. Nada que sincronizar."
  exit 0
fi

# Orden ascendente (más viejo primero) para que, si el disco se desconecta a
# mitad de la sincronización, los bundles más antiguos ya hayan quedado
# copiados.
sorted_names=($(printf '%s\n' "${source_names[@]}" | sort))

if [[ $latest_only == true ]]; then
  candidate_names=("${sorted_names[-1]}")
else
  candidate_names=("${sorted_names[@]}")
fi

copied_count=0
skipped_count=0
would_copy_count=0
failed_count=0

for bundle_name in "${candidate_names[@]}"; do
  source_bundle="$source_dir/$bundle_name"
  dest_bundle="$destination_dir/$bundle_name"
  work_dir="$dest_bundle.part"

  if [[ -d $dest_bundle ]] && is_complete_bundle "$dest_bundle" && verify_bundle_checksums "$dest_bundle"; then
    echo "YA SINCRONIZADO: $bundle_name (ya existe en destino con checksums válidos, se omite)."
    skipped_count=$((skipped_count + 1))
    continue
  fi

  if [[ $dry_run == true ]]; then
    echo "DRY-RUN: se copiaría $bundle_name a $destination_dir"
    would_copy_count=$((would_copy_count + 1))
    continue
  fi

  echo "Verificando checksums del bundle de origen antes de copiar: $bundle_name"
  if ! verify_bundle_checksums "$source_bundle"; then
    echo "ERROR: el bundle de origen $bundle_name no pasa su propio SHA256SUMS -- no se copia un bundle ya corrupto. Requiere revisión manual." >&2
    failed_count=$((failed_count + 1))
    continue
  fi

  [[ ! -e $work_dir ]] || fail "Ya existe un directorio temporal de una sincronización anterior sin terminar: $work_dir -- revísalo a mano antes de reintentar (no se borra automáticamente)."
  [[ ! -e $dest_bundle ]] || fail "Ya existe $dest_bundle en destino pero está incompleto o con checksums inválidos -- revísalo a mano antes de reintentar (no se sobrescribe automáticamente)."

  install -d -m 700 -- "$work_dir"
  copy_ok=true
  for required_file in "${required_files[@]}"; do
    cp -p -- "$source_bundle/$required_file" "$work_dir/$required_file" || { copy_ok=false; break; }
  done

  if [[ $copy_ok == true ]] && verify_bundle_checksums "$work_dir"; then
    mv -- "$work_dir" "$dest_bundle"
    echo "COPIADO Y VERIFICADO: $bundle_name -> $dest_bundle"
    copied_count=$((copied_count + 1))
  else
    echo "ERROR: la copia de $bundle_name no pasó la verificación de checksums en destino -- se descarta la copia parcial, no se deja un bundle corrupto en el disco externo." >&2
    rm -rf -- "$work_dir"
    failed_count=$((failed_count + 1))
  fi
done

echo
echo "Resumen: ${#candidate_names[@]} candidato(s). Copiados: $copied_count. Ya sincronizados: $skipped_count. Fallidos: $failed_count.$( [[ $dry_run == true ]] && echo " (dry-run) Se copiarían: $would_copy_count." )"

[[ $failed_count -eq 0 ]] || exit 1
exit 0
