import assert from 'node:assert/strict';
import test from 'node:test';
import { hashExcerpt } from './excerpt-hash.js';

test('hashExcerpt: mismo texto siempre produce el mismo hash (determinista)', () => {
  assert.equal(hashExcerpt('Empresa X tiene 150 empleados'), hashExcerpt('Empresa X tiene 150 empleados'));
});

test('hashExcerpt: diferencias triviales de formato (espacios, mayúsculas) colapsan al mismo hash', () => {
  const a = hashExcerpt('Empresa X tiene   150 empleados');
  const b = hashExcerpt('  EMPRESA x tiene 150 empleados  ');
  assert.equal(a, b);
});

test('hashExcerpt: textos distintos producen hashes distintos', () => {
  assert.notEqual(hashExcerpt('Empresa X tiene 150 empleados'), hashExcerpt('Empresa Y tiene 200 empleados'));
});

test('hashExcerpt: devuelve 64 caracteres hex (sha256)', () => {
  assert.match(hashExcerpt('cualquier texto'), /^[0-9a-f]{64}$/);
});
