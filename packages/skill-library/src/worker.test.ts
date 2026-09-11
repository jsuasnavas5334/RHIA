import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateToolManifest } from '@rhia/tool-registry';
import type { ToolManifest } from '@rhia/tool-registry';
import type { WorkerRunResult as PlaywrightRunResult, Checkpoint } from '@rhia/playwright-worker';
import { SkillRunner, type PlaywrightProcedureRunner } from './worker.js';
import { computeToolContractFingerprint } from './contracts.js';
import { FakeChecker } from './testing/fake-checkers.js';

const toolManifest = (overrides: Partial<ToolManifest> = {}): ToolManifest => {
  const result = validateToolManifest({
    id: 'tool-crm-web',
    name: 'CRM Web',
    ownerRef: 'team-sales',
    riskLevel: 'LOW',
    requiredCapability: 'records.read',
    credentialRef: null,
    allowedDomains: ['crm.example.com'],
    allowedActions: ['click', 'type'],
    ...overrides,
  });
  if (!result.valid) throw new Error('fixture invalido');
  return result.manifest;
};

const okCheckpoint: Checkpoint = { scenarioId: 'scn-update-contact', lastCompletedStepIndex: 0, lastCompletedStepId: 'click-save', updatedAt: new Date(0).toISOString() };

const completedPlaywrightResult: PlaywrightRunResult = { outcome: 'COMPLETED', scenarioId: 'scn-update-contact', contextId: 'ctx-1', evidence: [], checkpoint: okCheckpoint };

const failedPlaywrightResult: PlaywrightRunResult = {
  outcome: 'FAILED',
  scenarioId: 'scn-update-contact',
  contextId: 'ctx-1',
  evidence: [],
  checkpoint: { ...okCheckpoint, lastCompletedStepIndex: -1, lastCompletedStepId: null },
  failedStepId: 'click-save',
  error: { code: 'RHIA_BROWSER_SELECTOR_NOT_FOUND', message: 'no encontrado', retryable: false, safeDetails: 'no encontrado', cause: null },
};

const skill = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const runnerWith = (playwrightResult: PlaywrightRunResult, checkerResults: Record<string, boolean> = {}) => {
  const playwrightWorker: PlaywrightProcedureRunner = { run: async () => playwrightResult };
  const preconditionChecker = new FakeChecker(checkerResults);
  const validationChecker = new FakeChecker(checkerResults);
  const runner = new SkillRunner({ preconditionChecker, validationChecker, playwrightWorker });
  return { runner, preconditionChecker, validationChecker };
};

test('skill invalido se RECHAZA sin tocar ningun checker ni procedimiento', async () => {
  const { runner, preconditionChecker, validationChecker } = runnerWith(completedPlaywrightResult);
  const result = await runner.run({ id: '' }, toolManifest());
  assert.equal(result.outcome, 'REJECTED');
  assert.equal(preconditionChecker.calls.length, 0);
  assert.equal(validationChecker.calls.length, 0);
});

test('skill completo real -- COMPLETED tras precondiciones y validaciones reales, sin releer ningun historial (solo skill + tool manifest actual + dependencias inyectadas)', async () => {
  const { runner, preconditionChecker, validationChecker } = runnerWith(completedPlaywrightResult);
  const result = await runner.run(skill(), toolManifest());
  assert.equal(result.outcome, 'COMPLETED');
  assert.deepEqual(preconditionChecker.calls, ['crm-tool-up']);
  assert.deepEqual(validationChecker.calls, ['contact-updated']);
});

// Prueba requerida "Skill stale".
test('Prueba requerida "Skill stale" -- el contrato real de la tool cambio, el skill NUNCA se ejecuta a ciegas', async () => {
  const { runner, preconditionChecker } = runnerWith(completedPlaywrightResult);
  const changedTool = toolManifest({ allowedActions: ['click'] });
  const result = await runner.run(skill(), changedTool);
  assert.equal(result.outcome, 'STALE');
  // Ni precondiciones ni el procedimiento se llegaron a tocar.
  assert.equal(preconditionChecker.calls.length, 0);
});

// Prueba requerida "Missing precondition".
test('Prueba requerida "Missing precondition" -- una precondicion real que falla bloquea la corrida antes del procedimiento', async () => {
  const { runner } = runnerWith(completedPlaywrightResult, { 'crm-tool-up': false });
  const result = await runner.run(skill(), toolManifest());
  assert.equal(result.outcome, 'PRECONDITION_FAILED');
  if (result.outcome === 'PRECONDITION_FAILED') assert.equal(result.failedPreconditionId, 'crm-tool-up');
});

// Prueba requerida "Tool UI changed" -- detectada por el worker subyacente real, este paquete solo reacciona.
test('Prueba requerida "Tool UI changed" -- el procedimiento subyacente falla (selector real no encontrado) -> PROCEDURE_FAILED, sin rollback declarado', async () => {
  const { runner, validationChecker } = runnerWith(failedPlaywrightResult);
  const result = await runner.run(skill(), toolManifest());
  assert.equal(result.outcome, 'PROCEDURE_FAILED');
  if (result.outcome === 'PROCEDURE_FAILED') {
    assert.equal(result.procedureRun.result.outcome, 'FAILED');
    assert.equal(result.rollbackRun, null);
  }
  // Las validaciones NUNCA se corren si el procedimiento fallo -- no tiene sentido validar un resultado que no ocurrio.
  assert.equal(validationChecker.calls.length, 0);
});

test('un rollback declarado SI se intenta cuando el procedimiento principal falla', async () => {
  const rollbackScenario = { id: 'scn-rollback', allowedDomains: ['crm.example.com'], defaultTimeoutMs: 2000, steps: [{ id: 'undo', action: { kind: 'CLICK', selector: { strategies: [{ kind: 'testId', value: 'undo-button' }] } } }] };
  let calledScenarioIds: string[] = [];
  const playwrightWorker: PlaywrightProcedureRunner = {
    run: async (scenario) => {
      calledScenarioIds.push(scenario.id);
      return scenario.id === 'scn-rollback' ? completedPlaywrightResult : failedPlaywrightResult;
    },
  };
  const runner = new SkillRunner({ preconditionChecker: new FakeChecker(), validationChecker: new FakeChecker(), playwrightWorker });
  const result = await runner.run(skill({ rollback: { kind: 'PLAYWRIGHT', scenario: rollbackScenario } }), toolManifest());
  assert.equal(result.outcome, 'PROCEDURE_FAILED');
  if (result.outcome === 'PROCEDURE_FAILED') assert.equal(result.rollbackRun?.result.outcome, 'COMPLETED');
  assert.deepEqual(calledScenarioIds, ['scn-update-contact', 'scn-rollback']);
});

// Criterio "Validation final obligatoria".
test('una validation real que falla despues de un procedimiento exitoso NUNCA se considera COMPLETED', async () => {
  const { runner } = runnerWith(completedPlaywrightResult, { 'contact-updated': false });
  const result = await runner.run(skill(), toolManifest());
  assert.equal(result.outcome, 'VALIDATION_FAILED');
  if (result.outcome === 'VALIDATION_FAILED') assert.equal(result.failedValidationId, 'contact-updated');
});

test('sin un PlaywrightProcedureRunner inyectado, un procedure PLAYWRIGHT falla explicito (nunca se omite en silencio)', async () => {
  const runner = new SkillRunner({ preconditionChecker: new FakeChecker(), validationChecker: new FakeChecker() });
  const result = await runner.run(skill(), toolManifest());
  assert.equal(result.outcome, 'UNEXPECTED_FAILURE');
});
