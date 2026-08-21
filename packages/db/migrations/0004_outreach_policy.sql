\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE rhia.outreach_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  version text NOT NULL,
  name text NOT NULL,
  configuration jsonb NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  approved_by_user_id uuid REFERENCES rhia.app_user(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_policy_configuration_object CHECK (jsonb_typeof(configuration) = 'object'),
  CONSTRAINT outreach_policy_status_taxonomy CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT outreach_policy_approval_consistency CHECK ((status = 'ACTIVE' AND approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL) OR status <> 'ACTIVE'),
  UNIQUE (organization_id, version)
);
CREATE INDEX outreach_policy_status_idx ON rhia.outreach_policy (organization_id, status, updated_at DESC);

CREATE TABLE rhia.outreach_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  subject_type text NOT NULL,
  subject_key_hash char(64) NOT NULL,
  reason text NOT NULL,
  source text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_suppression_subject_type CHECK (subject_type IN ('CONTACT', 'CONTACT_POINT', 'COMPANY')),
  CONSTRAINT outreach_suppression_hash_sha256 CHECK (subject_key_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT outreach_suppression_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);
CREATE UNIQUE INDEX outreach_suppression_active_uq
  ON rhia.outreach_suppression (organization_id, subject_type, subject_key_hash)
  WHERE active;

ALTER TABLE rhia.outreach_sequence
  ADD CONSTRAINT outreach_sequence_policy_fk FOREIGN KEY (policy_id) REFERENCES rhia.outreach_policy(id);

CREATE FUNCTION rhia.enforce_outreach_sequence_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  opportunity_organization uuid;
  policy_organization uuid;
BEGIN
  SELECT organization_id INTO opportunity_organization
  FROM rhia.opportunity WHERE id = NEW.opportunity_id;
  IF NEW.policy_id IS NOT NULL THEN
    SELECT organization_id INTO policy_organization
    FROM rhia.outreach_policy WHERE id = NEW.policy_id;
    IF policy_organization IS NULL OR policy_organization <> opportunity_organization THEN
      RAISE EXCEPTION 'RHIA_POLICY_DENIED: outreach policy tenant mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER outreach_sequence_tenant_guard
BEFORE INSERT OR UPDATE ON rhia.outreach_sequence
FOR EACH ROW EXECUTE FUNCTION rhia.enforce_outreach_sequence_tenant();

INSERT INTO rhia.schema_migration (version, checksum_sha256)
VALUES ('0004_outreach_policy', :'migration_checksum');

COMMIT;
