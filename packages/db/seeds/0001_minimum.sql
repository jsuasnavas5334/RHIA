BEGIN;

INSERT INTO rhia.organization (id, name, default_locale, default_timezone, active)
VALUES ('00000000-0000-4000-8000-000000000001', 'RHIA Local', 'es-EC', 'America/Guayaquil', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rhia.agent_definition (id, key, name, version, purpose, status)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'commercial-agent',
  'Agente Comercial',
  '1.0',
  'Conseguir reuniones comerciales efectivas con evidencia y políticas explícitas.',
  'INACTIVE'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rhia.agent_instance (
  id,
  organization_id,
  agent_definition_id,
  configuration,
  status
)
VALUES (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '{"settingsVersion":"1.0"}'::jsonb,
  'INACTIVE'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
