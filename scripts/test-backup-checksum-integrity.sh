#!/usr/bin/env bash
# Prueba real (no simulada) de la CAPA de integridad por checksum que usa
# verify-postgres-backup.sh (`sha256sum --check SHA256SUMS`, misma linea
# exacta del script real) contra bundles ficticios (contenido sintetico,
# nunca datos reales) en un directorio temporal FUERA del repositorio.
#
# Alcance honesto: esto NO ejecuta verify-postgres-backup.sh completo (ese
# script exige `docker` como comando requerido antes de llegar siquiera al
# chequeo de checksums, y este entorno no tiene Docker -- ver
# docs/runbooks/disaster-recovery-runbook.md, seccion "Que falta"). Este
# test aisla y verifica UNICAMENTE la primera linea de defensa contra
# corrupcion (el archivo SHA256SUMS que backup-postgres.sh genera y que
# verify-postgres-backup.sh valida con `sha256sum --check` antes de tocar
# Docker), usando el mismo comando exacto que el script real. El "Corrupt
# backup test" completo del Task Packet (PLAN_MAESTRO.md PH10-T004) --
# confirmar que verify-postgres-backup.sh rechaza un .dump.gpg corrupto de
# punta a punta -- sigue pendiente de un entorno con Docker real.
set -Eeuo pipefail

fail() {
  echo "TEST FAIL: $*" >&2
  exit 1
}

for required_command in sha256sum truncate; do
  command -v "$required_command" >/dev/null 2>&1 || fail "Falta el comando requerido: $required_command."
done

fixtures_dir=$(mktemp -d /tmp/rhia-backup-checksum-test.XXXXXX)
cleanup() {
  rm -rf -- "$fixtures_dir"
}
trap cleanup EXIT

make_valid_bundle() {
  local dir=$1
  mkdir -p -- "$dir"
  # Contenido sintetico con tamano no trivial (no archivos vacios) para que
  # truncar/alterar un byte sea un cambio real y detectable.
  head -c 4096 /dev/urandom > "$dir/rhia_core.dump.gpg"
  head -c 4096 /dev/urandom > "$dir/n8n.dump.gpg"
  printf 'database\tschema\ttable\trow_count\n' > "$dir/counts.tsv"
  printf 'created_at_utc=2026-01-01T00:00:00Z\nformat=pg_dump-custom+gpg-aes256\n' > "$dir/metadata.txt"
  (
    cd -- "$dir"
    sha256sum rhia_core.dump.gpg n8n.dump.gpg counts.tsv metadata.txt > SHA256SUMS
  )
}

run_check() {
  local dir=$1
  (
    cd -- "$dir"
    sha256sum --check SHA256SUMS
  )
}

echo "== Caso 1: bundle valido, sin alterar => sha256sum --check debe pasar =="
valid_dir="$fixtures_dir/valid"
make_valid_bundle "$valid_dir"
if output=$(run_check "$valid_dir" 2>&1); then
  echo "$output"
  [[ $output == *"OK"* ]] || fail "Se esperaba 'OK' en la salida de un bundle valido, se obtuvo: $output"
else
  fail "sha256sum --check debia pasar en un bundle sin alterar, salio con error: $output"
fi

echo
echo "== Caso 2: .dump.gpg con un byte modificado (bit flip) => debe fallar =="
flipped_dir="$fixtures_dir/flipped"
cp -r -- "$valid_dir" "$flipped_dir"
rm -f -- "$flipped_dir/SHA256SUMS"
(
  cd -- "$valid_dir"
  sha256sum rhia_core.dump.gpg n8n.dump.gpg counts.tsv metadata.txt > "$flipped_dir/SHA256SUMS"
)
# Voltea el primer byte del dump cifrado (simula corrupcion en transito o en disco).
python3 -c "
import sys
path = sys.argv[1]
with open(path, 'r+b') as f:
    data = bytearray(f.read())
    data[0] ^= 0xFF
    f.seek(0)
    f.write(data)
" "$flipped_dir/rhia_core.dump.gpg"
set +e
output=$(run_check "$flipped_dir" 2>&1)
rc=$?
set -e
echo "$output"
[[ $rc -ne 0 ]] || fail "Se esperaba que sha256sum --check fallara con un archivo corrupto."
[[ $output == *"FAILED"* ]] || fail "Se esperaba 'FAILED' en la salida de un archivo corrupto, se obtuvo: $output"

echo
echo "== Caso 3: .dump.gpg truncado (transferencia incompleta) => debe fallar =="
truncated_dir="$fixtures_dir/truncated"
cp -r -- "$valid_dir" "$truncated_dir"
truncate -s 2048 "$truncated_dir/n8n.dump.gpg"
set +e
output=$(run_check "$truncated_dir" 2>&1)
rc=$?
set -e
echo "$output"
[[ $rc -ne 0 ]] || fail "Se esperaba que sha256sum --check fallara con un archivo truncado."
[[ $output == *"FAILED"* ]] || fail "Se esperaba 'FAILED' en la salida de un archivo truncado, se obtuvo: $output"

echo
echo "== Caso 4: archivo del bundle eliminado despues de firmar => debe fallar =="
missing_dir="$fixtures_dir/missing"
cp -r -- "$valid_dir" "$missing_dir"
rm -f -- "$missing_dir/n8n.dump.gpg"
set +e
output=$(run_check "$missing_dir" 2>&1)
rc=$?
set -e
echo "$output"
[[ $rc -ne 0 ]] || fail "Se esperaba que sha256sum --check fallara con un archivo faltante."
[[ $output == *"FAILED"* || $output == *"No such file"* ]] || fail "Se esperaba fallo por archivo faltante, se obtuvo: $output"

echo
echo "TODOS LOS TESTS PASARON (evidencia real, capa de checksum SHA256SUMS,"
echo "sin Docker/PostgreSQL -- ver cabecera de este script para el alcance exacto)."
