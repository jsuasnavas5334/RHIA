\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE rhia.core_idempotency (
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  fingerprint char(64) NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  resource_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, operation, idempotency_key),
  CONSTRAINT core_idempotency_operation_nonempty CHECK (btrim(operation) <> ''),
  CONSTRAINT core_idempotency_key_nonempty CHECK (btrim(idempotency_key) <> ''),
  CONSTRAINT core_idempotency_fingerprint_sha256 CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT core_idempotency_resource_object CHECK (jsonb_typeof(resource_snapshot) = 'object')
);
CREATE INDEX core_idempotency_resource_idx
  ON rhia.core_idempotency (organization_id, resource_type, resource_id);

ALTER TABLE rhia.approval
  ADD COLUMN organization_id uuid,
  ADD COLUMN job_id uuid,
  ADD COLUMN requested_by_user_id uuid REFERENCES rhia.app_user(id),
  ADD COLUMN reason_code text,
  ADD COLUMN summary text,
  ADD COLUMN target_ref uuid,
  ADD COLUMN correlation_id uuid;

UPDATE rhia.approval approval
SET
  organization_id = job.organization_id,
  job_id = job.id,
  reason_code = 'RHIA_APPROVAL_LEGACY',
  summary = COALESCE(NULLIF(approval.reason, ''), 'Approval migrado desde baseline'),
  target_ref = approval.action_id,
  correlation_id = execution.trace_id
FROM rhia.action action
JOIN rhia.execution execution ON execution.id = action.execution_id
JOIN rhia.job job ON job.id = execution.job_id
WHERE action.id = approval.action_id;

ALTER TABLE rhia.approval
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN job_id SET NOT NULL,
  ALTER COLUMN reason_code SET NOT NULL,
  ALTER COLUMN summary SET NOT NULL,
  ALTER COLUMN target_ref SET NOT NULL,
  ALTER COLUMN correlation_id SET NOT NULL,
  ADD CONSTRAINT approval_organization_fk FOREIGN KEY (organization_id) REFERENCES rhia.organization(id),
  ADD CONSTRAINT approval_job_fk FOREIGN KEY (job_id) REFERENCES rhia.job(id),
  ADD CONSTRAINT approval_reason_code_format CHECK (reason_code ~ '^RHIA_APPROVAL_[A-Z0-9_]+$'),
  ADD CONSTRAINT approval_summary_nonempty CHECK (btrim(summary) <> '');

CREATE INDEX approval_org_status_expiry_idx
  ON rhia.approval (organization_id, status, expires_at);
CREATE INDEX approval_job_idx
  ON rhia.approval (organization_id, job_id, requested_at DESC);

CREATE FUNCTION rhia.enforce_approval_core_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  linked_organization uuid;
  linked_job uuid;
  requester_user_organization uuid;
BEGIN
  SELECT job.organization_id, job.id INTO linked_organization, linked_job
  FROM rhia.action action
  JOIN rhia.execution execution ON execution.id = action.execution_id
  JOIN rhia.job job ON job.id = execution.job_id
  WHERE action.id = NEW.action_id;

  IF linked_organization IS NULL OR NEW.organization_id <> linked_organization OR NEW.job_id <> linked_job THEN
    RAISE EXCEPTION 'RHIA_POLICY_DENIED: approval core tenant/job mismatch' USING ERRCODE = '23514';
  END IF;

  IF NEW.requested_by_user_id IS NOT NULL THEN
    SELECT organization_id INTO requester_user_organization
    FROM rhia.app_user WHERE id = NEW.requested_by_user_id;
    IF requester_user_organization IS NULL OR requester_user_organization <> NEW.organization_id THEN
      RAISE EXCEPTION 'RHIA_POLICY_DENIED: approval human requester tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER approval_core_tenant_guard
BEFORE INSERT OR UPDATE ON rhia.approval
FOR EACH ROW EXECUTE FUNCTION rhia.enforce_approval_core_tenant();

INSERT INTO rhia.schema_migration (version, checksum_sha256)
VALUES ('0005_core_api_persistence', :'migration_checksum');

COMMIT;
