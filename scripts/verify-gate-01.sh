#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ $# -eq 1 ]] || fail "Uso: $0 /ruta/al/bundle-cifrado"

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/.." && pwd -P)
bundle_dir=$(realpath -e -- "$1")

case "$bundle_dir/" in
  "$repo_root/"*) fail "El bundle sensible no puede estar dentro del repositorio." ;;
esac

for task_id in PH01-T001 PH01-T002 PH01-T003 PH01-T004; do
  progress_file="$repo_root/docs/progress/$task_id.md"
  [[ -f "$progress_file" ]] || fail "Falta $progress_file."
  grep -Fq 'STATUS: DONE' "$progress_file" || fail "$task_id no está DONE."
done

required_repo_files=(
  docs/baseline/infrastructure.md
  docs/baseline/database.md
  docs/baseline/n8n.md
  tests/baseline/commercial_cases.md
  tests/baseline/commercial_cases.json
  docs/baseline/n8n/workflows/manifest.json
)

for relative_path in "${required_repo_files[@]}"; do
  [[ -s "$repo_root/$relative_path" ]] || fail "Falta el entregable $relative_path."
done

workflow_export_count=$(find "$repo_root/docs/baseline/n8n/workflows" -maxdepth 1 -type f -name '*.json' ! -name manifest.json | wc -l)
[[ $workflow_export_count -eq 10 ]] || fail "Se esperaban 10 exports n8n y se encontraron $workflow_export_count."
grep -Eq '"workflowCount"[[:space:]]*:[[:space:]]*10' "$repo_root/docs/baseline/n8n/workflows/manifest.json" || fail "El manifest n8n no declara 10 workflows."

required_bundle_files=(rhia_core.dump.gpg n8n.dump.gpg counts.tsv metadata.txt SHA256SUMS)
for bundle_file in "${required_bundle_files[@]}"; do
  [[ -s "$bundle_dir/$bundle_file" ]] || fail "Falta $bundle_file en el bundle."
done

manifest_table_count=$(tail -n +2 "$bundle_dir/counts.tsv" | sed '/^[[:space:]]*$/d' | wc -l)
[[ $manifest_table_count -eq 133 ]] || fail "El backup debe cubrir 133 tablas y cubre $manifest_table_count."

(
  cd -- "$bundle_dir"
  sha256sum --check SHA256SUMS
)

sensitive_file=$(find "$repo_root" -path "$repo_root/.git" -prune -o -type f \( -name '*.dump' -o -name '*.dump.gpg' \) -print -quit)
[[ -z $sensitive_file ]] || fail "Se encontró un dump sensible dentro del repositorio: $sensitive_file"

echo "GATE-01 verificado: 4 tareas DONE, 10 exports n8n y backup íntegro de 133 tablas."
