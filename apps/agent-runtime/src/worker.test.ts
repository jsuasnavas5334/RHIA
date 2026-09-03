import assert from 'node:assert/strict';
import test from 'node:test';
import { runAgentWorker } from './worker.js';
import type { RunResult } from './runner.js';

test('shutdown durante idle sale de inmediato sin reclamar otro job', async () => {
  const controller = new AbortController();
  let calls = 0;
  const runtime = { runOnce: async (): Promise<RunResult> => { calls += 1; return { status: 'IDLE' }; } };
  const running = runAgentWorker(runtime, { organizationId: 'org', workerId: 'worker', idlePollMs: 60_000 }, controller.signal);
  await new Promise((resolve) => setTimeout(resolve, 10));
  controller.abort();
  assert.deepEqual(await running, { cycles: 1, claimed: 0, succeeded: 0, retried: 0, deadLettered: 0, leasesLost: 0 });
  assert.equal(calls, 1);
});

test('shutdown cooperativo termina el job actual y no inicia el siguiente', async () => {
  const controller = new AbortController();
  let release!: () => void;
  const job = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const runtime = { runOnce: async (): Promise<RunResult> => {
    calls += 1; await job; return { status: 'SUCCEEDED', jobId: 'job-1' };
  } };
  const running = runAgentWorker(runtime, { organizationId: 'org', workerId: 'worker' }, controller.signal);
  await new Promise((resolve) => setTimeout(resolve, 10));
  controller.abort(); release();
  assert.deepEqual(await running, { cycles: 1, claimed: 1, succeeded: 1, retried: 0, deadLettered: 0, leasesLost: 0 });
  assert.equal(calls, 1);
});
