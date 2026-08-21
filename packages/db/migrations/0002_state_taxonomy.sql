\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE rhia.job
  ADD CONSTRAINT job_status_taxonomy CHECK (
    status IN ('PENDING', 'QUEUED', 'RUNNING', 'RETRY_SCHEDULED', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED', 'DEAD_LETTER')
  );

ALTER TABLE rhia.execution
  ADD CONSTRAINT execution_error_code_taxonomy CHECK (
    error_code IS NULL OR error_code IN (
      'RHIA_STATE_INVALID_TRANSITION',
      'RHIA_CONTRACT_INVALID_PAYLOAD',
      'RHIA_SEARCH_PROVIDER_DEGRADED',
      'RHIA_SEARCH_PROVIDER_UNAVAILABLE',
      'RHIA_SEARCH_RATE_LIMITED',
      'RHIA_SEARCH_CAPTCHA_BLOCKED',
      'RHIA_SEARCH_TIMEOUT',
      'RHIA_WORKFLOW_TIMEOUT',
      'RHIA_ENTITY_AMBIGUOUS',
      'RHIA_APPROVAL_REQUIRED',
      'RHIA_POLICY_DENIED',
      'RHIA_JOB_RETRY_EXHAUSTED',
      'RHIA_OUTREACH_OPTED_OUT',
      'RHIA_OUTREACH_PERMANENT_BOUNCE',
      'RHIA_MODEL_RATE_LIMITED',
      'RHIA_MODEL_PROVIDER_UNAVAILABLE',
      'RHIA_TOOL_FORBIDDEN',
      'RHIA_CORE_UNEXPECTED_FAILURE'
    )
  );

ALTER TABLE rhia.evidence
  ADD CONSTRAINT evidence_status_taxonomy CHECK (
    status IN ('COLLECTED', 'VALIDATED', 'ACTIVE', 'STALE', 'CONTRADICTED', 'REJECTED', 'SUPERSEDED')
  );

ALTER TABLE rhia.opportunity
  ADD CONSTRAINT opportunity_stage_taxonomy CHECK (
    stage IN ('DISCOVERED', 'QUALIFYING', 'QUALIFIED', 'NURTURE', 'OUTREACH_ACTIVE', 'ENGAGED', 'MEETING_BOOKED', 'WON', 'LOST', 'DISQUALIFIED')
  ),
  ADD CONSTRAINT opportunity_record_status_taxonomy CHECK (
    status IN ('OPEN', 'CLOSED', 'ARCHIVED')
  );

ALTER TABLE rhia.outreach_touch
  ADD CONSTRAINT outreach_touch_status_taxonomy CHECK (
    status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PLANNED', 'SENDING', 'SENT', 'DELIVERED', 'REPLIED', 'BOUNCED', 'FAILED', 'CANCELLED', 'OPTED_OUT')
  );

ALTER TABLE rhia.meeting
  ADD CONSTRAINT meeting_status_taxonomy CHECK (
    status IN ('BOOKED', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED')
  ),
  ADD CONSTRAINT meeting_qualification_taxonomy CHECK (
    qualification_status IN ('UNQUALIFIED', 'POTENTIAL', 'QUALIFIED')
  );

INSERT INTO rhia.schema_migration (version, checksum_sha256)
VALUES ('0002_state_taxonomy', :'migration_checksum');

COMMIT;
