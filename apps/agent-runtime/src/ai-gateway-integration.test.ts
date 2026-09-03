import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRuntime } from './index.js';
import type { AgentRuntimeStore, ClaimedJob, RuntimeAction, StepCheckpoint } from './index.js';
import {
  AiGateway,
  FakeTransport,
  createOpenAiAdapter,
  createAnthropicAdapter,
} from '@rhia/ai-gateway';
import {
  ModelRouter,
  InMemoryBudgetLedger,
  type Clock,
} from '@rhia/model-router';
import type { ModelProfile, TaskClassPolicy } from '@rhia/model-router';

/**
 * PH05-T004-ish / GATE-03 wiring test.
 *
 * Objetivo: probar que apps/agent-runtime puede ejecutar un job real usando
 * @rhia/ai-gateway + @rhia/model-router de punta a punta (claim -> step ->
 * ModelRouter.route() -> AiGateway.invoke() -> completeStep -> finish),
 * sin depender de PostgreSQL real (usa FakeStore, igual que runner.test.ts)
 * ni de red real (usa FakeTransport, igual que los tests de ai-gateway y
 * model-router).
 *
 * Esto cierra el hueco de "wiring" documentado en docs/progress/GATE-03.md:
 * antes de este archivo, apps/agent-runtime no importaba @rhia/ai-gateway
 * ni @rhia/model-router en ningún punto del código ni de los tests.
 */

const FIXED_CLOCK: Clock = { now: () => new Date('2026-09-01T10:00:00Z') };

/**
 * Error de dominio para el paso de IA: el runtime clasifica el `code` de
 * cualquier error lanzado dentro de step.execute() contra el patrón
 * RHIA_<DOMINIO>_<CONDICIÓN> (ver runner.ts::errorCode) para decidir el
 * error_code que persiste en rhia.job/rhia.execution. No reutilizamos
 * AgentRuntimeStoreError aquí porque su `code` es una unión cerrada
 * ('INVALID_INPUT' | 'LEASE_LOST' | 'INVALID_DATABASE_STATE') propia del
 * store, no del dominio de IA.
 */
class RhiaAiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'RhiaAiError';
  }
}

const claim: ClaimedJob = {
  id: '20000000-0000-4000-8000-000000000001',
  organizationId: '20000000-0000-4000-8000-000000000002',
  executionId: '20000000-0000-4000-8000-000000000003',
  attempt: 1,
  jobType: 'AI_CLASSIFY_LEAD',
  input: { leadText: 'Hola, quisiera cotizar 50 licencias' },
  retryCount: 0,
  leaseToken: '20000000-0000-4000-8000-000000000004',
  leaseOwner: 'worker-ai-1',
  leaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
};

class FakeStore implements AgentRuntimeStore {
  readonly calls: string[] = [];
  checkpointStatus: StepCheckpoint['status'] = 'STARTED';

  async claim() {
    this.calls.push('claim');
    return claim;
  }
  async renewLease() {
    this.calls.push('renew');
    return claim;
  }
  async beginStep(_claim: ClaimedJob, key: string, hash: string) {
    this.calls.push(`begin:${key}:${hash}`);
    return {
      id: '20000000-0000-4000-8000-000000000005',
      jobId: claim.id,
      executionId: claim.executionId,
      stepKey: key,
      status: this.checkpointStatus,
      inputHash: hash,
    } as const;
  }
  async reserveAction(_claim: ClaimedJob, checkpointId: string, _action: RuntimeAction) {
    this.calls.push(`action:${checkpointId}`);
    return '20000000-0000-4000-8000-000000000006';
  }
  async completeStep(_claim: ClaimedJob, checkpointId: string, output: Readonly<Record<string, unknown>>) {
    this.calls.push(`complete:${checkpointId}:${JSON.stringify(output)}`);
  }
  async finish() {
    this.calls.push('finish');
  }
  async fail(_claim: ClaimedJob, code: string, backoff: number) {
    this.calls.push(`fail:${code}:${backoff}`);
    return 'RETRY_SCHEDULED' as const;
  }
}

function routerFixtures() {
  const economy: ModelProfile = {
    provider: 'openai',
    model: 'gpt-5-mini',
    tier: 'economy',
    qualityScore: 0.8,
    estCostPerTaskUsd: 0.01,
    maxLatencyMsP95: 3000,
    dataResidency: 'any',
  };
  const premium: ModelProfile = {
    provider: 'anthropic',
    model: 'claude-premium',
    tier: 'premium',
    qualityScore: 0.95,
    estCostPerTaskUsd: 0.05,
    maxLatencyMsP95: 3000,
    dataResidency: 'any',
  };
  const policy: TaskClassPolicy = {
    taskClassId: 'clasificacion-lead',
    minQualityScore: 0,
    minConfidence: 0.8,
    requiresLocalOnly: false,
    candidateTiers: [[economy], [premium]],
  };
  return { economy, premium, policy };
}

test('agent-runtime + model-router + ai-gateway: un job real invoca el router y completa el checkpoint con la decisión', async () => {
  const { policy } = routerFixtures();

  const transport = new FakeTransport([
    {
      kind: 'respond',
      status: 200,
      body: {
        choices: [
          { message: { role: 'assistant', content: 'lead calificado: alta prioridad' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
      },
    },
  ]);
  const gateway = new AiGateway([createOpenAiAdapter(), createAnthropicAdapter()], transport);
  const ledger = new InMemoryBudgetLedger(FIXED_CLOCK);
  const router = new ModelRouter(gateway, ledger, { dailyLimitUsd: 10, monthlyLimitUsd: 100 });

  const store = new FakeStore();
  const runtime = new AgentRuntime(store, [
    {
      jobType: 'AI_CLASSIFY_LEAD',
      steps: [
        {
          key: 'classify',
          input: (job) => job.input,
          action: () => ({
            capabilityKey: 'ai.classify_lead',
            resourceType: 'model-router',
            requestPayload: { taskClassId: policy.taskClassId },
            riskLevel: 'LOW' as const,
          }),
          execute: async ({ claim: jobClaim, idempotencyKey }) => {
            const decision = await router.route(
              {
                requestId: idempotencyKey,
                taskClassId: policy.taskClassId,
                messages: [{ role: 'user', content: [{ type: 'text', text: String((jobClaim.input as { leadText?: unknown }).leadText ?? '') }] }],
                tools: [],
                responseFormat: { kind: 'text' as const },
                maxOutputTokens: 128,
                temperature: 0,
              },
              policy,
              { timeoutMs: 2000 },
            );
            if (!decision.chosen) {
              throw new RhiaAiError('RHIA_AI_NO_MODEL_AVAILABLE', 'Ningún modelo cumplió la política.');
            }
            return {
              provider: decision.chosen.provider,
              model: decision.chosen.model,
              tier: decision.chosen.tier,
              explanation: decision.explanation,
            };
          },
        },
      ],
    },
  ]);

  const result = await runtime.runOnce(claim.organizationId, 'worker-ai-1');

  assert.deepEqual(result, { status: 'SUCCEEDED', jobId: claim.id });
  assert.equal(transport.requests.length, 1, 'debe llamar al gateway exactamente una vez (economy cumple el umbral)');
  assert.equal(ledger.getDailyUsage().taskCount, 1);

  const completeCall = store.calls.find((c) => c.startsWith('complete:'));
  assert.ok(completeCall, 'debe haber completado el checkpoint');
  assert.match(completeCall!, /"provider":"openai"/);
  assert.match(completeCall!, /"tier":"economy"/);
  assert.deepEqual(store.calls.slice(0, 2).map((c) => c.split(':')[0]), ['claim', 'begin']);
  assert.equal(store.calls[store.calls.length - 1], 'finish');
});

test('agent-runtime + model-router: si ningún modelo cumple la política, el job falla con código RHIA_ y no se pierde el job', async () => {
  const policy: TaskClassPolicy = {
    taskClassId: 'clasificacion-lead-sin-budget',
    minQualityScore: 0,
    minConfidence: 0.8,
    requiresLocalOnly: false,
    candidateTiers: [[
      {
        provider: 'openai',
        model: 'gpt-5',
        tier: 'premium',
        qualityScore: 0.9,
        estCostPerTaskUsd: 999,
        maxLatencyMsP95: 3000,
        dataResidency: 'any',
      },
    ]],
  };

  const transport = new FakeTransport([]); // no debe usarse: se salta por budget
  const gateway = new AiGateway([createOpenAiAdapter()], transport);
  const ledger = new InMemoryBudgetLedger(FIXED_CLOCK);
  const router = new ModelRouter(gateway, ledger, { dailyLimitUsd: 0.001, monthlyLimitUsd: 100 });

  const store = new FakeStore();
  const runtime = new AgentRuntime(store, [
    {
      jobType: 'AI_CLASSIFY_LEAD',
      steps: [
        {
          key: 'classify',
          input: (job) => job.input,
          execute: async ({ idempotencyKey }) => {
            const decision = await router.route(
              {
                requestId: idempotencyKey,
                taskClassId: policy.taskClassId,
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hola' }] }],
                tools: [],
                responseFormat: { kind: 'text' as const },
                maxOutputTokens: 128,
                temperature: 0,
              },
              policy,
              { timeoutMs: 2000 },
            );
            if (!decision.chosen) {
              throw new RhiaAiError('RHIA_AI_NO_MODEL_AVAILABLE', 'Ningún modelo cumplió la política.');
            }
            return { provider: decision.chosen.provider };
          },
        },
      ],
    },
  ]);

  const result = await runtime.runOnce(claim.organizationId, 'worker-ai-1');

  assert.equal(result.status, 'RETRY_SCHEDULED');
  assert.equal(transport.requests.length, 0, 'no debe llamar al transporte si el router no elige modelo');
  assert.ok(store.calls.some((c) => c.startsWith('fail:RHIA_AI_NO_MODEL_AVAILABLE')));
});
