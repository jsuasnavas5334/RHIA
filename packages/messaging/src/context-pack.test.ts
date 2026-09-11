import assert from 'node:assert/strict';
import test from 'node:test';
import type { Fact } from '@rhia/evidence-pipeline';
import { buildContextPack } from './context-pack.js';
import type { Inference } from './schema.js';

const makeFact = (overrides: Partial<Fact> = {}): Fact => ({
  id: 'fact-1',
  organizationId: 'org-1',
  subjectType: 'COMPANY',
  subjectId: 'sub-1',
  predicate: 'EMPLOYEE_COUNT',
  value: { count: 120, unit: 'employees' },
  confidence: 0.8,
  supportingEvidenceIds: ['evidence-1'],
  ...overrides,
});

const makeInference = (overrides: Partial<Inference> = {}): Inference => ({
  id: 'inf-1',
  organizationId: 'org-1',
  subjectType: 'COMPANY',
  subjectId: 'sub-1',
  inferenceType: 'GROWTH_TRAJECTORY',
  value: { trend: 'UP' },
  confidence: 0.5,
  modelRunId: 'run-1',
  supportingFactIds: ['fact-1'],
  ...overrides,
});

test('buildContextPack separa facts de inferences y conserva una inference con soporte real', () => {
  const fact = makeFact();
  const inference = makeInference();
  const result = buildContextPack({ organizationId: 'org-1', subjectType: 'COMPANY', subjectId: 'sub-1', facts: [fact], inferences: [inference] });
  assert.equal(result.contextPack.facts.length, 1);
  assert.equal(result.contextPack.inferences.length, 1);
  assert.equal(result.droppedInferences.length, 0);
});

test('buildContextPack descarta una inference sin supportingFactIds (nunca se promueve sin soporte)', () => {
  const inference = makeInference({ supportingFactIds: [] });
  const result = buildContextPack({ organizationId: 'org-1', subjectType: 'COMPANY', subjectId: 'sub-1', facts: [], inferences: [inference] });
  assert.equal(result.contextPack.inferences.length, 0);
  assert.deepEqual(result.droppedInferences, [{ inference, reason: 'NO_SUPPORTING_FACTS' }]);
});

test('buildContextPack descarta una inference cuyo fact de soporte no esta en el mismo pack', () => {
  const inference = makeInference({ supportingFactIds: ['fact-que-no-esta'] });
  const result = buildContextPack({ organizationId: 'org-1', subjectType: 'COMPANY', subjectId: 'sub-1', facts: [makeFact()], inferences: [inference] });
  assert.equal(result.contextPack.inferences.length, 0);
  assert.equal(result.droppedInferences[0]!.reason, 'SUPPORTING_FACT_NOT_IN_PACK');
});
