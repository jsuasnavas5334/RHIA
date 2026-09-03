import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  bootstrapFirstAdmin, createRhiaAuthRuntime, hashAdminBootstrapPassword,
} from '../apps/auth/dist/index.js';
import {
  createCoreHttpServer, createPostgresCoreRuntime,
} from '../apps/core-api/dist/index.js';
import { RhiaCoreClient } from '../apps/web/dist/core-client.js';

const databaseUrl = process.env['RHIA_TEST_DATABASE_URL'];
if (!databaseUrl) throw new Error('Falta RHIA_TEST_DATABASE_URL para el E2E de Operations Center.');

const organizationId = '00000000-0000-4000-8000-000000000001';
const agentId = '00000000-0000-4000-8000-000000000003';
const email = 'operations.e2e@example.invalid';
const password = 'Operations-E2E-Temporary-0001!';
const pool = new Pool({ connectionString: databaseUrl, options: '-c search_path=rhia,public' });
const authServer = createServer();
let coreServer;

const closeServer = async (server) => {
  if (!server?.listening) return;
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
};

try {
  const bootstrap = await bootstrapFirstAdmin(pool, {
    organizationId,
    email,
    displayName: 'Operations E2E Admin',
    passwordHash: await hashAdminBootstrapPassword(password),
    traceId: randomUUID(),
  });
  const core = createPostgresCoreRuntime(pool);
  const agent = {
    kind: 'SERVICE', id: agentId, organizationId, service: 'AGENT_SERVICE',
    capabilities: ['records.read', 'records.write', 'jobs.execute', 'approvals.request'],
  };
  const job = await core.jobs.create(agent, {
    jobType: 'RESOLVE_ENTITY',
    input: { companyMentioned: 'Operations E2E', resolutionQueries: ['Operations E2E Ecuador'] },
    priority: 70,
    idempotencyKey: `operations:e2e:job:${randomUUID()}`,
  }, randomUUID());
  const approval = await core.approvals.create(agent, {
    jobId: job.job.id,
    action: 'GRANT_DISCOUNT',
    reasonCode: 'RHIA_APPROVAL_DISCOUNT',
    summary: 'Descuento E2E bloqueado hasta decisión humana',
    targetRef: randomUUID(),
    idempotencyKey: `operations:e2e:approval:${randomUUID()}`,
  }, randomUUID());

  authServer.listen(0, '127.0.0.1');
  await once(authServer, 'listening');
  const authAddress = authServer.address();
  assert.ok(authAddress && typeof authAddress === 'object');
  const authOrigin = `http://127.0.0.1:${authAddress.port}`;
  const auth = createRhiaAuthRuntime(pool, {
    baseUrl: authOrigin,
    production: false,
    secret: 'operations-e2e-only-not-a-real-secret-0001',
  });
  authServer.on('request', auth.handler);

  coreServer = createCoreHttpServer(core.api, { authenticate: auth.authenticate });
  coreServer.listen(0, '127.0.0.1');
  await once(coreServer, 'listening');
  const coreAddress = coreServer.address();
  assert.ok(coreAddress && typeof coreAddress === 'object');
  const client = new RhiaCoreClient(`http://127.0.0.1:${coreAddress.port}`);

  const signIn = await fetch(`${authOrigin}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: authOrigin, 'x-rhia-peer-ip': '203.0.113.50' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(signIn.status, 200, await signIn.text());
  const cookie = signIn.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; ');
  assert.match(cookie, /^rhia\.session_token=/);

  assert.deepEqual(await client.getSession(cookie), { roles: ['ADMIN'] });
  const pending = await client.listApprovals(cookie);
  assert.equal(pending.some((item) => item.id === approval.approval.id && item.status === 'PENDING'), true);
  await client.decideApproval(cookie, approval.approval.id, 'APPROVED', 'Validación humana E2E');
  const decided = await client.listApprovals(cookie);
  assert.equal(decided.some((item) => item.id === approval.approval.id && item.status === 'APPROVED'), true);

  const persisted = await pool.query(`SELECT approval.status, approval.approver_user_id,
      count(audit.id)::int AS audits
    FROM rhia.approval approval
    LEFT JOIN rhia.audit_event audit ON audit.resource_id=approval.id AND audit.action='APPROVAL_DECIDED'
    WHERE approval.id=$1
    GROUP BY approval.status, approval.approver_user_id`, [approval.approval.id]);
  assert.deepEqual(persisted.rows[0], { status: 'APPROVED', approver_user_id: bootstrap.appUserId, audits: 1 });
  process.stdout.write(JSON.stringify({
    status: 'PASS', flow: 'Auth cookie -> App client -> Core policy -> PostgreSQL',
    approvalId: approval.approval.id,
  }));
} finally {
  await closeServer(coreServer);
  await closeServer(authServer);
  await pool.end();
}
