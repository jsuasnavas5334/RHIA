// Threat Model (PH10-T003), accion 5 del packet: "Privilege escalation".
// Prueba requerida del packet, nombrada explicitamente: "Role escalation".
//
// Cubre 3 vectores reales de escalacion revisados en `@rhia/policy` y
// `@rhia/computer-use` antes de escribir esta prueba: (1) un rol humano
// insuficiente intentando una accion que requiere mas permiso, (2) una
// identidad de SERVICIO que se auto-declara con MAS capabilities de las que
// su techo real (`serviceCapabilityCeilings`) permite, y (3) una aprobacion
// "HUMAN_REQUIRED" auto-otorgada por quien pide la accion (self-approval),
// tanto en `@rhia/policy#authorize` como en el checkpoint de riesgo
// equivalente de `@rhia/computer-use`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorize, type ApprovalProof, type Principal } from '@rhia/policy';
import { ComputerUseWorker, type ComputerUseApprovalProof, type ComputerUseDriver, type ComputerUseObservation, type ComputerUseTask } from '@rhia/computer-use';
import type { BrowserContextHandle } from '@rhia/playwright-worker';

const now = () => new Date('2026-09-10T12:00:00Z');

test('Role escalation -- un VIEWER no puede DECIDE_APPROVAL (rol insuficiente)', () => {
  const viewer: Principal = { kind: 'HUMAN', id: 'user-1', organizationId: 'org-1', roles: ['VIEWER'] };
  const decision = authorize(viewer, 'DECIDE_APPROVAL');
  assert.equal(decision.outcome, 'DENY');
  assert.equal(decision.code, 'RHIA_POLICY_DENIED');
});

test('Role escalation -- un VIEWER no puede CHANGE_PRICE aunque intente aportar una ApprovalProof real (el permiso base falta antes de llegar al chequeo de aprobacion)', () => {
  const viewer: Principal = { kind: 'HUMAN', id: 'user-1', organizationId: 'org-1', roles: ['VIEWER'] };
  const approval: ApprovalProof = { action: 'CHANGE_PRICE', status: 'APPROVED', organizationId: 'org-1', approvedByHumanId: 'mgr-1' };
  const decision = authorize(viewer, 'CHANGE_PRICE', approval);
  assert.equal(decision.outcome, 'DENY');
  assert.equal(decision.code, 'RHIA_POLICY_DENIED');
});

test('Role escalation -- un OPERATOR no puede OFFER_DISCOUNT (falta commercial.approve, sin importar cualquier aprobacion)', () => {
  const operator: Principal = { kind: 'HUMAN', id: 'op-1', organizationId: 'org-1', roles: ['OPERATOR'] };
  const decision = authorize(operator, 'OFFER_DISCOUNT');
  assert.equal(decision.outcome, 'DENY');
  assert.equal(decision.code, 'RHIA_POLICY_DENIED');
});

test('Role escalation -- self-approval: un MANAGER con permiso real NO puede auto-aprobar su propia OFFER_DISCOUNT', () => {
  const manager: Principal = { kind: 'HUMAN', id: 'mgr-1', organizationId: 'org-1', roles: ['MANAGER'] };
  const selfApproval: ApprovalProof = { action: 'OFFER_DISCOUNT', status: 'APPROVED', organizationId: 'org-1', approvedByHumanId: 'mgr-1' };
  const decision = authorize(manager, 'OFFER_DISCOUNT', selfApproval);
  assert.equal(decision.outcome, 'APPROVAL_REQUIRED');
});

test('control positivo -- el mismo MANAGER SI puede ejecutar OFFER_DISCOUNT con una aprobacion real de OTRO humano', () => {
  const manager: Principal = { kind: 'HUMAN', id: 'mgr-1', organizationId: 'org-1', roles: ['MANAGER'] };
  const approval: ApprovalProof = { action: 'OFFER_DISCOUNT', status: 'APPROVED', organizationId: 'org-1', approvedByHumanId: 'mgr-2' };
  const decision = authorize(manager, 'OFFER_DISCOUNT', approval);
  assert.equal(decision.outcome, 'ALLOW');
});

test('Role escalation -- una identidad de SERVICIO que se auto-declara con capabilities fuera de su techo real NUNCA escala (el techo, no la auto-declaracion, decide)', () => {
  // N8N_SERVICE real (ver `serviceCapabilityCeilings` de @rhia/policy) NO
  // incluye 'approved-actions.execute' en su techo -- un principal forjado
  // que IGUAL reclama tenerla (p. ej. un token de servicio comprometido que
  // intenta declarar mas capabilities de las que le corresponden) sigue
  // siendo rechazado, porque `authorize()` valida contra el techo real, no
  // solo contra lo que el principal dice tener.
  const forgedServicePrincipal: Principal = {
    kind: 'SERVICE',
    id: 'n8n-1',
    organizationId: 'org-1',
    service: 'N8N_SERVICE',
    capabilities: ['records.read', 'records.write', 'jobs.execute', 'outreach.send', 'meetings.schedule', 'approved-actions.execute', 'approvals.request', 'outreach.draft'],
  };
  const decision = authorize(forgedServicePrincipal, 'CHANGE_PRICE');
  assert.equal(decision.outcome, 'DENY');
  assert.equal(decision.code, 'RHIA_TOOL_FORBIDDEN');
});

test('Role escalation -- ninguna identidad de SERVICIO puede ROTATE_SECRET/MANAGE_PERMISSIONS/DEPLOY_BREAKING (servicesForbidden), sin importar las capabilities que reclame', () => {
  const serviceWithEverything: Principal = {
    kind: 'SERVICE',
    id: 'worker-1',
    organizationId: 'org-1',
    service: 'WORKER_SERVICE',
    capabilities: ['records.read', 'records.write', 'jobs.execute', 'approved-actions.execute', 'outreach.send', 'meetings.schedule'],
  };
  for (const action of ['ROTATE_SECRET', 'MANAGE_PERMISSIONS', 'DEPLOY_BREAKING'] as const) {
    const decision = authorize(serviceWithEverything, action);
    assert.equal(decision.outcome, 'DENY', `${action} no debe ser alcanzable por una identidad de servicio`);
    assert.equal(decision.code, 'RHIA_POLICY_DENIED');
  }
});

class ApprovalRecordingDriver implements ComputerUseDriver {
  clickCount = 0;
  async createSandboxSession(): Promise<BrowserContextHandle> {
    return { contextId: 'ctx-1' };
  }
  async observe(): Promise<ComputerUseObservation> {
    return { screenshot: { screenshotId: 'shot-1', capturedAt: new Date(0).toISOString() }, currentUrl: 'https://app.example.com/checkout', modalDetected: false };
  }
  async moveAndClick(): Promise<void> {
    this.clickCount += 1;
  }
  async typeText(): Promise<void> {}
  async pressKey(): Promise<void> {}
  async wait(): Promise<void> {}
  async closeSession(): Promise<void> {}
}

test('Role escalation -- computer-use: un step CRITICAL auto-aprobado por quien pide la corrida se escala a humano, nunca se ejecuta', async () => {
  const driver = new ApprovalRecordingDriver();
  const worker = new ComputerUseWorker(driver, { now, requestingHumanId: 'mgr-1' });
  const task: ComputerUseTask = {
    id: 'task-checkout',
    organizationId: 'org-1',
    allowedDomains: ['app.example.com'],
    maxSteps: 1,
    defaultTimeoutMs: 1000,
    steps: [{ id: 'step-1', riskLevel: 'CRITICAL', action: { kind: 'MOVE_CLICK', coordinates: { x: 5, y: 5 }, targetDescription: 'boton confirmar compra' } }],
  };
  const selfApproval: ComputerUseApprovalProof = {
    taskId: 'task-checkout',
    stepId: 'step-1',
    status: 'APPROVED',
    organizationId: 'org-1',
    approvedByHumanId: 'mgr-1', // mismo humano que pide la corrida (requestingHumanId)
  };

  const result = await worker.run(task, { approvals: [selfApproval] });
  assert.equal(result.outcome, 'ESCALATED_TO_HUMAN');
  assert.equal(driver.clickCount, 0);
});

test('control positivo -- computer-use: el mismo step CRITICAL SI se ejecuta con una aprobacion real de OTRO humano', async () => {
  const driver = new ApprovalRecordingDriver();
  const worker = new ComputerUseWorker(driver, { now, requestingHumanId: 'mgr-1' });
  const task: ComputerUseTask = {
    id: 'task-checkout-2',
    organizationId: 'org-1',
    allowedDomains: ['app.example.com'],
    maxSteps: 1,
    defaultTimeoutMs: 1000,
    steps: [{ id: 'step-1', riskLevel: 'CRITICAL', action: { kind: 'MOVE_CLICK', coordinates: { x: 5, y: 5 }, targetDescription: 'boton confirmar compra' } }],
  };
  const realApproval: ComputerUseApprovalProof = {
    taskId: 'task-checkout-2',
    stepId: 'step-1',
    status: 'APPROVED',
    organizationId: 'org-1',
    approvedByHumanId: 'mgr-2',
  };
  const result = await worker.run(task, { approvals: [realApproval] });
  assert.equal(result.outcome, 'COMPLETED');
  assert.equal(driver.clickCount, 1);
});
