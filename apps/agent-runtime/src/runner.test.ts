import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRuntime, AgentRuntimeStoreError, checkpointInputHash } from './index.js';
import type { AgentRuntimeStore, ClaimedJob, RuntimeAction, StepCheckpoint } from './index.js';

const claim: ClaimedJob = {
  id: '10000000-0000-4000-8000-000000000001',
  organizationId: '10000000-0000-4000-8000-000000000002',
  executionId: '10000000-0000-4000-8000-000000000003',
  attempt: 1, jobType: 'TEST_JOB', input: { value: 7 }, retryCount: 0,
  leaseToken: '10000000-0000-4000-8000-000000000004', leaseOwner: 'worker-1',
  leaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
};

class FakeStore implements AgentRuntimeStore {
  readonly calls: string[] = [];
  checkpointStatus: StepCheckpoint['status'] = 'STARTED';
  failStatus: 'RETRY_SCHEDULED' | 'DEAD_LETTER' = 'RETRY_SCHEDULED';
  renewError?: Error;
  async claim() { this.calls.push('claim'); return claim; }
  async renewLease() {
    this.calls.push('renew');
    if (this.renewError) throw this.renewError;
    return claim;
  }
  async beginStep(_claim: ClaimedJob, key: string, hash: string) {
    this.calls.push(`begin:${key}:${hash}`);
    return { id: '10000000-0000-4000-8000-000000000005', jobId: claim.id,
      executionId: claim.executionId, stepKey: key, status: this.checkpointStatus, inputHash: hash } as const;
  }
  async reserveAction(_claim: ClaimedJob, checkpointId: string, _action: RuntimeAction) {
    this.calls.push(`action:${checkpointId}`); return '10000000-0000-4000-8000-000000000006';
  }
  async completeStep(_claim: ClaimedJob, checkpointId: string) { this.calls.push(`complete:${checkpointId}`); }
  async finish() { this.calls.push('finish'); }
  async fail(_claim: ClaimedJob, code: string, backoff: number) {
    this.calls.push(`fail:${code}:${backoff}`); return this.failStatus;
  }
}

const plan = (execute: () => Promise<Readonly<Record<string, unknown>>>) => [{
  jobType: 'TEST_JOB', steps: [{ key: 'step-1', input: () => ({ value: 7 }),
    action: () => ({ capabilityKey: 'test.run', resourceType: 'test', requestPayload: {}, riskLevel: 'LOW' as const }),
    execute }],
}];

test('ejecuta plan, propaga idempotencia y finaliza el job', async () => {
  const store = new FakeStore();
  let executed = 0;
  const runtime = new AgentRuntime(store, [{ jobType: 'TEST_JOB', steps: [{
    key: 'step-1', input: () => ({ value: 7 }),
    execute: async ({ idempotencyKey }) => { executed += 1; assert.equal(idempotencyKey, '10000000-0000-4000-8000-000000000005'); return { ok: true }; },
  }]}]);
  assert.deepEqual(await runtime.runOnce(claim.organizationId, 'worker-1'), { status: 'SUCCEEDED', jobId: claim.id });
  assert.equal(executed, 1);
  assert.deepEqual(store.calls, ['claim', `begin:step-1:${checkpointInputHash({ value: 7 })}`,
    'complete:10000000-0000-4000-8000-000000000005', 'finish']);
});

test('omite checkpoints completados sin repetir efectos', async () => {
  const store = new FakeStore(); store.checkpointStatus = 'SUCCEEDED';
  let executed = false;
  const runtime = new AgentRuntime(store, plan(async () => { executed = true; return {}; }));
  assert.equal((await runtime.runOnce(claim.organizationId, 'worker-1')).status, 'SUCCEEDED');
  assert.equal(executed, false);
  assert.equal(store.calls.some((call) => call.startsWith('action:')), false);
});

test('programa retry exponencial con código de error seguro', async () => {
  const store = new FakeStore();
  const runtime = new AgentRuntime(store, plan(async () => { throw Object.assign(new Error('temporal'), { code: 'RHIA_PROVIDER_TIMEOUT' }); }), { baseBackoffMs: 200 });
  assert.deepEqual(await runtime.runOnce(claim.organizationId, 'worker-1'),
    { status: 'RETRY_SCHEDULED', jobId: claim.id, errorCode: 'RHIA_PROVIDER_TIMEOUT' });
  assert.equal(store.calls.at(-1), 'fail:RHIA_PROVIDER_TIMEOUT:200');
});

test('heartbeat perdido aborta y nunca marca fallo con lease ajeno', async () => {
  const store = new FakeStore();
  store.renewError = new AgentRuntimeStoreError('LEASE_LOST', 'tomado por otro worker');
  const runtime = new AgentRuntime(store, plan(async () => {
    await new Promise((resolve) => setTimeout(resolve, 320)); return { late: true };
  }), { leaseMs: 300 });
  assert.deepEqual(await runtime.runOnce(claim.organizationId, 'worker-1'), { status: 'LEASE_LOST', jobId: claim.id });
  assert.equal(store.calls.includes('renew'), true);
  assert.equal(store.calls.some((call) => call.startsWith('fail:')), false);
  assert.equal(store.calls.includes('finish'), false);
});
