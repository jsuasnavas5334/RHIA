import { AgentRuntimeStoreError, checkpointInputHash } from './store.js';
import type { ClaimedJob, StepCheckpoint } from './store.js';

export type RuntimeAction = Readonly<{
  capabilityKey: string;
  resourceType: string;
  requestPayload: Readonly<Record<string, unknown>>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}>;

export type RuntimeStepContext = Readonly<{
  claim: ClaimedJob;
  checkpoint: StepCheckpoint;
  actionId?: string;
  idempotencyKey: string;
  signal: AbortSignal;
}>;

export type RuntimeStep = Readonly<{
  key: string;
  input: (job: ClaimedJob) => unknown;
  action?: (job: ClaimedJob) => RuntimeAction;
  execute: (context: RuntimeStepContext) => Promise<Readonly<Record<string, unknown>>>;
}>;

export type RuntimePlan = Readonly<{ jobType: string; steps: readonly RuntimeStep[] }>;

export interface AgentRuntimeStore {
  claim(organizationId: string, workerId: string, leaseMs: number): Promise<ClaimedJob | undefined>;
  renewLease(claim: ClaimedJob, leaseMs: number): Promise<ClaimedJob>;
  beginStep(claim: ClaimedJob, stepKey: string, inputHash: string): Promise<StepCheckpoint>;
  reserveAction(claim: ClaimedJob, checkpointId: string, action: RuntimeAction): Promise<string>;
  completeStep(claim: ClaimedJob, checkpointId: string, output: Readonly<Record<string, unknown>>): Promise<void>;
  finish(claim: ClaimedJob, status: 'SUCCEEDED' | 'PARTIAL'): Promise<void>;
  fail(claim: ClaimedJob, errorCode: string, backoffMs: number): Promise<'RETRY_SCHEDULED' | 'DEAD_LETTER'>;
}

export type RunResult =
  | Readonly<{ status: 'IDLE' }>
  | Readonly<{ status: 'SUCCEEDED'; jobId: string }>
  | Readonly<{ status: 'RETRY_SCHEDULED' | 'DEAD_LETTER'; jobId: string; errorCode: string }>
  | Readonly<{ status: 'LEASE_LOST'; jobId: string }>;

export class AgentRuntime {
  private readonly plans = new Map<string, RuntimePlan>();

  constructor(
    private readonly store: AgentRuntimeStore,
    plans: readonly RuntimePlan[],
    private readonly options: Readonly<{ leaseMs?: number; baseBackoffMs?: number }> = {},
  ) {
    for (const plan of plans) {
      if (this.plans.has(plan.jobType)) throw new Error(`Plan duplicado: ${plan.jobType}`);
      this.plans.set(plan.jobType, plan);
    }
  }

  async runOnce(organizationId: string, workerId: string): Promise<RunResult> {
    const leaseMs = this.options.leaseMs ?? 30_000;
    const claim = await this.store.claim(organizationId, workerId, leaseMs);
    if (!claim) return { status: 'IDLE' };
    const plan = this.plans.get(claim.jobType);
    if (!plan) return this.fail(claim, 'RHIA_JOB_TYPE_UNSUPPORTED');

    const heartbeat = this.startHeartbeat(claim, leaseMs);
    try {
      for (const step of plan.steps) {
        heartbeat.assertActive();
        const checkpoint = await this.store.beginStep(claim, step.key, checkpointInputHash(step.input(claim)));
        if (checkpoint.status === 'SUCCEEDED') continue;
        const actionId = step.action
          ? await this.store.reserveAction(claim, checkpoint.id, step.action(claim))
          : undefined;
        const output = await step.execute({
          claim, checkpoint, ...(actionId ? { actionId } : {}),
          idempotencyKey: checkpoint.id, signal: heartbeat.signal,
        });
        heartbeat.assertActive();
        await this.store.completeStep(claim, checkpoint.id, output);
      }
      heartbeat.assertActive();
      await this.store.finish(claim, 'SUCCEEDED');
      return { status: 'SUCCEEDED', jobId: claim.id };
    } catch (error) {
      if (isLeaseLost(error) || heartbeat.lost()) return { status: 'LEASE_LOST', jobId: claim.id };
      return this.fail(claim, errorCode(error));
    } finally {
      await heartbeat.stop();
    }
  }

  private async fail(claim: ClaimedJob, code: string): Promise<RunResult> {
    const base = this.options.baseBackoffMs ?? 1_000;
    const backoff = Math.min(86_400_000, base * (2 ** Math.min(claim.retryCount, 16)));
    try {
      const status = await this.store.fail(claim, code, backoff);
      return { status, jobId: claim.id, errorCode: code };
    } catch (error) {
      if (isLeaseLost(error)) return { status: 'LEASE_LOST', jobId: claim.id };
      throw error;
    }
  }

  private startHeartbeat(claim: ClaimedJob, leaseMs: number) {
    const controller = new AbortController();
    let lostError: unknown;
    let pending = Promise.resolve();
    const interval = setInterval(() => {
      pending = pending.then(async () => {
        try { await this.store.renewLease(claim, leaseMs); }
        catch (error) { lostError = error; controller.abort(error); }
      });
    }, Math.max(250, Math.floor(leaseMs / 3)));
    interval.unref?.();
    return {
      signal: controller.signal,
      lost: () => lostError !== undefined,
      assertActive: () => { if (lostError !== undefined) throw lostError; },
      stop: async () => { clearInterval(interval); await pending; },
    };
  }
}

const isLeaseLost = (error: unknown): boolean =>
  error instanceof AgentRuntimeStoreError && error.code === 'LEASE_LOST';

const errorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^RHIA_[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(code)) return code;
  }
  return 'RHIA_CORE_UNEXPECTED_FAILURE';
};
