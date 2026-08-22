import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { Pool } from 'pg';
import { bootstrapFirstAdmin, hashAdminBootstrapPassword } from './admin-bootstrap.js';
import { createRhiaAuthRuntime } from './runtime.js';

const integrationUrl = process.env['RHIA_TEST_DATABASE_URL'];
test('Better Auth real HTTP expone get-session sin autenticar y no inventa una identidad', { skip: !integrationUrl }, async () => {
  const pool = new Pool({ connectionString: integrationUrl, options: '-c search_path=rhia,public' });
  const runtime = createRhiaAuthRuntime(pool, {
    baseUrl: 'http://127.0.0.1',
    production: false,
    secret: 'http-test-only-not-a-real-secret-0001',
  });
  const server = createServer(runtime.handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/get-session`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), 'null');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});

test('Better Auth real HTTP autentica, entrega cookie estricta, revoca logout y respeta expiry', { skip: !integrationUrl }, async () => {
  const pool = new Pool({ connectionString: integrationUrl, options: '-c search_path=rhia,public' });
  const organizationId = '41000000-0000-4000-8000-000000000001';
  const email = 'http.admin@example.invalid';
  const password = 'Temporal-HTTP-Password-0001!';
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const runtime = createRhiaAuthRuntime(pool, {
      baseUrl,
      production: false,
      secret: 'http-integration-only-not-a-real-secret-0002',
    });
    server.on('request', runtime.handler);
    await pool.query(`INSERT INTO rhia.organization (id, name) VALUES ($1, 'Auth HTTP Temporal')`, [organizationId]);
    await bootstrapFirstAdmin(pool, {
      organizationId,
      email,
      displayName: 'Admin HTTP Temporal',
      passwordHash: await hashAdminBootstrapPassword(password),
      traceId: '41000000-0000-4000-8000-000000000002',
    });

    const signIn = async (): Promise<string> => {
      const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200, await response.text());
      const setCookies = response.headers.getSetCookie();
      assert.equal(setCookies.some((value) => /HttpOnly/i.test(value)), true);
      assert.equal(setCookies.some((value) => /SameSite=Strict/i.test(value)), true);
      return setCookies.map((value) => value.split(';', 1)[0]).join('; ');
    };
    const sessionBody = async (cookie: string): Promise<unknown> => {
      const response = await fetch(`${baseUrl}/api/auth/get-session`, { headers: { cookie } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return response.json() as Promise<unknown>;
    };

    const cookie = await signIn();
    const session = await sessionBody(cookie) as { user?: { appUserId?: string; organizationId?: string; roles?: string[] } };
    assert.equal(typeof session.user?.appUserId, 'string');
    assert.equal(session.user?.organizationId, undefined);
    assert.equal(session.user?.roles, undefined);
    const principal = await runtime.authenticate({ headers: {
      cookie,
      'x-rhia-organization-id': 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'x-rhia-roles': 'ROOT',
    } });
    assert.deepEqual(principal, {
      kind: 'HUMAN', id: session.user?.appUserId, organizationId, roles: ['ADMIN'],
    });
    const logout = await fetch(`${baseUrl}/api/auth/sign-out`, {
      method: 'POST', headers: { cookie, origin: baseUrl, 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(logout.status, 200);
    assert.equal(await sessionBody(cookie), null);

    const expiringCookie = await signIn();
    await pool.query(`UPDATE rhia.auth_session SET expires_at=now() - interval '1 second'`);
    assert.equal(await sessionBody(expiringCookie), null);

    const failedSignIn = async (candidateEmail: string): Promise<{ status: number; body: string }> => {
      const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ email: candidateEmail, password: 'Incorrect-Temporary-Password!' }),
      });
      return { status: response.status, body: await response.text() };
    };
    const knownFailure = await failedSignIn(email);
    const unknownFailure = await failedSignIn('unknown.user@example.invalid');
    assert.equal(knownFailure.status, unknownFailure.status);
    assert.equal(knownFailure.body, unknownFailure.body);

    // Dos logins válidos y estos tres fallos completan el máximo configurado de cinco.
    assert.notEqual((await failedSignIn('rate.limit@example.invalid')).status, 429);
    assert.equal((await failedSignIn('rate.limit@example.invalid')).status, 429);

    const sessionAudits = await pool.query<{ action: string; total: string }>(`
      SELECT action, count(*)::text AS total
      FROM rhia.audit_event
      WHERE organization_id=$1 AND action LIKE 'AUTH_%'
      GROUP BY action`, [organizationId]);
    assert.deepEqual(Object.fromEntries(sessionAudits.rows.map((row) => [row.action, row.total])), {
      AUTH_ADMIN_BOOTSTRAPPED: '1',
      AUTH_LOGIN_SUCCEEDED: '2',
      AUTH_SESSION_EXPIRED: '1',
      AUTH_SESSION_REVOKED: '1',
    });
    const securityEvents = await pool.query<{ status: string; total: string }>(`
      SELECT status, count(*)::text AS total
      FROM rhia.system_health_event
      WHERE component='AUTH' AND status IN ('LOGIN_FAILED', 'LOGIN_RATE_LIMITED')
      GROUP BY status`);
    assert.deepEqual(Object.fromEntries(securityEvents.rows.map((row) => [row.status, row.total])), {
      LOGIN_FAILED: '3', LOGIN_RATE_LIMITED: '1',
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});
