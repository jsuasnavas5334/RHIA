BEGIN;

CREATE SCHEMA rhia;

CREATE TABLE rhia.schema_migration (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum_sha256 char(64) NOT NULL
);

CREATE TABLE rhia.organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_locale text NOT NULL DEFAULT 'es-EC',
  default_timezone text NOT NULL DEFAULT 'America/Guayaquil',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_name_nonempty CHECK (btrim(name) <> '')
);

CREATE TABLE rhia.app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  email text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  auth_provider text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT app_user_email_shape CHECK (position('@' IN email) > 1)
);
CREATE UNIQUE INDEX app_user_org_email_uq ON rhia.app_user (organization_id, lower(email));

CREATE TABLE rhia.role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  key text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE TABLE rhia.permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rhia.user_role (
  user_id uuid NOT NULL REFERENCES rhia.app_user(id),
  role_id uuid NOT NULL REFERENCES rhia.role(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by_user_id uuid REFERENCES rhia.app_user(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE rhia.role_permission (
  role_id uuid NOT NULL REFERENCES rhia.role(id),
  permission_id uuid NOT NULL REFERENCES rhia.permission(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE rhia.agent_definition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  version text NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  default_policy_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, version)
);

CREATE TABLE rhia.agent_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  agent_definition_id uuid NOT NULL REFERENCES rhia.agent_definition(id),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'INACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_instance_configuration_object CHECK (jsonb_typeof(configuration) = 'object')
);

CREATE TABLE rhia.capability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  risk_level text NOT NULL,
  requires_approval_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rhia.agent_capability (
  agent_definition_id uuid NOT NULL REFERENCES rhia.agent_definition(id),
  capability_id uuid NOT NULL REFERENCES rhia.capability(id),
  policy_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_definition_id, capability_id),
  CONSTRAINT agent_capability_policy_object CHECK (jsonb_typeof(policy_overrides) = 'object')
);

CREATE TABLE rhia.job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  agent_instance_id uuid REFERENCES rhia.agent_instance(id),
  job_type text NOT NULL,
  input jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  priority smallint NOT NULL DEFAULT 50,
  idempotency_key text NOT NULL,
  retry_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT job_input_object CHECK (jsonb_typeof(input) = 'object'),
  CONSTRAINT job_priority_range CHECK (priority BETWEEN 0 AND 100),
  CONSTRAINT job_retry_nonnegative CHECK (retry_count >= 0),
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX job_status_attempt_idx ON rhia.job (organization_id, status, next_attempt_at);

CREATE TABLE rhia.execution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES rhia.job(id),
  attempt integer NOT NULL,
  executor_type text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  outcome text,
  error_code text,
  trace_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT execution_attempt_positive CHECK (attempt > 0),
  UNIQUE (job_id, attempt)
);
CREATE INDEX execution_trace_idx ON rhia.execution (trace_id);

CREATE TABLE rhia.action (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES rhia.execution(id),
  capability_key text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_summary jsonb,
  risk_level text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_request_object CHECK (jsonb_typeof(request_payload) = 'object')
);

CREATE TABLE rhia.approval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES rhia.action(id),
  requested_by_agent_instance_id uuid REFERENCES rhia.agent_instance(id),
  approval_type text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  approver_user_id uuid REFERENCES rhia.app_user(id),
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX approval_status_expiry_idx ON rhia.approval (status, expires_at);

CREATE TABLE rhia.company_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  canonical_name text NOT NULL,
  website_root text,
  global_identity_status text NOT NULL DEFAULT 'UNRESOLVED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_group_name_nonempty CHECK (btrim(canonical_name) <> '')
);
CREATE INDEX company_group_name_idx ON rhia.company_group (organization_id, lower(canonical_name));

CREATE TABLE rhia.company_entity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  company_group_id uuid NOT NULL REFERENCES rhia.company_group(id),
  legal_name text NOT NULL,
  trade_name text,
  country_code char(2) NOT NULL,
  legal_identifier text,
  entity_type text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_entity_country_iso2 CHECK (country_code ~ '^[A-Z]{2}$')
);
CREATE INDEX company_entity_name_market_idx ON rhia.company_entity (organization_id, lower(legal_name), country_code);
CREATE UNIQUE INDEX company_entity_legal_id_uq ON rhia.company_entity (organization_id, country_code, legal_identifier) WHERE legal_identifier IS NOT NULL;

CREATE TABLE rhia.company_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  company_entity_id uuid NOT NULL REFERENCES rhia.company_entity(id),
  country_code char(2) NOT NULL,
  administrative_area text,
  city text NOT NULL,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text,
  is_headquarters boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_location_country_iso2 CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT company_location_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT company_location_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX company_location_market_idx ON rhia.company_location (organization_id, country_code, lower(city));
CREATE UNIQUE INDEX company_location_one_hq_uq ON rhia.company_location (company_entity_id) WHERE is_headquarters;

CREATE TABLE rhia.company_alias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  company_group_id uuid REFERENCES rhia.company_group(id),
  company_entity_id uuid REFERENCES rhia.company_entity(id),
  alias text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_alias_one_subject CHECK (num_nonnulls(company_group_id, company_entity_id) = 1)
);
CREATE INDEX company_alias_lookup_idx ON rhia.company_alias (organization_id, lower(alias));

CREATE TABLE rhia.evidence_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  source_type text NOT NULL,
  domain text,
  url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  provider text NOT NULL,
  source_reliability numeric(5,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_source_reliability CHECK (source_reliability BETWEEN 0 AND 1)
);
CREATE UNIQUE INDEX evidence_source_url_fetch_uq ON rhia.evidence_source (organization_id, url, fetched_at);

CREATE TABLE rhia.evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  source_id uuid NOT NULL REFERENCES rhia.evidence_source(id),
  claim_type text NOT NULL,
  excerpt_hash char(64) NOT NULL,
  observed_value jsonb NOT NULL,
  confidence numeric(5,4) NOT NULL,
  freshness_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_confidence CHECK (confidence BETWEEN 0 AND 1)
);
CREATE INDEX evidence_subject_freshness_idx ON rhia.evidence (organization_id, subject_type, subject_id, claim_type, freshness_at DESC);
CREATE UNIQUE INDEX evidence_excerpt_source_uq ON rhia.evidence (organization_id, source_id, excerpt_hash, claim_type);

CREATE TABLE rhia.fact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  predicate text NOT NULL,
  value jsonb NOT NULL,
  confidence numeric(5,4) NOT NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  supporting_evidence_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fact_confidence CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT fact_valid_window CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT fact_requires_evidence CHECK (cardinality(supporting_evidence_ids) > 0)
);
CREATE INDEX fact_subject_idx ON rhia.fact (organization_id, subject_type, subject_id, predicate);

CREATE TABLE rhia.model_provider (
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'INACTIVE',
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, provider),
  CONSTRAINT model_provider_capabilities_array CHECK (jsonb_typeof(capabilities) = 'array')
);

CREATE TABLE rhia.model_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  task_class text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  quality_score numeric(6,3) NOT NULL DEFAULT 0,
  latency_score numeric(6,3) NOT NULL DEFAULT 0,
  cost_score numeric(6,3) NOT NULL DEFAULT 0,
  privacy_class text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, provider) REFERENCES rhia.model_provider(organization_id, provider),
  UNIQUE (organization_id, task_class, provider, model)
);

CREATE TABLE rhia.model_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  job_id uuid REFERENCES rhia.job(id),
  provider text NOT NULL,
  model text NOT NULL,
  task_class text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost numeric(14,6) NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  success boolean NOT NULL,
  quality_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_run_tokens_nonnegative CHECK (input_tokens >= 0 AND output_tokens >= 0),
  CONSTRAINT model_run_cost_nonnegative CHECK (estimated_cost >= 0),
  CONSTRAINT model_run_latency_nonnegative CHECK (latency_ms >= 0)
);
CREATE INDEX model_run_task_provider_idx ON rhia.model_run (organization_id, task_class, provider, model, created_at DESC);

CREATE TABLE rhia.inference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  inference_type text NOT NULL,
  value jsonb NOT NULL,
  confidence numeric(5,4) NOT NULL,
  model_run_id uuid NOT NULL REFERENCES rhia.model_run(id),
  supporting_fact_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inference_confidence CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT inference_requires_facts CHECK (cardinality(supporting_fact_ids) > 0)
);
CREATE INDEX inference_subject_idx ON rhia.inference (organization_id, subject_type, subject_id, inference_type);

CREATE TABLE rhia.decision_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  decision_type text NOT NULL,
  input_snapshot jsonb NOT NULL,
  output jsonb NOT NULL,
  rationale_summary text NOT NULL,
  policy_version text NOT NULL,
  model_run_id uuid REFERENCES rhia.model_run(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decision_input_object CHECK (jsonb_typeof(input_snapshot) = 'object')
);

CREATE TABLE rhia.contact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  company_group_id uuid NOT NULL REFERENCES rhia.company_group(id),
  company_entity_id uuid REFERENCES rhia.company_entity(id),
  full_name text NOT NULL,
  title text,
  department text,
  seniority text,
  country_code char(2),
  city text,
  linkedin_url text,
  status text NOT NULL DEFAULT 'UNVERIFIED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_country_iso2 CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$')
);
CREATE INDEX contact_company_name_idx ON rhia.contact (organization_id, company_group_id, lower(full_name));

CREATE TABLE rhia.contact_point (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  contact_id uuid NOT NULL REFERENCES rhia.contact(id),
  point_type text NOT NULL,
  value_encrypted bytea NOT NULL,
  value_hash char(64) NOT NULL,
  validation_status text NOT NULL DEFAULT 'UNVERIFIED',
  source_id uuid REFERENCES rhia.evidence_source(id),
  last_validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contact_point_hash_uq ON rhia.contact_point (organization_id, point_type, value_hash);

CREATE TABLE rhia.opportunity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  company_group_id uuid NOT NULL REFERENCES rhia.company_group(id),
  primary_entity_id uuid REFERENCES rhia.company_entity(id),
  market_country char(2) NOT NULL,
  market_city text,
  stage text NOT NULL,
  score numeric(6,3) NOT NULL DEFAULT 0,
  score_version text NOT NULL,
  owner_user_id uuid REFERENCES rhia.app_user(id),
  next_action_at timestamptz,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_country_iso2 CHECK (market_country ~ '^[A-Z]{2}$'),
  CONSTRAINT opportunity_score_range CHECK (score BETWEEN 0 AND 100)
);
CREATE INDEX opportunity_status_action_idx ON rhia.opportunity (organization_id, status, next_action_at);

CREATE TABLE rhia.opportunity_signal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES rhia.opportunity(id),
  signal_type text NOT NULL,
  signal_value jsonb NOT NULL,
  evidence_id uuid NOT NULL REFERENCES rhia.evidence(id),
  weight numeric(8,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX opportunity_signal_opportunity_idx ON rhia.opportunity_signal (opportunity_id, signal_type);

CREATE TABLE rhia.product (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  sku text NOT NULL,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sku)
);

CREATE TABLE rhia.price_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  country_code char(2) NOT NULL,
  currency char(3) NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_book_country_iso2 CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT price_book_currency_iso3 CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT price_book_window CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX price_book_market_status_idx ON rhia.price_book (organization_id, country_code, status, valid_from DESC);

CREATE TABLE rhia.price_book_item (
  price_book_id uuid NOT NULL REFERENCES rhia.price_book(id),
  product_id uuid NOT NULL REFERENCES rhia.product(id),
  unit_price numeric(14,4) NOT NULL,
  minimum_quantity numeric(14,4) NOT NULL DEFAULT 1,
  policy_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (price_book_id, product_id),
  CONSTRAINT price_book_item_price_nonnegative CHECK (unit_price >= 0),
  CONSTRAINT price_book_item_quantity_positive CHECK (minimum_quantity > 0)
);

CREATE TABLE rhia.outreach_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  opportunity_id uuid NOT NULL REFERENCES rhia.opportunity(id),
  policy_id uuid,
  status text NOT NULL DEFAULT 'DRAFT',
  max_touches smallint NOT NULL DEFAULT 3,
  timezone text NOT NULL,
  quiet_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_sequence_max_touches CHECK (max_touches BETWEEN 1 AND 3),
  CONSTRAINT outreach_sequence_quiet_hours_object CHECK (jsonb_typeof(quiet_hours) = 'object')
);

CREATE TABLE rhia.outreach_touch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES rhia.outreach_sequence(id),
  contact_id uuid NOT NULL REFERENCES rhia.contact(id),
  channel text NOT NULL,
  planned_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'PLANNED',
  message_version text NOT NULL,
  provider_message_id text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, idempotency_key)
);
CREATE INDEX outreach_touch_schedule_idx ON rhia.outreach_touch (status, planned_at);

CREATE TABLE rhia.conversation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  opportunity_id uuid NOT NULL REFERENCES rhia.opportunity(id),
  contact_id uuid NOT NULL REFERENCES rhia.contact(id),
  channel text NOT NULL,
  status text NOT NULL,
  sentiment text,
  intent text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rhia.message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES rhia.conversation(id),
  direction text NOT NULL,
  content_redacted text NOT NULL,
  provider_message_id text,
  sent_at timestamptz NOT NULL,
  detected_intent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX message_provider_id_uq ON rhia.message (conversation_id, provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE rhia.meeting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  opportunity_id uuid NOT NULL REFERENCES rhia.opportunity(id),
  contact_id uuid NOT NULL REFERENCES rhia.contact(id),
  scheduled_at timestamptz NOT NULL,
  timezone text NOT NULL,
  status text NOT NULL,
  qualification_status text NOT NULL DEFAULT 'UNQUALIFIED',
  attended boolean NOT NULL DEFAULT false,
  outcome text,
  calendar_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meeting_schedule_status_idx ON rhia.meeting (organization_id, scheduled_at, status);

CREATE TABLE rhia.model_benchmark (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  task_class text NOT NULL,
  dataset_version text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  accuracy numeric(6,5) NOT NULL,
  cost_per_case numeric(14,6) NOT NULL,
  latency_p50 integer NOT NULL,
  latency_p95 integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_benchmark_accuracy CHECK (accuracy BETWEEN 0 AND 1),
  CONSTRAINT model_benchmark_cost_nonnegative CHECK (cost_per_case >= 0),
  CONSTRAINT model_benchmark_latency CHECK (latency_p50 >= 0 AND latency_p95 >= latency_p50),
  UNIQUE (organization_id, task_class, dataset_version, provider, model)
);

CREATE TABLE rhia.audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rhia.organization(id),
  actor_ref uuid,
  actor_type text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  before_hash char(64),
  after_hash char(64),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  trace_id uuid NOT NULL
);
CREATE INDEX audit_event_trace_idx ON rhia.audit_event (organization_id, trace_id, occurred_at);
CREATE INDEX audit_event_resource_idx ON rhia.audit_event (organization_id, resource_type, resource_id, occurred_at DESC);

CREATE TABLE rhia.system_health_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  status text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_health_detail_object CHECK (jsonb_typeof(detail) = 'object')
);
CREATE INDEX system_health_component_idx ON rhia.system_health_event (component, occurred_at DESC);

CREATE TABLE rhia.legacy_object_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_key text NOT NULL,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  migration_version text NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_key, target_table)
);

INSERT INTO rhia.schema_migration (version, checksum_sha256)
VALUES ('0001_domain_v1', :'migration_checksum');

COMMIT;
