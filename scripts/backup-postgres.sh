#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Uso: RHIA_BACKUP_PASSPHRASE_FILE=/ruta/segura/clave $0 /directorio/fuera/del/repo" >&2
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

assert_private_passphrase_file() {
  local file=$1
  local passphrase_mode passphrase_permissions filesystem_type windows_path

  passphrase_mode=$(stat -c '%a' -- "$file")
  passphrase_permissions=$((8#$passphrase_mode))
  if (( (passphrase_permissions & 077) == 0 )); then
    return 0
  fi

  filesystem_type=$(stat -f -c '%T' -- "$file")
  if [[ $filesystem_type == 9p || $filesystem_type == v9fs ]] && command -v wslpath >/dev/null 2>&1 && command -v powershell.exe >/dev/null 2>&1; then
    windows_path=$(wslpath -w -- "$file")
    if printf '%s\n' "$windows_path" | powershell.exe -NoLogo -NoProfile -NonInteractive -Command '
$path = [Console]::In.ReadLine()
try {
  $acl = [System.IO.File]::GetAccessControl($path)
  $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $allowedSids = @($currentSid, "S-1-5-18", "S-1-5-32-544")
  $ownerSid = $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
  if ($allowedSids -notcontains $ownerSid) { exit 1 }
  $rules = $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
  foreach ($rule in $rules) {
    if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { continue }
    $sid = $rule.IdentityReference.Value
    if ($allowedSids -notcontains $sid) { exit 1 }
  }
  if ($rules.Count -eq 0) { exit 1 }
  exit 0
} catch {
  exit 1
}
' >/dev/null 2>&1; then
      return 0
    fi
  fi

  fail "El archivo de passphrase debe tener permisos Unix 600 o una ACL privada de Windows."
}

[[ $# -eq 1 ]] || { usage; exit 2; }

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/.." && pwd -P)
output_root=$(realpath -m -- "$1")
passphrase_file=${RHIA_BACKUP_PASSPHRASE_FILE:-}

case "$output_root/" in
  "$repo_root/"*) fail "El destino no puede estar dentro del repositorio RHIA." ;;
esac

[[ -n "$passphrase_file" ]] || fail "Falta RHIA_BACKUP_PASSPHRASE_FILE."
[[ -f "$passphrase_file" && -r "$passphrase_file" ]] || fail "El archivo de passphrase no existe o no es legible."
[[ -s "$passphrase_file" ]] || fail "El archivo de passphrase está vacío."
passphrase_file=$(realpath -e -- "$passphrase_file")

case "$passphrase_file" in
  "$repo_root"/*) fail "La passphrase no puede estar dentro del repositorio RHIA." ;;
esac

assert_private_passphrase_file "$passphrase_file"

command -v docker >/dev/null 2>&1 || fail "Docker no está disponible."
command -v gpg >/dev/null 2>&1 || fail "GnuPG no está disponible."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum no está disponible."

container_name=rhia-postgres
[[ $(docker inspect --format '{{.State.Running}}' "$container_name" 2>/dev/null || true) == true ]] || fail "rhia-postgres no está activo."

database_user=$(docker exec "$container_name" printenv POSTGRES_USER)
[[ -n "$database_user" ]] || fail "No se pudo resolver el rol PostgreSQL existente."

timestamp=$(date -u +'%Y%m%dT%H%M%SZ')
bundle_dir="$output_root/rhia-postgres-$timestamp"
work_dir="$bundle_dir.part"
[[ ! -e "$bundle_dir" && ! -e "$work_dir" ]] || fail "El bundle de destino o su directorio temporal ya existe."

if [[ -e "$output_root" ]]; then
  [[ -d "$output_root" ]] || fail "El destino existe y no es un directorio."
else
  install -d -m 700 -- "$output_root"
fi
install -d -m 700 -- "$work_dir"

cleanup_partial() {
  if [[ -d "$work_dir" ]]; then
    find "$work_dir" -mindepth 1 -maxdepth 1 -type f -delete 2>/dev/null || true
    rmdir -- "$work_dir" 2>/dev/null || true
  fi
}
trap cleanup_partial EXIT

databases=(rhia_core n8n)
for database_name in "${databases[@]}"; do
  encrypted_file="$work_dir/$database_name.dump.gpg"
  [[ ! -e "$encrypted_file" ]] || fail "El archivo $encrypted_file ya existe."

  docker exec "$container_name" pg_dump \
    -U "$database_user" \
    -d "$database_name" \
    --format=custom \
    --compress=gzip:6 \
    --create \
    --no-owner \
    --no-privileges \
  | gpg --batch --yes --quiet --pinentry-mode loopback \
      --passphrase-file "$passphrase_file" \
      --symmetric --cipher-algo AES256 --compress-algo none \
      --output "$encrypted_file.part"

  chmod 600 "$encrypted_file.part"
  mv -- "$encrypted_file.part" "$encrypted_file"

  gpg --batch --quiet --pinentry-mode loopback \
      --passphrase-file "$passphrase_file" \
      --decrypt "$encrypted_file" >/dev/null

  set +e
  gpg --batch --quiet --pinentry-mode loopback \
      --passphrase-file "$passphrase_file" \
      --decrypt "$encrypted_file" 2>/dev/null \
  | docker exec -i "$container_name" pg_restore --list >/dev/null
  archive_check_status=("${PIPESTATUS[@]}")
  set -e
  (( archive_check_status[1] == 0 )) || fail "El archivo cifrado de $database_name no contiene un archive pg_dump válido."
done

counts_file="$work_dir/counts.tsv"
printf 'database\tschema\ttable\trow_count\n' > "$counts_file"

for database_name in "${databases[@]}"; do
  table_list=$(docker exec "$container_name" psql -X -v ON_ERROR_STOP=1 \
    -U "$database_user" -d "$database_name" -At -F '|' -c \
    "SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY schemaname, tablename;")
  [[ -n "$table_list" ]] || fail "No se encontraron tablas de aplicación en $database_name."

  while IFS='|' read -r schema_name table_name; do
    [[ $schema_name =~ ^[A-Za-z0-9_]+$ && $table_name =~ ^[A-Za-z0-9_]+$ ]] || fail "Identificador inválido en conteos de $database_name."
    row_count=$(docker exec "$container_name" psql -X -v ON_ERROR_STOP=1 \
      -U "$database_user" -d "$database_name" -Atc \
      "SELECT count(*) FROM \"$schema_name\".\"$table_name\";")
    [[ $row_count =~ ^[0-9]+$ ]] || fail "Conteo inválido para $database_name.$schema_name.$table_name."
    printf '%s\t%s\t%s\t%s\n' "$database_name" "$schema_name" "$table_name" "$row_count" >> "$counts_file"
  done <<< "$table_list"
done
chmod 600 "$counts_file"

metadata_file="$work_dir/metadata.txt"
{
  printf 'created_at_utc=%s\n' "$timestamp"
  printf 'source_container=%s\n' "$container_name"
  printf 'postgres_version='
  docker exec "$container_name" postgres --version
  printf 'format=pg_dump-custom+gpg-aes256\n'
} > "$metadata_file"
chmod 600 "$metadata_file"

(
  cd -- "$work_dir"
  sha256sum rhia_core.dump.gpg n8n.dump.gpg counts.tsv metadata.txt > SHA256SUMS
  chmod 600 SHA256SUMS
)

mv -- "$work_dir" "$bundle_dir"
trap - EXIT
echo "Backup cifrado creado: $bundle_dir"
echo "Siguiente paso obligatorio: ejecutar verify-postgres-backup.sh sobre este bundle."
