#!/usr/bin/env bash
# Prueba real (no simulada) de check-backup-age.sh y prune-postgres-backups.sh
# usando bundles ficticios (metadata/dumps vacíos, nunca datos reales) en un
# directorio temporal FUERA del repositorio. No requiere Docker ni PostgreSQL
# real -- ambos scripts operan solo sobre metadata de archivos en disco.
set -Eeuo pipefail

fail() {
  echo "TEST FAIL: $*" >&2
  exit 1
}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
age_script="$script_dir/check-backup-age.sh"
prune_script="$script_dir/prune-postgres-backups.sh"

[[ -x $age_script || -f $age_script ]] || fail "No se encontró check-backup-age.sh"
[[ -x $prune_script || -f $prune_script ]] || fail "No se encontró prune-postgres-backups.sh"

# Directorio de fixtures en /tmp (nunca dentro del repo ni de la carpeta
# conectada del usuario) para poder crear/borrar libremente.
fixtures_dir=$(mktemp -d /tmp/rhia-backup-retention-test.XXXXXX)
cleanup() {
  rm -rf -- "$fixtures_dir"
}
trap cleanup EXIT

make_bundle() {
  local name=$1
  local complete=$2
  local dir="$fixtures_dir/$name"
  mkdir -p -- "$dir"
  : > "$dir/rhia_core.dump.gpg"
  : > "$dir/counts.tsv"
  : > "$dir/metadata.txt"
  : > "$dir/SHA256SUMS"
  if [[ $complete == true ]]; then
    : > "$dir/n8n.dump.gpg"
  fi
}

utc_timestamp() {
  # $1 = horas hacia atrás desde ahora
  date -u -d "-$1 hours" +'%Y%m%dT%H%M%SZ'
}

echo "== Fixture: 9 bundles completos (0h,10h,...,80h atrás) + 1 incompleto + 1 .part =="
for i in 0 10 20 30 40 50 60 70 80; do
  ts=$(utc_timestamp "$i")
  make_bundle "rhia-postgres-$ts" true
done
incomplete_name="rhia-postgres-$(utc_timestamp 5)"
make_bundle "$incomplete_name" false
mkdir -p -- "$fixtures_dir/rhia-postgres-$(utc_timestamp 1).part"

total_dirs=$(find "$fixtures_dir" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo "Directorios de fixture creados: $total_dirs"

echo
echo "== check-backup-age.sh: bundle más reciente tiene ~0h, umbral 26h => OK =="
if output=$("$age_script" "$fixtures_dir" --max-age-hours 26 2>&1); then
  echo "$output"
  [[ $output == *"OK:"* ]] || fail "Se esperaba salida OK, se obtuvo: $output"
else
  fail "check-backup-age.sh debía salir 0 (bundle reciente), salió con error: $output"
fi

echo
echo "== check-backup-age.sh: directorio con solo bundles viejos (70h/80h), umbral 26h => ALERTA =="
stale_dir=$(mktemp -d /tmp/rhia-backup-retention-test-stale.XXXXXX)
stale_ts_70=$(utc_timestamp 70)
stale_ts_80=$(utc_timestamp 80)
mkdir -p -- "$stale_dir/rhia-postgres-$stale_ts_70" "$stale_dir/rhia-postgres-$stale_ts_80"
for stale_ts in "$stale_ts_70" "$stale_ts_80"; do
  d="$stale_dir/rhia-postgres-$stale_ts"
  : > "$d/rhia_core.dump.gpg"; : > "$d/n8n.dump.gpg"; : > "$d/counts.tsv"; : > "$d/metadata.txt"; : > "$d/SHA256SUMS"
done
set +e
output=$("$age_script" "$stale_dir" --max-age-hours 26 2>&1)
rc=$?
set -e
rm -rf -- "$stale_dir"
echo "$output"
[[ $rc -ne 0 ]] || fail "Se esperaba código de salida distinto de 0 con bundles viejos."
[[ $output == *"ALERTA:"* ]] || fail "Se esperaba salida ALERTA, se obtuvo: $output"

echo
echo "== check-backup-age.sh: directorio sin ningún bundle válido => ALERTA =="
empty_dir=$(mktemp -d /tmp/rhia-backup-retention-test-empty.XXXXXX)
set +e
output=$("$age_script" "$empty_dir" --max-age-hours 26 2>&1)
rc=$?
set -e
rm -rf -- "$empty_dir"
[[ $rc -ne 0 ]] || fail "Se esperaba error en directorio vacío."
[[ $output == *"ALERTA:"* ]] || fail "Se esperaba ALERTA en directorio vacío, se obtuvo: $output"
echo "$output"

echo
echo "== prune-postgres-backups.sh: dry-run con --keep 3 no borra nada =="
before_count=$(find "$fixtures_dir" -mindepth 1 -maxdepth 1 -type d | wc -l)
output=$("$prune_script" "$fixtures_dir" --keep 3 2>&1)
echo "$output"
[[ $output == *"DRY-RUN"* ]] || fail "Se esperaba mención de DRY-RUN en la salida."
after_count=$(find "$fixtures_dir" -mindepth 1 -maxdepth 1 -type d | wc -l)
[[ $before_count -eq $after_count ]] || fail "El dry-run no debía cambiar el número de directorios ($before_count -> $after_count)."

echo
echo "== prune-postgres-backups.sh: --apply con --keep 3 borra solo los completos más antiguos =="
output=$("$prune_script" "$fixtures_dir" --keep 3 --apply 2>&1)
echo "$output"

remaining_complete=0
for entry in "$fixtures_dir"/*/; do
  entry_name=$(basename -- "$entry")
  [[ $entry_name =~ ^rhia-postgres-[0-9]{8}T[0-9]{6}Z$ ]] || continue
  [[ -f "$entry/n8n.dump.gpg" ]] || continue
  remaining_complete=$((remaining_complete + 1))
done
[[ $remaining_complete -eq 3 ]] || fail "Se esperaban 3 bundles completos tras podar con --keep 3, quedaron $remaining_complete."

[[ -d "$fixtures_dir/$incomplete_name" ]] || fail "El bundle incompleto no debía borrarse automáticamente."
part_count=$(find "$fixtures_dir" -mindepth 1 -maxdepth 1 -type d -name '*.part' | wc -l)
[[ $part_count -eq 1 ]] || fail "El directorio .part no debía borrarse automáticamente."

echo
echo "== prune-postgres-backups.sh: rechaza operar dentro del repositorio =="
repo_root=$(cd -- "$script_dir/.." && pwd -P)
set +e
output=$("$prune_script" "$repo_root" --keep 1 2>&1)
rc=$?
set -e
[[ $rc -ne 0 ]] || fail "Se esperaba que prune-postgres-backups.sh rechazara un directorio dentro del repo."
[[ $output == *"no puede estar dentro del repositorio"* ]] || fail "Mensaje de error inesperado: $output"
echo "OK (rechazado correctamente): $output"

echo
echo "TODOS LOS TESTS PASARON (evidencia real, ejecutada contra fixtures en disco, sin Docker/PostgreSQL)."
