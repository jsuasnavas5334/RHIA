\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE rhia.capability
  ADD CONSTRAINT capability_risk_taxonomy CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

ALTER TABLE rhia.action
  ADD CONSTRAINT action_risk_taxonomy CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

CREATE FUNCTION rhia.enforce_user_role_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  user_organization uuid;
  role_organization uuid;
BEGIN
  SELECT organization_id INTO user_organization FROM rhia.app_user WHERE id = NEW.user_id;
  SELECT organization_id INTO role_organization FROM rhia.role WHERE id = NEW.role_id;
  IF user_organization IS NULL OR role_organization IS NULL OR user_organization <> role_organization THEN
    RAISE EXCEPTION 'RHIA_POLICY_DENIED: user_role tenant mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_role_tenant_guard
BEFORE INSERT OR UPDATE ON rhia.user_role
FOR EACH ROW EXECUTE FUNCTION rhia.enforce_user_role_tenant();

CREATE FUNCTION rhia.enforce_approval_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  action_organization uuid;
  requester_organization uuid;
  approver_organization uuid;
BEGIN
  SELECT j.organization_id INTO action_organization
  FROM rhia.action a
  JOIN rhia.execution e ON e.id = a.execution_id
  JOIN rhia.job j ON j.id = e.job_id
  WHERE a.id = NEW.action_id;

  IF action_organization IS NULL THEN
    RAISE EXCEPTION 'RHIA_POLICY_DENIED: approval action has no tenant' USING ERRCODE = '23514';
  END IF;

  IF NEW.requested_by_agent_instance_id IS NOT NULL THEN
    SELECT organization_id INTO requester_organization
    FROM rhia.agent_instance WHERE id = NEW.requested_by_agent_instance_id;
    IF requester_organization IS NULL OR requester_organization <> action_organization THEN
      RAISE EXCEPTION 'RHIA_POLICY_DENIED: approval requester tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.approver_user_id IS NOT NULL THEN
    SELECT organization_id INTO approver_organization
    FROM rhia.app_user WHERE id = NEW.approver_user_id;
    IF approver_organization IS NULL OR approver_organization <> action_organization THEN
      RAISE EXCEPTION 'RHIA_POLICY_DENIED: approval approver tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER approval_tenant_guard
BEFORE INSERT OR UPDATE ON rhia.approval
FOR EACH ROW EXECUTE FUNCTION rhia.enforce_approval_tenant();

CREATE FUNCTION rhia.enforce_service_capability_ceiling()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  definition_key text;
  capability_key_value text;
BEGIN
  SELECT key INTO definition_key FROM rhia.agent_definition WHERE id = NEW.agent_definition_id;
  SELECT key INTO capability_key_value FROM rhia.capability WHERE id = NEW.capability_id;

  IF definition_key = 'commercial-agent' AND capability_key_value NOT IN (
    'records.read', 'records.write', 'jobs.execute', 'approvals.request',
    'outreach.draft', 'outreach.send', 'meetings.schedule'
  ) THEN
    RAISE EXCEPTION 'RHIA_TOOL_FORBIDDEN: capability exceeds AGENT_SERVICE ceiling' USING ERRCODE = '23514';
  ELSIF definition_key = 'n8n-service' AND capability_key_value NOT IN (
    'records.read', 'records.write', 'jobs.execute', 'outreach.send', 'meetings.schedule'
  ) THEN
    RAISE EXCEPTION 'RHIA_TOOL_FORBIDDEN: capability exceeds N8N_SERVICE ceiling' USING ERRCODE = '23514';
  ELSIF definition_key = 'worker-service' AND capability_key_value NOT IN (
    'records.read', 'records.write', 'jobs.execute', 'approved-actions.execute',
    'outreach.send', 'meetings.schedule'
  ) THEN
    RAISE EXCEPTION 'RHIA_TOOL_FORBIDDEN: capability exceeds WORKER_SERVICE ceiling' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_capability_ceiling_guard
BEFORE INSERT OR UPDATE ON rhia.agent_capability
FOR EACH ROW EXECUTE FUNCTION rhia.enforce_service_capability_ceiling();

INSERT INTO rhia.schema_migration (version, checksum_sha256)
VALUES ('0003_rbac_tenant_guards', :'migration_checksum');

COMMIT;
