import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComponentId,
  parseComponentId,
  buildHealthEvent,
  computeComponentHealthScores,
  buildHealthSnapshot,
  type HealthEventRecord,
} from './health.js';

test('buildComponentId / parseComponentId son inversas', () => {
  const id = buildComponentId('model_provider', 'anthropic');
  assert.equal(id, 'model_provider:anthropic');
  assert.deepEqual(parseComponentId(id), { kind: 'model_provider', name: 'anthropic' });
});

test('parseComponentId devuelve null para un component sin separador valido', () => {
  assert.equal(parseComponentId('sin-separador'), null);
  assert.equal(parseComponentId(':nombre-sin-kind'), null);
  assert.equal(parseComponentId('kind-sin-nombre:'), null);
});

test('buildHealthEvent produce la forma lista para rhia.system_health_event', () => {
  const event = buildHealthEvent('tool', 'playwright', 'OK', { latencyMs: 120 });
  assert.deepEqual(event, { component: 'tool:playwright', status: 'OK', detail: { latencyMs: 120 } });
});

test('componente sin eventos en la ventana recibe NO_DATA, nunca HEALTHY por defecto', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const events: HealthEventRecord[] = [
    { component: 'model_provider:openai', status: 'OK', occurredAt: new Date('2026-08-01T00:00:00Z') }, // fuera de la ventana de 14 dias
  ];
  const scores = computeComponentHealthScores(events, { now });
  const openai = scores.find((s) => s.component === 'model_provider:openai');
  assert.ok(openai);
  assert.equal(openai?.classification, 'NO_DATA');
  assert.equal(openai?.score, null);
});

test('pocas muestras -> NO_DATA (muestra insuficiente), no una clasificacion prematura', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const events: HealthEventRecord[] = [
    { component: 'tool:playwright', status: 'OK', occurredAt: now },
  ];
  const scores = computeComponentHealthScores(events, { now, minSampleWeight: 3 });
  const playwright = scores.find((s) => s.component === 'tool:playwright');
  assert.ok(playwright);
  assert.equal(playwright?.classification, 'NO_DATA');
  assert.ok((playwright?.score ?? 0) > 0);
});

// "Provider outage" (prueba requerida del packet PH11-T001) -- simula un
// model provider (ai-gateway) que empieza a fallar de forma sostenida: los
// eventos DOWN recientes deben dominar el score (pesan mas que un historial
// OK mas antiguo) y el componente debe clasificar DEGRADED/DOWN, nunca
// HEALTHY mientras la caida esta activa. El overall del snapshot debe
// reflejar la peor clasificacion real, nunca promediarse para ocultarla.
test('Provider outage: un model provider caido clasifica DEGRADED/DOWN y domina el overall', () => {
  const now = new Date('2026-09-10T12:00:00Z');

  const healthyHistory: HealthEventRecord[] = Array.from({ length: 5 }, (_, i) => ({
    component: 'model_provider:openai',
    status: 'OK' as const,
    occurredAt: new Date(now.getTime() - (10 + i) * 24 * 60 * 60 * 1000), // 10-14 dias atras, en el borde de la ventana
  }));

  const outageEvents: HealthEventRecord[] = Array.from({ length: 6 }, (_, i) => ({
    component: 'model_provider:openai',
    status: 'DOWN' as const,
    occurredAt: new Date(now.getTime() - i * 60 * 60 * 1000), // ultimas 6 horas, recientes -> pesan mas por decaimiento
  }));

  const otherComponent: HealthEventRecord[] = [
    { component: 'tool:playwright', status: 'OK', occurredAt: now },
    { component: 'tool:playwright', status: 'OK', occurredAt: now },
    { component: 'tool:playwright', status: 'OK', occurredAt: now },
    { component: 'tool:playwright', status: 'OK', occurredAt: now },
  ];

  const scores = computeComponentHealthScores([...healthyHistory, ...outageEvents, ...otherComponent], { now });

  const openai = scores.find((s) => s.component === 'model_provider:openai');
  assert.ok(openai);
  assert.notEqual(openai?.classification, 'HEALTHY');
  assert.ok(openai?.classification === 'DEGRADED' || openai?.classification === 'DOWN');
  assert.equal(openai?.lastStatus, 'DOWN');

  const playwright = scores.find((s) => s.component === 'tool:playwright');
  assert.equal(playwright?.classification, 'HEALTHY');

  const snapshot = buildHealthSnapshot(scores, now);
  assert.notEqual(snapshot.overall, 'HEALTHY');
  assert.ok(snapshot.overall === 'DEGRADED' || snapshot.overall === 'DOWN');
});

test('buildHealthSnapshot con solo NO_DATA reporta overall NO_DATA, no HEALTHY', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const scores = computeComponentHealthScores(
    [{ component: 'db:postgres', status: 'OK', occurredAt: new Date('2026-01-01T00:00:00Z') }],
    { now },
  );
  const snapshot = buildHealthSnapshot(scores, now);
  assert.equal(snapshot.overall, 'NO_DATA');
});

test('buildHealthSnapshot con todos los componentes sanos reporta overall HEALTHY', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const events: HealthEventRecord[] = Array.from({ length: 5 }, () => ({
    component: 'app:core-api',
    status: 'OK' as const,
    occurredAt: now,
  }));
  const scores = computeComponentHealthScores(events, { now });
  const snapshot = buildHealthSnapshot(scores, now);
  assert.equal(snapshot.overall, 'HEALTHY');
});
