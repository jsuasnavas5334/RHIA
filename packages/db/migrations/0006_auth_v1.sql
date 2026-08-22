\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE rhia.auth_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL UNIQUE REFERENCES rhia.app_user(id),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_user_name_nonempty CHECK (btrim(name) <> ''),
  CONSTRAINT auth_user_email_shape CHECK (position('@' IN email) > 1),
  CONSTRAINT auth_user_email_normalized CHECK (email = lower(email))
);

CREATE TABLE rhia.auth_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id uuid NOT NULL REFERENCES rhia.auth_user(id) ON DELETE CASCADE,
  CONSTRAINT auth_session_token_nonempty CHECK (btrim(token) <> '')
);
CREATE INDEX auth_session_user_expiry_idx ON rhia.auth_session (user_id, expires_at);

CREATE TABLE rhia.auth_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES rhia.auth_user(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_account_issuer_nonempty CHECK (btrim(issuer) <> ''),
  CONSTRAINT auth_account_provider_nonempty CHECK (btrim(provider_id) <> ''),
  UNIQUE (issuer, account_id)
);
CREATE INDEX auth_account_user_idx ON rhia.auth_account (user_id);

CREATE TABLE rhia.auth_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash text NOT NULL,
  value_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_verification_identifier_idx ON rhia.auth_verification (identifier_hash);

CREATE TABLE rhia.auth_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  count integer NOT NULL,
  last_request_at_ms bigint NOT NULL,
  CONSTRAINT auth_rate_limit_count_nonnegative CHECK (count >= 0),
  CONSTRAINT auth_rate_limit_timestamp_nonnegative CHECK (last_request_at_ms >= 0)
);

INSERT INTO rhia.schema_migration (version, checksum_sha256)
VALUES ('0006_auth_v1', :'migration_checksum');

COMMIT;
