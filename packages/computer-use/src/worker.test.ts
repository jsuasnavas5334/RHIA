import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComputerUseWorker, describeTrace } from './worker.js';
import { FakeComputerUseDriver } from './testing/fake-driver.js';
import type { ComputerUseTask, ComputerUseApprovalProof } from './contracts.js';
import type { SecretResolver } from './driver.js';

const now = () => new Date('2026-09-10T12:00:00Z');

const task = (overrides: Partial<ComputerUseTask> = {}): ComputerUseTask => ({
  id: 'task-checkout',
  organizationId: 'org-1',
  allowedDomains: ['app.example.com'],
  maxSteps: 3,
  defaultTimeoutMs: 200,
  steps: [
    { id: 'step-click', riskLevel: 'LOW', action: { kind: 'MOVE_CLICK', coordinates: { x: 100, y: 200 }, targetDescription: 'boton "editar perfil"' } },
    { id: 'step-type', riskLevel: 'LOW', action: { kind: 'TYPE', targetDescription: 'campo nombre', input: { kind: 'LITERAL', value: 'Ana' } } },
    { id: 'step-confirm', riskLevel: 'HIGH', action: { kind: 'KEY_PRESS', key: 'Enter' } },
  ],
  ...overrides,
});

const approvalFor = (t: ComputerUseTask, stepId: string, approvedByHumanId = 'human-approver'): ComputerUseApprovalProof => ({
  taskId: t.id,
  stepId,
  status: 'APPROVED',
  organizationId: t.organizationId,
  approvedByHumanId,
  expiresAt: '2026-09-11T00:00:00Z',
});

test('tarea invalida se RECHAZA sin crear ninguna sesion sandbox', async () => {
  const driver = new FakeComputerUseDriver();
  const worker = new ComputerUseWorker(driver, { now });
  const result = await worker.run({ id: '', organizationId: '', allowedDomains: [], maxSteps: 0, defaultTimeoutMs: -1, steps: [] });
  assert.equal(result.outcome, 'REJECTED');
  assert.equal(driver.createdProfiles.length, 0);
});

test('tarea completa real (incluye un step HIGH con aprobacion valida) -- COMPLETED con trace de 3 entradas EXECUTED', async () => {
  const driver = new FakeComputerUseDriver();
  const worker = new ComputerUseWorker(driver, { now, requestingHumanId: 'human-requester' });
  const t = task();
  const result = await worker.run(t, { approvals: [approvalFor(t, 'step-confirm')] });
  assert.equal(result.outcome, 'COMPLETED');
  if (result.outcome === 'COMPLETED') {
    assert.equal(result.trace.length, 3);
    assert.ok(result.trace.every((entry) => entry.outcome === 'EXECUTED'));
  }
  assert.equal(driver.closedContextIds.length, 1);
});

// Accion "Sandbox browser" + reuso del principio de aislamiento de @rhia/playwright-worker.
test('dos corridas de la MISMA tarea usan sesiones/perfiles aislados distintos, ambas se cierran', async () => {
  const driver = new FakeComputerUseDriver();
  const worker = new ComputerUseWorker(driver, { now });
  const t = task({ steps: [task().steps[0]!] });
  await worker.run(t);
  await worker.run(t);
  assert.equal(driver.createdProfiles.length, 2);
  assert.notEqual(driver.createdProfiles[0]?.profileId, driver.createdProfiles[1]?.profileId);
  assert.equal(driver.closedContextIds.length, 2);
});

// Prueba requerida "Unexpected modal".
test('Prueba requerida "Unexpected modal" -- un modal real detectado antes de actuar escala a humano, nunca intenta seguir solo', async () => {
  const driver = new FakeComputerUseDriver();
  driver.currentModalDetected = true;
  const worker = new ComputerUseWorker(driver, { now });
  const result = await worker.run(task());
  assert.equal(result.outcome, 'ESCALATED_TO_HUMAN');
  if (result.outcome === 'ESCALATED_TO_HUMAN') {
    assert.equal(result.stepId, 'step-click');
    assert.equal(result.trace.length, 1);
    assert.equal(result.trace[0]?.outcome, 'BLOCKED');
    assert.ok(result.reason.toLowerCase().includes('modal'));
  }
  // Nunca se llego a intentar el click real.
  assert.equal(driver.clickedCoordinates.length, 0);
  assert.equal(driver.closedContextIds.length, 1);
});

// Prueba requerida "Wrong page" + criterio "No accede dominios no autorizados".
test('Prueba requerida "Wrong page" -- la URL real observada fuera de la allowlist produce FAILED sin ejecutar la accion', async () => {
  const driver = new FakeComputerUseDriver();
  driver.currentUrl = 'https://evil.example.com/phishing';
  const worker = new ComputerUseWorker(driver, { now });
  const result = await worker.run(task());
  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') {
    assert.equal(result.error.code, 'RHIA_COMPUTER_USE_DOMAIN_FORBIDDEN');
    assert.equal(result.stepId, 'step-click');
  }
  assert.equal(driver.clickedCoordinates.length, 0);
});

// Prueba requerida "Sensitive action" + criterio "High-risk action requiere approval".
test('Prueba requerida "Sensitive action" -- un step HIGH sin aprobacion escala a humano, nunca se ejecuta', async () => {
  const driver = new FakeComputerUseDriver();
  const worker = new ComputerUseWorker(driver, { now });
  const result = await worker.run(task());
  assert.equal(result.outcome, 'ESCALATED_TO_HUMAN');
  if (result.outcome === 'ESCALATED_TO_HUMAN') {
    assert.equal(result.stepId, 'step-confirm');
    assert.ok(result.reason.includes('HIGH'));
  }
  // Los 2 steps LOW previos SI se ejecutaron -- solo el de riesgo alto se bloquea.
  assert.equal(driver.clickedCoordinates.length, 1);
  assert.equal(driver.typedValues.length, 1);
});

test('un step LOW/MEDIUM nunca exige aprobacion aunque no se entregue ninguna', async () => {
  const driver = new FakeComputerUseDriver();
  const worker = new ComputerUseWorker(driver, { now });
  const t = task({ steps: [task().steps[0]!, task().steps[1]!] });
  const result = await worker.run(t);
  assert.equal(result.outcome, 'COMPLETED');
});

test('una aprobacion AUTO-otorgada por quien pide la corrida NUNCA es valida -- mismo principio real que @rhia/policy#authorize', async () => {
  const driver = new FakeComputerUseDriver();
  const worker = new ComputerUseWorker(driver, { now, requestingHumanId: 'human-requester' });
  const t = task();
  const selfApproval = approvalFor(t, 'step-confirm', 'human-requester');
  const result = await worker.run(t, { approvals: [selfApproval] });
  assert.equal(result.outcome, 'ESCALATED_TO_HUMAN');
});

test('una aprobacion expirada NUNCA es valida', async () => {
  const driver = new FakeComputerUseDriver();
  const worker = new ComputerUseWorker(driver, { now });
  const t = task();
  const expired: ComputerUseApprovalProof = { ...approvalFor(t, 'step-confirm'), expiresAt: '2026-09-01T00:00:00Z' };
  const result = await worker.run(t, { approvals: [expired] });
  assert.equal(result.outcome, 'ESCALATED_TO_HUMAN');
});

test('una aprobacion de OTRA organizacion NUNCA es valida', async () => {
  const driver = new FakeComputerUseDriver();
  const worker = new ComputerUseWorker(driver, { now });
  const t = task();
  const wrongOrg: ComputerUseApprovalProof = { ...approvalFor(t, 'step-confirm'), organizationId: 'org-otra' };
  const result = await worker.run(t, { approvals: [wrongOrg] });
  assert.equal(result.outcome, 'ESCALATED_TO_HUMAN');
});

// Timeout real.
test('un step que cuelga mas alla de su timeoutMs produce RHIA_WORKFLOW_TIMEOUT real, sin colgar el worker', async () => {
  const driver = new FakeComputerUseDriver();
  driver.program('moveAndClick', { kind: 'hang' });
  const worker = new ComputerUseWorker(driver, { now });
  const startedAt = Date.now();
  const result = await worker.run(task({ defaultTimeoutMs: 50 }));
  const elapsedMs = Date.now() - startedAt;
  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') assert.equal(result.error.code, 'RHIA_WORKFLOW_TIMEOUT');
  assert.ok(elapsedMs < 2000, `se esperaba que resolviera cerca de 50ms, tardo ${elapsedMs}ms`);
});

// Credenciales no se loguean (mismo criterio que @rhia/playwright-worker, aplicado aqui).
test('Credenciales no se loguean: un TYPE con SECRET_REF resuelve el valor real solo para el driver, nunca aparece en el trace/resultado', async () => {
  const driver = new FakeComputerUseDriver();
  const secretResolver: SecretResolver = { resolve: async () => 'super-secreto-real-999' };
  const worker = new ComputerUseWorker(driver, { now, secretResolver });
  const t = task({
    steps: [{ id: 'step-type-pass', riskLevel: 'LOW', action: { kind: 'TYPE', targetDescription: 'campo password', input: { kind: 'SECRET_REF', ref: 'vault:x' } } }],
  });
  const result = await worker.run(t);
  assert.equal(result.outcome, 'COMPLETED');
  assert.deepEqual(driver.typedValues, ['super-secreto-real-999']);
  assert.equal(JSON.stringify(result).includes('super-secreto-real-999'), false);
});

// Criterio "Session trace auditable" + Validacion final "Replay/trace permite entender lo realizado".
test('describeTrace produce lineas legibles, en el orden real de ejecucion, sin ningun valor tipeado', async () => {
  const driver = new FakeComputerUseDriver();
  const worker = new ComputerUseWorker(driver, { now, requestingHumanId: 'human-requester' });
  const t = task();
  const result = await worker.run(t, { approvals: [approvalFor(t, 'step-confirm')] });
  assert.equal(result.outcome, 'COMPLETED');
  if (result.outcome === 'COMPLETED') {
    const lines = describeTrace(result.trace);
    assert.equal(lines.length, 3);
    assert.deepEqual(
      lines.map((line) => line.split(' ')[0]),
      ['step-click', 'step-type', 'step-confirm'],
    );
    assert.ok(lines.every((line) => !line.includes('Ana')));
    assert.ok(lines[0]?.includes('EXECUTED'));
  }
});

test('cada entrada del trace real incluye observacion (screenshot + url) antes y despues de un step ejecutado', async () => {
  const driver = new FakeComputerUseDriver();
  const worker = new ComputerUseWorker(driver, { now });
  const t = task({ steps: [task().steps[0]!] });
  const result = await worker.run(t);
  assert.equal(result.outcome, 'COMPLETED');
  if (result.outcome === 'COMPLETED') {
    const entry = result.trace[0];
    assert.ok(entry?.preObservation.screenshot.screenshotId);
    assert.ok(entry?.postObservation?.screenshot.screenshotId);
  }
});
