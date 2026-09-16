#!/usr/bin/env bash
# Prueba real (no simulada) de sync-backups-to-external.sh usando bundles
# ficticios (contenido aleatorio pequeño, nunca datos reales) con SHA256SUMS
# reales calculados sobre ese contenido ficticio, en directorios temporales
# FUERA del repositorio. No requiere Docker ni PostgreSQL -- el script solo
# copia archivos y verifica checksums.
set -Eeuo pipefail

fail() {
  echo "TEST FAIL: $*" >&2
  exit 1
}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
sync_script="$script_dir/sync-backups-to-external.sh"
[[ -f $sync_script ]] || fail "No se encontró sync-backups-to-external.sh"

source_dir=$(mktemp -d /tmp/rhia-sync-test-source.XXXXXX)
dest_dir=$(mktemp -d /tmp/rhia-sync-test-dest.XXXXXX)
cleanup() {
  rm -rf -- "$source_dir" "$dest_dir"
}
trap cleanup EXIT

make_bundle() {
  # $1 = directorio padre, $2 = nombre del bundle, $3 = variante de contenido
  # (para poder crear un bundle "distinto" con el mismo nombre y así simular
  # corrupción bit a bit).
  local parent=$1 name=$2 variant=${3:-a}
  local dir="$parent/$name"
  mkdir -p -- "$dir"
  echo "contenido-ficticio-rhia_core-$variant" > "$dir/rhia_core.dump.gpg"
  echo "contenido-ficticio-n8n-$variant" > "$dir/n8n.dump.gpg"
  printf 'database\tschema\ttable\trow_count\n' > "$dir/counts.tsv"
  echo "created_at_utc=fixture" > "$dir/metadata.txt"
  (cd -- "$dir" && sha256sum rhia_core.dump.gpg n8n.dump.gpg counts.tsv metadata.txt > SHA256SUMS)
}

utc_timestamp() {
  date -u -d "-$1 hours" +'%Y%m%dT%H%M%SZ'
}

bundle_old=rhia-postgres-$(utc_timestamp 48)
bundle_mid=rhia-postgres-$(utc_timestamp 24)
bundle_new=rhia-postgres-$(utc_timestamp 0)

make_bundle "$source_dir" "$bundle_old"
make_bundle "$source_dir" "$bundle_mid"
make_bundle "$source_dir" "$bundle_new"

echo "== Rechaza destino inexistente (disco externo no conectado) =="
set +e
output=$("$sync_script" "$source_dir" "$dest_dir/no-existe" 2>&1)
rc=$?
set -e
[[ $rc -ne 0 ]] || fail "Debía fallar con destino inexistente."
[[ $output == *"no existe o no está montado"* ]] || fail "Mensaje inesperado: $output"
echo "OK (rechazado): $output"

echo
echo "== Rechaza destino igual al origen =="
set +e
output=$("$sync_script" "$source_dir" "$source_dir" 2>&1)
rc=$?
set -e
[[ $rc -ne 0 ]] || fail "Debía fallar con destino == origen."
[[ $output == *"no puede ser el mismo directorio"* ]] || fail "Mensaje inesperado: $output"
echo "OK (rechazado): $output"

echo
echo "== Rechaza destino dentro del repositorio =="
repo_root=$(cd -- "$script_dir/.." && pwd -P)
set +e
output=$("$sync_script" "$source_dir" "$repo_root" 2>&1)
rc=$?
set -e
[[ $rc -ne 0 ]] || fail "Debía fallar con destino dentro del repo."
[[ $output == *"no puede estar dentro del repositorio"* ]] || fail "Mensaje inesperado: $output"
echo "OK (rechazado): $output"

echo
echo "== --dry-run no copia nada y reporta los 3 bundles =="
before_count=$(find "$dest_dir" -mindepth 1 -maxdepth 1 -type d | wc -l)
output=$("$sync_script" "$source_dir" "$dest_dir" --dry-run 2>&1)
echo "$output"
after_count=$(find "$dest_dir" -mindepth 1 -maxdepth 1 -type d | wc -l)
[[ $before_count -eq $after_count && $after_count -eq 0 ]] || fail "El dry-run no debía crear directorios en destino."
dry_run_matches=$(echo "$output" | grep -c "^DRY-RUN: se copiaría" || true)
[[ $dry_run_matches -eq 3 ]] || fail "Se esperaban 3 líneas DRY-RUN, se obtuvieron $dry_run_matches."

echo
echo "== --latest-only copia solo el bundle más reciente =="
output=$("$sync_script" "$source_dir" "$dest_dir" --latest-only 2>&1)
echo "$output"
[[ -d "$dest_dir/$bundle_new" ]] || fail "Debía copiarse el bundle más reciente ($bundle_new)."
[[ ! -e "$dest_dir/$bundle_old" ]] || fail "No debía copiarse el bundle viejo con --latest-only."
[[ ! -e "$dest_dir/$bundle_mid" ]] || fail "No debía copiarse el bundle intermedio con --latest-only."
(cd -- "$dest_dir/$bundle_new" && sha256sum --status --check SHA256SUMS) || fail "El bundle copiado no pasa su propio SHA256SUMS."
[[ ! -e "$dest_dir/$bundle_new.part" ]] || fail "No debía quedar un directorio .part tras una copia exitosa."

echo
echo "== Re-correr sin --latest-only: el ya copiado se omite, los otros 2 se copian =="
output=$("$sync_script" "$source_dir" "$dest_dir" 2>&1)
echo "$output"
[[ $output == *"YA SINCRONIZADO: $bundle_new"* ]] || fail "Debía reportar $bundle_new como ya sincronizado."
[[ -d "$dest_dir/$bundle_old" && -d "$dest_dir/$bundle_mid" ]] || fail "Debían copiarse los 2 bundles restantes."
for b in "$bundle_old" "$bundle_mid" "$bundle_new"; do
  (cd -- "$dest_dir/$b" && sha256sum --status --check SHA256SUMS) || fail "$b no pasa su propio SHA256SUMS en destino."
  cmp -s "$source_dir/$b/rhia_core.dump.gpg" "$dest_dir/$b/rhia_core.dump.gpg" || fail "$b: el contenido copiado difiere del original (rhia_core.dump.gpg)."
  cmp -s "$source_dir/$b/n8n.dump.gpg" "$dest_dir/$b/n8n.dump.gpg" || fail "$b: el contenido copiado difiere del original (n8n.dump.gpg)."
done
summary_line=$(echo "$output" | grep "^Resumen:")
[[ $summary_line == *"Copiados: 2"* && $summary_line == *"Ya sincronizados: 1"* && $summary_line == *"Fallidos: 0"* ]] || fail "Resumen inesperado: $summary_line"

echo
echo "== Bundle de origen corrupto (SHA256SUMS no coincide) se rechaza, no se copia =="
corrupt_source=$(mktemp -d /tmp/rhia-sync-test-corrupt-source.XXXXXX)
corrupt_dest=$(mktemp -d /tmp/rhia-sync-test-corrupt-dest.XXXXXX)
bundle_corrupt=rhia-postgres-$(utc_timestamp 0)
make_bundle "$corrupt_source" "$bundle_corrupt"
# Corromper el contenido DESPUÉS de firmar el SHA256SUMS, para que el
# checksum ya no coincida (simula corrupción en el disco, no un bug del
# propio backup).
echo "byte-alterado" >> "$corrupt_source/$bundle_corrupt/rhia_core.dump.gpg"
set +e
output=$("$sync_script" "$corrupt_source" "$corrupt_dest" 2>&1)
rc=$?
set -e
rm -rf -- "$corrupt_source" "$corrupt_dest"
[[ $rc -ne 0 ]] || fail "Debía fallar (exit != 0) con un bundle de origen corrupto."
[[ $output == *"no pasa su propio SHA256SUMS"* ]] || fail "Mensaje inesperado: $output"
echo "OK (rechazado, exit=$rc): $output"

echo
echo "TODOS LOS TESTS PASARON (evidencia real, fixtures en disco con checksums reales, sin Docker/PostgreSQL)."
