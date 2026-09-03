import assert from 'node:assert/strict';
import test from 'node:test';
import { AlwaysAllowQuotaGuard, InMemorySourceQuotaGuard } from './quota.js';

test('InMemorySourceQuotaGuard: no salta hasta alcanzar el umbral de fallos', () => {
  const guard = new InMemorySourceQuotaGuard({ failureThreshold: 3, now: () => new Date('2026-09-03T00:00:00Z') });
  assert.equal(guard.shouldSkip('SEARXNG'), false);
  guard.recordOutcome('SEARXNG', 'FAILURE');
  assert.equal(guard.shouldSkip('SEARXNG'), false);
  guard.recordOutcome('SEARXNG', 'FAILURE');
  assert.equal(guard.shouldSkip('SEARXNG'), false);
  guard.recordOutcome('SEARXNG', 'FAILURE');
  assert.equal(guard.shouldSkip('SEARXNG'), true, 'el tercer fallo consecutivo debe abrir el circuito');
});

test('InMemorySourceQuotaGuard: un éxito resetea el contador de fallos', () => {
  let now = new Date('2026-09-03T00:00:00Z');
  const guard = new InMemorySourceQuotaGuard({ failureThreshold: 2, now: () => now });
  guard.recordOutcome('WEB_API', 'FAILURE');
  guard.recordOutcome('WEB_API', 'SUCCESS');
  guard.recordOutcome('WEB_API', 'FAILURE');
  assert.equal(guard.shouldSkip('WEB_API'), false, 'un solo fallo tras el reset no debe abrir el circuito (umbral=2)');
});

test('InMemorySourceQuotaGuard: el circuito se cierra solo tras cumplir el cooldown y sondear con éxito', () => {
  let now = new Date('2026-09-03T00:00:00Z');
  const guard = new InMemorySourceQuotaGuard({ failureThreshold: 1, cooldownMs: 60_000, now: () => now });

  guard.recordOutcome('BROWSER', 'FAILURE');
  assert.equal(guard.shouldSkip('BROWSER'), true, 'circuito abierto inmediatamente tras el fallo');

  now = new Date(now.getTime() + 30_000);
  assert.equal(guard.shouldSkip('BROWSER'), true, 'sigue abierto: no pasó el cooldown completo');

  now = new Date(now.getTime() + 31_000);
  assert.equal(guard.shouldSkip('BROWSER'), false, 'cooldown cumplido: permite un sondeo');
  assert.equal(guard.shouldSkip('BROWSER'), true, 'un segundo sondeo antes de resolver el primero se sigue saltando');

  guard.recordOutcome('BROWSER', 'SUCCESS');
  assert.equal(guard.shouldSkip('BROWSER'), false, 'el sondeo exitoso cierra el circuito');
});

test('InMemorySourceQuotaGuard: fuentes distintas no comparten estado', () => {
  const guard = new InMemorySourceQuotaGuard({ failureThreshold: 1 });
  guard.recordOutcome('SEARXNG', 'FAILURE');
  assert.equal(guard.shouldSkip('SEARXNG'), true);
  assert.equal(guard.shouldSkip('WEB_API'), false);
});

test('AlwaysAllowQuotaGuard: nunca salta ninguna fuente', () => {
  const guard = new AlwaysAllowQuotaGuard();
  guard.recordOutcome('SEARXNG', 'FAILURE');
  assert.equal(guard.shouldSkip('SEARXNG'), false);
});
