import assert from 'node:assert/strict';
import test from 'node:test';
import { applyConflictPenalties, combineConfidence } from './confidence.js';

test('combineConfidence: lista vacía da 0', () => {
  assert.equal(combineConfidence([]), 0);
});

test('combineConfidence: una sola señal se conserva igual (dentro de redondeo)', () => {
  assert.ok(Math.abs(combineConfidence([0.7]) - 0.7) < 1e-9);
});

test('combineConfidence: noisy-or sube por encima de la señal individual más fuerte, nunca llega a 1', () => {
  const combined = combineConfidence([0.7, 0.6]);
  assert.ok(combined > 0.7);
  assert.ok(combined <= 0.99);
});

test('applyConflictPenalties: sin conflictos no cambia la confianza', () => {
  assert.equal(applyConflictPenalties(0.8, 0), 0.8);
});

test('applyConflictPenalties: cada conflicto adicional reduce la confianza de forma monotónica', () => {
  const zero = applyConflictPenalties(0.8, 0);
  const one = applyConflictPenalties(0.8, 1);
  const two = applyConflictPenalties(0.8, 2);
  assert.ok(one < zero);
  assert.ok(two < one);
});
