BEGIN;

INSERT INTO rhia.permission (key, description)
VALUES
  ('records.read', 'Leer registros operativos.'),
  ('records.write', 'Crear y actualizar registros operativos.'),
  ('jobs.execute', 'Iniciar y controlar jobs.'),
  ('approvals.read', 'Consultar approvals.'),
  ('approvals.decide', 'Decidir approvals autorizados.'),
  ('outreach.read', 'Consultar outreach.'),
  ('outreach.send', 'Ejecutar outreach dentro de policy.'),
  ('meetings.manage', 'Crear y actualizar reuniones.'),
  ('pricebooks.read', 'Consultar precios oficiales.'),
  ('pricebooks.write', 'Modificar price books mediante approval.'),
  ('commercial.approve', 'Aprobar condiciones y compromisos autorizados.'),
  ('audit.read', 'Consultar trazabilidad y auditoría.'),
  ('settings.manage', 'Gestionar configuración no secreta.'),
  ('users.manage', 'Gestionar usuarios.'),
  ('permissions.manage', 'Gestionar roles y permisos.'),
  ('secrets.rotate', 'Rotar referencias de secretos.'),
  ('deployments.approve', 'Aprobar despliegues sensibles.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO rhia.role (organization_id, key, name)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'ADMIN', 'Administrador'),
  ('00000000-0000-4000-8000-000000000001', 'MANAGER', 'Gerente'),
  ('00000000-0000-4000-8000-000000000001', 'OPERATOR', 'Operador'),
  ('00000000-0000-4000-8000-000000000001', 'VIEWER', 'Viewer / Auditor')
ON CONFLICT (organization_id, key) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

WITH matrix(role_key, permission_key) AS (VALUES
  ('ADMIN', 'records.read'), ('ADMIN', 'records.write'), ('ADMIN', 'jobs.execute'),
  ('ADMIN', 'approvals.read'), ('ADMIN', 'approvals.decide'), ('ADMIN', 'outreach.read'),
  ('ADMIN', 'outreach.send'), ('ADMIN', 'meetings.manage'), ('ADMIN', 'pricebooks.read'),
  ('ADMIN', 'pricebooks.write'), ('ADMIN', 'commercial.approve'), ('ADMIN', 'audit.read'),
  ('ADMIN', 'settings.manage'), ('ADMIN', 'users.manage'), ('ADMIN', 'permissions.manage'),
  ('ADMIN', 'secrets.rotate'), ('ADMIN', 'deployments.approve'),
  ('MANAGER', 'records.read'), ('MANAGER', 'records.write'), ('MANAGER', 'jobs.execute'),
  ('MANAGER', 'approvals.read'), ('MANAGER', 'approvals.decide'), ('MANAGER', 'outreach.read'),
  ('MANAGER', 'outreach.send'), ('MANAGER', 'meetings.manage'), ('MANAGER', 'pricebooks.read'),
  ('MANAGER', 'commercial.approve'), ('MANAGER', 'audit.read'),
  ('OPERATOR', 'records.read'), ('OPERATOR', 'records.write'), ('OPERATOR', 'jobs.execute'),
  ('OPERATOR', 'approvals.read'), ('OPERATOR', 'outreach.read'), ('OPERATOR', 'outreach.send'),
  ('OPERATOR', 'meetings.manage'), ('OPERATOR', 'pricebooks.read'),
  ('VIEWER', 'records.read'), ('VIEWER', 'outreach.read'), ('VIEWER', 'pricebooks.read'),
  ('VIEWER', 'audit.read')
)
INSERT INTO rhia.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM matrix m
JOIN rhia.role r ON r.organization_id = '00000000-0000-4000-8000-000000000001' AND r.key = m.role_key
JOIN rhia.permission p ON p.key = m.permission_key
ON CONFLICT DO NOTHING;

INSERT INTO rhia.capability (key, risk_level, requires_approval_default)
VALUES
  ('records.read', 'LOW', false),
  ('records.write', 'MEDIUM', false),
  ('jobs.execute', 'MEDIUM', false),
  ('approvals.request', 'HIGH', true),
  ('approved-actions.execute', 'CRITICAL', true),
  ('outreach.draft', 'LOW', false),
  ('outreach.send', 'HIGH', false),
  ('meetings.schedule', 'MEDIUM', false)
ON CONFLICT (key) DO UPDATE SET
  risk_level = EXCLUDED.risk_level,
  requires_approval_default = EXCLUDED.requires_approval_default;

INSERT INTO rhia.agent_definition (id, key, name, version, purpose, status)
VALUES
  ('00000000-0000-4000-8000-000000000004', 'n8n-service', 'n8n Service', '1.0', 'Orquestar workflows autorizados con capabilities limitadas.', 'INACTIVE'),
  ('00000000-0000-4000-8000-000000000005', 'worker-service', 'Worker Service', '1.0', 'Ejecutar jobs y acciones previamente autorizadas.', 'INACTIVE')
ON CONFLICT (key, version) DO UPDATE SET
  name = EXCLUDED.name,
  purpose = EXCLUDED.purpose,
  status = 'INACTIVE',
  updated_at = now();

INSERT INTO rhia.agent_instance (id, organization_id, agent_definition_id, configuration, status)
VALUES
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '{"identity":"N8N_SERVICE","ceilingVersion":"1.0"}', 'INACTIVE'),
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '{"identity":"WORKER_SERVICE","ceilingVersion":"1.0"}', 'INACTIVE')
ON CONFLICT (id) DO UPDATE SET configuration = EXCLUDED.configuration, status = 'INACTIVE', updated_at = now();

WITH matrix(definition_key, capability_key) AS (VALUES
  ('commercial-agent', 'records.read'), ('commercial-agent', 'records.write'),
  ('commercial-agent', 'jobs.execute'), ('commercial-agent', 'approvals.request'),
  ('commercial-agent', 'outreach.draft'), ('commercial-agent', 'outreach.send'),
  ('commercial-agent', 'meetings.schedule'),
  ('n8n-service', 'records.read'), ('n8n-service', 'records.write'),
  ('n8n-service', 'jobs.execute'), ('n8n-service', 'outreach.send'),
  ('n8n-service', 'meetings.schedule'),
  ('worker-service', 'records.read'), ('worker-service', 'records.write'),
  ('worker-service', 'jobs.execute'), ('worker-service', 'approved-actions.execute'),
  ('worker-service', 'outreach.send'), ('worker-service', 'meetings.schedule')
)
INSERT INTO rhia.agent_capability (agent_definition_id, capability_id, policy_overrides)
SELECT d.id, c.id, '{"ceilingVersion":"1.0"}'::jsonb
FROM matrix m
JOIN rhia.agent_definition d ON d.key = m.definition_key AND d.version = '1.0'
JOIN rhia.capability c ON c.key = m.capability_key
ON CONFLICT (agent_definition_id, capability_id) DO UPDATE
SET policy_overrides = EXCLUDED.policy_overrides;

COMMIT;
