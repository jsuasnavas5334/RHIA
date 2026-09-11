import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AiGateway, FakeTransport, createOpenAiAdapter } from '@rhia/ai-gateway';
import { InMemoryBudgetLedger, ModelRouter, type Clock } from '@rhia/model-router';
import type { ModelProfile, TaskClassPolicy } from '@rhia/model-router';
import { computeOpportunityScore, type OpportunityScoreResult } from '@rhia/opportunity-scoring';
import { isCatalogAction } from './catalog.js';
import { decideNextBestAction } from './decision.js';
import type { ModelDecisionDeps } from './model-fallback.js';
import { DEFAULT_NBA_POLICY_CONFIG } from './policy.js';
import { toDecisionRecordInput } from './persist.js';
import type { NBAInput } from './schema.js';

const FIXED_CLOCK: Clock = { now: () => new Date('2026-09-07T12:00:00Z') };
const NOW = '2026-09-07T12:00:00.000Z';

const ECONOMY: ModelProfile = {
  provider: 'openai', model: 'gpt-5-mini', tier: 'economy', qualityScore: 0.8,
  estCostPerTaskUsd: 0.01, maxLatencyMsP95: 3000, dataResidency: 'any',
};
const TASK_POLICY: TaskClassPolicy = {
  taskClassId: 'nba-decision', minQualityScore: 0, minConfidence: 0.5, requiresLocalOnly: false,
  candidateTiers: [[ECONOMY]],
};

function baseInput(overrides: Partial<NBAInput> = {}): NBAInput {
  return {
    opportunityId: '33333333-3333-4333-8333-333333333333',
    now: NOW,
    createdAt: '2026-09-01T12:00:00.000Z',
    scoreResult: null,
    sendableContactPointCount: 2,
    hasPendingReply: false,
    lastContactedAt: null,
    ...overrides,
  };
}

function respond(body: unknown) {
  return { kind: 'respond' as const, status: 200, body };
}
function openAiChoice(content: string) {
  return { choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } };
}

function makeModelDeps(transport: FakeTransport): ModelDecisionDeps {
  const gateway = new AiGateway([createOpenAiAdapter()], transport);
  const router = new ModelRouter(gateway, new InMemoryBudgetLedger(FIXED_CLOCK), { dailyLimitUsd: 10, monthlyLimitUsd: 100 });
  let counter = 0;
  return { router, taskClassPolicy: TASK_POLICY, routeOptions: { timeoutMs: 1000 }, newRequestId: () => `req-${counter++}` };
}

function midScoreResult(): OpportunityScoreResult {
  return computeOpportunityScore(
    {
      matchedCriteria: 5, totalCriteria: 10, signals: [{ weight: 0.5, hasEvidence: true }],
      sendableContactPoints: 2, totalContactPoints: 4, nextActionAt: null, countryCode: 'PE', evidenceCount: 2,
    },
    { now: new Date(NOW) },
  );
}

test('decision: caso resuelto por regla NUNCA llama al modelo', async () => {
  const transport = new FakeTransport([]); // si se llamara, no hay comportamientos programados -> lanza
  const decision = await decideNextBestAction(baseInput({ hasPendingReply: true }), DEFAULT_NBA_POLICY_CONFIG, makeModelDeps(transport));
  assert.equal(decision.action, 'CONTACT');
  assert.equal(decision.source, 'RULE');
});

test('decision: caso ambiguo con modelo disponible -> resuelve via MODEL, con next_action_at programado', async () => {
  const transport = new FakeTransport([respond(openAiChoice(JSON.stringify({ action: 'REVALIDATE', rationale: 'score medio, sin senal dominante.' })))]);
  const decision = await decideNextBestAction(
    baseInput({ scoreResult: midScoreResult(), sendableContactPointCount: 2 }),
    DEFAULT_NBA_POLICY_CONFIG,
    makeModelDeps(transport),
  );
  assert.equal(decision.source, 'MODEL');
  assert.equal(decision.action, 'REVALIDATE');
  assert.notEqual(decision.nextActionAt, null);
  assert.match(decision.rationale, /decidido por modelo openai\/gpt-5-mini/);
});

test('decision: caso ambiguo sin modelo configurado -> fallback seguro WAIT, nunca sin accion', async () => {
  const decision = await decideNextBestAction(baseInput({ scoreResult: midScoreResult(), sendableContactPointCount: 2 }), DEFAULT_NBA_POLICY_CONFIG, null);
  assert.equal(decision.source, 'FALLBACK');
  assert.equal(decision.action, 'WAIT');
  assert.equal(decision.requiresApproval, false);
  assert.notEqual(decision.nextActionAt, null);
});

test('decision: caso ambiguo con modelo que inventa una accion fuera de catalogo -> fallback seguro, nunca la accion inventada', async () => {
  const transport = new FakeTransport([respond(openAiChoice(JSON.stringify({ action: 'SEND_GIFT', rationale: 'inventada' })))]);
  const decision = await decideNextBestAction(
    baseInput({ scoreResult: midScoreResult(), sendableContactPointCount: 2 }),
    DEFAULT_NBA_POLICY_CONFIG,
    makeModelDeps(transport),
  );
  assert.equal(decision.source, 'FALLBACK');
  assert.equal(decision.action, 'WAIT');
});

test('decision: DISCARD siempre requiresApproval=true; ninguna otra accion lo requiere', async () => {
  const discard = await decideNextBestAction(
    baseInput({
      scoreResult: computeOpportunityScore(
        { matchedCriteria: 0, totalCriteria: 10, signals: [], sendableContactPoints: 0, totalContactPoints: 5, nextActionAt: null, countryCode: 'ZZ', evidenceCount: 0 },
        { now: new Date(NOW) },
      ),
      sendableContactPointCount: 2,
      createdAt: '2026-01-01T12:00:00.000Z',
    }),
    DEFAULT_NBA_POLICY_CONFIG,
    null,
  );
  assert.equal(discard.action, 'DISCARD');
  assert.equal(discard.requiresApproval, true);
});

test('decision: validacion final -- 100 oportunidades sinteticas SIEMPRE obtienen una NBADecision con accion del catalogo (sin huerfanas)', async () => {
  const transport = new FakeTransport(Array.from({ length: 100 }, () => respond(openAiChoice(JSON.stringify({ action: 'WAIT', rationale: 'sin senal dominante, se espera.' })))));
  const modelDeps = makeModelDeps(transport);

  const scenarios: NBAInput[] = Array.from({ length: 100 }, (_, index) => {
    const hasPendingReply = index % 7 === 0;
    const sendableContactPointCount = index % 5 === 0 ? 0 : (index % 4) + 1;
    const scoreResult = index % 3 === 0
      ? null
      : computeOpportunityScore(
          {
            matchedCriteria: index % 11, totalCriteria: 10, signals: index % 2 === 0 ? [{ weight: 0.5, hasEvidence: true }] : [],
            sendableContactPoints: sendableContactPointCount, totalContactPoints: Math.max(sendableContactPointCount, 1),
            nextActionAt: index % 6 === 0 ? NOW : null, countryCode: index % 2 === 0 ? 'EC' : 'ZZ', evidenceCount: index % 5,
          },
          { now: new Date(NOW) },
        );
    return baseInput({
      opportunityId: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
      hasPendingReply,
      sendableContactPointCount,
      scoreResult,
      createdAt: index % 9 === 0 ? '2026-01-01T12:00:00.000Z' : '2026-09-01T12:00:00.000Z',
    });
  });

  const decisions = await Promise.all(scenarios.map((input) => decideNextBestAction(input, DEFAULT_NBA_POLICY_CONFIG, modelDeps)));

  assert.equal(decisions.length, 100);
  for (const decision of decisions) {
    assert.equal(isCatalogAction(decision.action), true, `accion invalida: ${decision.action}`);
    assert.ok(decision.rationale.length > 0);
    assert.equal(decision.requiresApproval, decision.action === 'DISCARD');
    if (decision.action !== 'DISCARD') assert.notEqual(decision.nextActionAt, null);
  }
});

test('persist: toDecisionRecordInput deja el shape listo para rhia.decision_record', () => {
  const input = baseInput({ hasPendingReply: true });
  const decision = { opportunityId: input.opportunityId, action: 'CONTACT' as const, rationale: 'r', source: 'RULE' as const, requiresApproval: false, nextActionAt: NOW, policyVersion: 'nba-v1', decidedAt: NOW };
  const record = toDecisionRecordInput(input, decision);
  assert.equal(record.decisionType, 'NEXT_BEST_ACTION');
  assert.equal(record.rationaleSummary, decision.rationale);
  assert.equal(record.policyVersion, decision.policyVersion);
  assert.equal(record.modelRunId, null); // RULE -> nunca modelRunId
  assert.deepEqual(record.inputSnapshot, input);
  assert.deepEqual(record.output, decision);
});

test('persist: modelRunId solo viaja cuando source=MODEL', () => {
  const input = baseInput();
  const modelDecision = { opportunityId: input.opportunityId, action: 'WAIT' as const, rationale: 'r', source: 'MODEL' as const, requiresApproval: false, nextActionAt: NOW, policyVersion: 'nba-v1', decidedAt: NOW };
  const record = toDecisionRecordInput(input, modelDecision, 'model-run-id-123');
  assert.equal(record.modelRunId, 'model-run-id-123');
});
