import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CapabilityKey, Principal } from '@rhia/policy';
import { authorizeToolInvocation } from './authorization.js';
import { validateToolManifest, type ToolManifest } from './contracts.js';
import { recordHealthCheck } from './health.js';

const now = () => new Date('2026-09-10T12:00:00Z');

const manifest: ToolManifest = (() => {
  const result = validateToolManifest({
    id: 'tool-web-search',
    name: 'Web Search',
    ownerRef: 'team-search',
    riskLevel: 'MEDIUM',
    requiredCapability: 'records.read',
    credentialRef: null,
    allowedDomains: ['api.searchprovider.com'],
    allowedActions: ['search'],
  });
  if (!result.valid) throw new Error('fixture manifest invalido');
  return result.manifest;
})();

const agentPrincipal = (capabilities: readonly CapabilityKey[]): Principal => ({
  kind: 'SERVICE',
  id: 'agent-1',
  organizationId: 'org-1',
  service: 'AGENT_SERVICE',
  capabilities,
});

const upHealth = recordHealthCheck('tool-web-search', 'UP', now);

test('Prueba requerida "Unauthorized tool" -- principal sin la capability requerida se rechaza con RHIA_TOOL_FORBIDDEN', () => {
  const decision = authorizeToolInvocation({ principal: agentPrincipal([]), manifest, health: upHealth, requestedAction: 'search' });
  assert.equal(decision.outcome, 'DENY');
  if (decision.outcome === 'DENY') assert.equal(decision.code, 'RHIA_TOOL_FORBIDDEN');
});

test('Validacion final del packet "Runtime rechaza tool fuera de capability" -- una capability que excede el techo real del servicio tambien se rechaza', () => {
  // 'approved-actions.execute' no esta en el techo real de AGENT_SERVICE (ver serviceCapabilityCeilings de @rhia/policy) aunque se lo pasemos como otorgado.
  const decision = authorizeToolInvocation({
    principal: agentPrincipal(['approved-actions.execute'] as readonly CapabilityKey[]),
    manifest: { ...manifest, requiredCapability: 'approved-actions.execute' as CapabilityKey },
    health: upHealth,
    requestedAction: 'search',
  });
  assert.equal(decision.outcome, 'DENY');
  if (decision.outcome === 'DENY') assert.equal(decision.code, 'RHIA_TOOL_FORBIDDEN');
});

test('un principal HUMAN nunca puede invocar una tool (concepto de capability de servicio)', () => {
  const humanPrincipal: Principal = { kind: 'HUMAN', id: 'user-1', organizationId: 'org-1', roles: ['ADMIN'] };
  const decision = authorizeToolInvocation({ principal: humanPrincipal, manifest, health: upHealth, requestedAction: 'search' });
  assert.equal(decision.outcome, 'DENY');
  if (decision.outcome === 'DENY') assert.equal(decision.code, 'RHIA_TOOL_FORBIDDEN');
});

test('Prueba requerida "Tool down" -- capability correcta pero salud no disponible se rechaza con RHIA_TOOL_UNAVAILABLE', () => {
  const decision = authorizeToolInvocation({ principal: agentPrincipal(['records.read']), manifest, health: recordHealthCheck('tool-web-search', 'DOWN', now), requestedAction: 'search' });
  assert.equal(decision.outcome, 'DENY');
  if (decision.outcome === 'DENY') assert.equal(decision.code, 'RHIA_TOOL_UNAVAILABLE');
});

test('Tool down tambien cubre el caso sin ningun chequeo de salud real (undefined)', () => {
  const decision = authorizeToolInvocation({ principal: agentPrincipal(['records.read']), manifest, health: undefined, requestedAction: 'search' });
  assert.equal(decision.outcome, 'DENY');
  if (decision.outcome === 'DENY') assert.equal(decision.code, 'RHIA_TOOL_UNAVAILABLE');
});

test('accion fuera de las permitidas se rechaza con RHIA_TOOL_ACTION_FORBIDDEN', () => {
  const decision = authorizeToolInvocation({ principal: agentPrincipal(['records.read']), manifest, health: upHealth, requestedAction: 'delete-everything' });
  assert.equal(decision.outcome, 'DENY');
  if (decision.outcome === 'DENY') assert.equal(decision.code, 'RHIA_TOOL_ACTION_FORBIDDEN');
});

test('dominio fuera de los permitidos se rechaza con RHIA_TOOL_DOMAIN_FORBIDDEN', () => {
  const decision = authorizeToolInvocation({ principal: agentPrincipal(['records.read']), manifest, health: upHealth, requestedAction: 'search', requestedDomain: 'evil.example.com' });
  assert.equal(decision.outcome, 'DENY');
  if (decision.outcome === 'DENY') assert.equal(decision.code, 'RHIA_TOOL_DOMAIN_FORBIDDEN');
});

test('con capability real, salud UP, accion y dominio permitidos -- ALLOW real', () => {
  const decision = authorizeToolInvocation({ principal: agentPrincipal(['records.read']), manifest, health: upHealth, requestedAction: 'search', requestedDomain: 'api.searchprovider.com' });
  assert.equal(decision.outcome, 'ALLOW');
});
