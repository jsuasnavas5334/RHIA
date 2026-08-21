#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

for command in docker gpg sha256sum cut grep sort; do
  command -v "$command" >/dev/null 2>&1 || fail "Falta el comando requerido: $command."
done

project_root=$(realpath -e -- "$(dirname -- "${BASH_SOURCE[0]}")/..")
migration="$project_root/packages/db/migrations/0001_domain_v1.sql"
state_migration="$project_root/packages/db/migrations/0002_state_taxonomy.sql"
rbac_migration="$project_root/packages/db/migrations/0003_rbac_tenant_guards.sql"
outreach_migration="$project_root/packages/db/migrations/0004_outreach_policy.sql"
seed="$project_root/packages/db/seeds/0001_minimum.sql"
rbac_seed="$project_root/packages/db/seeds/0002_rbac_policy.sql"
outreach_seed="$project_root/packages/db/seeds/0003_outreach_policy.sql"
bundle=${RHIA_BACKUP_BUNDLE:-}
passphrase_file=${RHIA_BACKUP_PASSPHRASE_FILE:-}

[[ -f "$migration" && -f "$state_migration" && -f "$rbac_migration" && -f "$outreach_migration" && -f "$seed" && -f "$rbac_seed" && -f "$outreach_seed" ]] || fail "Faltan migrations o seeds."
[[ -n "$bundle" ]] || fail "Falta RHIA_BACKUP_BUNDLE."
bundle=$(realpath -e -- "$bundle")
[[ -f "$bundle/rhia_core.dump.gpg" && -f "$bundle/counts.tsv" && -f "$bundle/SHA256SUMS" ]] || fail "Bundle incompleto."
[[ -n "$passphrase_file" && -r "$passphrase_file" && -s "$passphrase_file" ]] || fail "Passphrase inválida o no legible."

(
  cd -- "$bundle"
  sha256sum --check SHA256SUMS >/dev/null
)

container="rhia-domain-migration-$(date -u +'%Y%m%d%H%M%S')-$$"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

start_postgres() {
  docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=rhia_domain_test postgres:18 >/dev/null
  local ready=false
  local consecutive=0
  for _ in {1..60}; do
    if docker exec "$container" psql -X -U postgres -d postgres -Atc 'SELECT 1' 2>/dev/null | grep -qx '1'; then
      consecutive=$((consecutive + 1))
      if [[ $consecutive -ge 2 ]]; then
        ready=true
        break
      fi
    else
      consecutive=0
    fi
    sleep 0.5
  done
  [[ $ready == true ]] || fail "PostgreSQL temporal no inició."
}

restore_rhia_core() {
  gpg --batch --quiet --pinentry-mode loopback \
      --passphrase-file "$passphrase_file" \
      --decrypt "$bundle/rhia_core.dump.gpg" \
  | docker exec -i "$container" pg_restore \
      -U postgres -d postgres --create --exit-on-error --no-owner --no-privileges
}

assert_legacy_counts() {
  while IFS=$'\t' read -r database_name schema_name table_name expected_count; do
    [[ $database_name == rhia_core ]] || continue
    [[ $schema_name =~ ^[A-Za-z0-9_]+$ && $table_name =~ ^[A-Za-z0-9_]+$ && $expected_count =~ ^[0-9]+$ ]] || fail "Manifest inválido."
    actual=$(docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core -Atc \
      "SELECT count(*) FROM \"$schema_name\".\"$table_name\";")
    [[ $actual == "$expected_count" ]] || fail "Conteo cambió en $schema_name.$table_name."
  done < <(tail -n +2 "$bundle/counts.tsv")
}

expect_sql_failure() {
  local label=$1
  local sql=$2
  if docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core -c "$sql" >/dev/null 2>&1; then
    fail "El constraint no rechazó: $label."
  fi
}

start_postgres
restore_rhia_core
assert_legacy_counts

migration_checksum=$(sha256sum "$migration" | cut -d' ' -f1)
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -v migration_checksum="$migration_checksum" \
  -U postgres -d rhia_core < "$migration" >/dev/null
state_migration_checksum=$(sha256sum "$state_migration" | cut -d' ' -f1)
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -v migration_checksum="$state_migration_checksum" \
  -U postgres -d rhia_core < "$state_migration" >/dev/null
rbac_migration_checksum=$(sha256sum "$rbac_migration" | cut -d' ' -f1)
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -v migration_checksum="$rbac_migration_checksum" \
  -U postgres -d rhia_core < "$rbac_migration" >/dev/null
outreach_migration_checksum=$(sha256sum "$outreach_migration" | cut -d' ' -f1)
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -v migration_checksum="$outreach_migration_checksum" \
  -U postgres -d rhia_core < "$outreach_migration" >/dev/null
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core < "$seed" >/dev/null
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core < "$seed" >/dev/null
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core < "$rbac_seed" >/dev/null
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core < "$rbac_seed" >/dev/null
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core < "$outreach_seed" >/dev/null
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core < "$outreach_seed" >/dev/null

recorded_checksum=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "SELECT checksum_sha256 FROM rhia.schema_migration WHERE version='0001_domain_v1';")
[[ $recorded_checksum == "$migration_checksum" ]] || fail "Checksum de migration no coincide."
recorded_state_checksum=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "SELECT checksum_sha256 FROM rhia.schema_migration WHERE version='0002_state_taxonomy';")
[[ $recorded_state_checksum == "$state_migration_checksum" ]] || fail "Checksum de state migration no coincide."
recorded_rbac_checksum=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "SELECT checksum_sha256 FROM rhia.schema_migration WHERE version='0003_rbac_tenant_guards';")
[[ $recorded_rbac_checksum == "$rbac_migration_checksum" ]] || fail "Checksum de RBAC migration no coincide."
recorded_outreach_checksum=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "SELECT checksum_sha256 FROM rhia.schema_migration WHERE version='0004_outreach_policy';")
[[ $recorded_outreach_checksum == "$outreach_migration_checksum" ]] || fail "Checksum de outreach migration no coincide."

rbac_counts=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "SELECT (SELECT count(*) FROM rhia.permission) || ':' || (SELECT count(*) FROM rhia.role WHERE organization_id='00000000-0000-4000-8000-000000000001') || ':' || (SELECT count(*) FROM rhia.role_permission) || ':' || (SELECT count(*) FROM rhia.capability) || ':' || (SELECT count(*) FROM rhia.agent_capability);")
[[ $rbac_counts == '17:4:40:8:18' ]] || fail "Seed RBAC incompleto o no idempotente: $rbac_counts."
outreach_seed_state=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "SELECT count(*) || ':' || max(status) || ':' || max(configuration->>'maxProactiveTouches') FROM rhia.outreach_policy WHERE organization_id='00000000-0000-4000-8000-000000000001' AND version='1.0';")
[[ $outreach_seed_state == '1:DRAFT:3' ]] || fail "Seed de outreach inválido o activo sin aprobación: $outreach_seed_state."

table_count=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='rhia';")
[[ $table_count -ge 35 ]] || fail "El schema rhia quedó incompleto: $table_count tablas."

missing_indexes=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "WITH required(name) AS (VALUES
    ('company_group_name_idx'), ('company_entity_name_market_idx'), ('company_entity_legal_id_uq'),
    ('company_location_market_idx'), ('contact_point_hash_uq'), ('opportunity_status_action_idx'),
    ('job_status_attempt_idx'), ('evidence_subject_freshness_idx'), ('model_run_task_provider_idx'),
    ('audit_event_trace_idx')
  ) SELECT count(*) FROM required r LEFT JOIN pg_indexes i ON i.schemaname='rhia' AND i.indexname=r.name WHERE i.indexname IS NULL;")
[[ $missing_indexes == 0 ]] || fail "Faltan $missing_indexes índices críticos."

docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core >/dev/null <<'SQL'
INSERT INTO rhia.company_group (id, organization_id, canonical_name)
VALUES ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Empresa Sintética');
INSERT INTO rhia.company_entity (id, organization_id, company_group_id, legal_name, country_code, entity_type)
VALUES ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Empresa Sintética Costa Rica', 'CR', 'LEGAL_ENTITY');
INSERT INTO rhia.company_location (organization_id, company_entity_id, country_code, city, timezone, is_headquarters)
VALUES ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'CR', 'San José', 'America/Costa_Rica', true);
INSERT INTO rhia.opportunity (id, organization_id, company_group_id, primary_entity_id, market_country, market_city, stage, score, score_version)
VALUES ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'CR', 'San José', 'DISCOVERED', 75, '1.0');
INSERT INTO rhia.evidence_source (id, organization_id, source_type, url, fetched_at, provider, source_reliability)
VALUES ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'WEB', 'https://example.invalid/evidence', now(), 'SYNTHETIC', 0.8);
INSERT INTO rhia.evidence (id, organization_id, subject_type, subject_id, source_id, claim_type, excerpt_hash, observed_value, confidence, freshness_at, status)
VALUES ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'COMPANY', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'name', repeat('a', 64), '{}', 0.8, now(), 'ACTIVE');
SQL

docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core -c \
  "INSERT INTO rhia.job (organization_id, agent_instance_id, job_type, input, idempotency_key) VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'RESOLVE_ENTITY', '{}'::jsonb, 'synthetic-job-1');" >/dev/null

docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d rhia_core >/dev/null <<'SQL'
INSERT INTO rhia.organization (id, name) VALUES ('20000000-0000-4000-8000-000000000001', 'Tenant Sintético 2');
INSERT INTO rhia.app_user (id, organization_id, email, display_name, auth_provider)
VALUES
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'approver@example.invalid', 'Approver Sintético', 'TEST'),
  ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'other@example.invalid', 'Otro Tenant', 'TEST');
INSERT INTO rhia.role (id, organization_id, key, name)
VALUES ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'VIEWER', 'Viewer Tenant 2');
INSERT INTO rhia.outreach_policy (id, organization_id, version, name, configuration, status)
VALUES ('20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', '1.0', 'Policy Tenant 2', '{}', 'DRAFT');
INSERT INTO rhia.execution (id, job_id, attempt, executor_type, trace_id)
SELECT '20000000-0000-4000-8000-000000000005', id, 1, 'WORKER_SERVICE', '20000000-0000-4000-8000-000000000006'
FROM rhia.job WHERE idempotency_key='synthetic-job-1';
INSERT INTO rhia.action (id, execution_id, capability_key, resource_type, request_payload, risk_level)
VALUES ('20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000005', 'approved-actions.execute', 'PRICE_BOOK', '{}', 'CRITICAL');
INSERT INTO rhia.approval (id, action_id, requested_by_agent_instance_id, approval_type, status, approver_user_id, decided_at)
VALUES ('20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000003', 'CHANGE_PRICE', 'APPROVED', '20000000-0000-4000-8000-000000000002', now());
SQL

expect_sql_failure 'country ISO2' \
  "INSERT INTO rhia.company_entity (organization_id, company_group_id, legal_name, country_code, entity_type) VALUES ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Inválida', 'ecu', 'LEGAL_ENTITY');"
expect_sql_failure 'máximo de tres toques' \
  "INSERT INTO rhia.outreach_sequence (organization_id, opportunity_id, max_touches, timezone) VALUES ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 4, 'America/Guayaquil');"
idempotency_rows=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "SELECT count(*) FROM rhia.job WHERE organization_id='00000000-0000-4000-8000-000000000001' AND idempotency_key='synthetic-job-1';")
idempotency_constraint=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "SELECT count(*) FROM pg_constraint WHERE conrelid='rhia.job'::regclass AND contype='u';")
[[ $idempotency_rows == 1 && $idempotency_constraint -ge 1 ]] || \
  fail "Precondición de idempotencia inválida: filas=$idempotency_rows constraints=$idempotency_constraint."
expect_sql_failure 'idempotency duplicada' \
  "INSERT INTO rhia.job (organization_id, job_type, input, idempotency_key) VALUES ('00000000-0000-4000-8000-000000000001', 'RESOLVE_ENTITY', '{}', 'synthetic-job-1');"
expect_sql_failure 'fact sin evidence' \
  "INSERT INTO rhia.fact (organization_id, subject_type, subject_id, predicate, value, confidence, supporting_evidence_ids) VALUES ('00000000-0000-4000-8000-000000000001', 'COMPANY', '10000000-0000-4000-8000-000000000001', 'name', '{}', 0.8, '{}');"
expect_sql_failure 'job status libre' \
  "INSERT INTO rhia.job (organization_id, job_type, input, idempotency_key, status) VALUES ('00000000-0000-4000-8000-000000000001', 'RESOLVE_ENTITY', '{}', 'synthetic-job-invalid-status', 'EN_PROCESO');"
expect_sql_failure 'opportunity stage libre' \
  "INSERT INTO rhia.opportunity (id, organization_id, company_group_id, market_country, stage, score_version) VALUES ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'CR', 'DISCOVERY', '1.0');"
expect_sql_failure 'evidence status libre' \
  "INSERT INTO rhia.evidence (id, organization_id, subject_type, subject_id, source_id, claim_type, excerpt_hash, observed_value, confidence, freshness_at, status) VALUES ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'COMPANY', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'name', repeat('b', 64), '{}', 0.8, now(), 'VIGENTE');"
expect_sql_failure 'user_role cross-tenant' \
  "INSERT INTO rhia.user_role (user_id, role_id) SELECT '20000000-0000-4000-8000-000000000003', id FROM rhia.role WHERE organization_id='00000000-0000-4000-8000-000000000001' AND key='VIEWER';"
expect_sql_failure 'approval cross-tenant' \
  "INSERT INTO rhia.approval (action_id, requested_by_agent_instance_id, approval_type, status, approver_user_id) VALUES ('20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000003', 'CHANGE_PRICE', 'APPROVED', '20000000-0000-4000-8000-000000000003');"
expect_sql_failure 'agent capability autoelevada' \
  "INSERT INTO rhia.agent_capability (agent_definition_id, capability_id) SELECT d.id, c.id FROM rhia.agent_definition d CROSS JOIN rhia.capability c WHERE d.key='commercial-agent' AND d.version='1.0' AND c.key='approved-actions.execute';"
expect_sql_failure 'outreach policy cross-tenant' \
  "INSERT INTO rhia.outreach_sequence (organization_id, opportunity_id, policy_id, timezone) VALUES ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000009', 'America/Guayaquil');"
expect_sql_failure 'suppression sin hash SHA256' \
  "INSERT INTO rhia.outreach_suppression (organization_id, subject_type, subject_key_hash, reason, source) VALUES ('00000000-0000-4000-8000-000000000001', 'CONTACT', 'email-en-claro@example.invalid', 'OPT_OUT', 'TEST');"

assert_legacy_counts

docker rm -f "$container" >/dev/null
start_postgres
restore_rhia_core
assert_legacy_counts
schema_after_restore=$(docker exec "$container" psql -X -U postgres -d rhia_core -Atc \
  "SELECT count(*) FROM pg_namespace WHERE nspname='rhia';")
[[ $schema_after_restore == 0 ]] || fail "El restore limpio contiene artefactos de la migration."

echo "Domain migrations verificadas sobre backup: legacy intacto, seeds idempotentes, taxonomy/RBAC/outreach/tenant guards/índices y restore strategy aprobados."
