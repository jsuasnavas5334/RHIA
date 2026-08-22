import assert from 'node:assert/strict';
import test from 'node:test';
import { getAuthTables } from 'better-auth/db';
import { getMigrations } from 'better-auth/db/migration';
import { Pool } from 'pg';
import { AdminBootstrapError, bootstrapFirstAdmin, hashAdminBootstrapPassword } from './admin-bootstrap.js';
import { createRhiaAuthOptions } from './auth-options.js';

const pool = {} as Pool;
const runtime = { baseUrl: 'http://localhost:4173', production: false, secret: 'x'.repeat(32) } as const;

test('schema mapping mantiene auth separada del usuario tenant-aware', () => {
  const options = createRhiaAuthOptions(pool, runtime);
  const tables = getAuthTables(options);

  assert.equal(tables['user']?.modelName, 'auth_user');
  assert.equal(tables['user']?.fields['appUserId']?.fieldName, 'app_user_id');
  assert.equal(tables['session']?.modelName, 'auth_session');
  assert.equal(tables['session']?.fields['userId']?.fieldName, 'user_id');
  assert.equal(tables['account']?.modelName, 'auth_account');
  assert.equal(tables['account']?.fields['password']?.fieldName, 'password_hash');
  assert.equal(tables['verification']?.modelName, 'auth_verification');
  assert.equal(tables['rateLimit']?.modelName, 'auth_rate_limit');
  assert.equal(Object.keys(tables).length, 5);
});

test('perfil RHIA fija signup, expiración y rate limit', () => {
  const options = createRhiaAuthOptions(pool, runtime);

  assert.equal(options.emailAndPassword?.disableSignUp, true);
  assert.equal(options.emailAndPassword?.minPasswordLength, 12);
  assert.equal(options.session?.expiresIn, 28_800);
  assert.equal(options.session?.disableSessionRefresh, true);
  assert.deepEqual(options.rateLimit?.customRules?.['/sign-in/email'], { window: 900, max: 5 });
  assert.equal(options.advanced?.defaultCookieAttributes?.sameSite, 'strict');
  assert.equal(options.advanced?.trustedProxyHeaders, false);
  assert.deepEqual(options.advanced?.ipAddress?.ipAddressHeaders, ['x-rhia-peer-ip']);
});

test('configuración rechaza secret débil y HTTP en producción', () => {
  assert.throws(() => createRhiaAuthOptions(pool, { ...runtime, secret: 'short' }), /32 caracteres/);
  assert.throws(() => createRhiaAuthOptions(pool, { ...runtime, production: true }), /HTTPS/);
});

test('bootstrap exige contraseña fuerte y produce únicamente hash scrypt Better Auth', async () => {
  await assert.rejects(hashAdminBootstrapPassword('corta'), AdminBootstrapError);
  await assert.rejects(hashAdminBootstrapPassword('x'.repeat(129)), AdminBootstrapError);
  const hash = await hashAdminBootstrapPassword('Temporal-Only-Password-0000!');
  assert.match(hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(hash.includes('Temporal-Only-Password-0000!'), false);
  await assert.rejects(bootstrapFirstAdmin(pool, {
    organizationId: '40000000-0000-4000-8000-000000000010',
    email: 'admin@example.invalid',
    displayName: 'Admin',
    passwordHash: 'texto-plano-prohibido',
    traceId: '40000000-0000-4000-8000-000000000011',
  }), (error: unknown) => error instanceof AdminBootstrapError && error.code === 'INVALID_INPUT');
  await assert.rejects(bootstrapFirstAdmin(pool, {
    organizationId: '40000000-0000-4000-8000-000000000010',
    email: 'direccion-invalida',
    displayName: 'x'.repeat(121),
    passwordHash: hash,
    traceId: '40000000-0000-4000-8000-000000000011',
  }), (error: unknown) => error instanceof AdminBootstrapError && error.code === 'INVALID_INPUT');
});

const integrationUrl = process.env['RHIA_TEST_DATABASE_URL'];
test('Better Auth real compila el schema mapping en PostgreSQL temporal', { skip: !integrationUrl }, async () => {
  const integrationPool = new Pool({ connectionString: integrationUrl, options: '-c search_path=rhia,public' });
  try {
    const options = createRhiaAuthOptions(integrationPool, {
      ...runtime,
      secret: 'integration-only-not-a-real-secret-0001',
    });
    const plan = await getMigrations(options, { throwOnUnsafe: false });
    assert.deepEqual(plan.toBeCreated, []);
    assert.deepEqual(plan.toBeAdded, []);
    assert.deepEqual(plan.unsafeChanges, []);
    const sql = await plan.compileMigrations();
    assert.equal(sql.trim(), '');
    await plan.runMigrations();
    const schema = await integrationPool.query<{ table_name: string; column_name: string }>(`SELECT table_name, column_name
      FROM information_schema.columns WHERE table_schema='rhia' AND table_name LIKE 'auth_%' ORDER BY table_name, ordinal_position`);
    assert.equal(new Set(schema.rows.map((row) => row.table_name)).size, 5);
    assert.equal(schema.rows.some((row) => row.table_name === 'auth_user' && row.column_name === 'app_user_id'), true);
    assert.equal(schema.rows.some((row) => row.table_name === 'auth_account' && row.column_name === 'password_hash'), true);
  } finally {
    await integrationPool.end();
  }
});

test('Better Auth real crea el primer admin una sola vez y bloquea escalamiento posterior', { skip: !integrationUrl }, async () => {
  const integrationPool = new Pool({ connectionString: integrationUrl, options: '-c search_path=rhia,public' });
  const organizationId = '40000000-0000-4000-8000-000000000001';
  try {
    await integrationPool.query(`INSERT INTO rhia.organization (id, name) VALUES ($1, 'Auth Bootstrap Temporal')`, [organizationId]);
    const originalHash = await hashAdminBootstrapPassword('Temporal-Only-Password-0001!');
    const request = {
      organizationId,
      email: 'ADMIN.TEMP@EXAMPLE.INVALID',
      displayName: 'Admin Temporal',
      passwordHash: originalHash,
      traceId: '40000000-0000-4000-8000-000000000002',
    } as const;
    const first = await bootstrapFirstAdmin(integrationPool, request);
    assert.equal(first.created, true);
    assert.equal(first.email, 'admin.temp@example.invalid');

    const replay = await bootstrapFirstAdmin(integrationPool, {
      ...request,
      passwordHash: await hashAdminBootstrapPassword('Different-Temporary-Password-0002!'),
      traceId: '40000000-0000-4000-8000-000000000003',
    });
    assert.equal(replay.created, false);
    assert.equal(replay.appUserId, first.appUserId);

    const persisted = await integrationPool.query<{ accounts: string; audits: string; password_hash: string }>(`
      SELECT count(DISTINCT aa.id)::text AS accounts,
        count(DISTINCT ae.id)::text AS audits,
        min(aa.password_hash) AS password_hash
      FROM rhia.auth_user au
      JOIN rhia.auth_account aa ON aa.user_id=au.id
      LEFT JOIN rhia.audit_event ae ON ae.resource_id=au.app_user_id AND ae.action='AUTH_ADMIN_BOOTSTRAPPED'
      WHERE au.app_user_id=$1 GROUP BY au.id`, [first.appUserId]);
    assert.equal(persisted.rows[0]?.accounts, '1');
    assert.equal(persisted.rows[0]?.audits, '1');
    assert.equal(persisted.rows[0]?.password_hash, originalHash);

    await assert.rejects(
      bootstrapFirstAdmin(integrationPool, {
        ...request,
        email: 'second.admin@example.invalid',
        traceId: '40000000-0000-4000-8000-000000000004',
      }),
      (error: unknown) => error instanceof AdminBootstrapError && error.code === 'ALREADY_BOOTSTRAPPED',
    );
    const second = await integrationPool.query(
      `SELECT 1 FROM rhia.app_user WHERE organization_id=$1 AND lower(email)='second.admin@example.invalid'`, [organizationId],
    );
    assert.equal(second.rowCount, 0);
  } finally {
    await integrationPool.end();
  }
});
