import type { RunResult } from './runner.js';

export interface RunnableAgentRuntime {
  runOnce(organizationId: string, workerId: string): Promise<RunResult>;
}

export type WorkerSummary = Readonly<{
  cycles: number;
  claimed: number;
  succeeded: number;
  retried: number;
  deadLettered: number;
  leasesLost: number;
}>;

export async function runAgentWorker(
  runtime: RunnableAgentRuntime,
  config: Readonly<{ organizationId: string; workerId: string; idlePollMs?: number }>,
  signal: AbortSignal,
): Promise<WorkerSummary> {
  const idlePollMs = config.idlePollMs ?? 1_000;
  if (!Number.isSafeInteger(idlePollMs) || idlePollMs < 10 || idlePollMs > 60_000) {
    throw new Error('idlePollMs debe estar entre 10 y 60000.');
  }
  const summary = { cycles: 0, claimed: 0, succeeded: 0, retried: 0, deadLettered: 0, leasesLost: 0 };
  while (!signal.aborted) {
    const result = await runtime.runOnce(config.organizationId, config.workerId);
    summary.cycles += 1;
    if (result.status === 'IDLE') {
      await waitForPoll(idlePollMs, signal);
      continue;
    }
    summary.claimed += 1;
    if (result.status === 'SUCCEEDED') summary.succeeded += 1;
    else if (result.status === 'RETRY_SCHEDULED') summary.retried += 1;
    else if (result.status === 'DEAD_LETTER') summary.deadLettered += 1;
    else summary.leasesLost += 1;
  }
  return summary;
}

const waitForPoll = (milliseconds: number, signal: AbortSignal): Promise<void> => new Promise((resolve) => {
  if (signal.aborted) { resolve(); return; }
  const timer = setTimeout(done, milliseconds);
  function done() { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); }
  signal.addEventListener('abort', done, { once: true });
});
