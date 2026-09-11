import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHealthSnapshot, type ComponentHealthScore } from '@rhia/observability';
import { evaluateComponentHealthAlerts } from './health.js';

const now = new Date('2026-09-10T12:00:00Z');

const scoreFor = (component: string, classification: ComponentHealthScore['classification'], overrides: Partial<ComponentHealthScore> = {}): ComponentHealthScore => ({
  component,
  score: classification === 'DOWN' ? 0.1 : classification === 'DEGRADED' ? 0.4 : classification === 'UNSTABLE' ? 0.6 : classification === 'NO_DATA' ? null : 0.95,
  classification,
  sampleWeight: 10,
  eventCount: 10,
  lastStatus: classification === 'DOWN' ? 'DOWN' : classification === 'DEGRADED' ? 'DEGRADED' : 'OK',
  ...overrides,
});

test('Simulated incident -- Search degraded: un componente search_engine DOWN produce un Alert CRITICAL con causa, accion y runbook reales', () => {
  const snapshot = buildHealthSnapshot([scoreFor('search_engine:google', 'DOWN')], now);
  const alerts = evaluateComponentHealthAlerts(snapshot, now);
  assert.equal(alerts.length, 1);
  const alert = alerts[0]!;
  assert.equal(alert.category, 'SEARCH_DEGRADED');
  assert.equal(alert.severity, 'CRITICAL');
  assert.ok(alert.cause.includes('search_engine:google'));
  assert.ok(alert.action.length > 0);
  assert.equal(alert.runbookRef, 'docs/runbooks/alerting-runbook.md#search-degraded');
});

test('Simulated incident -- un componente no-search DEGRADED produce COMPONENT_DEGRADED (WARNING, no CRITICAL)', () => {
  const snapshot = buildHealthSnapshot([scoreFor('model_provider:openai', 'DEGRADED')], now);
  const alerts = evaluateComponentHealthAlerts(snapshot, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.category, 'COMPONENT_DEGRADED');
  assert.equal(alerts[0]!.severity, 'WARNING');
  assert.equal(alerts[0]!.runbookRef, 'docs/runbooks/alerting-runbook.md#component-degraded');
});

test('control positivo -- componentes HEALTHY/NO_DATA/UNSTABLE nunca producen un alert (evita alertar por cada estado no perfecto)', () => {
  const snapshot = buildHealthSnapshot(
    [scoreFor('tool:playwright', 'HEALTHY'), scoreFor('db:postgres', 'NO_DATA'), scoreFor('app:core-api', 'UNSTABLE')],
    now,
  );
  const alerts = evaluateComponentHealthAlerts(snapshot, now);
  assert.deepEqual(alerts, []);
});

test('un snapshot con componentes mixtos produce exactamente 1 alert por cada DEGRADED/DOWN, ninguno por los sanos', () => {
  const snapshot = buildHealthSnapshot(
    [scoreFor('search_engine:bing', 'DOWN'), scoreFor('tool:playwright', 'HEALTHY'), scoreFor('model_provider:anthropic', 'DEGRADED')],
    now,
  );
  const alerts = evaluateComponentHealthAlerts(snapshot, now);
  assert.equal(alerts.length, 2);
  assert.deepEqual(
    alerts.map((a) => a.id).sort(),
    ['COMPONENT_DEGRADED:model_provider:anthropic', 'SEARCH_DEGRADED:search_engine:bing'],
  );
});
