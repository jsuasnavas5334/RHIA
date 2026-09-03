import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { AgentRuntimeStoreError, PostgresAgentRuntimeStore, checkpointInputHash } from './store.js';

test('rechaza claims y checkpoints inválidos antes de consultar PostgreSQL', async () => {
  const store = new PostgresAgentRuntimeStore({} as Pool);
  await assert.rejects(store.claim('tenant-inválido', 'worker-1'),
    (error: unknown) => error instanceof AgentRuntimeStoreError && error.code === 'INVALID_INPUT');
  const invalidClaim = {
    id: randomUUID(), organizationId: randomUUID(), executionId: randomUUID(), attempt: 1,
    jobType: 'RESOLVE_ENTITY', input: {}, retryCount: 0, leaseToken: randomUUID(),
    leaseOwner: 'worker-1', leaseExpiresAt: new Date().toISOString(),
  } as const;
  await assert.rejects(store.beginStep(invalidClaim, 'step inválido', 'no-hash'), /Step key o input hash inválido/);
  assert.match(checkpointInputHash({ stable: true }), /^[0-9a-f]{64}$/);
});

const integrationUrl = process.env['RHIA_TEST_DATABASE_URL'];
test('claim concurrente, crash, checkpoint y retry sobreviven en PostgreSQL', { skip: !integrationUrl }, async () => {
  const pool = new Pool({ connectionString: integrationUrl, options: '-c search_path=rhia,public' });
  const organizationId = randomUUID();
  const jobId = randomUUID();
  let clock = new Date('2026-08-22T06:00:00.000Z');
  const store = new PostgresAgentRuntimeStore(pool, () => new Date(clock), randomUUID);
  try {
    await pool.query('INSERT INTO rhia.organization (id, name) VALUES ($1, $2)', [organizationId, 'Agent Runtime E2E']);
    await pool.query(`INSERT INTO rhia.job
      (id, organization_id, job_type, input, status, priority, idempotency_key)
      VALUES ($1,$2,'RESOLVE_ENTITY',$3::jsonb,'PENDING',80,$4)`,
    [jobId, organizationId, JSON.stringify({ companyMentioned: 'Runtime E2E', resolutionQueries: ['Runtime E2E'] }), `runtime:${randomUUID()}`]);

    const [first, competing] = await Promise.all([
      store.claim(organizationId, 'worker-a', 10_000),
      store.claim(organizationId, 'worker-b', 10_000),
    ]);
    const claim = first ?? competing;
    assert.ok(claim);
    assert.equal([first, competing].filter(Boolean).length, 1);
    assert.equal(claim.attempt, 1);

    const inputHash = checkpointInputHash({ query: 'Runtime E2E' });
    const checkpoint = await store.beginStep(claim, 'resolve-entity', inputHash);
    const actionRequest = {
      capabilityKey: 'records.read', resourceType: 'COMPANY', requestPayload: { query: 'Runtime E2E' }, riskLevel: 'LOW',
    } as const;
    const actionId = await store.reserveAction(claim, checkpoint.id, actionRequest);
    assert.equal(await store.reserveAction(claim, checkpoint.id, actionRequest), actionId);
    await store.completeStep(claim, checkpoint.id, { candidateCount: 1 });

    clock = new Date('2026-08-22T06:00:11.000Z');
    const recovered = await store.claim(organizationId, 'worker-recovery', 10_000);
    assert.ok(recovered);
    assert.equal(recovered.attempt, 2);
    assert.equal(recovered.retryCount, 1);
    const reused = await store.beginStep(recovered, 'resolve-entity', inputHash);
    assert.equal(reused.id, checkpoint.id);
    assert.equal(reused.status, 'SUCCEEDED');
    assert.equal(reused.actionId, actionId);
    assert.deepEqual(reused.outputSummary, { candidateCount: 1 });

    const secondStep = await store.beginStep(recovered, 'persist-result', checkpointInputHash({ result: 1 }));
    assert.equal(secondStep.status, 'STARTED');
    assert.equal(await store.fail(recovered, 'RHIA_WORKFLOW_TIMEOUT', 0), 'RETRY_SCHEDULED');

    const third = await store.claim(organizationId, 'worker-third', 10_000);
    assert.ok(third);
    assert.equal(third.retryCount, 2);
    assert.equal(await store.fail(third, 'RHIA_WORKFLOW_TIMEOUT', 0), 'RETRY_SCHEDULED');
    const fourth = await store.claim(organizationId, 'worker-fourth', 10_000);
    assert.ok(fourth);
    assert.equal(fourth.retryCount, 3);
    assert.equal(await store.fail(fourth, 'RHIA_WORKFLOW_TIMEOUT', 0), 'DEAD_LETTER');

    const state = await pool.query(`SELECT job.status, job.retry_count,
        (SELECT count(*)::int FROM rhia.execution WHERE job_id=job.id) AS executions,
        (SELECT count(*)::int FROM rhia.job_step_checkpoint WHERE job_id=job.id) AS checkpoints,
        (SELECT count(*)::int FROM rhia.action action JOIN rhia.execution execution ON execution.id=action.execution_id
          WHERE execution.job_id=job.id AND action.id=$2) AS stable_actions
      FROM rhia.job job WHERE job.id=$1`, [jobId, actionId]);
    assert.deepEqual(state.rows[0], { status: 'DEAD_LETTER', retry_count: 3, executions: 4, checkpoints: 2, stable_actions: 1 });
    assert.equal(await store.claim(organizationId, 'worker-after-dead-letter', 10_000), undefined);
  } finally {
    await pool.end();
  }
});

test('un proceso terminado a mitad del step se recupera en PostgreSQL sin duplicar action', { skip: !integrationUrl }, async () => {
  const pool = new Pool({ connectionString: integrationUrl, options: '-c search_path=rhia,public' });
  const organizationId = randomUUID();
  const jobId = randomUUID();
  try {
    await pool.query('INSERT INTO rhia.organization (id, name) VALUES ($1, $2)', [organizationId, 'Agent Kill E2E']);
    await pool.query(`INSERT INTO rhia.job
      (id, organization_id, job_type, input, status, priority, idempotency_key)
      VALUES ($1,$2,'RESOLVE_ENTITY','{}'::jsonb,'PENDING',90,$3)`,
    [jobId, organizationId, `kill:${randomUUID()}`]);

    const child = spawn(process.execPath, [fileURLToPath(new URL('./kill-worker-fixture.js', import.meta.url))], {
      env: { ...process.env, RHIA_TEST_DATABASE_URL: integrationUrl, RHIA_KILL_TEST_ORGANIZATION_ID: organizationId },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const ready = await waitForReady(child);
    assert.equal(child.kill('SIGKILL'), true);
    await new Promise<void>((resolve, reject) => {
      child.once('exit', () => resolve()); child.once('error', reject);
    });
    await new Promise((resolve) => setTimeout(resolve, 1_200));

    const recoveryStore = new PostgresAgentRuntimeStore(pool);
    const recovered = await recoveryStore.claim(organizationId, 'worker-after-process-kill', 10_000);
    assert.ok(recovered);
    assert.equal(recovered.attempt, 2);
    const checkpoint = await recoveryStore.beginStep(recovered, 'process-kill-step', checkpointInputHash({ stable: true }));
    assert.equal(checkpoint.id, ready.checkpointId);
    const actionId = await recoveryStore.reserveAction(recovered, checkpoint.id, {
      capabilityKey: 'records.read', resourceType: 'COMPANY', requestPayload: { recovered: true }, riskLevel: 'LOW',
    });
    assert.equal(actionId, ready.actionId);
    await recoveryStore.completeStep(recovered, checkpoint.id, { recovered: true });
    await recoveryStore.finish(recovered, 'SUCCEEDED');
    const state = await pool.query(`SELECT job.status,
      (SELECT count(*)::int FROM rhia.execution WHERE job_id=job.id) executions,
      (SELECT count(*)::int FROM rhia.job_step_checkpoint WHERE job_id=job.id) checkpoints,
      (SELECT count(*)::int FROM rhia.action action JOIN rhia.execution execution ON execution.id=action.execution_id
        WHERE execution.job_id=job.id) actions FROM rhia.job job WHERE job.id=$1`, [jobId]);
    assert.deepEqual(state.rows[0], { status: 'SUCCEEDED', executions: 2, checkpoints: 1, actions: 1 });
  } finally {
    await pool.end();
  }
});

const waitForReady = (child: ReturnType<typeof spawn>): Promise<{ checkpointId: string; actionId: string }> =>
  new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => reject(new Error(`Timeout esperando fixture. ${stderr}`)), 10_000);
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      const line = stdout.split(/\r?\n/).find((value) => value.includes('ready_to_kill'));
      if (!line) return;
      clearTimeout(timeout);
      try { resolve(JSON.parse(line) as { checkpointId: string; actionId: string }); }
      catch (error) { reject(error); }
    });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => {
      if (!stdout.includes('ready_to_kill')) { clearTimeout(timeout); reject(new Error(`Fixture terminó (${code}). ${stderr}`)); }
    });
  });
