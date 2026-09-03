#!/usr/bin/env bash
set -e
echo "  otorgando permisos sobre el esquema rhia a rhia_orchestrator..."
docker exec -i rhia-postgres psql -X -U rhia_admin -d rhia_core -v ON_ERROR_STOP=1 -q <<'SQL'
GRANT USAGE ON SCHEMA rhia TO rhia_orchestrator;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rhia TO rhia_orchestrator;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rhia TO rhia_orchestrator;
ALTER DEFAULT PRIVILEGES FOR ROLE rhia_admin IN SCHEMA rhia GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rhia_orchestrator;
ALTER DEFAULT PRIVILEGES FOR ROLE rhia_admin IN SCHEMA rhia GRANT USAGE, SELECT ON SEQUENCES TO rhia_orchestrator;
SQL
echo "  permisos otorgados correctamente."
