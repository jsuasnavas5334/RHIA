import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCacheKey } from './cache-key.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';

test('buildCacheKey: combina organizationId, subjectType, subjectId y claimType', () => {
  const key = buildCacheKey({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
  });

  assert.equal(key, `${ORG_ID}::COMPANY::${SUBJECT_ID}::EMPLOYEE_COUNT`);
});

test('buildCacheKey: distinto claimType produce una key distinta para el mismo subject', () => {
  const base = { organizationId: ORG_ID, subjectType: 'COMPANY', subjectId: SUBJECT_ID };
  const keyA = buildCacheKey({ ...base, claimType: 'EMPLOYEE_COUNT' });
  const keyB = buildCacheKey({ ...base, claimType: 'LEGAL_IDENTIFIER' });

  assert.notEqual(keyA, keyB);
});

test('buildCacheKey: distinto subjectId (misma organizacion/claim) produce una key distinta -- nunca colapsa dos empresas distintas', () => {
  const keyA = buildCacheKey({ organizationId: ORG_ID, subjectType: 'COMPANY', subjectId: SUBJECT_ID, claimType: 'EMPLOYEE_COUNT' });
  const keyB = buildCacheKey({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: '33333333-3333-4333-8333-333333333333',
    claimType: 'EMPLOYEE_COUNT',
  });

  assert.notEqual(keyA, keyB, 'la key debe depender de la identidad de la entidad (subjectId), nunca de un nombre de empresa en texto libre');
});
