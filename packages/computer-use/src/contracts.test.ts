import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiresApproval, validateTask } from './contracts.js';

const baseTask = () => ({
  id: 'task-1',
  organizationId: 'org-1',
  allowedDomains: ['app.example.com'],
  maxSteps: 5,
  defaultTimeoutMs: 2000,
  steps: [
    { id: 'step-1', riskLevel: 'LOW', action: { kind: 'MOVE_CLICK', coordinates: { x: 10, y: 20 }, targetDescription: 'boton enviar' } },
  ],
});

test('tarea minima real valida es aceptada', () => {
  assert.equal(validateTask(baseTask()).valid, true);
});

test('id/organizationId vacios se rechazan', () => {
  assert.equal(validateTask({ ...baseTask(), id: '' }).valid, false);
  assert.equal(validateTask({ ...baseTask(), organizationId: '' }).valid, false);
});

// Criterio "No accede dominios no autorizados".
test('allowedDomains vacio se rechaza -- fail-closed', () => {
  const result = validateTask({ ...baseTask(), allowedDomains: [] });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.field === 'allowedDomains'));
});

// Accion "Step limits".
test('steps.length que excede maxSteps se rechaza -- techo real y duro', () => {
  const task = {
    ...baseTask(),
    maxSteps: 1,
    steps: [
      { id: 'step-1', riskLevel: 'LOW', action: { kind: 'WAIT', ms: 10 } },
      { id: 'step-2', riskLevel: 'LOW', action: { kind: 'WAIT', ms: 10 } },
    ],
  };
  const result = validateTask(task);
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.reason.includes('Step limits')));
});

test('maxSteps invalido (0 o no entero) se rechaza', () => {
  assert.equal(validateTask({ ...baseTask(), maxSteps: 0 }).valid, false);
  assert.equal(validateTask({ ...baseTask(), maxSteps: 1.5 }).valid, false);
});

test('riskLevel invalido se rechaza', () => {
  const task = { ...baseTask(), steps: [{ id: 'step-1', riskLevel: 'SUPER_HIGH', action: { kind: 'WAIT', ms: 10 } }] };
  assert.equal(validateTask(task).valid, false);
});

test('ids de step duplicados se rechazan', () => {
  const task = {
    ...baseTask(),
    steps: [
      { id: 'dup', riskLevel: 'LOW', action: { kind: 'WAIT', ms: 10 } },
      { id: 'dup', riskLevel: 'LOW', action: { kind: 'WAIT', ms: 10 } },
    ],
  };
  assert.equal(validateTask(task).valid, false);
});

test('MOVE_CLICK sin targetDescription se rechaza -- necesario para "Session trace auditable"', () => {
  const task = { ...baseTask(), steps: [{ id: 'step-1', riskLevel: 'LOW', action: { kind: 'MOVE_CLICK', coordinates: { x: 1, y: 1 }, targetDescription: '' } }] };
  assert.equal(validateTask(task).valid, false);
});

test('MOVE_CLICK con coordinates invalidas se rechaza', () => {
  const task = { ...baseTask(), steps: [{ id: 'step-1', riskLevel: 'LOW', action: { kind: 'MOVE_CLICK', coordinates: { x: '1', y: 1 }, targetDescription: 'x' } }] };
  assert.equal(validateTask(task).valid, false);
});

// Regla fija del proyecto (reusa looksLikeRawSecret real de @rhia/tool-registry).
test('un TYPE con LITERAL que parece un secreto real se rechaza -- debe usar SECRET_REF', () => {
  const task = {
    ...baseTask(),
    steps: [{ id: 'step-1', riskLevel: 'LOW', action: { kind: 'TYPE', targetDescription: 'campo password', input: { kind: 'LITERAL', value: 'Bearer sometoken12345678901234567890' } } }],
  };
  const result = validateTask(task);
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.reason.includes('SECRET_REF')));
});

test('un TYPE con SECRET_REF valido es aceptado', () => {
  const task = {
    ...baseTask(),
    steps: [{ id: 'step-1', riskLevel: 'HIGH', action: { kind: 'TYPE', targetDescription: 'campo password', input: { kind: 'SECRET_REF', ref: 'vault:x' } } }],
  };
  assert.equal(validateTask(task).valid, true);
});

test('KEY_PRESS sin key y WAIT sin ms valido se rechazan', () => {
  assert.equal(validateTask({ ...baseTask(), steps: [{ id: 's', riskLevel: 'LOW', action: { kind: 'KEY_PRESS', key: '' } }] }).valid, false);
  assert.equal(validateTask({ ...baseTask(), steps: [{ id: 's', riskLevel: 'LOW', action: { kind: 'WAIT', ms: -1 } }] }).valid, false);
});

// Accion "Risk checkpoints".
test('requiresApproval: solo HIGH/CRITICAL requieren aprobacion', () => {
  assert.equal(requiresApproval('LOW'), false);
  assert.equal(requiresApproval('MEDIUM'), false);
  assert.equal(requiresApproval('HIGH'), true);
  assert.equal(requiresApproval('CRITICAL'), true);
});

test('root no-objeto se rechaza', () => {
  assert.equal(validateTask('no es una tarea').valid, false);
  assert.equal(validateTask(null).valid, false);
});
