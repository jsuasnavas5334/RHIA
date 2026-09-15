import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  hashContactPointValue,
  contactPointValueMatchesHash,
  encryptContactPointValue,
  decryptContactPointValue,
} from './encryption.js';

const key32 = randomBytes(32);

test('Criterio "Encrypt contact points sensibles" -- encrypt/decrypt real produce ida y vuelta exacta', () => {
  const raw = 'jane.doe@empresa.com';
  const result = encryptContactPointValue(raw, key32);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  // El valor cifrado nunca debe contener el texto en claro (bytea real, no un wrapper superficial).
  const serialized = Buffer.from(result.encrypted.valueEncrypted).toString('latin1');
  assert.ok(!serialized.includes(raw));

  const decrypted = decryptContactPointValue(result.encrypted.valueEncrypted, key32);
  assert.equal(decrypted.ok, true);
  if (decrypted.ok) assert.equal(decrypted.value, raw);
});

test('value_hash permite dedupe sin desencriptar (mismo valor -> mismo hash, normalizado)', () => {
  const a = encryptContactPointValue('Jane.Doe@Empresa.com  ', key32);
  const b = encryptContactPointValue('jane.doe@empresa.com', key32);
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) {
    assert.equal(a.encrypted.valueHash, b.encrypted.valueHash, 'el hash debe ser estable ante casing/espacios para servir de dedupe real');
    // El ciphertext SI puede variar (iv aleatorio por corrida) aunque el hash coincida.
  }
  assert.equal(hashContactPointValue('jane.doe@empresa.com').length, 64, 'debe caber exacto en la columna char(64)');
  assert.equal(contactPointValueMatchesHash('JANE.DOE@empresa.com', hashContactPointValue('jane.doe@empresa.com')), true);
  assert.equal(contactPointValueMatchesHash('otro@empresa.com', hashContactPointValue('jane.doe@empresa.com')), false);
});

test('encryptContactPointValue rechaza un valor vacio sin lanzar', () => {
  const result = encryptContactPointValue('   ', key32);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'RHIA_SECRETS_EMPTY_VALUE');
});

test('encryptContactPointValue/decryptContactPointValue rechazan una clave con longitud invalida sin lanzar', () => {
  const shortKey = randomBytes(16);
  const encrypted = encryptContactPointValue('jane.doe@empresa.com', shortKey);
  assert.equal(encrypted.ok, false);
  if (!encrypted.ok) assert.equal(encrypted.error.code, 'RHIA_SECRETS_INVALID_KEY_LENGTH');

  const valid = encryptContactPointValue('jane.doe@empresa.com', key32);
  assert.ok(valid.ok);
  if (valid.ok) {
    const decrypted = decryptContactPointValue(valid.encrypted.valueEncrypted, shortKey);
    assert.equal(decrypted.ok, false);
    if (!decrypted.ok) assert.equal(decrypted.error.code, 'RHIA_SECRETS_INVALID_KEY_LENGTH');
  }
});

test('decryptContactPointValue con la clave incorrecta falla explicito (GCM autenticado), nunca devuelve texto corrupto en silencio', () => {
  const encrypted = encryptContactPointValue('jane.doe@empresa.com', key32);
  assert.ok(encrypted.ok);
  if (!encrypted.ok) return;

  const wrongKey = randomBytes(32);
  const result = decryptContactPointValue(encrypted.encrypted.valueEncrypted, wrongKey);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'RHIA_SECRETS_DECRYPTION_FAILED');
});

test('decryptContactPointValue detecta un valor cifrado alterado (integridad real de GCM)', () => {
  const encrypted = encryptContactPointValue('jane.doe@empresa.com', key32);
  assert.ok(encrypted.ok);
  if (!encrypted.ok) return;

  const tampered = new Uint8Array(encrypted.encrypted.valueEncrypted);
  tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;

  const result = decryptContactPointValue(tampered, key32);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'RHIA_SECRETS_DECRYPTION_FAILED');
});

test('decryptContactPointValue rechaza un buffer demasiado corto sin lanzar', () => {
  const result = decryptContactPointValue(new Uint8Array([1, 2, 3]), key32);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'RHIA_SECRETS_DECRYPTION_FAILED');
});

test('dos telefonos distintos producen ciphertext y hash distintos (sin colisiones triviales)', () => {
  const a = encryptContactPointValue('+593991234567', key32);
  const b = encryptContactPointValue('+593997654321', key32);
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) {
    assert.notEqual(a.encrypted.valueHash, b.encrypted.valueHash);
    assert.notEqual(Buffer.from(a.encrypted.valueEncrypted).toString('hex'), Buffer.from(b.encrypted.valueEncrypted).toString('hex'));
  }
});
