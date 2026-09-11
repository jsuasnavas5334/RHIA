import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBounceSpikeAlert, type BounceSample } from './bounce.js';

const now = new Date('2026-09-10T12:00:00Z');

const samplesWithBounceRate = (total: number, bounced: number): BounceSample[] => {
  const samples: BounceSample[] = [];
  for (let i = 0; i < bounced; i += 1) samples.push({ status: 'BOUNCED' });
  for (let i = 0; i < total - bounced; i += 1) samples.push({ status: 'DELIVERED' });
  return samples;
};

test('Simulated incident -- Bounce spike: 10% de rebote sobre 30 muestras (umbral 5%) produce un Alert', () => {
  const alerts = evaluateBounceSpikeAlert(samplesWithBounceRate(30, 3), undefined, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.category, 'BOUNCE_SPIKE');
  assert.equal(alerts[0]!.runbookRef, 'docs/runbooks/alerting-runbook.md#bounce-spike');
});

test('una tasa 3x el umbral escala a CRITICAL', () => {
  const alerts = evaluateBounceSpikeAlert(samplesWithBounceRate(30, 6), undefined, now); // 20% >= 5%*3
  assert.equal(alerts[0]!.severity, 'CRITICAL');
});

test('control positivo -- una muestra insuficiente (menos de minSampleSize) nunca alerta aunque la tasa parezca alta', () => {
  const alerts = evaluateBounceSpikeAlert(samplesWithBounceRate(10, 3), undefined, now); // 30% de rebote pero solo 10 muestras < minSampleSize 20
  assert.deepEqual(alerts, []);
});

test('control positivo -- una tasa de rebote por debajo del umbral no alerta', () => {
  const alerts = evaluateBounceSpikeAlert(samplesWithBounceRate(30, 1), undefined, now); // ~3.3% < 5%
  assert.deepEqual(alerts, []);
});

test('estados que no son SENT/DELIVERED/BOUNCED (PLANNED, OPTED_OUT, etc.) no participan del calculo de tasa', () => {
  const samples: BounceSample[] = [
    ...samplesWithBounceRate(20, 1), // 5% real de la muestra relevante
    { status: 'PLANNED' },
    { status: 'OPTED_OUT' },
    { status: 'CANCELLED' },
  ];
  const alerts = evaluateBounceSpikeAlert(samples, undefined, now);
  assert.equal(alerts.length, 1);
  assert.ok(alerts[0]!.cause.includes('20 touches'));
});
