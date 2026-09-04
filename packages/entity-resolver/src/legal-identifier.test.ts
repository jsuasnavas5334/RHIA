import assert from 'node:assert/strict';
import test from 'node:test';
import { legalIdentifiersMatch, normalizeLegalIdentifier } from './legal-identifier.js';

test('normalizeLegalIdentifier: ignora espacios, guiones, puntos y mayúsculas', () => {
  assert.equal(normalizeLegalIdentifier('12-3456789'), '123456789');
  assert.equal(normalizeLegalIdentifier(' ab.cd/ef '), 'ABCDEF');
});

test('legalIdentifiersMatch: mismo identificador y mismo país matchea', () => {
  const a = { identifier: '12-3456789', countryCode: 'US' };
  const b = { identifier: '123456789', countryCode: 'US' };
  assert.equal(legalIdentifiersMatch(a, b), true);
});

test('legalIdentifiersMatch: mismo identificador en países distintos NO matchea (esquemas de numeración distintos)', () => {
  const a = { identifier: '123456789', countryCode: 'US' };
  const b = { identifier: '123456789', countryCode: 'CR' };
  assert.equal(legalIdentifiersMatch(a, b), false);
});

test('legalIdentifiersMatch: identificadores distintos en el mismo país no matchean', () => {
  const a = { identifier: '111111111', countryCode: 'US' };
  const b = { identifier: '222222222', countryCode: 'US' };
  assert.equal(legalIdentifiersMatch(a, b), false);
});
