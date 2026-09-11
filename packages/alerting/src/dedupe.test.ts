import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeAlerts, type ActiveAlertState } from './dedupe.js';
import type { Alert } from './contracts.js';

const now = new Date('2026-09-10T12:00:00Z');

const makeAlert = (id: string): Alert => ({
  id,
  category: 'COMPONENT_DEGRADED',
  severity: 'WARNING',
  message: 'm',
  cause: 'c',
  action: 'a',
  runbookRef: 'docs/runbooks/alerting-runbook.md#component-degraded',
  occurredAt: now.toISOString(),
});

test('criterio de aceptacion "No alert storm" / error a evitar "Sin dedupe" -- una alerta sin estado activo previo SIEMPRE se dispara', () => {
  const result = dedupeAlerts([makeAlert('A')], [], 15 * 60 * 1000, now);
  assert.deepEqual(result.toFire.map((a) => a.id), ['A']);
  assert.deepEqual(result.suppressed, []);
});

test('la misma alerta reapareciendo DENTRO del cooldown se suprime (previene storm de la misma condicion real)', () => {
  const active: ActiveAlertState[] = [{ id: 'A', lastFiredAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString() }];
  const result = dedupeAlerts([makeAlert('A')], active, 15 * 60 * 1000, now);
  assert.deepEqual(result.toFire, []);
  assert.deepEqual(result.suppressed.map((a) => a.id), ['A']);
});

test('la misma alerta reapareciendo DESPUES de vencido el cooldown se dispara de nuevo (una condicion real que sigue activa merece recordatorio)', () => {
  const active: ActiveAlertState[] = [{ id: 'A', lastFiredAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString() }];
  const result = dedupeAlerts([makeAlert('A')], active, 15 * 60 * 1000, now);
  assert.deepEqual(result.toFire.map((a) => a.id), ['A']);
  assert.deepEqual(result.suppressed, []);
});

test('alertas con id distinto son independientes -- el estado activo de una nunca suprime otra', () => {
  const active: ActiveAlertState[] = [{ id: 'A', lastFiredAt: now.toISOString() }];
  const result = dedupeAlerts([makeAlert('A'), makeAlert('B')], active, 15 * 60 * 1000, now);
  assert.deepEqual(result.toFire.map((a) => a.id), ['B']);
  assert.deepEqual(result.suppressed.map((a) => a.id), ['A']);
});
