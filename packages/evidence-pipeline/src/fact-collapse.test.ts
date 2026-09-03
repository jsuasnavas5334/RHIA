import assert from 'node:assert/strict';
import test from 'node:test';
import { collapseToFacts, isStaleEvidence, markStaleEvidence } from './fact-collapse.js';
import type { Evidence } from './schema.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

let counter = 0;
const nextId = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}`;
};

const baseEvidence = (overrides: Partial<Evidence> = {}): Evidence => ({
  id: nextId(),
  organizationId: ORG_ID,
  subjectType: 'COMPANY',
  subjectId: SUBJECT_ID,
  sourceId: nextId(),
  claimType: 'EMPLOYEE_COUNT',
  excerptHash: HASH_A,
  observedValue: { count: 150, unit: 'employees' },
  confidence: 0.7,
  freshnessAt: '2026-09-01T00:00:00.000Z',
  status: 'ACTIVE',
  ...overrides,
});

test('duplicate evidence: dos evidencias con el mismo claim y el mismo valor colapsan en UN solo fact, sumando ambas como support', () => {
  const evidenceA = baseEvidence({ confidence: 0.7 });
  const evidenceB = baseEvidence({ confidence: 0.6, sourceId: nextId(), excerptHash: HASH_B });

  const facts = collapseToFacts([evidenceA, evidenceB], { newId: nextId });

  assert.equal(facts.length, 1, 'no debe crear un fact por cada evidencia duplicada');
  assert.deepEqual(new Set(facts[0]?.supportingEvidenceIds), new Set([evidenceA.id, evidenceB.id]));
  // noisy-or: corroborar con una segunda evidencia debe subir la confianza por encima de cualquiera de las dos solas.
  assert.ok((facts[0]?.confidence ?? 0) > 0.7, 'la confianza combinada debe superar a la evidencia individual más fuerte');
});

test('contradictory evidence: mismo claim con valores distintos produce facts separados, sin fusionar support', () => {
  const evidenceLow = baseEvidence({ observedValue: { count: 150, unit: 'employees' }, confidence: 0.6 });
  const evidenceHigh = baseEvidence({ observedValue: { count: 500, unit: 'employees' }, confidence: 0.6, sourceId: nextId() });

  const facts = collapseToFacts([evidenceLow, evidenceHigh], { newId: nextId });

  assert.equal(facts.length, 2, 'evidencia contradictoria no debe colapsar en un único fact');
  const supportSets = facts.map((fact) => fact.supportingEvidenceIds);
  assert.deepEqual(supportSets, [[evidenceLow.id], [evidenceHigh.id]]);
  // Ningún fact contradictorio debe declararse tan confiable como si no hubiera conflicto (penalización aplicada).
  for (const fact of facts) {
    assert.ok(fact.confidence < 0.6, `fact contradictorio (${fact.confidence}) debería estar penalizado por debajo de la confianza base 0.6`);
  }
});

test('stale evidence: si TODA la evidencia de un claim está obsoleta, no se emite ningún fact', () => {
  const now = () => new Date('2026-09-03T00:00:00.000Z');
  const staleOnly = [baseEvidence({ freshnessAt: '2020-01-01T00:00:00.000Z' })];

  const marked = markStaleEvidence(staleOnly, { now, staleAfterDays: 365 });
  assert.equal(marked[0]?.status, 'STALE');

  const facts = collapseToFacts(marked, { newId: nextId });
  assert.deepEqual(facts, [], 'evidencia solo obsoleta no debe sostener un fact nuevo');
});

test('stale evidence: si hay evidencia fresca ademas de la obsoleta, el fact se sostiene solo sobre la fresca', () => {
  const now = () => new Date('2026-09-03T00:00:00.000Z');
  const stale = baseEvidence({ freshnessAt: '2020-01-01T00:00:00.000Z' });
  const fresh = baseEvidence({ freshnessAt: '2026-08-01T00:00:00.000Z', sourceId: nextId() });

  const marked = markStaleEvidence([stale, fresh], { now, staleAfterDays: 365 });
  const facts = collapseToFacts(marked, { newId: nextId });

  assert.equal(facts.length, 1);
  assert.deepEqual(facts[0]?.supportingEvidenceIds, [fresh.id], 'el fact no debe apoyarse en la evidencia STALE');
});

test('isStaleEvidence: evidencia justo dentro del umbral no es stale; justo fuera sí', () => {
  const now = new Date('2026-09-03T00:00:00.000Z');
  const withinThreshold = baseEvidence({ freshnessAt: '2025-09-04T00:00:00.000Z' });
  const beyondThreshold = baseEvidence({ freshnessAt: '2025-09-01T00:00:00.000Z' });

  assert.equal(isStaleEvidence(withinThreshold, now, 365), false);
  assert.equal(isStaleEvidence(beyondThreshold, now, 365), true);
});

test('cada fact tiene al menos una supporting evidence (criterio de aceptación del packet)', () => {
  const facts = collapseToFacts([baseEvidence()], { newId: nextId });
  assert.ok(facts.every((fact) => fact.supportingEvidenceIds.length >= 1));
});

test('collapseToFacts: evidencia de distintos subjects/claims no se mezcla entre grupos', () => {
  const forCompanyA = baseEvidence({ subjectId: SUBJECT_ID });
  const forCompanyB = baseEvidence({ subjectId: '33333333-3333-4333-8333-333333333333', sourceId: nextId() });

  const facts = collapseToFacts([forCompanyA, forCompanyB], { newId: nextId });
  assert.equal(facts.length, 2);
});
