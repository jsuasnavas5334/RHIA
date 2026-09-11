import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MetricsCollector } from './metrics.js';

test('record rechaza name vacio y value no finito', () => {
  const collector = new MetricsCollector({ retentionDays: 30 });

  const missingName = collector.record('', 'counter', 1);
  assert.equal(missingName.ok, false);
  if (!missingName.ok) assert.equal(missingName.error.code, 'RHIA_OBS_INVALID_METRIC');

  const invalidValue = collector.record('job.duration_ms', 'histogram', Number.NaN);
  assert.equal(invalidValue.ok, false);
});

test('record acepta muestras validas y summarize agrega count/sum/min/max/percentiles', () => {
  const collector = new MetricsCollector({ retentionDays: 30 });
  const now = new Date('2026-09-10T00:00:00Z');

  for (const value of [10, 20, 30, 40, 50]) {
    const result = collector.record('job.duration_ms', 'histogram', value, {}, now);
    assert.equal(result.ok, true);
  }

  const summary = collector.summarize('job.duration_ms');
  assert.ok(summary);
  assert.equal(summary?.count, 5);
  assert.equal(summary?.sum, 150);
  assert.equal(summary?.min, 10);
  assert.equal(summary?.max, 50);
  assert.ok((summary?.p50 ?? 0) > 0);
  assert.ok((summary?.p95 ?? 0) <= 50);
});

test('summarize devuelve null para una metrica sin muestras', () => {
  const collector = new MetricsCollector({ retentionDays: 30 });
  assert.equal(collector.summarize('no-existe'), null);
});

// Error a evitar del packet "Datos sensibles" -- tags de una metrica nunca
// deben sobrevivir con PII/secretos, mismo mecanismo de redaccion que logging.
test('record redacta tags sensibles antes de guardar la muestra', () => {
  const collector = new MetricsCollector({ retentionDays: 30 });
  const now = new Date('2026-09-10T00:00:00Z');

  collector.record('outreach.sent', 'counter', 1, { email: 'contacto@empresa.com', channel: 'email' }, now);

  const samples = collector.samplesFor('outreach.sent');
  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.tags['email'], '[REDACTED]');
  assert.equal(samples[0]?.tags['channel'], 'email');
});

// "Retention" (accion 5 del packet).
test('record aplica retencion automaticamente en cada escritura', () => {
  const collector = new MetricsCollector({ retentionDays: 7 });
  const old = new Date('2026-08-01T00:00:00Z'); // > 7 dias antes de la siguiente escritura
  const recent = new Date('2026-09-10T00:00:00Z');

  collector.record('job.duration_ms', 'histogram', 100, {}, old);
  collector.record('job.duration_ms', 'histogram', 200, {}, recent);

  // La segunda escritura ya purgo automaticamente la muestra vencida -- no
  // hace falta una llamada explicita a applyRetention para que surta efecto.
  const remaining = collector.samplesFor('job.duration_ms');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.value, 200);
});

test('applyRetention purga explicitamente muestras vencidas cuando avanza "now"', () => {
  const collector = new MetricsCollector({ retentionDays: 7 });
  const insertionTime = new Date('2026-08-01T00:00:00Z');

  // Ambas muestras se insertan en el mismo instante -- la retencion
  // automatica de `record` no purga nada todavia (ninguna esta vencida
  // respecto de si misma).
  collector.record('job.duration_ms', 'histogram', 100, {}, insertionTime);
  collector.record('job.duration_ms', 'histogram', 200, {}, insertionTime);
  assert.equal(collector.samplesFor('job.duration_ms').length, 2);

  const later = new Date('2026-09-10T00:00:00Z'); // > 7 dias despues
  const purgedCount = collector.applyRetention(later);
  assert.equal(purgedCount, 2);
  assert.equal(collector.samplesFor('job.duration_ms').length, 0);
});

test('metricNames devuelve nombres unicos y ordenados de las metricas retenidas', () => {
  const collector = new MetricsCollector({ retentionDays: 30 });
  const now = new Date('2026-09-10T00:00:00Z');
  collector.record('b.metric', 'counter', 1, {}, now);
  collector.record('a.metric', 'counter', 1, {}, now);
  collector.record('a.metric', 'counter', 2, {}, now);

  assert.deepEqual(collector.metricNames(), ['a.metric', 'b.metric']);
});
