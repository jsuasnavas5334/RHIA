import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRetentionCutoff, partitionByRetention } from './retention.js';

test('computeRetentionCutoff calcula el instante limite segun retentionDays', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const cutoff = computeRetentionCutoff({ retentionDays: 10 }, now);
  assert.ok(cutoff);
  assert.equal(cutoff?.toISOString(), '2026-08-31T00:00:00.000Z');
});

test('computeRetentionCutoff devuelve null para una politica invalida (retentionDays negativo o no finito)', () => {
  assert.equal(computeRetentionCutoff({ retentionDays: -1 }), null);
  assert.equal(computeRetentionCutoff({ retentionDays: Number.NaN }), null);
});

test('partitionByRetention separa registros vencidos de vigentes', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const records = [
    { id: 'a', occurredAt: new Date('2026-09-09T00:00:00Z') }, // 1 dia -> vigente
    { id: 'b', occurredAt: new Date('2026-08-01T00:00:00Z') }, // ~40 dias -> vencido
    { id: 'c', occurredAt: new Date('2026-09-10T00:00:00Z') }, // exacto ahora -> vigente
  ];

  const { keep, purge } = partitionByRetention(records, { retentionDays: 7 }, now);
  assert.deepEqual(keep.map((r) => r.id), ['a', 'c']);
  assert.deepEqual(purge.map((r) => r.id), ['b']);
});

test('partitionByRetention purga (no conserva silenciosamente) un registro con fecha invalida', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const records = [{ id: 'bad', occurredAt: 'no-es-una-fecha' }];
  const { keep, purge } = partitionByRetention(records, { retentionDays: 30 }, now);
  assert.equal(keep.length, 0);
  assert.equal(purge.length, 1);
});

test('partitionByRetention con retentionDays 0 purga todo lo anterior a "now"', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const records = [
    { id: 'past', occurredAt: new Date('2026-09-09T23:59:59Z') },
    { id: 'now', occurredAt: now },
  ];
  const { keep, purge } = partitionByRetention(records, { retentionDays: 0 }, now);
  assert.deepEqual(keep.map((r) => r.id), ['now']);
  assert.deepEqual(purge.map((r) => r.id), ['past']);
});
