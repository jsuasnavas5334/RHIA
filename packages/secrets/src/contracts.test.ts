import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSecretReference, isRotationDue } from './contracts.js';

const validRaw = {
  name: 'outreach-provider-api-key',
  ref: 'vault:outreach:api-key',
  rotationIntervalDays: 90,
  lastRotatedAt: '2026-08-01T00:00:00.000Z',
};

test('validateSecretReference acepta una referencia real completa', () => {
  const result = validateSecretReference(validRaw);
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.reference.name, 'outreach-provider-api-key');
});

test('validateSecretReference acepta lastRotatedAt null (nunca rotado)', () => {
  const result = validateSecretReference({ ...validRaw, lastRotatedAt: null });
  assert.equal(result.valid, true);
});

test('Criterio "No secret en repo/log" -- rechaza un ref que parece un secreto real (reusa looksLikeRawSecret de @rhia/tool-registry)', () => {
  const withAwsKey = validateSecretReference({ ...validRaw, ref: 'AKIAIOSFODNN7EXAMPLE' });
  assert.equal(withAwsKey.valid, false);
  if (!withAwsKey.valid) assert.ok(withAwsKey.errors.some((e) => e.field === 'ref'));

  const withBearer = validateSecretReference({ ...validRaw, ref: 'Bearer sometoken12345678901234567890' });
  assert.equal(withBearer.valid, false);

  const withRealRef = validateSecretReference({ ...validRaw, ref: 'vault:tool-x:api-key' });
  assert.equal(withRealRef.valid, true, 'una referencia corta y legible SI debe aceptarse');
});

test('validateSecretReference rechaza rotationIntervalDays invalido', () => {
  const zero = validateSecretReference({ ...validRaw, rotationIntervalDays: 0 });
  assert.equal(zero.valid, false);
  if (!zero.valid) assert.ok(zero.errors.some((e) => e.field === 'rotationIntervalDays'));

  const negative = validateSecretReference({ ...validRaw, rotationIntervalDays: -5 });
  assert.equal(negative.valid, false);
});

test('validateSecretReference rechaza lastRotatedAt que no es una fecha valida', () => {
  const result = validateSecretReference({ ...validRaw, lastRotatedAt: 'no-es-una-fecha' });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((e) => e.field === 'lastRotatedAt'));
});

test('validateSecretReference rechaza root no-objeto y campos vacios', () => {
  assert.equal(validateSecretReference(null).valid, false);
  assert.equal(validateSecretReference('vault:x').valid, false);

  const withoutName = validateSecretReference({ ...validRaw, name: '' });
  assert.equal(withoutName.valid, false);
  if (!withoutName.valid) assert.ok(withoutName.errors.some((e) => e.field === 'name'));
});

test('Criterio "Rotation posible" -- isRotationDue: null lastRotatedAt siempre vencido', () => {
  const reference = { name: 'x', ref: 'vault:x', rotationIntervalDays: 30, lastRotatedAt: null } as const;
  assert.equal(isRotationDue(reference, new Date('2026-09-10T00:00:00.000Z')), true);
});

test('isRotationDue: vencido cuando pasaron mas dias que rotationIntervalDays, no vencido si no', () => {
  const reference = { name: 'x', ref: 'vault:x', rotationIntervalDays: 30, lastRotatedAt: '2026-08-01T00:00:00.000Z' } as const;
  assert.equal(isRotationDue(reference, new Date('2026-08-10T00:00:00.000Z')), false, '9 dias despues, no deberia estar vencido');
  assert.equal(isRotationDue(reference, new Date('2026-09-01T00:00:00.000Z')), true, '31 dias despues, deberia estar vencido');
  assert.equal(isRotationDue(reference, new Date('2026-08-31T00:00:00.000Z')), true, 'exactamente en el limite (30 dias) cuenta como vencido');
});
