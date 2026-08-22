import { hashPassword } from 'better-auth/crypto';
import type { Pool, PoolClient } from 'pg';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BETTER_AUTH_SCRYPT_HASH = /^[0-9a-f]{32}:[0-9a-f]{128}$/;
const CREDENTIAL_ISSUER = 'local:credential';

export class AdminBootstrapError extends Error {
  public constructor(public readonly code: 'INVALID_INPUT' | 'ORGANIZATION_NOT_FOUND' | 'ALREADY_BOOTSTRAPPED' | 'IDENTITY_CONFLICT', message: string) {
    super(message);
    this.name = 'AdminBootstrapError';
  }
}

export type AdminBootstrapRequest = Readonly<{
  organizationId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  traceId: string;
}>;

export type AdminBootstrapResult = Readonly<{
  appUserId: string;
  authUserId: string;
  organizationId: string;
  email: string;
  created: boolean;
}>;

export const hashAdminBootstrapPassword = async (password: string): Promise<string> => {
  if (password.length < 12 || password.length > 128) {
    throw new AdminBootstrapError('INVALID_INPUT', 'La contraseña debe tener entre 12 y 128 caracteres.');
  }
  return hashPassword(password);
};

const validateRequest = (request: AdminBootstrapRequest): { email: string; displayName: string } => {
  const email = request.email.trim().toLowerCase();
  const displayName = request.displayName.trim();
  if (!UUID.test(request.organizationId) || !UUID.test(request.traceId)) {
    throw new AdminBootstrapError('INVALID_INPUT', 'organizationId y traceId deben ser UUID válidos.');
  }
  if (!EMAIL.test(email) || email.length > 320 || !displayName || displayName.length > 120 || !BETTER_AUTH_SCRYPT_HASH.test(request.passwordHash)) {
    throw new AdminBootstrapError('INVALID_INPUT', 'Email, nombre y hash scrypt de Better Auth son obligatorios.');
  }
  return { email, displayName };
};

const rollbackQuietly = async (client: PoolClient): Promise<void> => {
  try { await client.query('ROLLBACK'); } catch { /* conserva el error original */ }
};

export const bootstrapFirstAdmin = async (pool: Pool, request: AdminBootstrapRequest): Promise<AdminBootstrapResult> => {
  const { email, displayName } = validateRequest(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`rhia:first-admin:${request.organizationId}`]);

    const organization = await client.query<{ id: string }>(
      'SELECT id FROM rhia.organization WHERE id=$1 AND active=true', [request.organizationId],
    );
    if (organization.rowCount !== 1) {
      throw new AdminBootstrapError('ORGANIZATION_NOT_FOUND', 'La organización no existe o está inactiva.');
    }

    const currentAdmin = await client.query<{ app_user_id: string; auth_user_id: string; email: string; status: string }>(`
      SELECT u.id AS app_user_id, au.id AS auth_user_id, lower(au.email) AS email, u.status
      FROM rhia.app_user u
      JOIN rhia.auth_user au ON au.app_user_id=u.id
      JOIN rhia.auth_account aa ON aa.user_id=au.id
        AND aa.provider_id='credential' AND aa.issuer=$2 AND aa.password_hash IS NOT NULL
      JOIN rhia.user_role ur ON ur.user_id=u.id
      JOIN rhia.role r ON r.id=ur.role_id AND r.organization_id=u.organization_id
      WHERE u.organization_id=$1 AND r.key='ADMIN'
      ORDER BY u.created_at
      LIMIT 1`, [request.organizationId, CREDENTIAL_ISSUER]);
    const existingAdmin = currentAdmin.rows[0];
    if (existingAdmin) {
      if (existingAdmin.email !== email) {
        throw new AdminBootstrapError('ALREADY_BOOTSTRAPPED', 'La organización ya tiene un administrador autenticable.');
      }
      if (existingAdmin.status !== 'ACTIVE') {
        throw new AdminBootstrapError('IDENTITY_CONFLICT', 'El administrador autenticable existente no está activo.');
      }
      await client.query('COMMIT');
      return {
        appUserId: existingAdmin.app_user_id,
        authUserId: existingAdmin.auth_user_id,
        organizationId: request.organizationId,
        email,
        created: false,
      };
    }

    const conflictingAuth = await client.query<{ app_user_id: string }>(
      'SELECT app_user_id FROM rhia.auth_user WHERE email=$1', [email],
    );
    const appUser = await client.query<{ id: string; status: string }>(
      'SELECT id, status FROM rhia.app_user WHERE organization_id=$1 AND lower(email)=$2', [request.organizationId, email],
    );
    let appUserId: string;
    if (appUser.rows[0]) {
      if (appUser.rows[0].status !== 'ACTIVE') {
        throw new AdminBootstrapError('IDENTITY_CONFLICT', 'El usuario de aplicación existente no está activo.');
      }
      appUserId = appUser.rows[0].id;
    } else {
      const inserted = await client.query<{ id: string }>(`
        INSERT INTO rhia.app_user (organization_id, email, display_name, auth_provider)
        VALUES ($1, $2, $3, 'BETTER_AUTH') RETURNING id`, [request.organizationId, email, displayName]);
      appUserId = inserted.rows[0]!.id;
    }
    if (conflictingAuth.rows[0] && conflictingAuth.rows[0].app_user_id !== appUserId) {
      throw new AdminBootstrapError('IDENTITY_CONFLICT', 'El email ya pertenece a otra identidad autenticable.');
    }

    const linkedAuth = await client.query<{ id: string; email: string }>(
      'SELECT id, lower(email) AS email FROM rhia.auth_user WHERE app_user_id=$1', [appUserId],
    );
    if (linkedAuth.rows[0] && linkedAuth.rows[0].email !== email) {
      throw new AdminBootstrapError('IDENTITY_CONFLICT', 'El usuario de aplicación ya está vinculado a otro email autenticable.');
    }
    let authUserId = linkedAuth.rows[0]?.id;
    if (!authUserId) {
      const insertedAuth = await client.query<{ id: string }>(`
        INSERT INTO rhia.auth_user (app_user_id, name, email, email_verified)
        VALUES ($1, $2, $3, false) RETURNING id`, [appUserId, displayName, email]);
      authUserId = insertedAuth.rows[0]!.id;
    }
    await client.query(`
      INSERT INTO rhia.auth_account (issuer, account_id, provider_id, user_id, password_hash)
      VALUES ($1, $2, 'credential', $2, $3)
      ON CONFLICT (issuer, account_id) DO UPDATE
        SET password_hash=EXCLUDED.password_hash, updated_at=now()
        WHERE auth_account.user_id=EXCLUDED.user_id AND auth_account.password_hash IS NULL`,
    [CREDENTIAL_ISSUER, authUserId, request.passwordHash]);
    const credential = await client.query(
      `SELECT 1 FROM rhia.auth_account
       WHERE issuer=$1 AND account_id=$2 AND provider_id='credential' AND user_id=$2 AND password_hash IS NOT NULL`,
    [CREDENTIAL_ISSUER, authUserId]);
    if (credential.rowCount !== 1) {
      throw new AdminBootstrapError('IDENTITY_CONFLICT', 'La cuenta credential existente no puede vincularse de forma segura.');
    }
    const role = await client.query<{ id: string }>(`
      INSERT INTO rhia.role (organization_id, key, name)
      VALUES ($1, 'ADMIN', 'Administrador')
      ON CONFLICT (organization_id, key) DO UPDATE SET name=EXCLUDED.name, updated_at=now()
      RETURNING id`, [request.organizationId]);
    await client.query(`
      INSERT INTO rhia.user_role (user_id, role_id, granted_by_user_id)
      VALUES ($1, $2, $1) ON CONFLICT (user_id, role_id) DO NOTHING`, [appUserId, role.rows[0]!.id]);
    await client.query(`
      INSERT INTO rhia.audit_event
        (organization_id, actor_ref, actor_type, action, resource_type, resource_id, trace_id)
      VALUES ($1, $2, 'HUMAN', 'AUTH_ADMIN_BOOTSTRAPPED', 'app_user', $2, $3)`,
    [request.organizationId, appUserId, request.traceId]);
    await client.query('COMMIT');
    return { appUserId, authUserId, organizationId: request.organizationId, email, created: true };
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  } finally {
    client.release();
  }
};
