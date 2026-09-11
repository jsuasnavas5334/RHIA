import assert from 'node:assert/strict';
import test from 'node:test';
import { findLatestInvalidation } from './invalidation.js';
import type { ManualInvalidation } from './schema.js';

const entry = (overrides: Partial<ManualInvalidation> = {}): ManualInvalidation => ({
  key: 'KEY_A',
  invalidatedAt: '2026-09-01T00:00:00.000Z',
  reason: 'dato corregido manualmente',
  ...overrides,
});

test('findLatestInvalidation: sin invalidaciones para la key, devuelve undefined', () => {
  assert.equal(findLatestInvalidation('KEY_A', []), undefined);
  assert.equal(findLatestInvalidation('KEY_A', [entry({ key: 'KEY_B' })]), undefined);
});

test('findLatestInvalidation: con una sola invalidacion para la key, la devuelve', () => {
  const only = entry();
  assert.deepEqual(findLatestInvalidation('KEY_A', [only]), only);
});

test('findLatestInvalidation: con varias invalidaciones para la misma key, devuelve solo la mas reciente', () => {
  const older = entry({ invalidatedAt: '2026-01-01T00:00:00.000Z', reason: 'primera' });
  const newer = entry({ invalidatedAt: '2026-08-01T00:00:00.000Z', reason: 'segunda' });

  assert.deepEqual(findLatestInvalidation('KEY_A', [older, newer]), newer);
  assert.deepEqual(findLatestInvalidation('KEY_A', [newer, older]), newer, 'el orden de la lista no debe importar');
});
