import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AuthorizationDecision } from '@rhia/policy';
import { evaluatePolicyViolationAlerts, type PolicyDecisionEvent } from './policy-violation.js';

const now = new Date('2026-09-10T12:00:00Z');
const deny: AuthorizationDecision = { outcome: 'DENY', code: 'RHIA_POLICY_DENIED', reason: 'sin permiso' };
const allow: AuthorizationDecision = { outcome: 'ALLOW', reason: 'ok' };

const minutesAgo = (m: number): string => new Date(now.getTime() - m * 60 * 1000).toISOString();

test('Simulated incident -- Policy violation: 5 DENY reales del mismo principal+accion en la ventana producen un Alert (patron, no ruido)', () => {
  const events: PolicyDecisionEvent[] = Array.from({ length: 5 }, (_, i) => ({
    principalId: 'agent-1',
    action: 'DEPLOY_BREAKING',
    decision: deny,
    occurredAt: minutesAgo(10 - i),
  }));
  const alerts = evaluatePolicyViolationAlerts(events, undefined, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.id, 'POLICY_VIOLATION:agent-1::DEPLOY_BREAKING');
  assert.ok(alerts[0]!.cause.includes('5 decisiones reales DENY'));
});

test('control positivo -- error a evitar "alertas por cada error individual": un solo DENY aislado NUNCA alerta', () => {
  const events: PolicyDecisionEvent[] = [{ principalId: 'user-1', action: 'CHANGE_PRICE', decision: deny, occurredAt: minutesAgo(1) }];
  const alerts = evaluatePolicyViolationAlerts(events, undefined, now);
  assert.deepEqual(alerts, []);
});

test('control positivo -- decisiones ALLOW nunca cuentan hacia el patron, sin importar cuantas haya', () => {
  const events: PolicyDecisionEvent[] = Array.from({ length: 10 }, () => ({ principalId: 'agent-1', action: 'READ_OPERATIONS', decision: allow, occurredAt: minutesAgo(2) }));
  const alerts = evaluatePolicyViolationAlerts(events, undefined, now);
  assert.deepEqual(alerts, []);
});

test('DENY fuera de la ventana de tiempo no cuenta hacia el patron', () => {
  const events: PolicyDecisionEvent[] = Array.from({ length: 5 }, () => ({ principalId: 'agent-1', action: 'DEPLOY_BREAKING', decision: deny, occurredAt: minutesAgo(60) })); // fuera de la ventana default de 15 min
  const alerts = evaluatePolicyViolationAlerts(events, undefined, now);
  assert.deepEqual(alerts, []);
});

test('DENY de distintos principales/acciones no se mezclan -- cada combinacion se evalua por separado', () => {
  const events: PolicyDecisionEvent[] = [
    ...Array.from({ length: 5 }, () => ({ principalId: 'agent-1', action: 'DEPLOY_BREAKING' as const, decision: deny, occurredAt: minutesAgo(5) })),
    ...Array.from({ length: 2 }, () => ({ principalId: 'agent-2', action: 'DEPLOY_BREAKING' as const, decision: deny, occurredAt: minutesAgo(5) })),
  ];
  const alerts = evaluatePolicyViolationAlerts(events, undefined, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.id, 'POLICY_VIOLATION:agent-1::DEPLOY_BREAKING');
});
