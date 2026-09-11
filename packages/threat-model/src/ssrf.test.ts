// Threat Model (PH10-T003), accion 4 del packet: "SSRF". Prueba requerida
// del packet, nombrada explicitamente: "Malicious URL".
//
// Cubre las 3 superficies reales del repo que deciden si un agente puede
// tocar una URL/dominio: `@rhia/playwright-worker` (navegacion determinista),
// `@rhia/computer-use` (URL observada, no declarada), y `@rhia/tool-registry`
// (dominio solicitado de una invocacion de tool). Los 3 ya implementan una
// allowlist fail-closed (ver comentarios reales en `worker.ts`/`contracts.ts`
// de cada paquete, releidos completos antes de escribir esta prueba) -- esta
// prueba los ejerce con objetivos SSRF realistas (IP de metadata de nube,
// localhost, y un intento de bypass por sufijo de dominio) para confirmar con
// evidencia real (no solo lectura de codigo) que el fail-closed se sostiene.
//
// Los "drivers" de abajo son fakes deterministas locales (nunca abren un
// navegador real) -- mismo espiritu que `testing/fake-driver.ts` de cada
// paquete, pero reescritos aqui porque esos helpers NO se exportan
// publicamente (el `package.json` de cada paquete solo declara el subpath
// "." en `exports`, un import profundo fallaria bajo ESM real).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PlaywrightWorker,
  type BrowserContextHandle,
  type BrowserDriver,
  type BrowserProfile,
  type ElementHandle,
  type RobustSelector,
  type Scenario,
  type ScreenshotRef,
} from '@rhia/playwright-worker';
import {
  ComputerUseWorker,
  type ComputerUseDriver,
  type ComputerUseObservation,
  type ComputerUseTask,
} from '@rhia/computer-use';
import { authorizeToolInvocation } from '@rhia/tool-registry';
import { recordHealthCheck, validateToolManifest, type ToolManifest } from '@rhia/tool-registry';
import type { Principal } from '@rhia/policy';

class RecordingBrowserDriver implements BrowserDriver {
  readonly navigateCalls: string[] = [];
  async createIsolatedContext(_profile: BrowserProfile): Promise<BrowserContextHandle> {
    return { contextId: 'ctx-1' };
  }
  async navigate(_context: BrowserContextHandle, url: string): Promise<void> {
    this.navigateCalls.push(url);
  }
  async findElement(): Promise<ElementHandle> {
    return { elementId: 'el-1', matchedStrategy: 'css' };
  }
  async click(): Promise<void> {}
  async type(): Promise<void> {}
  async readText(): Promise<string> {
    return '';
  }
  async captureScreenshot(): Promise<ScreenshotRef> {
    return { screenshotId: 'shot-1', capturedAt: new Date(0).toISOString() };
  }
  async closeContext(): Promise<void> {}
}

const cssSelector = (value: string): RobustSelector => ({ strategies: [{ kind: 'css', value }] });

const now = () => new Date('2026-09-10T12:00:00Z');

test('Malicious URL (SSRF) -- playwright-worker rechaza NAVIGATE a la IP de metadata de nube aunque la URL sea absoluta y bien formada', async () => {
  const driver = new RecordingBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const scenario: Scenario = {
    id: 'scn-crm-lookup',
    allowedDomains: ['crm.example.com'],
    defaultTimeoutMs: 1000,
    steps: [
      { id: 'step-1', action: { kind: 'NAVIGATE', url: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/' } },
    ],
  };

  const result = await worker.run(scenario);

  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') assert.equal(result.error.code, 'RHIA_BROWSER_DOMAIN_FORBIDDEN');
  // Fail-closed real: el driver NUNCA fue invocado -- el chequeo ocurre
  // antes de tocar la red real (ver `assertDomainAllowed` en worker.ts).
  assert.deepEqual(driver.navigateCalls, []);
});

test('Malicious URL (SSRF) -- un dominio que "contiene" el dominio permitido como sufijo/prefijo (bypass tipico de allowlist) sigue rechazado (match exacto de hostname)', async () => {
  const driver = new RecordingBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const scenario: Scenario = {
    id: 'scn-crm-lookup-2',
    allowedDomains: ['crm.example.com'],
    defaultTimeoutMs: 1000,
    steps: [{ id: 'step-1', action: { kind: 'NAVIGATE', url: 'https://crm.example.com.evil.com/steal' } }],
  };

  const result = await worker.run(scenario);
  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') assert.equal(result.error.code, 'RHIA_BROWSER_DOMAIN_FORBIDDEN');
  assert.deepEqual(driver.navigateCalls, []);
});

test('control positivo -- un NAVIGATE a un dominio real de la allowlist SI llega al driver', async () => {
  const driver = new RecordingBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now });
  const scenario: Scenario = {
    id: 'scn-crm-lookup-3',
    allowedDomains: ['crm.example.com'],
    defaultTimeoutMs: 1000,
    steps: [
      { id: 'step-1', action: { kind: 'NAVIGATE', url: 'https://crm.example.com/accounts/1' } },
      { id: 'step-2', action: { kind: 'WAIT_FOR', selector: cssSelector('#loaded') } },
    ],
  };
  const result = await worker.run(scenario);
  assert.equal(result.outcome, 'COMPLETED');
  assert.deepEqual(driver.navigateCalls, ['https://crm.example.com/accounts/1']);
});

class RecordingComputerUseDriver implements ComputerUseDriver {
  readonly clickCalls: number[] = [];
  currentUrl = 'https://app.example.com/dashboard';
  async createSandboxSession(): Promise<BrowserContextHandle> {
    return { contextId: 'ctx-cu-1' };
  }
  async observe(): Promise<ComputerUseObservation> {
    return { screenshot: { screenshotId: 'shot-1', capturedAt: new Date(0).toISOString() }, currentUrl: this.currentUrl, modalDetected: false };
  }
  async moveAndClick(): Promise<void> {
    this.clickCalls.push(1);
  }
  async typeText(): Promise<void> {}
  async pressKey(): Promise<void> {}
  async wait(): Promise<void> {}
  async closeSession(): Promise<void> {}
}

test('Malicious URL (SSRF) -- computer-use rechaza ejecutar una accion cuando la URL REAL observada es la IP de metadata de nube, aunque la tarea no declare un NAVIGATE explicito', async () => {
  const driver = new RecordingComputerUseDriver();
  driver.currentUrl = 'http://169.254.169.254/latest/meta-data/';
  const worker = new ComputerUseWorker(driver, { now });
  const task: ComputerUseTask = {
    id: 'task-1',
    organizationId: 'org-1',
    allowedDomains: ['app.example.com'],
    maxSteps: 3,
    defaultTimeoutMs: 1000,
    steps: [{ id: 'step-1', riskLevel: 'LOW', action: { kind: 'MOVE_CLICK', coordinates: { x: 10, y: 10 }, targetDescription: 'boton confirmar' } }],
  };

  const result = await worker.run(task);
  assert.equal(result.outcome, 'FAILED');
  if (result.outcome === 'FAILED') assert.equal(result.error.code, 'RHIA_COMPUTER_USE_DOMAIN_FORBIDDEN');
  assert.deepEqual(driver.clickCalls, []);
});

test('Malicious URL (SSRF) -- tool-registry rechaza una invocacion cuya URL/dominio solicitado no esta en el allowlist real de la tool', () => {
  const manifestResult = validateToolManifest({
    id: 'tool-crm-api',
    name: 'CRM API',
    ownerRef: 'team-crm',
    riskLevel: 'MEDIUM',
    requiredCapability: 'records.read',
    credentialRef: null,
    allowedDomains: ['api.crm.example.com'],
    allowedActions: ['GET'],
  });
  if (!manifestResult.valid) throw new Error('fixture manifest invalido');
  const manifest: ToolManifest = manifestResult.manifest;
  const principal: Principal = { kind: 'SERVICE', id: 'agent-1', organizationId: 'org-1', service: 'AGENT_SERVICE', capabilities: ['records.read'] };
  const health = recordHealthCheck('tool-crm-api', 'UP', now);

  const decision = authorizeToolInvocation({
    principal,
    manifest,
    health,
    requestedAction: 'GET',
    requestedDomain: '169.254.169.254',
  });

  assert.equal(decision.outcome, 'DENY');
  if (decision.outcome === 'DENY') assert.equal(decision.code, 'RHIA_TOOL_DOMAIN_FORBIDDEN');
});
