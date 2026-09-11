import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateToolManifest } from '@rhia/tool-registry';
import type { ToolManifest } from '@rhia/tool-registry';
import { computeToolContractFingerprint, isSkillStale, validateSkillManifest } from './contracts.js';
import type { SkillManifest } from './contracts.js';

const toolManifest = (): ToolManifest => {
  const result = validateToolManifest({
    id: 'tool-crm-web',
    name: 'CRM Web',
    ownerRef: 'team-sales',
    riskLevel: 'LOW',
    requiredCapability: 'records.read',
    credentialRef: null,
    allowedDomains: ['crm.example.com'],
    allowedActions: ['click', 'type'],
  });
  if (!result.valid) throw new Error('fixture invalido');
  return result.manifest;
};

const baseSkill = (): unknown => ({
  id: 'skill-update-contact',
  name: 'Actualizar contacto en CRM',
  version: '1.0.0',
  targetToolId: 'tool-crm-web',
  builtAgainstToolFingerprint: computeToolContractFingerprint(toolManifest()),
  io: { inputs: [{ name: 'contactId', type: 'string', required: true }], outputs: [] },
  preconditions: [{ id: 'crm-tool-up', description: 'La tool CRM Web esta UP.' }],
  validations: [{ id: 'contact-updated', description: 'El contacto quedo actualizado en el CRM.' }],
  procedure: {
    kind: 'PLAYWRIGHT',
    scenario: {
      id: 'scn-update-contact',
      allowedDomains: ['crm.example.com'],
      defaultTimeoutMs: 2000,
      steps: [{ id: 'click-save', action: { kind: 'CLICK', selector: { strategies: [{ kind: 'testId', value: 'save-button' }] } } }],
    },
  },
});

test('skill minimo real valido es aceptado', () => {
  assert.equal(validateSkillManifest(baseSkill()).valid, true);
});

// Accion "Versioning".
test('version que no sigue MAJOR.MINOR.PATCH se rechaza', () => {
  const skill = baseSkill() as Record<string, unknown>;
  assert.equal(validateSkillManifest({ ...skill, version: 'v1' }).valid, false);
  assert.equal(validateSkillManifest({ ...skill, version: '1.0' }).valid, false);
});

// Criterio "Validation final obligatoria".
test('un skill sin ninguna validation se rechaza -- no se puede registrar', () => {
  const skill = baseSkill() as Record<string, unknown>;
  const result = validateSkillManifest({ ...skill, validations: [] });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.field === 'validations'));
});

// Criterio "No mezcla secretos" -- delega en validateScenario/validateTask reales.
test('un procedure PLAYWRIGHT con un TYPE que parece un secreto real se rechaza (delegado a validateScenario)', () => {
  const skill = baseSkill() as Record<string, unknown>;
  const badScenario = {
    id: 'scn-bad',
    allowedDomains: ['crm.example.com'],
    defaultTimeoutMs: 2000,
    steps: [
      {
        id: 'type-token',
        action: { kind: 'TYPE', selector: { strategies: [{ kind: 'testId', value: 'token-field' }] }, input: { kind: 'LITERAL', value: 'Bearer sometoken12345678901234567890' } },
      },
    ],
  };
  const result = validateSkillManifest({ ...skill, procedure: { kind: 'PLAYWRIGHT', scenario: badScenario } });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.field.includes('procedure.scenario')));
});

test('un nombre de input que parece una credencial real se rechaza', () => {
  const skill = baseSkill() as Record<string, unknown>;
  const io = { inputs: [{ name: 'Bearer sometoken12345678901234567890', type: 'string', required: true }], outputs: [] };
  const result = validateSkillManifest({ ...skill, io });
  assert.equal(result.valid, false);
});

test('preconditions/validations mal formadas se rechazan', () => {
  const skill = baseSkill() as Record<string, unknown>;
  assert.equal(validateSkillManifest({ ...skill, preconditions: [{ id: '' }] }).valid, false);
  assert.equal(validateSkillManifest({ ...skill, validations: [{ id: 'x' }] }).valid, false);
});

test('un rollback tambien se valida como procedure real', () => {
  const skill = baseSkill() as Record<string, unknown>;
  const result = validateSkillManifest({ ...skill, rollback: { kind: 'COMPUTER_USE', task: { id: '', organizationId: '', allowedDomains: [], maxSteps: 0, defaultTimeoutMs: -1, steps: [] } } });
  assert.equal(result.valid, false);
});

// Prueba requerida "Skill stale".
test('computeToolContractFingerprint cambia si allowedActions/allowedDomains/requiredCapability cambian, no si solo cambia ownerRef/riskLevel', () => {
  const original = toolManifest();
  const sameContractDifferentOwner = { ...original, ownerRef: 'otro-equipo', riskLevel: 'HIGH' as const };
  assert.equal(computeToolContractFingerprint(original), computeToolContractFingerprint(sameContractDifferentOwner));

  const changedActions = { ...original, allowedActions: [...original.allowedActions, 'drag'] };
  assert.notEqual(computeToolContractFingerprint(original), computeToolContractFingerprint(changedActions));
});

test('isSkillStale: false cuando el fingerprint y el targetToolId coinciden', () => {
  const result = validateSkillManifest(baseSkill());
  if (!result.valid) throw new Error('fixture invalido');
  assert.equal(isSkillStale(result.skill, toolManifest()), false);
});

test('isSkillStale: true cuando el contrato real de la tool cambio desde que el skill se construyo', () => {
  const result = validateSkillManifest(baseSkill());
  if (!result.valid) throw new Error('fixture invalido');
  const changedTool: ToolManifest = { ...toolManifest(), allowedActions: ['click'] };
  assert.equal(isSkillStale(result.skill, changedTool), true);
});

test('isSkillStale: true cuando targetToolId ya no corresponde a la tool actual', () => {
  const result = validateSkillManifest(baseSkill());
  if (!result.valid) throw new Error('fixture invalido');
  const otherTool: ToolManifest = { ...toolManifest(), id: 'otra-tool' };
  assert.equal(isSkillStale(result.skill, otherTool), true);
});

test('root no-objeto se rechaza', () => {
  assert.equal(validateSkillManifest('no es un skill').valid, false);
});
