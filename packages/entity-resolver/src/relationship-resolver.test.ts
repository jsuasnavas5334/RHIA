import assert from 'node:assert/strict';
import test from 'node:test';
import { detectRelationship } from './relationship-resolver.js';
import type { KnownEntity, OwnershipSignal } from './schema.js';

const GROUP_ID_1 = '11111111-1111-4111-8111-111111111111';
const GROUP_ID_2 = '22222222-2222-4222-8222-222222222222';

const knownEntity = (overrides: Partial<KnownEntity> & { companyGroupId: string; canonicalName: string }): KnownEntity => ({
  legalIdentifiers: [],
  aliases: [],
  ...overrides,
});

test('sin señales de ownership: no hay relación', () => {
  assert.equal(detectRelationship([], []), undefined);
});

test('señal de subsidiary con contraparte que matchea un grupo conocido: liga matchedGroupId', () => {
  const parent = knownEntity({ companyGroupId: GROUP_ID_1, canonicalName: 'Acme Holding', countryCode: 'US' });
  const signals: OwnershipSignal[] = [{ counterpartName: 'Acme Holding', relation: 'SUBSIDIARY_OF', confidence: 0.8 }];

  const result = detectRelationship(signals, [parent]);

  assert.equal(result?.relation, 'SUBSIDIARY_OF');
  assert.equal(result?.matchedGroupId, GROUP_ID_1);
});

test('señal de ownership cuya contraparte NO matchea ningún candidato conocido: relación registrada sin matchedGroupId', () => {
  const unrelated = knownEntity({ companyGroupId: GROUP_ID_2, canonicalName: 'Globex Industries' });
  const signals: OwnershipSignal[] = [{ counterpartName: 'Acme Holding', relation: 'SUBSIDIARY_OF', confidence: 0.8 }];

  const result = detectRelationship(signals, [unrelated]);

  assert.equal(result?.relation, 'SUBSIDIARY_OF');
  assert.equal(result?.matchedGroupId, undefined);
});

test('varias señales de ownership: se usa la de mayor confidence', () => {
  const signals: OwnershipSignal[] = [
    { counterpartName: 'Weak Signal Co', relation: 'OPERATOR_OF', confidence: 0.3 },
    { counterpartName: 'Strong Signal Holding', relation: 'SUBSIDIARY_OF', confidence: 0.9 },
  ];

  const result = detectRelationship(signals, []);

  assert.equal(result?.counterpartName, 'Strong Signal Holding');
  assert.equal(result?.confidence, 0.9);
});
