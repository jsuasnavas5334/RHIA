import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_VALIDATION_STALE_AFTER_DAYS,
  confidenceForStatus,
  effectiveValidationStatus,
  hashContactPointValue,
  isSendableContactPoint,
  isValidationStale,
  maskContactPointValue,
  normalizeContactPointValue,
  validateContactPointFormat,
} from './contact-point-service.js';

// Accion 1, "Normalizar".
test('normalizeContactPointValue: EMAIL se recorta y pasa a minusculas', () => {
  assert.equal(normalizeContactPointValue('EMAIL', '  Jane.Doe@Acme.COM  '), 'jane.doe@acme.com');
});

test('normalizeContactPointValue: PHONE conserva un "+" inicial y descarta separadores', () => {
  assert.equal(normalizeContactPointValue('PHONE', '+593 99-123 4567'), '+593991234567');
});

test('normalizeContactPointValue: PHONE sin "+" nunca inventa un codigo de pais', () => {
  assert.equal(normalizeContactPointValue('PHONE', '0991234567'), '0991234567');
});

// Accion 3, "Validar formato" + Pruebas requeridas: "Invalid email".
test('validateContactPointFormat: email invalido (sin arroba) es rechazado', () => {
  assert.equal(validateContactPointFormat('EMAIL', 'no-es-un-email'), false);
});

test('validateContactPointFormat: email valido pasa', () => {
  assert.equal(validateContactPointFormat('EMAIL', 'jane.doe@acme.com'), true);
});

test('validateContactPointFormat: telefono sin "+" (no E.164) es rechazado', () => {
  assert.equal(validateContactPointFormat('PHONE', '0991234567'), false);
});

test('validateContactPointFormat: telefono E.164 valido pasa', () => {
  assert.equal(validateContactPointFormat('WHATSAPP', '+593991234567'), true);
});

// Accion 2, "Dedup hash" + Pruebas requeridas: "Duplicate phone" (a nivel de hash puro -- el dedup real de persistencia se cubre en core-api.test.ts).
test('hashContactPointValue: el mismo telefono normalizado produce el mismo hash sin importar el formato de entrada original', () => {
  const normalizedFromSpaced = normalizeContactPointValue('PHONE', '+593 99 123 4567');
  const normalizedFromDashed = normalizeContactPointValue('PHONE', '+593-99-123-4567');
  assert.equal(hashContactPointValue(normalizedFromSpaced), hashContactPointValue(normalizedFromDashed));
});

test('hashContactPointValue: telefonos distintos producen hashes distintos', () => {
  assert.notEqual(hashContactPointValue('+593991234567'), hashContactPointValue('+593991234568'));
});

test('hashContactPointValue: nunca expone el valor en claro (sha256 hex de 64 caracteres)', () => {
  const digest = hashContactPointValue('+593991234567');
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.ok(!digest.includes('593991234567'));
});

// Criterio de aceptacion: "PII protegida" (mascara).
test('maskContactPointValue: EMAIL conserva solo el primer caracter del local-part y el dominio completo', () => {
  assert.equal(maskContactPointValue('EMAIL', 'jane.doe@acme.com'), 'j*******@acme.com');
});

test('maskContactPointValue: PHONE conserva solo los ultimos 4 digitos', () => {
  assert.equal(maskContactPointValue('PHONE', '+593991234567'), '********4567');
});

test('maskContactPointValue: nunca devuelve el valor completo sin enmascarar', () => {
  const raw = '+593991234567';
  const masked = maskContactPointValue('PHONE', raw);
  assert.notEqual(masked, raw);
});

// Pruebas requeridas: "Stale validation".
test('isValidationStale: una validacion mas vieja que el umbral es stale', () => {
  const now = new Date('2026-09-07T00:00:00.000Z');
  const old = new Date(now.getTime() - (DEFAULT_VALIDATION_STALE_AFTER_DAYS + 10) * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isValidationStale(old, now), true);
});

test('isValidationStale: una validacion reciente NO es stale', () => {
  const now = new Date('2026-09-07T00:00:00.000Z');
  assert.equal(isValidationStale(now.toISOString(), now), false);
});

test('isValidationStale: sin lastValidatedAt (nunca validado) cuenta como stale -- nunca "fresco" por defecto', () => {
  const now = new Date('2026-09-07T00:00:00.000Z');
  assert.equal(isValidationStale(null, now), true);
});

// Criterio de aceptacion: "Unknown no se presenta como verified".
test('effectiveValidationStatus: VERIFIED stale degrada a UNVERIFIED', () => {
  const now = new Date('2026-09-07T00:00:00.000Z');
  const old = new Date(now.getTime() - (DEFAULT_VALIDATION_STALE_AFTER_DAYS + 10) * 24 * 60 * 60 * 1000).toISOString();
  const status = effectiveValidationStatus({ validationStatus: 'VERIFIED', lastValidatedAt: old }, now);
  assert.equal(status, 'UNVERIFIED');
});

test('effectiveValidationStatus: VERIFIED reciente se mantiene VERIFIED', () => {
  const now = new Date('2026-09-07T00:00:00.000Z');
  const status = effectiveValidationStatus({ validationStatus: 'VERIFIED', lastValidatedAt: now.toISOString() }, now);
  assert.equal(status, 'VERIFIED');
});

test('effectiveValidationStatus: INVALID nunca se degrada por antiguedad (sigue INVALID)', () => {
  const now = new Date('2026-09-07T00:00:00.000Z');
  const veryOld = new Date(now.getTime() - 5000 * 24 * 60 * 60 * 1000).toISOString();
  const status = effectiveValidationStatus({ validationStatus: 'INVALID', lastValidatedAt: veryOld }, now);
  assert.equal(status, 'INVALID');
});

// Criterio de aceptacion: "No envia a INVALID".
test('isSendableContactPoint: INVALID nunca es sendable', () => {
  assert.equal(isSendableContactPoint({ validationStatus: 'INVALID' }), false);
});

test('isSendableContactPoint: UNVERIFIED y VERIFIED si son sendable', () => {
  assert.equal(isSendableContactPoint({ validationStatus: 'UNVERIFIED' }), true);
  assert.equal(isSendableContactPoint({ validationStatus: 'VERIFIED' }), true);
});

test('confidenceForStatus: INVALID=0, UNVERIFIED=0.5, VERIFIED=1', () => {
  assert.equal(confidenceForStatus('INVALID'), 0);
  assert.equal(confidenceForStatus('UNVERIFIED'), 0.5);
  assert.equal(confidenceForStatus('VERIFIED'), 1);
});
