import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTtlDays } from './ttl-policy.js';
import type { CachePolicy } from './schema.js';

test('resolveTtlDays: sin overrides usa el default de la politica', () => {
  const policy: CachePolicy = { defaultTtlDays: 30 };
  assert.equal(resolveTtlDays({ claimType: 'EMPLOYEE_COUNT' }, policy), 30);
});

test('resolveTtlDays: override por claimType reemplaza el default', () => {
  const policy: CachePolicy = { defaultTtlDays: 30, claimTypeTtlDays: { LEGAL_IDENTIFIER: 365 } };
  assert.equal(resolveTtlDays({ claimType: 'LEGAL_IDENTIFIER' }, policy), 365);
  assert.equal(resolveTtlDays({ claimType: 'EMPLOYEE_COUNT' }, policy), 30, 'un claim sin override sigue usando el default');
});

test('resolveTtlDays: override por sourceType reemplaza el default', () => {
  const policy: CachePolicy = { defaultTtlDays: 30, sourceTypeTtlDays: { SOCIAL: 3 } };
  assert.equal(resolveTtlDays({ claimType: 'EMPLOYEE_COUNT', sourceType: 'SOCIAL' }, policy), 3);
});

test('resolveTtlDays: cuando compiten override de claim y de source, gana el MAS CORTO (mas conservador)', () => {
  const policy: CachePolicy = {
    defaultTtlDays: 30,
    claimTypeTtlDays: { LEGAL_IDENTIFIER: 365 },
    sourceTypeTtlDays: { SOCIAL: 3 },
  };

  assert.equal(
    resolveTtlDays({ claimType: 'LEGAL_IDENTIFIER', sourceType: 'SOCIAL' }, policy),
    3,
    'un legal identifier visto solo en una red social no deberia heredar el TTL largo pensado para fuentes oficiales',
  );
});

test('resolveTtlDays: sourceType ausente del map no rompe la resolucion (solo default/claim aplican)', () => {
  const policy: CachePolicy = { defaultTtlDays: 30, sourceTypeTtlDays: { SOCIAL: 3 } };
  assert.equal(resolveTtlDays({ claimType: 'EMPLOYEE_COUNT', sourceType: 'OFFICIAL_WEBSITE' }, policy), 30);
});
