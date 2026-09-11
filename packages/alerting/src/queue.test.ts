import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateQueueStalledAlerts, type QueueSignal } from './queue.js';

const now = new Date('2026-09-10T12:00:00Z');

test('Simulated incident -- Queue stalled: un item pendiente por encima del umbral produce un Alert con causa/accion reales', () => {
  const signals: QueueSignal[] = [{ queueName: 'search-jobs', oldestPendingAgeSeconds: 1200, pendingCount: 7 }];
  const alerts = evaluateQueueStalledAlerts(signals, 900, now);
  assert.equal(alerts.length, 1);
  const alert = alerts[0]!;
  assert.equal(alert.category, 'QUEUE_STALLED');
  assert.equal(alert.severity, 'WARNING');
  assert.ok(alert.cause.includes('search-jobs'));
  assert.equal(alert.runbookRef, 'docs/runbooks/alerting-runbook.md#queue-stalled');
});

test('un retraso 4x el umbral escala a CRITICAL', () => {
  const alerts = evaluateQueueStalledAlerts([{ queueName: 'outreach-jobs', oldestPendingAgeSeconds: 3700, pendingCount: 3 }], 900, now);
  assert.equal(alerts[0]!.severity, 'CRITICAL');
});

test('control positivo -- una cola vacia (oldestPendingAgeSeconds null) nunca alerta', () => {
  const alerts = evaluateQueueStalledAlerts([{ queueName: 'search-jobs', oldestPendingAgeSeconds: null, pendingCount: 0 }], 900, now);
  assert.deepEqual(alerts, []);
});

test('control positivo -- un item por debajo del umbral no alerta', () => {
  const alerts = evaluateQueueStalledAlerts([{ queueName: 'search-jobs', oldestPendingAgeSeconds: 300, pendingCount: 2 }], 900, now);
  assert.deepEqual(alerts, []);
});
