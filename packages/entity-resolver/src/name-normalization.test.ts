import assert from 'node:assert/strict';
import test from 'node:test';
import { nameSimilarity, normalizeCompanyName } from './name-normalization.js';

test('normalizeCompanyName: quita sufijos legales conocidos (EN/ES) y pliega mayúsculas/diacríticos', () => {
  assert.equal(normalizeCompanyName('Acme Corp.'), 'acme');
  assert.equal(normalizeCompanyName('Acme, Inc.'), 'acme');
  assert.equal(normalizeCompanyName('Compañía Acme S.A. de C.V.'), 'compania acme');
  assert.equal(normalizeCompanyName('ACME  Ltd'), 'acme');
});

test('normalizeCompanyName: sin sufijo legal no cambia el contenido, solo normaliza forma', () => {
  assert.equal(normalizeCompanyName('  Acme   Robotics  '), 'acme robotics');
});

test('normalizeCompanyName: no colapsa nombres cortos de una sola palabra que coincide con un sufijo legal', () => {
  // "Co" es un nombre de una sola palabra: no debe vaciarse a "".
  assert.equal(normalizeCompanyName('Co'), 'co');
});

test('nameSimilarity: nombres idénticos ya normalizados dan 1', () => {
  assert.equal(nameSimilarity('acme', 'acme'), 1);
});

test('nameSimilarity: nombres sin ningún token en común dan 0', () => {
  assert.equal(nameSimilarity('acme robotics', 'globex industries'), 0);
});

test('nameSimilarity: solapamiento parcial de tokens da un valor intermedio (Jaccard)', () => {
  const score = nameSimilarity('acme robotics costa rica', 'acme robotics panama');
  assert.ok(score > 0 && score < 1, `similitud esperada entre 0 y 1, obtuvo ${score}`);
});

test('nameSimilarity: string vacío nunca produce división por cero', () => {
  assert.equal(nameSimilarity('', 'acme'), 0);
  assert.equal(nameSimilarity('acme', ''), 0);
});
