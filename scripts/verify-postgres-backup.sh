#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Uso: RHIA_BACKUP_PASSPHRASE_FILE=/ruta/segura/clave $0 /ruta/al/bundle" >&2
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

bundle_dir=$(realpath -e -- "$1")
passphrase_file=${RHIA_BACKUP_PASSPHRASE_FILE:-}
[[ -n "$passphrase_file" ]] || fail "Falta RHIA_BACKUP_PASSPHRASE_FILE."
[[ -f "$passphrase_file" && -r "$passphrase_file" && -s "$passphrase_file" ]] || fail "El archivo de passphrase no es válido."

assert_private_passphrase_file "$passphrase_file"

required_files=(rhia_core.dump.gpg n8n.dump.gpg counts.tsv metadata.txt SHA256SUMS)
for required_file in "${required_files[@]}"; do
  [[ -f "$bundle_dir/$required_file" ]] || fail "Falta $required_file en el bundle."
done

for required_command in docker gpg sha256sum sort cut wc head tail sed; do
  command -v "$required_command" >/dev/null 2>&1 || fail "Falta el comando requerido: $required_command."
done

expected_counts_header=$'database\tschema\ttable\trow_count'
actual_counts_header=$(head -n 1 "$bundle_dir/counts.tsv")
[[ $actual_counts_header == "$expected_counts_header" ]] || fail "El encabezado de counts.tsv no es válido."

manifest_row_count=$(tail -n +2 "$bundle_dir/counts.tsv" | sed '/^[[:space:]]*$/d' | wc -l)
[[ $manifest_row_count =~ ^[0-9]+$ && $manifest_row_count -gt 0 ]] || fail "counts.tsv no contiene tablas."

manifest_unique_count=$(tail -n +2 "$bundle_dir/counts.tsv" | sed '/^[[:space:]]*$/d' | cut -f 1-3 | sort -u | wc -l)
[[ $manifest_unique_count == "$manifest_row_count" ]] || fail "counts.tsv contiene tablas duplicadas."

(
  cd -- "$bundle_dir"
  sha256sum --check SHA256SUMS
)

verify_container="rhia-restore-verify-$(date -u +'%Y%m%d%H%M%S')-$$"
[[ -z $(docker ps -a --filter "name=^/$verify_container$" --format '{{.Names}}') ]] || fail "El contenedor temporal ya existe."

cleanup_container() {
  docker stop "$verify_container" >/dev/null 2>&1 || true
}
trap cleanup_container EXIT

docker run --rm -d --name "$verify_container" \
  -e POSTGRES_PASSWORD=rhia_restore_test \
  postgres:18 >/dev/null

ready=false
for _ in {1..40}; do
  if docker exec "$verify_container" pg_isready -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.5
done
[[ $ready == true ]] || fail "El PostgreSQL temporal no inició."

for database_name in rhia_core n8n; do
  gpg --batch --quiet --pinentry-mode loopback \
      --passphrase-file "$passphrase_file" \
      --decrypt "$bundle_dir/$database_name.dump.gpg" \
  | docker exec -i "$verify_container" pg_restore \
      -U postgres -d postgres --create --exit-on-error --no-owner --no-privileges
done

manifest_tables=$(tail -n +2 "$bundle_dir/counts.tsv" | sed '/^[[:space:]]*$/d' | cut -f 1-3 | sort)
restored_tables=$(
  for database_name in rhia_core n8n; do
    table_list=$(docker exec "$verify_container" psql -X -v ON_ERROR_STOP=1 \
      -U postgres -d "$database_name" -At -F '|' -c \
      "SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY schemaname, tablename;")
    [[ -n "$table_list" ]] || fail "El restore de $database_name no contiene tablas de aplicación."
    while IFS='|' read -r schema_name table_name; do
      [[ $schema_name =~ ^[A-Za-z0-9_]+$ && $table_name =~ ^[A-Za-z0-9_]+$ ]] || fail "Identificador restaurado inválido en $database_name."
      printf '%s\t%s\t%s\n' "$database_name" "$schema_name" "$table_name"
    done <<< "$table_list"
  done | sort
)
[[ $manifest_tables == "$restored_tables" ]] || fail "La cobertura de counts.tsv no coincide con todas las tablas restauradas."
printf 'OK cobertura del manifest = %s tablas\n' "$manifest_row_count"

tail -n +2 "$bundle_dir/counts.tsv" | while IFS=$'\t' read -r database_name schema_name table_name expected_count; do
  [[ $database_name =~ ^[a-z0-9_]+$ && $schema_name =~ ^[A-Za-z0-9_]+$ && $table_name =~ ^[A-Za-z0-9_]+$ && $expected_count =~ ^[0-9]+$ ]] || fail "Entrada inválida en counts.tsv."
  restored_count=$(docker exec "$verify_container" psql -X -v ON_ERROR_STOP=1 \
    -U postgres -d "$database_name" -Atc \
    "SELECT count(*) FROM \"$schema_name\".\"$table_name\";")
  [[ $restored_count == "$expected_count" ]] || fail "$database_name.$schema_name.$table_name: esperado $expected_count, restaurado $restored_count."
  printf 'OK %s.%s.%s = %s\n' "$database_name" "$schema_name" "$table_name" "$restored_count"
done

echo "Restore y conteos verificados correctamente en entorno aislado."
