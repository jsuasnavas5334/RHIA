import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaywrightWorker } from './worker.js';
import { FakeBrowserDriver } from './testing/fake-driver.js';
import { BrowserSelectorNotFoundError, BrowserSessionExpiredError } from './errors.js';
import type { Scenario } from './contracts.js';
import type { SecretResolver } from './driver.js';

const now = () => new Date('2026-09-10T12:00:00Z');

const scenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: 'scn-login-flow',
  allowedDomains: ['app.example.com'],
  defaultTimeoutMs: 200,
  steps: [
    { id: 'go-to-login', action: { kind: 'NAVIGATE', url: 'https://app.example.com/login' } },
    { id: 'type-user', action: { kind: 'TYPE', selector: { strategies: [{ kind: 'testId', value: 'user-field' }] }, input: { kind: 'LITERAL', value: 'ana@example.com' } } },
    { id: 'click-submit', action: { kind: 'CLICK', selector: { strategies: [{ kind: 'testId', value: 'submit-button' }] } } },
    { id: 'wait-dashboard', action: { kind: 'WAIT_FOR', selector: { strategies: [{ kind: 'testId', value: 'dashboard-root' }] } } },
  ],
  ...overrides,
});

test('escenario invalido se RECHAZA sin abrir ningun contexto real -- accion "Perfiles aislados" nunca se toca en un REJECTED', async () => {
  const driver = new FakeBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const result = await worker.run({ id: '', allowedDomains: [], defaultTimeoutMs: -1, steps: [] });
  assert.equal(result.outcome, 'REJECTED');
  assert.equal(driver.createdProfiles.length, 0);
});

test('escenario completo real -- COMPLETED con evidencia real de cada step y checkpoint final', async () => {
  const driver = new FakeBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const result = await worker.run(scenario());
  assert.equal(result.outcome, 'COMPLETED');
  if (result.outcome === 'COMPLETED') {
    assert.equal(result.evidence.length, 4);
    assert.ok(result.evidence.every((entry) => entry.outcome === 'SUCCEEDED'));
    assert.equal(result.checkpoint.lastCompletedStepId, 'wait-dashboard');
    assert.equal(result.checkpoint.lastCompletedStepIndex, 3);
  }
  // Accion "Perfiles aislados": el contexto real se cerro al terminar.
  assert.deepEqual(driver.closedContextIds, [result.outcome === 'COMPLETED' ? result.contextId : '']);
});

// Accion "Perfiles aislados" + error a evitar "Compartir sesion sin aislamiento".
test('dos corridas del MISMO escenario usan perfiles/contextos aislados distintos, y ambos se cierran', async () => {
  const driver = new FakeBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const first = await worker.run(scenario());
  const second = await worker.run(scenario());
  assert.equal(driver.createdProfiles.length, 2);
  assert.notEqual(driver.createdProfiles[0]?.profileId, driver.createdProfiles[1]?.profileId);
  if (first.outcome === 'COMPLETED' && second.outcome === 'COMPLETED') {
    assert.notEqual(first.contextId, second.contextId);
  }
  assert.equal(driver.closedContextIds.length, 2);
});

// Prueba requerida "UI changed".
test('Prueba requerida "UI changed" -- selector inexistente en TODAS sus estrategias produce RHIA_BROWSER_SELECTOR_NOT_FOUND con evidencia y screenshot real', async () => {
  const driver = new FakeBrowserDriver();
  driver.program('findElement', { kind: 'throw', error: new BrowserSelectorNotFoundError() });
  const worker = new PlaywrightWorker(driver, { now });
  const result = await worker.run(scenario());
  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') {
    assert.equal(result.error.code, 'RHIA_BROWSER_SELECTOR_NOT_FOUND');
    assert.equal(result.failedStepId, 'type-user');
    const failedEvidence = result.evidence.at(-1);
    assert.equal(failedEvidence?.outcome, 'FAILED');
    // Criterio de aceptacion "Fallos capturan evidencia".
    assert.ok(failedEvidence?.screenshot !== null);
  }
  assert.equal(driver.screenshotCalls.length, 1);
  // El contexto se cierra igual, incluso en fallo.
  assert.equal(driver.closedContextIds.length, 1);
});

// Prueba requerida "Timeout".
test('Prueba requerida "Timeout" -- un step que cuelga mas alla de su timeoutMs produce RHIA_WORKFLOW_TIMEOUT sin colgar el worker', async () => {
  const driver = new FakeBrowserDriver();
  driver.program('navigate', { kind: 'hang' });
  const worker = new PlaywrightWorker(driver, { now });
  const startedAt = Date.now();
  // maxStepAttempts:1 aisla la clasificacion del timeout de la logica de
  // retry (probada por separado abajo) -- sin esto, NAVIGATE es una accion
  // reintentable y un segundo intento (sin el hang ya consumido) sanaria el
  // timeout en vez de terminar en FAILED.
  const result = await worker.run(scenario({ defaultTimeoutMs: 50, maxStepAttempts: 1 }));
  const elapsedMs = Date.now() - startedAt;
  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') {
    assert.equal(result.error.code, 'RHIA_WORKFLOW_TIMEOUT');
    assert.equal(result.error.retryable, true);
    assert.equal(result.failedStepId, 'go-to-login');
  }
  assert.ok(elapsedMs < 2000, `se esperaba que resolviera cerca de 50ms, tardo ${elapsedMs}ms`);
});

// Prueba requerida "Login expired".
test('Prueba requerida "Login expired" -- sesion expirada produce RHIA_BROWSER_SESSION_EXPIRED y NUNCA se reintenta automaticamente', async () => {
  const driver = new FakeBrowserDriver();
  // wait-dashboard es un WAIT_FOR (accion reintentable) -- pero la sesion
  // expirada debe seguir sin reintentarse ni una sola vez de mas.
  driver.program('findElement', { kind: 'throw', error: new BrowserSessionExpiredError() });
  const worker = new PlaywrightWorker(driver, { now });
  const result = await worker.run(scenario());
  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') {
    assert.equal(result.error.code, 'RHIA_BROWSER_SESSION_EXPIRED');
    const failedEvidence = result.evidence.find((entry) => entry.stepId === 'type-user');
    // Un solo intento real, nunca reintentado -- ver "Retry seguro".
    assert.equal(failedEvidence?.attempts, 1);
  }
});

// Criterio de aceptacion "Retry seguro".
test('Retry seguro: un WAIT_FOR que falla una vez y luego funciona SI se reintenta automaticamente (accion idempotente)', async () => {
  const driver = new FakeBrowserDriver();
  // Falla la primera vez que se busca el selector del ultimo step (WAIT_FOR); las 3 busquedas anteriores (NAVIGATE no busca elemento, TYPE y CLICK si) deben tener exito.
  let findElementCalls = 0;
  const originalFindElement = driver.findElement.bind(driver);
  driver.findElement = async (context, selector, signal) => {
    findElementCalls += 1;
    if (findElementCalls === 3) throw new Error('fallo transitorio simulado');
    return originalFindElement(context, selector, signal);
  };
  const worker = new PlaywrightWorker(driver, { now });
  const result = await worker.run(scenario());
  assert.equal(result.outcome, 'COMPLETED');
  const waitEvidence = result.outcome === 'COMPLETED' ? result.evidence.find((entry) => entry.stepId === 'wait-dashboard') : undefined;
  assert.equal(waitEvidence?.attempts, 2);
});

test('Retry seguro: un CLICK que falla NUNCA se reintenta automaticamente (evitar doble-submit)', async () => {
  const driver = new FakeBrowserDriver();
  driver.program('click', { kind: 'throw', error: new Error('fallo simulado en click') });
  const worker = new PlaywrightWorker(driver, { now });
  const result = await worker.run(scenario());
  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') {
    assert.equal(result.failedStepId, 'click-submit');
    const failedEvidence = result.evidence.at(-1);
    assert.equal(failedEvidence?.attempts, 1);
  }
});

// Criterio de aceptacion "Credenciales no se loguean".
test('Credenciales no se loguean: un TYPE con SECRET_REF resuelve el valor real solo para el driver, nunca aparece en la evidencia', async () => {
  const driver = new FakeBrowserDriver();
  const secretResolver: SecretResolver = { resolve: async () => 'super-secreto-real-123' };
  const worker = new PlaywrightWorker(driver, { now, secretResolver });
  const scenarioWithSecret = scenario({
    steps: [
      { id: 'go-to-login', action: { kind: 'NAVIGATE', url: 'https://app.example.com/login' } },
      { id: 'type-password', action: { kind: 'TYPE', selector: { strategies: [{ kind: 'testId', value: 'password-field' }] }, input: { kind: 'SECRET_REF', ref: 'vault:portal-x:password' } } },
    ],
  });
  const result = await worker.run(scenarioWithSecret);
  assert.equal(result.outcome, 'COMPLETED');
  // El driver SI recibe el valor real (lo necesita para escribirlo) --
  // pero la evidencia que se persiste/loguea nunca lo incluye.
  assert.deepEqual(driver.typedValues, ['super-secreto-real-123']);
  if (result.outcome === 'COMPLETED') {
    const typeEvidence = result.evidence.find((entry) => entry.stepId === 'type-password');
    assert.equal(typeEvidence?.redactedSummary.includes('super-secreto-real-123'), false);
    assert.ok(typeEvidence?.redactedSummary.includes('redactado'));
    assert.equal(JSON.stringify(result).includes('super-secreto-real-123'), false);
  }
});

test('Credenciales no se loguean: un TYPE literal normal tambien redacta su valor en la evidencia (no solo los secretos)', async () => {
  const driver = new FakeBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const result = await worker.run(scenario());
  assert.equal(result.outcome, 'COMPLETED');
  if (result.outcome === 'COMPLETED') {
    const typeEvidence = result.evidence.find((entry) => entry.stepId === 'type-user');
    assert.equal(typeEvidence?.redactedSummary.includes('ana@example.com'), false);
  }
});

test('un TYPE con SECRET_REF sin SecretResolver inyectado falla explicito, nunca omite el step en silencio', async () => {
  const driver = new FakeBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const scenarioWithSecret = scenario({
    steps: [{ id: 'type-password', action: { kind: 'TYPE', selector: { strategies: [{ kind: 'testId', value: 'password-field' }] }, input: { kind: 'SECRET_REF', ref: 'vault:x' } } }],
  });
  const result = await worker.run(scenarioWithSecret);
  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') assert.equal(result.error.code, 'RHIA_BROWSER_SECRET_UNAVAILABLE');
});

// Accion "Domain allowlist": la validacion estructural (contracts.ts) solo
// exige que la URL sea absoluta y bien formada -- el chequeo real contra la
// allowlist es responsabilidad UNICA del runtime, justo antes de llamar al
// driver, para que sea el punto de seguridad que de verdad importa.
test('Domain allowlist en runtime: un NAVIGATE fuera de la allowlist se rechaza en ejecucion, sin llamar driver.navigate', async () => {
  const driver = new FakeBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const badScenario: Scenario = {
    id: 'scn-bad',
    allowedDomains: ['app.example.com'],
    defaultTimeoutMs: 200,
    steps: [{ id: 'go', action: { kind: 'NAVIGATE', url: 'https://evil.example.com/' } }],
  };
  const result = await worker.run(badScenario);
  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') assert.equal(result.error.code, 'RHIA_BROWSER_DOMAIN_FORBIDDEN');
  assert.equal(driver.navigateCalls.length, 0);
});

// Accion "Checkpoints".
test('Checkpoints: un resumeFrom valido salta los steps ya completados, sin volver a ejecutarlos', async () => {
  const driver = new FakeBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const resumeFrom = { scenarioId: 'scn-login-flow', lastCompletedStepIndex: 1, lastCompletedStepId: 'type-user', updatedAt: now().toISOString() };
  const result = await worker.run(scenario(), { resumeFrom });
  assert.equal(result.outcome, 'COMPLETED');
  if (result.outcome === 'COMPLETED') {
    assert.equal(result.evidence.length, 2);
    assert.deepEqual(result.evidence.map((entry) => entry.stepId), ['click-submit', 'wait-dashboard']);
  }
});

test('Checkpoints: un resumeFrom de OTRO escenario se ignora -- arranca desde el principio', async () => {
  const driver = new FakeBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const resumeFrom = { scenarioId: 'scn-otro', lastCompletedStepIndex: 2, lastCompletedStepId: 'x', updatedAt: now().toISOString() };
  const result = await worker.run(scenario(), { resumeFrom });
  assert.equal(result.outcome, 'COMPLETED');
  if (result.outcome === 'COMPLETED') assert.equal(result.evidence.length, 4);
});
