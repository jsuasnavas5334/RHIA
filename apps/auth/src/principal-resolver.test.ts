import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { AuthenticationRequiredError, PostgresPrincipalResolver, createSessionPrincipalAuthenticator } from './principal-resolver.js';

const future = (): string => new Date(Date.now() + 60_000).toISOString();

test('resuelve tenant y roles exclusivamente desde PostgreSQL', async () => {
  const userId = '50000000-0000-4000-8000-000000000001';
  const calls: unknown[][] = [];
  const pool = {
    query: async (_sql: string, values: unknown[]) => {
      calls.push(values);
      return { rows: [{ id: userId, organization_id: 'org-db', status: 'ACTIVE', roles: ['ADMIN', 'VIEWER'] }] };
    },
  } as unknown as Pool;
  const resolver = new PostgresPrincipalResolver(pool);
  const auth = {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        assert.equal(headers.get('cookie'), 'rhia.session=abc');
        return {
          session: { expiresAt: future(), organizationId: 'org-untrusted' },
          user: { appUserId: userId, roles: ['ADMIN'], organizationId: 'org-untrusted' },
        };
      },
    },
  };

  const authenticate = createSessionPrincipalAuthenticator(auth, resolver);
  const principal = await authenticate({ headers: { cookie: 'rhia.session=abc' } });

  assert.deepEqual(principal, {
    kind: 'HUMAN', id: userId, organizationId: 'org-db', roles: ['ADMIN', 'VIEWER'],
  });
  assert.deepEqual(calls, [[userId]]);
});

test('rechaza usuario inactivo, sin roles o con rol fuera de la política', async () => {
  const userId = '50000000-0000-4000-8000-000000000002';
  for (const row of [
    { id: userId, organization_id: 'o', status: 'INACTIVE', roles: ['ADMIN'] },
    { id: userId, organization_id: 'o', status: 'ACTIVE', roles: [] },
    { id: userId, organization_id: 'o', status: 'ACTIVE', roles: ['ROOT'] },
  ]) {
    const pool = { query: async () => ({ rows: [row] }) } as unknown as Pool;
    assert.equal(await new PostgresPrincipalResolver(pool).resolve(userId), undefined);
  }
});

test('no consulta permisos si la sesión falta, expiró o no está vinculada', async () => {
  let queries = 0;
  const pool = { query: async () => { queries += 1; return { rows: [] }; } } as unknown as Pool;
  const resolver = new PostgresPrincipalResolver(pool);
  const cases: unknown[] = [
    null,
    { session: { expiresAt: new Date(Date.now() - 1_000) }, user: { appUserId: '50000000-0000-4000-8000-000000000003' } },
    { session: { expiresAt: future() }, user: {} },
    { session: { expiresAt: future() }, user: { appUserId: 'not-a-uuid' } },
  ];
  for (const session of cases) {
    const auth = { api: { getSession: async () => session } };
    const authenticate = createSessionPrincipalAuthenticator(auth, resolver);
    await assert.rejects(authenticate({ headers: {} }), AuthenticationRequiredError);
  }
  assert.equal(queries, 0);
});
