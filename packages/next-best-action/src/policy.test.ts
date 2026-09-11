import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOpportunityScore, type OpportunityScoreResult } from '@rhia/opportunity-scoring';
import { applyPolicy, DEFAULT_NBA_POLICY_CONFIG } from './policy.js';
import type { NBAInput } from './schema.js';

const NOW = '2026-09-07T12:00:00.000Z';
const OPPORTUNITY_ID = '11111111-1111-4111-8111-111111111111';

function lowScoreResult(): OpportunityScoreResult {
  return computeOpportunityScore(
    {
      matchedCriteria: 0, totalCriteria: 10, signals: [], sendableContactPoints: 0, totalContactPoints: 5,
      nextActionAt: null, countryCode: 'ZZ', evidenceCount: 0,
    },
    { now: new Date(NOW) },
  );
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

function highScoreResult(): OpportunityScoreResult {
  return computeOpportunityScore(
    {
      matchedCriteria: 8, totalCriteria: 10, signals: [{ weight: 0.9, hasEvidence: true }],
      sendableContactPoints: 4, totalContactPoints: 5, nextActionAt: NOW, countryCode: 'EC', evidenceCount: 5,
    },
    { now: new Date(NOW) },
  );
}

function baseInput(overrides: Partial<NBAInput> = {}): NBAInput {
  return {
    opportunityId: OPPORTUNITY_ID,
    now: NOW,
    createdAt: '2026-09-01T12:00:00.000Z', // 6 dias antes de NOW -- no stale
    scoreResult: null,
    sendableContactPointCount: 1,
    hasPendingReply: false,
    lastContactedAt: null,
    ...overrides,
  };
}

test('policy: reply pending gana sobre cualquier otra senal -> CONTACT urgente', () => {
  const decision = applyPolicy(
    baseInput({ hasPendingReply: true, sendableContactPointCount: 0, scoreResult: lowScoreResult() }),
    DEFAULT_NBA_POLICY_CONFIG,
  );
  assert.ok(decision);
  assert.equal(decision?.action, 'CONTACT');
  assert.equal(decision?.source, 'RULE');
  assert.equal(decision?.requiresApproval, false);
  assert.notEqual(decision?.nextActionAt, null);
  assert.match(decision?.rationale ?? '', /respuesta/i);
});

test('policy: sin contact point enviable -> RESEARCH, sin importar el score', () => {
  const decision = applyPolicy(baseInput({ sendableContactPointCount: 0, scoreResult: highScoreResult() }), DEFAULT_NBA_POLICY_CONFIG);
  assert.ok(decision);
  assert.equal(decision?.action, 'RESEARCH');
  assert.equal(decision?.source, 'RULE');
  assert.equal(decision?.requiresApproval, false);
});

test('policy: low score + oportunidad stale -> DISCARD, exige aprobacion', () => {
  const decision = applyPolicy(
    baseInput({
      scoreResult: lowScoreResult(),
      sendableContactPointCount: 2,
      createdAt: '2026-06-01T12:00:00.000Z', // muy anterior a NOW -- stale
    }),
    DEFAULT_NBA_POLICY_CONFIG,
  );
  assert.ok(decision);
  assert.equal(decision?.action, 'DISCARD');
  assert.equal(decision?.requiresApproval, true);
  assert.equal(decision?.nextActionAt, null);
});

test('policy: low score pero todavia no stale -> REVALIDATE, sin aprobacion', () => {
  const decision = applyPolicy(
    baseInput({ scoreResult: lowScoreResult(), sendableContactPointCount: 2, createdAt: '2026-09-01T12:00:00.000Z' }),
    DEFAULT_NBA_POLICY_CONFIG,
  );
  assert.ok(decision);
  assert.equal(decision?.action, 'REVALIDATE');
  assert.equal(decision?.requiresApproval, false);
  assert.notEqual(decision?.nextActionAt, null);
});

test('policy: score alto + contactable + sin reply pendiente -> CONTACT proactivo', () => {
  const decision = applyPolicy(baseInput({ scoreResult: highScoreResult(), sendableContactPointCount: 3 }), DEFAULT_NBA_POLICY_CONFIG);
  assert.ok(decision);
  assert.equal(decision?.action, 'CONTACT');
  assert.equal(decision?.requiresApproval, false);
});

test('policy: score en banda media, contactable, sin reply -> ambiguo (null, se difiere al modelo)', () => {
  const decision = applyPolicy(baseInput({ scoreResult: midScoreResult(), sendableContactPointCount: 2 }), DEFAULT_NBA_POLICY_CONFIG);
  assert.equal(decision, null);
});

test('policy: sin score todavia, contactable, sin reply -> ambiguo (null)', () => {
  const decision = applyPolicy(baseInput({ scoreResult: null, sendableContactPointCount: 2 }), DEFAULT_NBA_POLICY_CONFIG);
  assert.equal(decision, null);
});
