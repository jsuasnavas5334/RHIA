\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE rhia.job
  ADD COLUMN lease_token uuid,
  ADD COLUMN lease_owner text,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN current_step text,
  ADD CONSTRAINT job_lease_complete CHECK ((lease_token IS NULL AND lease_owner IS NULL AND lease_expires_at IS NULL) OR (lease_token IS NOT NULL AND btrim(lease_owner) <> '' AND lease_expires_at IS NOT NULL)),
  ADD CONSTRAINT job_current_step_nonempty CHECK (current_step IS NULL OR btrim(current_step) <> '');

CREATE INDEX job_runtime_claim_idx
  ON rhia.job (status, next_attempt_at, lease_expires_at, priority DESC, created_at)
  WHERE status IN ('PENDING', 'QUEUED', 'RETRY_SCHEDULED', 'RUNNING');

CREATE TABLE rhia.job_step_checkpoint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  job_id uuid NOT NULL REFERENCES rhia.job(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL REFERENCES rhia.execution(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  status text NOT NULL,
  attempt integer NOT NULL,
  lease_token uuid NOT NULL,
  input_hash text NOT NULL,
  output_summary jsonb,
  action_id uuid REFERENCES rhia.action(id),
  error_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_step_key_nonempty CHECK (btrim(step_key) <> ''),
  CONSTRAINT job_step_status_taxonomy CHECK (status IN ('STARTED', 'SUCCEEDED', 'FAILED')),
  CONSTRAINT job_step_attempt_positive CHECK (attempt > 0),
  CONSTRAINT job_step_input_hash_sha256 CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT job_step_output_object CHECK (output_summary IS NULL OR jsonb_typeof(output_summary) = 'object'),
  CONSTRAINT job_step_completion_consistent CHECK ((status = 'STARTED' AND completed_at IS NULL) OR (status IN ('SUCCEEDED', 'FAILED') AND completed_at IS NOT NULL)),
  CONSTRAINT job_step_success_without_error CHECK (status <> 'SUCCEEDED' OR error_code IS NULL),
  UNIQUE (job_id, step_key)
);

CREATE INDEX job_step_execution_idx
  ON rhia.job_step_checkpoint (execution_id, started_at);
CREATE INDEX job_step_resume_idx
  ON rhia.job_step_checkpoint (organization_id, job_id, status, updated_at);

CREATE FUNCTION rhia.enforce_job_step_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, rhia
AS $$
DECLARE
  linked_organization uuid;
  linked_job uuid;
BEGIN
  SELECT job.organization_id, execution.job_id
  INTO linked_organization, linked_job
  FROM rhia.execution execution
  JOIN rhia.job job ON job.id=execution.job_id
  WHERE execution.id=NEW.execution_id;

  IF linked_organization IS NULL
    OR linked_organization <> NEW.organization_id
    OR linked_job <> NEW.job_id THEN
    RAISE EXCEPTION 'RHIA_POLICY_DENIED: checkpoint tenant/job mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER job_step_tenant_guard
BEFORE INSERT OR UPDATE ON rhia.job_step_checkpoint
FOR EACH ROW EXECUTE FUNCTION rhia.enforce_job_step_tenant();

INSERT INTO rhia.schema_migration (version, checksum_sha256)
VALUES ('0008_agent_runtime', :'migration_checksum');

COMMIT;
