import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CapabilityKey, Principal } from '@rhia/policy';
import { ToolRegistry } from './registry.js';
import { recordHealthCheck, type ToolHealthRecord } from './health.js';

const now = () => new Date('2026-09-10T12:00:00Z');

const rawWebSearchTool = {
  id: 'tool-web-search',
  name: 'Web Search',
  ownerRef: 'team-search',
  riskLevel: 'MEDIUM',
  requiredCapability: 'records.read',
  credentialRef: null,
  allowedDomains: ['api.searchprovider.com'],
  allowedActions: ['search'],
};

const agentPrincipal = (capabilities: readonly CapabilityKey[]): Principal => ({
  kind: 'SERVICE',
  id: 'agent-1',
  organizationId: 'org-1',
  service: 'AGENT_SERVICE',
  capabilities,
});

test('register real acepta un manifest valido y rechaza un id duplicado', () => {
  const registry = new ToolRegistry();
  const first = registry.register(rawWebSearchTool);
  assert.equal(first.outcome, 'REGISTERED');
  const second = registry.register(rawWebSearchTool);
  assert.equal(second.outcome, 'DUPLICATE');
  assert.equal(registry.list().length, 1, 'un registro duplicado nunca sobreescribe en silencio');
});

test('register real rechaza un manifest invalido y no lo agrega a la lista', () => {
  const registry = new ToolRegistry();
  const result = registry.register({ ...rawWebSearchTool, riskLevel: 'NOPE' });
  assert.equal(result.outcome, 'REJECTED');
  assert.equal(registry.list().length, 0);
});

test('Criterio "Agent solo ve tools permitidas" -- un principal sin la capability requerida no ve la tool', () => {
  const registry = new ToolRegistry();
  registry.register(rawWebSearchTool);
  const health = new Map<string, ToolHealthRecord>([['tool-web-search', recordHealthCheck('tool-web-search', 'UP', now)]]);

  const withoutCapability = registry.listForPrincipal(agentPrincipal([]), health);
  assert.deepEqual(withoutCapability, []);

  const withCapability = registry.listForPrincipal(agentPrincipal(['records.read']), health);
  assert.equal(withCapability.length, 1);
  assert.equal(withCapability[0]?.id, 'tool-web-search');
});

test('un principal humano nunca ve ninguna tool (las tools son un concepto de capability de servicio)', () => {
  const registry = new ToolRegistry();
  registry.register(rawWebSearchTool);
  const health = new Map<string, ToolHealthRecord>([['tool-web-search', recordHealthCheck('tool-web-search', 'UP', now)]]);
  const humanPrincipal: Principal = { kind: 'HUMAN', id: 'user-1', organizationId: 'org-1', roles: ['ADMIN'] };
  assert.deepEqual(registry.listForPrincipal(humanPrincipal, health), []);
});

test('una tool sin chequeo de salud reciente (o DOWN) no aparece en la lista aunque la capability sea correcta', () => {
  const registry = new ToolRegistry();
  registry.register(rawWebSearchTool);
  const noHealth = new Map<string, ToolHealthRecord>();
  assert.deepEqual(registry.listForPrincipal(agentPrincipal(['records.read']), noHealth), []);

  const downHealth = new Map<string, ToolHealthRecord>([['tool-web-search', recordHealthCheck('tool-web-search', 'DOWN', now)]]);
  assert.deepEqual(registry.listForPrincipal(agentPrincipal(['records.read']), downHealth), []);
});
