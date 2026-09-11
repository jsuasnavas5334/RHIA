import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AiGateway, FakeTransport, createOpenAiAdapter } from '@rhia/ai-gateway';
import { InMemoryBudgetLedger, ModelRouter, type Clock } from '@rhia/model-router';
import type { ModelProfile, TaskClassPolicy } from '@rhia/model-router';
import { decideWithModel, type ModelDecisionDeps } from './model-fallback.js';
import type { NBAInput } from './schema.js';

const FIXED_CLOCK: Clock = { now: () => new Date('2026-09-07T12:00:00Z') };
const NOW = '2026-09-07T12:00:00.000Z';

const ECONOMY: ModelProfile = {
  provider: 'openai', model: 'gpt-5-mini', tier: 'economy', qualityScore: 0.8,
  estCostPerTaskUsd: 0.01, maxLatencyMsP95: 3000, dataResidency: 'any',
};
const POLICY: TaskClassPolicy = {
  taskClassId: 'nba-decision', minQualityScore: 0, minConfidence: 0.5, requiresLocalOnly: false,
  candidateTiers: [[ECONOMY]],
};

function baseInput(overrides: Partial<NBAInput> = {}): NBAInput {
  return {
    opportunityId: '22222222-2222-4222-8222-222222222222',
    now: NOW,
    createdAt: '2026-09-01T12:00:00.000Z',
    scoreResult: null,
    sendableContactPointCount: 2,
    hasPendingReply: false,
    lastContactedAt: null,
    ...overrides,
  };
}

function makeDeps(transport: FakeTransport, overrides: Partial<Pick<ModelDecisionDeps, 'taskClassPolicy'>> = {}): ModelDecisionDeps {
  const gateway = new AiGateway([createOpenAiAdapter()], transport);
  const router = new ModelRouter(gateway, new InMemoryBudgetLedger(FIXED_CLOCK), { dailyLimitUsd: 10, monthlyLimitUsd: 100 });
  let counter = 0;
  return {
    router,
    taskClassPolicy: overrides.taskClassPolicy ?? POLICY,
    routeOptions: { timeoutMs: 1000 },
    newRequestId: () => `nba-req-${counter++}`,
  };
}

function respond(body: unknown) {
  return { kind: 'respond' as const, status: 200, body };
}

function openAiChoice(content: string) {
  return { choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } };
}

test('model-fallback: usa ModelRouter de verdad y acepta una accion valida del catalogo', async () => {
  const transport = new FakeTransport([respond(openAiChoice(JSON.stringify({ action: 'REVALIDATE', rationale: 'score en banda media, sin senal clara.' })))]);
  const outcome = await decideWithModel(baseInput(), makeDeps(transport));
  assert.ok(outcome);
  assert.equal(outcome?.action, 'REVALIDATE');
  assert.equal(outcome?.provider, 'openai');
  assert.equal(outcome?.model, 'gpt-5-mini');
  assert.match(outcome?.rationale ?? '', /banda media/);
  assert.ok((outcome?.confidence ?? 0) > 0);
});

test('model-fallback: NUNCA confia en una accion fuera del catalogo -- se descarta por completo', async () => {
  const transport = new FakeTransport([respond(openAiChoice(JSON.stringify({ action: 'SEND_GIFT', rationale: 'accion inventada por el modelo' })))]);
  const outcome = await decideWithModel(baseInput(), makeDeps(transport));
  assert.equal(outcome, null);
});

test('model-fallback: respuesta que no es JSON valido se descarta', async () => {
  const transport = new FakeTransport([respond(openAiChoice('esto no es json'))]);
  const outcome = await decideWithModel(baseInput(), makeDeps(transport));
  assert.equal(outcome, null);
});

test('model-fallback: sin rationale no vacia se descarta', async () => {
  const transport = new FakeTransport([respond(openAiChoice(JSON.stringify({ action: 'WAIT', rationale: '' })))]);
  const outcome = await decideWithModel(baseInput(), makeDeps(transport));
  assert.equal(outcome, null);
});

test('model-fallback: si el Router no elige ningun candidato (budget agotado), devuelve null', async () => {
  const transport = new FakeTransport([]); // no deberia ni llegar a llamarse
  const deps = makeDeps(transport, {
    taskClassPolicy: { ...POLICY, candidateTiers: [[{ ...ECONOMY, estCostPerTaskUsd: 999 }]] },
  });
  const outcome = await decideWithModel(baseInput(), deps);
  assert.equal(outcome, null);
});

test('model-fallback: outage del proveedor -> null, sin lanzar excepcion', async () => {
  const transport = new FakeTransport([{ kind: 'throw', message: 'provider outage' }]);
  const outcome = await decideWithModel(baseInput(), makeDeps(transport));
  assert.equal(outcome, null);
});
