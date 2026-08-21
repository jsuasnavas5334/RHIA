import assert from 'node:assert/strict';
import test from 'node:test';
import { authorize, type ApprovalProof, type Principal } from './index.js';

const organizationId = 'organization-1';
const manager: Principal = { kind: 'HUMAN', id: 'manager-1', organizationId, roles: ['MANAGER'] };
const admin: Principal = { kind: 'HUMAN', id: 'admin-1', organizationId, roles: ['ADMIN'] };
const operator: Principal = { kind: 'HUMAN', id: 'operator-1', organizationId, roles: ['OPERATOR'] };
const agent: Principal = {
  kind: 'SERVICE', id: 'agent-1', organizationId, service: 'AGENT_SERVICE',
  capabilities: ['records.read', 'records.write', 'jobs.execute', 'approvals.request', 'outreach.send'],
};
const worker: Principal = {
  kind: 'SERVICE', id: 'worker-1', organizationId, service: 'WORKER_SERVICE',
  capabilities: ['approved-actions.execute'],
};
const priceApproval: ApprovalProof = {
  action: 'CHANGE_PRICE', status: 'APPROVED', organizationId, approvedByHumanId: 'manager-1', expiresAt: '2030-01-01T00:00:00Z',
};

test('roles humanos aplican mínimo privilegio', () => {
  assert.equal(authorize(operator, 'WRITE_OPERATIONS').outcome, 'ALLOW');
  assert.equal(authorize(operator, 'CHANGE_PRICE').outcome, 'DENY');
  assert.equal(authorize({ kind: 'HUMAN', id: 'viewer-1', organizationId, roles: ['VIEWER'] }, 'START_JOB').outcome, 'DENY');
});

test('precio y compromiso nunca se ejecutan sin aprobación humana', () => {
  assert.equal(authorize(admin, 'CHANGE_PRICE').outcome, 'APPROVAL_REQUIRED');
  assert.equal(authorize(manager, 'COMMERCIAL_COMMITMENT').outcome, 'APPROVAL_REQUIRED');
  assert.notEqual(authorize(agent, 'CHANGE_PRICE').outcome, 'ALLOW');
  assert.notEqual(authorize(agent, 'COMMERCIAL_COMMITMENT').outcome, 'ALLOW');
});

test('solo el executor limitado usa una aprobación válida', () => {
  assert.equal(authorize(worker, 'CHANGE_PRICE', priceApproval, new Date('2029-01-01T00:00:00Z')).outcome, 'ALLOW');
  assert.equal(authorize(worker, 'CHANGE_PRICE', { ...priceApproval, action: 'OFFER_DISCOUNT' }, new Date('2029-01-01T00:00:00Z')).outcome, 'APPROVAL_REQUIRED');
  assert.equal(authorize(worker, 'CHANGE_PRICE', { ...priceApproval, expiresAt: '2028-01-01T00:00:00Z' }, new Date('2029-01-01T00:00:00Z')).outcome, 'APPROVAL_REQUIRED');
});

test('autoaprobación humana no habilita una acción sensible', () => {
  assert.equal(authorize(manager, 'COMMERCIAL_COMMITMENT', {
    action: 'COMMERCIAL_COMMITMENT', status: 'APPROVED', organizationId, approvedByHumanId: 'manager-1',
  }).outcome, 'APPROVAL_REQUIRED');
});

test('approval de otra organización no cruza el tenant', () => {
  assert.equal(authorize(worker, 'CHANGE_PRICE', {
    ...priceApproval, organizationId: 'organization-2',
  }, new Date('2029-01-01T00:00:00Z')).outcome, 'APPROVAL_REQUIRED');
});

test('servicios no pueden autoelevar permisos aunque inyecten capabilities', () => {
  const forged = { ...agent, capabilities: [...agent.capabilities, 'approved-actions.execute'] } as Principal;
  assert.equal(authorize(forged, 'MANAGE_PERMISSIONS').outcome, 'DENY');
  assert.equal(authorize(forged, 'ROTATE_SECRET').outcome, 'DENY');
});

test('ceiling de servicio rechaza capability no permitida para agent', () => {
  const forged = { ...agent, capabilities: ['approved-actions.execute'] } as Principal;
  assert.equal(authorize(forged, 'CHANGE_PRICE', priceApproval, new Date('2029-01-01T00:00:00Z')).outcome, 'DENY');
});

test('operación ordinaria autorizada no requiere approval', () => {
  assert.equal(authorize(agent, 'READ_OPERATIONS').outcome, 'ALLOW');
  assert.equal(authorize(agent, 'SEND_OUTREACH').outcome, 'ALLOW');
});
