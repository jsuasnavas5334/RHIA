// Threat Model (PH10-T003), accion 6 del packet: "Data exfiltration".
//
// Cubre: (1) redaccion real de 2 capas (`@rhia/secrets#redactText`/
// `redactValue`) contra un intento de exfiltracion tipico (un log que
// termina incluyendo, por accidente o por un tool comprometido, un token/PII
// real embebido en texto libre); (2) la garantia ESTRUCTURAL (no dependiente
// de un heuristico de contenido) de que un valor tipeado en playwright-worker
// nunca aparece en la evidencia/trace, incluso para un valor que el
// heuristico `looksLikeRawSecret` NO detectaria (defensa en profundidad: la
// capa estructural no depende de que el heuristico de contenido acierte); y
// (3) un HALLAZGO REAL encontrado durante PH10-T003 (documentado, no oculto
// -- ver docs/security/threat-model.md seccion 7): `validateToolManifest`
// solo aplicaba `looksLikeRawSecret` a `credentialRef`, nunca a
// `ownerRef`/`name` -- un manifest que filtraba una credencial real en esos
// otros 2 campos se registraba sin rechazo. Corregido en un ciclo posterior
// (fix aislado y aditivo, ver "Update" en docs/progress/PH10-T003.md); el
// test de abajo se actualizo a la vez, como su nota original pedia.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactText, redactValue } from '@rhia/secrets';
import { PlaywrightWorker, type BrowserContextHandle, type BrowserDriver, type BrowserProfile, type ElementHandle, type Scenario, type ScreenshotRef } from '@rhia/playwright-worker';
import { ToolRegistry } from '@rhia/tool-registry';

test('Data exfiltration -- redactText elimina tokens/PII reales embebidos en texto libre (simulando un log de una tool comprometida)', () => {
  const exfilAttemptLogLine =
    'Fallo al sincronizar contacto jane.doe@acme.com (+1 415-555-0134); reintentando con Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz123456 y AKIAABCDEFGHIJKLMNOP';

  const redacted = redactText(exfilAttemptLogLine);

  assert.ok(!redacted.includes('jane.doe@acme.com'));
  assert.ok(!redacted.includes('sk-abcdefghijklmnopqrstuvwxyz123456'));
  assert.ok(!redacted.includes('AKIAABCDEFGHIJKLMNOP'));
  assert.ok(!redacted.includes('415-555-0134'));
  assert.ok(redacted.includes('[REDACTED_EMAIL]'));
  assert.ok(redacted.includes('[REDACTED_SECRET]'));
});

test('Data exfiltration -- redactValue redacta por NOMBRE de campo sensible incluso si el valor no matchea ningun patron de contenido', () => {
  const payload = {
    password: 'una-frase-larga-cualquiera-sin-forma-de-token',
    note: 'este campo no es sensible y debe sobrevivir intacto',
  };
  const redacted = redactValue(payload) as Record<string, unknown>;
  assert.equal(redacted['password'], '[REDACTED]');
  assert.equal(redacted['note'], 'este campo no es sensible y debe sobrevivir intacto');
});

class RecordingBrowserDriver implements BrowserDriver {
  async createIsolatedContext(): Promise<BrowserContextHandle> {
    return { contextId: 'ctx-1' };
  }
  async navigate(): Promise<void> {}
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

test('Data exfiltration -- un valor TYPE nunca aparece en la evidencia/trace de playwright-worker, ni siquiera un valor que el heuristico looksLikeRawSecret NO detectaria', async () => {
  // "Sup3r-Password-De-Cliente" es una contraseña real plausible pero NO
  // matchea ningun patron de `looksLikeRawSecret` (no es un bearer/sk-/AKIA/
  // JWT, y su longitud/estructura tampoco dispara la heuristica de entropia
  // -- por eso `validateScenario` la deja pasar como LITERAL). La garantia
  // real contra exfiltracion aqui NO es el heuristico de contenido: es que
  // `redactedSummaryFor` en worker.ts SIEMPRE redacta por TIPO de accion
  // (TYPE), nunca interpola el valor, sin importar si "parece" secreto.
  const sneakyButPlausiblePassword = 'Sup3r-Password-De-Cliente';
  const driver = new RecordingBrowserDriver();
  const worker = new PlaywrightWorker(driver, { now: () => new Date('2026-09-10T12:00:00Z') });
  const scenario: Scenario = {
    id: 'scn-exfil-check',
    allowedDomains: ['app.example.com'],
    defaultTimeoutMs: 1000,
    steps: [
      {
        id: 'step-1',
        action: { kind: 'TYPE', selector: { strategies: [{ kind: 'css', value: '#password' }] }, input: { kind: 'LITERAL', value: sneakyButPlausiblePassword } },
      },
    ],
  };

  const result = await worker.run(scenario);
  assert.equal(result.outcome, 'COMPLETED');
  if (result.outcome === 'COMPLETED') {
    const summary = result.evidence[0]?.redactedSummary ?? '';
    assert.ok(!summary.includes(sneakyButPlausiblePassword));
    assert.equal(summary, 'TYPE (valor redactado: ••••••)');
  }
  // Verificacion adicional: el JSON completo del resultado tampoco contiene
  // el valor real en ningun otro campo (nunca se filtra por un campo lateral).
  assert.ok(!JSON.stringify(result).includes(sneakyButPlausiblePassword));
});

test('HALLAZGO REAL CORREGIDO (ver docs/security/threat-model.md seccion 7): validateToolManifest ahora aplica looksLikeRawSecret a ownerRef/name, no solo a credentialRef -- un manifest que filtra una credencial real ahi se rechaza', () => {
  const registry = new ToolRegistry();
  const result = registry.register({
    id: 'tool-leaky-owner',
    // Un secreto real pegado por error en `ownerRef` (p. ej. alguien copio
    // el token equivocado al llenar el formulario de alta de la tool).
    // Historial: este mismo test/fixture documento el gap como HALLAZGO REAL
    // no corregido durante PH10-T003 (asercion original `result.outcome ===
    // 'REGISTERED'`). Corregido en un ciclo posterior (fix aislado y aditivo
    // en @rhia/tool-registry sobre el hallazgo ya documentado, ver "Update"
    // en docs/progress/PH10-T003.md); este test se actualiza a la vez, tal
    // como la nota original pedia.
    name: 'Tool con owner filtrado',
    ownerRef: 'sk-abcdefghijklmnopqrstuvwxyz123456',
    riskLevel: 'LOW',
    requiredCapability: 'records.read',
    credentialRef: null,
    allowedDomains: [],
    allowedActions: ['noop'],
  });
  assert.equal(result.outcome, 'REJECTED');
  if (result.outcome === 'REJECTED') assert.ok(result.errors.some((e) => e.field === 'ownerRef'));
});
