#!/usr/bin/env bash
set -e
cd "/mnt/c/Users/jesfu/Desktop/Software RHIA/packages/db/migrations"
for f in 0001_domain_v1.sql 0002_state_taxonomy.sql 0003_rbac_tenant_guards.sql 0004_outreach_policy.sql 0005_core_api_persistence.sql 0006_auth_v1.sql 0007_auth_audit.sql 0008_agent_runtime.sql; do
  echo "  aplicando $f..."
  checksum=$(sha256sum "$f" | cut -d' ' -f1)
  docker exec -i rhia-postgres psql -X -U rhia_admin -d rhia_core -v ON_ERROR_STOP=1 -v migration_checksum="$checksum" -q < "$f"
done
cd "/mnt/c/Users/jesfu/Desktop/Software RHIA/packages/db/seeds"
for f in 0001_minimum.sql 0002_rbac_policy.sql 0003_outreach_policy.sql; do
  echo "  aplicando semilla $f..."
  docker exec -i rhia-postgres psql -X -U rhia_admin -d rhia_core -v ON_ERROR_STOP=1 -q < "$f"
done
echo "  otorgando permisos sobre el esquema rhia a rhia_orchestrator..."
docker exec -i rhia-postgres psql -X -U rhia_admin -d rhia_core -v ON_ERROR_STOP=1 -q <<'SQL'
GRANT USAGE ON SCHEMA rhia TO rhia_orchestrator;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rhia TO rhia_orchestrator;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rhia TO rhia_orchestrator;
ALTER DEFAULT PRIVILEGES FOR ROLE rhia_admin IN SCHEMA rhia GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rhia_orchestrator;
ALTER DEFAULT PRIVILEGES FOR ROLE rhia_admin IN SCHEMA rhia GRANT USAGE, SELECT ON SEQUENCES TO rhia_orchestrator;
SQL
echo "  migraciones, semillas y permisos aplicados correctamente."
