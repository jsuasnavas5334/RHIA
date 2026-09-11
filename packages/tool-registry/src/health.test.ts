import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordHealthCheck, isToolAvailable } from './health.js';

const now = () => new Date('2026-09-10T12:00:00Z');

test('recordHealthCheck construye un registro real con el timestamp dado', () => {
  const record = recordHealthCheck('tool-1', 'UP', now);
  assert.equal(record.toolId, 'tool-1');
  assert.equal(record.status, 'UP');
  assert.equal(record.checkedAt, now().toISOString());
});

test('Prueba requerida "Tool down" -- DOWN nunca se considera disponible', () => {
  assert.equal(isToolAvailable(recordHealthCheck('tool-1', 'DOWN', now)), false);
});

test('UNKNOWN (sin chequeo real, o nunca chequeada) tampoco se considera disponible -- fail-closed', () => {
  assert.equal(isToolAvailable(undefined), false);
  assert.equal(isToolAvailable(recordHealthCheck('tool-1', 'UNKNOWN', now)), false);
});

test('UP y DEGRADED SI se consideran disponibles', () => {
  assert.equal(isToolAvailable(recordHealthCheck('tool-1', 'UP', now)), true);
  assert.equal(isToolAvailable(recordHealthCheck('tool-1', 'DEGRADED', now)), true);
});
