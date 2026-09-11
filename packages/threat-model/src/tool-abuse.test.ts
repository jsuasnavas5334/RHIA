// Threat Model (PH10-T003), accion 3 del packet: "Tool abuse".
//
// Cubre 4 vectores reales de abuso: (1) un agente que intenta invocar una
// accion de una tool fuera de las declaradas en su manifest, (2) un agente
// que intenta usar una tool cuya salud real no esta UP/DEGRADED (herramienta
// comprometida/caida), (3) un intento de registrar un manifest de tool que
// filtra una credencial real en `credentialRef` (smuggling de secretos via
// registro de tools), y (4) un intento de smuggling de credenciales via un
// literal de formulario (`TYPE`) en un `Scenario`/`ComputerUseTask`, en vez
// de una `SECRET_REF` real -- los 3 paquetes puros ya rechazan esto
// (`validateToolManifest`/`validateScenario`/`validateTask`), esta prueba lo
// confirma con evidencia real.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ToolRegistry, authorizeToolInvocation, recordHealthCheck, validateToolManifest } from '@rhia/tool-registry';
import { validateScenario } from '@rhia/playwright-worker';
import { validateTask } from '@rhia/computer-use';
import type { Principal } from '@rhia/policy';

const now = () => new Date('2026-09-10T12:00:00Z');

test('Tool abuse -- una accion no declarada en allowedActions se rechaza con RHIA_TOOL_ACTION_FORBIDDEN', () => {
  const manifestResult = validateToolManifest({
    id: 'tool-crm',
    name: 'CRM',
    ownerRef: 'team-crm',
    riskLevel: 'MEDIUM',
    requiredCapability: 'records.write',
    credentialRef: null,
    allowedDomains: ['api.crm.example.com'],
    allowedActions: ['GET', 'POST'],
  });
  if (!manifestResult.valid) throw new Error('fixture invalida');
  const principal: Principal = { kind: 'SERVICE', id: 'agent-1', organizationId: 'org-1', service: 'AGENT_SERVICE', capabilities: ['records.write'] };
  const decision = authorizeToolInvocation({
    principal,
    manifest: manifestResult.manifest,
    health: recordHealthCheck('tool-crm', 'UP', now),
    requestedAction: 'DELETE', // fuera de lo declarado -- intento real de abuso
  });
  assert.equal(decision.outcome, 'DENY');
  if (decision.outcome === 'DENY') assert.equal(decision.code, 'RHIA_TOOL_ACTION_FORBIDDEN');
});

test('Tool abuse -- una tool con salud DOWN (posiblemente comprometida) nunca se autoriza aunque la capability sea correcta', () => {
  const manifestResult = validateToolManifest({
    id: 'tool-crm-2',
    name: 'CRM',
    ownerRef: 'team-crm',
    riskLevel: 'HIGH',
    requiredCapability: 'records.write',
    credentialRef: null,
    allowedDomains: ['api.crm.example.com'],
    allowedActions: ['POST'],
  });
  if (!manifestResult.valid) throw new Error('fixture invalida');
  const principal: Principal = { kind: 'SERVICE', id: 'agent-1', organizationId: 'org-1', service: 'AGENT_SERVICE', capabilities: ['records.write'] };
  const decision = authorizeToolInvocation({
    principal,
    manifest: manifestResult.manifest,
    health: recordHealthCheck('tool-crm-2', 'DOWN', now, 'circuit breaker abierto -- posible incidente'),
    requestedAction: 'POST',
  });
  assert.equal(decision.outcome, 'DENY');
  if (decision.outcome === 'DENY') assert.equal(decision.code, 'RHIA_TOOL_UNAVAILABLE');
});

test('Tool abuse -- un manifest que intenta registrar una credencial REAL (no una referencia) en credentialRef se rechaza al validar, nunca llega al registro', () => {
  const registry = new ToolRegistry();
  const result = registry.register({
    id: 'tool-malicious',
    name: 'Tool sospechosa',
    ownerRef: 'team-x',
    riskLevel: 'LOW',
    requiredCapability: 'records.read',
    credentialRef: 'sk-abcdefghijklmnopqrstuvwxyz123456', // secreto real pegado por error/abuso
    allowedDomains: [],
    allowedActions: ['noop'],
  });
  assert.equal(result.outcome, 'REJECTED');
  if (result.outcome === 'REJECTED') {
    assert.ok(result.errors.some((e) => e.field === 'credentialRef'));
  }
  assert.equal(registry.get('tool-malicious'), undefined);
});

test('Tool abuse -- un Scenario de playwright-worker que intenta tipear un literal con forma de credencial real se rechaza en validateScenario, nunca llega al driver', () => {
  const result = validateScenario({
    id: 'scn-login-abuse',
    allowedDomains: ['app.example.com'],
    defaultTimeoutMs: 1000,
    steps: [
      {
        id: 'step-1',
        action: {
          kind: 'TYPE',
          selector: { strategies: [{ kind: 'css', value: '#password' }] },
          input: { kind: 'LITERAL', value: 'sk-abcdefghijklmnopqrstuvwxyz123456' },
        },
      },
    ],
  });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((e) => e.field.endsWith('input.value')));
});

test('Tool abuse -- una ComputerUseTask que intenta tipear un literal con forma de credencial real tambien se rechaza en validateTask', () => {
  const result = validateTask({
    id: 'task-login-abuse',
    organizationId: 'org-1',
    allowedDomains: ['app.example.com'],
    maxSteps: 1,
    defaultTimeoutMs: 1000,
    steps: [
      {
        id: 'step-1',
        riskLevel: 'LOW',
        action: { kind: 'TYPE', input: { kind: 'LITERAL', value: 'AKIAABCDEFGHIJKLMNOP' }, targetDescription: 'campo de contraseña' },
      },
    ],
  });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((e) => e.field.endsWith('input.value')));
});

test('control positivo -- el mismo escenario con SECRET_REF (nunca el valor real) SI es valido', () => {
  const result = validateScenario({
    id: 'scn-login-ok',
    allowedDomains: ['app.example.com'],
    defaultTimeoutMs: 1000,
    steps: [
      {
        id: 'step-1',
        action: { kind: 'TYPE', selector: { strategies: [{ kind: 'css', value: '#password' }] }, input: { kind: 'SECRET_REF', ref: 'vault:crm:login-password' } },
      },
    ],
  });
  assert.equal(result.valid, true);
});
