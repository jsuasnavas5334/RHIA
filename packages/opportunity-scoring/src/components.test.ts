import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contactabilityScore, evidenceScore, fitScore, signalScore, timingScore } from './components.js';

test('fitScore: sin criterios declarados es neutro (0.5), nunca 1 sin evidencia de encaje', () => {
  assert.equal(fitScore(0, 0), 0.5);
});

test('fitScore: proporcion real de criterios cumplidos', () => {
  assert.equal(fitScore(3, 4), 0.75);
});

// Pruebas requeridas del packet: "No evidence test".
test('signalScore: sin señales aportadas es 0, nunca se infiere una señal implicita', () => {
  assert.equal(signalScore([]), 0);
});

test('signalScore: una señal sin evidencia (imposible en el esquema real, pero defensivo) nunca cuenta', () => {
  assert.equal(signalScore([{ weight: 1, hasEvidence: false }]), 0);
});

test('signalScore: promedia las señales CON evidencia', () => {
  const score = signalScore([{ weight: 1, hasEvidence: true }, { weight: 0.5, hasEvidence: true }, { weight: 1, hasEvidence: false }]);
  assert.equal(score, 0.75);
});

test('contactabilityScore: sin puntos de contacto es 0', () => {
  assert.equal(contactabilityScore(0, 0), 0);
});

test('contactabilityScore: proporcion de sendable sobre el total', () => {
  assert.equal(contactabilityScore(2, 4), 0.5);
});

test('timingScore: sin nextActionAt es 0 -- ausencia de timing no es buen timing', () => {
  assert.equal(timingScore(null, new Date('2026-09-07T00:00:00.000Z')), 0);
});

test('timingScore: nextActionAt HOY puntua maximo (1)', () => {
  const now = new Date('2026-09-07T00:00:00.000Z');
  assert.equal(timingScore(now.toISOString(), now), 1);
});

test('timingScore: nextActionAt vencida (en el pasado) puntua 0, no negativo', () => {
  const now = new Date('2026-09-07T00:00:00.000Z');
  const past = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(timingScore(past, now), 0);
});

test('timingScore: decae linealmente dentro de la ventana', () => {
  const now = new Date('2026-09-07T00:00:00.000Z');
  const halfway = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(timingScore(halfway, now, 30), 0.5);
});

// Pruebas requeridas del packet: "No evidence test" (aplicado tambien al componente EVIDENCE).
test('evidenceScore: sin evidencia real es EXACTAMENTE 0, nunca un valor positivo "por si acaso"', () => {
  assert.equal(evidenceScore(0), 0);
});

test('evidenceScore: mas evidencia sube el score con retornos decrecientes, satura en 1', () => {
  assert.equal(evidenceScore(5, 5), 1);
  assert.equal(evidenceScore(50, 5), 1);
  assert.ok(evidenceScore(2, 5) < evidenceScore(4, 5));
});
