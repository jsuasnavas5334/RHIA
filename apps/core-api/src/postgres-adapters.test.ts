import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import type { Principal } from '@rhia/policy';
import { CompanyGroupService } from './company-service.js';
import { ApprovalService, JobService } from './control-services.js';
import { createPostgresCoreDependencies, PostgresSession } from './postgres-adapters.js';
import { ContactService, OpportunityService } from './record-services.js';

type FakeClient = Readonly<{
  commands: string[];
  released: { value: boolean };
  query: (statement: string) => Promise<{ rows: never[] }>;
  release: () => void;
}>;

const fixture = (): Readonly<{ pool: Pool; client: FakeClient }> => {
  const commands: string[] = [];
  const released = { value: false };
  const client: FakeClient = {
    commands,
    released,
    query: async (statement) => {
      commands.push(statement);
      return { rows: [] };
    },
    release: () => { released.value = true; },
  };
  const pool = {
    connect: async () => client,
    query: async (statement: string) => {
      commands.push(`POOL:${statement}`);
      return { rows: [] };
    },
  } as unknown as Pool;
  return { pool, client };
};

test('PostgresSession confirma todas las escrituras sobre un único cliente', async () => {
  const { pool, client } = fixture();
  const session = new PostgresSession(pool);

  const result = await session.execute(async () => {
    await session.query('INSERT resource');
    await session.query('INSERT audit');
    await session.query('INSERT idempotency');
    return 'ok';
  });

  assert.equal(result, 'ok');
  assert.deepEqual(client.commands, ['BEGIN', 'INSERT resource', 'INSERT audit', 'INSERT idempotency', 'COMMIT']);
  assert.equal(client.released.value, true);
});

test('PostgresSession revierte la transacción completa ante un fallo intermedio', async () => {
  const { pool, client } = fixture();
  const session = new PostgresSession(pool);

  await assert.rejects(session.execute(async () => {
    await session.query('INSERT resource');
    throw new Error('audit failed');
  }), /audit failed/);

  assert.deepEqual(client.commands, ['BEGIN', 'INSERT resource', 'ROLLBACK']);
  assert.equal(client.released.value, true);
});

test('PostgresSession une unidades anidadas a la transacción existente', async () => {
  const { pool, client } = fixture();
  const session = new PostgresSession(pool);

  await session.execute(async () => session.execute(async () => {
    await session.query('INSERT nested');
  }));

  assert.deepEqual(client.commands, ['BEGIN', 'INSERT nested', 'COMMIT']);
});

const integrationUrl = process.env['RHIA_TEST_DATABASE_URL'];
test('PostgreSQL real revierte recurso, audit y ledger como una unidad', { skip: !integrationUrl }, async () => {
  const pool = new Pool({ connectionString: integrationUrl });
  const organizationId = '00000000-0000-4000-8000-000000000001';
  const resourceId = '31000000-0000-4000-8000-000000000001';
  const auditId = '31000000-0000-4000-8000-000000000002';
  const principal: Principal = {
    kind: 'HUMAN', id: '31000000-0000-4000-8000-000000000003', organizationId, roles: ['MANAGER'],
  };
  const ids = [resourceId, auditId];
  const dependencies = createPostgresCoreDependencies(pool, {
    newId: () => ids.shift() ?? '31000000-0000-4000-8000-000000000099',
    now: () => new Date('2026-08-21T20:00:00.000Z'),
  });
  const service = new CompanyGroupService({
    ...dependencies,
    audit: { append: async () => { throw new Error('forced audit failure'); } },
  });
  try {
    await assert.rejects(service.create(principal, {
      canonicalName: 'Rollback Core API', idempotencyKey: 'integration:rollback:001',
    }, '31000000-0000-4000-8000-000000000004'), /forced audit failure/);
    const state = await pool.query<{ resources: string; audits: string; ledger: string }>(`SELECT
      (SELECT count(*) FROM rhia.company_group WHERE id=$1)::text AS resources,
      (SELECT count(*) FROM rhia.audit_event WHERE resource_id=$1)::text AS audits,
      (SELECT count(*) FROM rhia.core_idempotency WHERE resource_id=$1)::text AS ledger`, [resourceId]);
    assert.deepEqual(state.rows[0], { resources: '0', audits: '0', ledger: '0' });
  } finally {
    await pool.end();
  }
});

test('PostgreSQL real persiste y aísla el ciclo Core completo', { skip: !integrationUrl }, async () => {
  const pool = new Pool({ connectionString: integrationUrl });
  const organizationId = '00000000-0000-4000-8000-000000000001';
  const companyId = '32000000-0000-4000-8000-000000000001';
  const contactId = '32000000-0000-4000-8000-000000000003';
  const opportunityId = '32000000-0000-4000-8000-000000000005';
  const jobId = '32000000-0000-4000-8000-000000000007';
  const approvalId = '32000000-0000-4000-8000-000000000009';
  const requestCorrelationId = '33000000-0000-4000-8000-000000000001';
  const agent: Principal = {
    kind: 'SERVICE', id: '00000000-0000-4000-8000-000000000003', organizationId,
    service: 'AGENT_SERVICE', capabilities: ['records.read', 'records.write', 'jobs.execute', 'approvals.request'],
  };
  const manager: Principal = {
    kind: 'HUMAN', id: '20000000-0000-4000-8000-000000000002', organizationId, roles: ['MANAGER'],
  };
  const otherManager: Principal = {
    kind: 'HUMAN', id: '20000000-0000-4000-8000-000000000003',
    organizationId: '20000000-0000-4000-8000-000000000001', roles: ['MANAGER'],
  };
  const ids = [
    companyId, '32000000-0000-4000-8000-000000000002',
    contactId, '32000000-0000-4000-8000-000000000004',
    opportunityId, '32000000-0000-4000-8000-000000000006',
    jobId, '32000000-0000-4000-8000-000000000008',
    approvalId, '32000000-0000-4000-8000-000000000010',
    '32000000-0000-4000-8000-000000000011',
  ];
  const dependencies = createPostgresCoreDependencies(pool, {
    newId: () => ids.shift() ?? '32000000-0000-4000-8000-000000000099',
    now: () => new Date('2026-08-21T21:00:00.000Z'),
  });
  const companies = new CompanyGroupService(dependencies);
  const contacts = new ContactService(dependencies);
  const opportunities = new OpportunityService(dependencies);
  const jobs = new JobService(dependencies);
  const approvals = new ApprovalService(dependencies);
  try {
    const company = await companies.create(agent, {
      canonicalName: 'Core PostgreSQL Integration', websiteRoot: 'https://example.invalid', idempotencyKey: 'integration:company:001',
    }, '33000000-0000-4000-8000-000000000002');
    const replay = await companies.create(agent, {
      canonicalName: 'Core PostgreSQL Integration', websiteRoot: 'https://example.invalid', idempotencyKey: 'integration:company:001',
    }, '33000000-0000-4000-8000-000000000002');
    assert.equal(company.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(replay.company.id, companyId);

    await contacts.create(agent, {
      companyGroupId: companyId, fullName: 'Contacto Integración', countryCode: 'EC', idempotencyKey: 'integration:contact:001',
    }, '33000000-0000-4000-8000-000000000003');
    await opportunities.create(agent, {
      companyGroupId: companyId, marketCountry: 'EC', marketCity: 'Quito', idempotencyKey: 'integration:opportunity:001',
    }, '33000000-0000-4000-8000-000000000004');
    await jobs.create(agent, {
      jobType: 'RESOLVE_ENTITY',
      input: { companyMentioned: 'Core PostgreSQL Integration', resolutionQueries: ['Core PostgreSQL Integration Ecuador'] },
      priority: 70, idempotencyKey: 'integration:job:001',
    }, '33000000-0000-4000-8000-000000000005');
    const requested = await approvals.create(agent, {
      jobId, action: 'BINDING_COMMITMENT', reasonCode: 'RHIA_APPROVAL_INTEGRATION',
      summary: 'Validación transaccional sin ejecutar compromiso', targetRef: opportunityId,
      idempotencyKey: 'integration:approval:001',
    }, requestCorrelationId);
    assert.equal(requested.approval.correlationId, requestCorrelationId);
    const decided = await approvals.decide(manager, approvalId, {
      decision: 'APPROVED', reason: 'Prueba humana controlada', idempotencyKey: 'integration:approval:decision:001',
    }, '33000000-0000-4000-8000-000000000006');
    assert.equal(decided.approval.status, 'APPROVED');

    assert.equal((await companies.list(agent)).some((value) => value.id === companyId), true);
    assert.equal((await contacts.list(agent)).some((value) => value.id === contactId), true);
    assert.equal((await opportunities.list(agent)).some((value) => value.id === opportunityId), true);
    assert.equal((await jobs.list(agent)).some((value) => value.id === jobId), true);
    const listedApprovals = await approvals.list(manager);
    assert.equal(listedApprovals.some((value) => value.id === approvalId && value.status === 'APPROVED'), true);
    assert.equal((await companies.list(otherManager)).some((value) => value.id === companyId), false);

    const state = await pool.query<{ resources: string; audits: string; ledger: string; controls: string }>(`SELECT
      ((SELECT count(*) FROM rhia.company_group WHERE id=$1) + (SELECT count(*) FROM rhia.contact WHERE id=$2) +
       (SELECT count(*) FROM rhia.opportunity WHERE id=$3) + (SELECT count(*) FROM rhia.job WHERE id=$4) +
       (SELECT count(*) FROM rhia.approval WHERE id=$5))::text AS resources,
      (SELECT count(*) FROM rhia.audit_event WHERE resource_id IN ($1,$2,$3,$4,$5))::text AS audits,
      (SELECT count(*) FROM rhia.core_idempotency WHERE resource_id IN ($1,$2,$3,$4,$5))::text AS ledger,
      (SELECT count(*) FROM rhia.approval approval JOIN rhia.action action ON action.id=approval.action_id
       JOIN rhia.execution execution ON execution.id=action.execution_id
       WHERE approval.id=$5 AND approval.correlation_id=$6 AND execution.trace_id=$6)::text AS controls`,
    [companyId, contactId, opportunityId, jobId, approvalId, requestCorrelationId]);
    assert.deepEqual(state.rows[0], { resources: '5', audits: '6', ledger: '6', controls: '1' });
  } finally {
    await pool.end();
  }
});
