\set ON_ERROR_STOP on

BEGIN;

CREATE FUNCTION rhia.audit_auth_session_created()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, rhia
AS $$
DECLARE
  v_app_user_id uuid;
  v_organization_id uuid;
BEGIN
  SELECT u.id, u.organization_id
  INTO STRICT v_app_user_id, v_organization_id
  FROM rhia.auth_user au
  JOIN rhia.app_user u ON u.id=au.app_user_id
  WHERE au.id=NEW.user_id;

  INSERT INTO rhia.audit_event
    (organization_id, actor_ref, actor_type, action, resource_type, resource_id, trace_id)
  VALUES
    (v_organization_id, v_app_user_id, 'HUMAN', 'AUTH_LOGIN_SUCCEEDED', 'auth_session', NEW.id, NEW.id);
  RETURN NEW;
END;
$$;

CREATE FUNCTION rhia.audit_auth_session_deleted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, rhia
AS $$
DECLARE
  v_app_user_id uuid;
  v_organization_id uuid;
  v_action text;
BEGIN
  SELECT ae.actor_ref, ae.organization_id
  INTO STRICT v_app_user_id, v_organization_id
  FROM rhia.audit_event ae
  WHERE ae.resource_type='auth_session' AND ae.resource_id=OLD.id
  ORDER BY ae.occurred_at, ae.id
  LIMIT 1;

  v_action := CASE
    WHEN OLD.expires_at <= clock_timestamp() THEN 'AUTH_SESSION_EXPIRED'
    ELSE 'AUTH_SESSION_REVOKED'
  END;
  INSERT INTO rhia.audit_event
    (organization_id, actor_ref, actor_type, action, resource_type, resource_id, trace_id)
  VALUES
    (v_organization_id, v_app_user_id, 'HUMAN', v_action, 'auth_session', OLD.id, OLD.id);
  RETURN OLD;
END;
$$;

CREATE TRIGGER auth_session_created_audit
AFTER INSERT ON rhia.auth_session
FOR EACH ROW EXECUTE FUNCTION rhia.audit_auth_session_created();

INSERT INTO rhia.audit_event
  (organization_id, actor_ref, actor_type, action, resource_type, resource_id, trace_id)
SELECT
  u.organization_id, u.id, 'HUMAN', 'AUTH_SESSION_BASELINED', 'auth_session', s.id, s.id
FROM rhia.auth_session s
JOIN rhia.auth_user au ON au.id=s.user_id
JOIN rhia.app_user u ON u.id=au.app_user_id;

CREATE TRIGGER auth_session_deleted_audit
AFTER DELETE ON rhia.auth_session
FOR EACH ROW EXECUTE FUNCTION rhia.audit_auth_session_deleted();

INSERT INTO rhia.schema_migration (version, checksum_sha256)
VALUES ('0007_auth_audit', :'migration_checksum');

COMMIT;
