// Playwright Worker (PH09-T002) -- ejecuta un `Scenario` (contracts.ts)
// contra un `BrowserDriver` inyectado (driver.ts), accion por accion, con
// las 6 acciones del packet: perfiles aislados, selectors robustos (ya
// impuesto en `validateScenario`), screenshots en fallo, timeouts,
// checkpoints y domain allowlist (ya impuesto en `validateScenario`, mas un
// segundo chequeo en runtime aqui -- defensa en profundidad, mismo patron
// que `ToolRegistry`/`authorizeToolInvocation` en `@rhia/tool-registry`,
// que separan "el manifest es valido" de "esta invocacion puntual esta
// autorizada").

import { randomUUID } from 'node:crypto';
import type { Scenario, ScenarioStep, StepAction, TypeInput } from './contracts.js';
import { isSafelyRetryableAction, validateScenario, type ScenarioValidationError } from './contracts.js';
import type { BrowserContextHandle, BrowserDriver, ScreenshotRef, SecretResolver } from './driver.js';
import { classifyStepError, createBrowserError, ClassifiedBrowserError, type BrowserError } from './errors.js';

const REDACTED_PLACEHOLDER = '••••••';

export type StepEvidence = Readonly<{
  stepId: string;
  actionKind: StepAction['kind'];
  outcome: 'SUCCEEDED' | 'FAILED';
  attempts: number;
  startedAt: string;
  finishedAt: string;
  /** Nunca contiene un valor real tipeado -- solo un resumen seguro (p.ej. "TYPE (valor redactado)"). */
  redactedSummary: string;
  /** Accion "Screenshots en fallo": solo se captura y adjunta cuando `outcome === 'FAILED'`. */
  screenshot: ScreenshotRef | null;
  error: BrowserError | null;
}>;

export type Checkpoint = Readonly<{
  scenarioId: string;
  lastCompletedStepIndex: number;
  lastCompletedStepId: string | null;
  updatedAt: string;
}>;

export type WorkerRunResult =
  | Readonly<{ outcome: 'REJECTED'; errors: readonly ScenarioValidationError[] }>
  | Readonly<{ outcome: 'COMPLETED'; scenarioId: string; contextId: string; evidence: readonly StepEvidence[]; checkpoint: Checkpoint }>
  | Readonly<{
      outcome: 'FAILED';
      scenarioId: string;
      contextId: string;
      evidence: readonly StepEvidence[];
      checkpoint: Checkpoint;
      failedStepId: string;
      error: BrowserError;
    }>;

export type PlaywrightWorkerDeps = Readonly<{
  now: () => Date;
  secretResolver?: SecretResolver;
}>;

export type RunScenarioOptions = Readonly<{
  /** Accion "Checkpoints": si se entrega y coincide con `scenario.id`, la corrida arranca DESPUES del ultimo step completado -- nunca repite steps ya verificados. */
  resumeFrom?: Checkpoint;
}>;

const withTimeout = async <T>(signal: AbortSignal, timeoutMs: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  const onExternalAbort = (): void => controller.abort();
  signal.addEventListener('abort', onExternalAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onExternalAbort);
  }
};

const redactedSummaryFor = (action: StepAction): string => {
  switch (action.kind) {
    case 'NAVIGATE':
      return `NAVIGATE ${new URL(action.url).hostname}`;
    case 'CLICK':
      return 'CLICK';
    case 'WAIT_FOR':
      return 'WAIT_FOR';
    case 'ASSERT_TEXT':
      return 'ASSERT_TEXT';
    case 'TYPE':
      // Criterio de aceptacion "Credenciales no se loguean": NUNCA se
      // interpola el valor real (ni LITERAL ni el secreto resuelto de
      // SECRET_REF) en ningun resumen/evidencia/log.
      return `TYPE (valor redactado: ${REDACTED_PLACEHOLDER})`;
  }
};

/**
 * Accion "Domain allowlist": punto UNICO real de aplicacion de la
 * allowlist, justo antes de llamar al driver real. `validateScenario` solo
 * exige que la URL sea absoluta y bien formada (ver contracts.ts) --
 * deliberado: el chequeo de seguridad que importa es este, inmediatamente
 * antes de la accion de red real, no uno duplicado en la validacion
 * estructural. Fail-closed: si la URL no se puede parsear, tambien se
 * rechaza.
 */
const assertDomainAllowed = (scenario: Scenario, url: string): BrowserError | null => {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return createBrowserError({ code: 'RHIA_BROWSER_DOMAIN_FORBIDDEN', message: `url invalida: '${url}'.` });
  }
  if (!scenario.allowedDomains.includes(host)) {
    return createBrowserError({ code: 'RHIA_BROWSER_DOMAIN_FORBIDDEN', message: `El host '${host}' no esta en la allowlist del escenario.` });
  }
  return null;
};

export class PlaywrightWorker {
  private readonly driver: BrowserDriver;
  private readonly deps: PlaywrightWorkerDeps;

  constructor(driver: BrowserDriver, deps: PlaywrightWorkerDeps) {
    this.driver = driver;
    this.deps = deps;
  }

  /**
   * Resuelve el valor REAL a tipear para un `TypeInput`. Un `SECRET_REF`
   * sin `secretResolver` inyectado nunca se intenta adivinar/omitir en
   * silencio -- falla explicito con `RHIA_BROWSER_SECRET_UNAVAILABLE`.
   */
  private async resolveTypeValue(input: TypeInput, signal: AbortSignal): Promise<string> {
    if (input.kind === 'LITERAL') return input.value;
    if (!this.deps.secretResolver) {
      throw new ClassifiedBrowserError(
        createBrowserError({ code: 'RHIA_BROWSER_SECRET_UNAVAILABLE', message: 'El step requiere un SECRET_REF pero no hay SecretResolver inyectado.' }),
      );
    }
    return this.deps.secretResolver.resolve(input.ref, signal);
  }

  private async performAction(context: BrowserContextHandle, action: StepAction, signal: AbortSignal): Promise<void> {
    switch (action.kind) {
      case 'NAVIGATE': {
        await this.driver.navigate(context, action.url, signal);
        return;
      }
      case 'CLICK': {
        const element = await this.driver.findElement(context, action.selector, signal);
        await this.driver.click(context, element, signal);
        return;
      }
      case 'WAIT_FOR': {
        await this.driver.findElement(context, action.selector, signal);
        return;
      }
      case 'ASSERT_TEXT': {
        const element = await this.driver.findElement(context, action.selector, signal);
        const text = await this.driver.readText(context, element, signal);
        if (text !== action.expected) {
          throw new ClassifiedBrowserError(createBrowserError({ code: 'RHIA_BROWSER_ASSERTION_FAILED', message: `Texto esperado '${action.expected}', obtenido '${text}'.` }));
        }
        return;
      }
      case 'TYPE': {
        const element = await this.driver.findElement(context, action.selector, signal);
        const value = await this.resolveTypeValue(action.input, signal);
        await this.driver.type(context, element, value, signal);
        return;
      }
    }
  }

  /**
   * Ejecuta UN step con su politica de timeout y de reintento seguro.
   * Nunca lanza -- siempre devuelve la `StepEvidence` completa (exito o
   * fallo clasificado), y en fallo ya incluye el screenshot real
   * (accion "Screenshots en fallo").
   */
  private async runStep(context: BrowserContextHandle, scenario: Scenario, step: ScenarioStep): Promise<StepEvidence> {
    const startedAt = this.deps.now().toISOString();
    const timeoutMs = step.timeoutMs ?? scenario.defaultTimeoutMs;
    // Accion "Retry seguro": solo NAVIGATE/WAIT_FOR/ASSERT_TEXT pueden
    // reintentarse automaticamente dentro del mismo step -- ver
    // `isSafelyRetryableAction`. CLICK/TYPE siempre tienen 1 solo intento
    // real aqui, precisamente para no duplicar una accion mutante.
    const maxAttempts = isSafelyRetryableAction(step.action.kind) ? scenario.maxStepAttempts ?? 2 : 1;

    let lastError: BrowserError | null = null;
    let attempts = 0;
    for (attempts = 1; attempts <= maxAttempts; attempts += 1) {
      // Accion "Domain allowlist" (runtime): NUNCA se llama al driver si el
      // dominio no esta permitido -- fail-closed antes de tocar la red real.
      if (step.action.kind === 'NAVIGATE') {
        const domainError = assertDomainAllowed(scenario, step.action.url);
        if (domainError) {
          lastError = domainError;
          break;
        }
      }

      try {
        const controller = new AbortController();
        await withTimeout(controller.signal, timeoutMs, (signal) => this.performAction(context, step.action, signal));
        return {
          stepId: step.id,
          actionKind: step.action.kind,
          outcome: 'SUCCEEDED',
          attempts,
          startedAt,
          finishedAt: this.deps.now().toISOString(),
          redactedSummary: redactedSummaryFor(step.action),
          screenshot: null,
          error: null,
        };
      } catch (rawError) {
        // `ClassifiedBrowserError` es el UNICO caso que ya trae un
        // `BrowserError` clasificado de antemano (lanzado explicitamente
        // dentro de este mismo paquete, ver `resolveTypeValue`/ASSERT_TEXT).
        // Todo lo demas SIEMPRE pasa por `classifyStepError` -- un chequeo
        // heuristico por "tiene un campo `code`" es incorrecto aqui: un
        // `DOMException` real (el `AbortError` de un timeout) tambien trae
        // un `.code` nativo (el legado numerico DOM4, `20`), lo que
        // clasificaria mal un timeout real (bug encontrado con evidencia
        // real en este ciclo, ver docs/progress/PH09-T002.md).
        lastError = rawError instanceof ClassifiedBrowserError ? rawError.browserError : classifyStepError(rawError);
        // Nunca reintentar RHIA_BROWSER_SESSION_EXPIRED (Prueba requerida
        // "Login expired"): la sesion no se arregla sola reintentando, hace
        // falta una corrida nueva con credenciales/login frescos.
        if (lastError.code === 'RHIA_BROWSER_SESSION_EXPIRED') break;
        if (attempts >= maxAttempts) break;
      }
    }

    // Accion "Screenshots en fallo": SIEMPRE se intenta capturar evidencia
    // real en cualquier fallo terminal de un step. Si la propia captura
    // falla, no se enmascara el error original -- se adjunta `null`.
    let screenshot: ScreenshotRef | null = null;
    try {
      screenshot = await this.driver.captureScreenshot(context);
    } catch {
      screenshot = null;
    }

    return {
      stepId: step.id,
      actionKind: step.action.kind,
      outcome: 'FAILED',
      attempts,
      startedAt,
      finishedAt: this.deps.now().toISOString(),
      redactedSummary: redactedSummaryFor(step.action),
      screenshot,
      error: lastError ?? createBrowserError({ code: 'RHIA_BROWSER_UNEXPECTED_FAILURE', message: 'Fallo sin clasificar.' }),
    };
  }

  /**
   * Ejecuta el escenario completo. Nunca abre un contexto para un escenario
   * invalido (`REJECTED` se devuelve antes de tocar el driver). Accion
   * "Perfiles aislados": SIEMPRE crea un contexto nuevo con un `profileId`
   * unico por corrida (nunca reutiliza uno de una corrida anterior, ni
   * siquiera en un retry desde checkpoint) -- error a evitar "Compartir
   * sesion sin aislamiento".
   */
  async run(scenarioInput: Scenario | unknown, options: RunScenarioOptions = {}): Promise<WorkerRunResult> {
    const validation = validateScenario(scenarioInput);
    if (!validation.valid) return { outcome: 'REJECTED', errors: validation.errors };
    const scenario = validation.scenario;

    const startIndex =
      options.resumeFrom && options.resumeFrom.scenarioId === scenario.id ? options.resumeFrom.lastCompletedStepIndex + 1 : 0;

    const context = await this.driver.createIsolatedContext({ profileId: `${scenario.id}:${randomUUID()}` }, new AbortController().signal);
    const evidence: StepEvidence[] = [];
    let checkpoint: Checkpoint = options.resumeFrom ?? {
      scenarioId: scenario.id,
      lastCompletedStepIndex: -1,
      lastCompletedStepId: null,
      updatedAt: this.deps.now().toISOString(),
    };

    try {
      for (let index = startIndex; index < scenario.steps.length; index += 1) {
        const step = scenario.steps[index];
        if (!step) continue;
        const stepEvidence = await this.runStep(context, scenario, step);
        evidence.push(stepEvidence);

        if (stepEvidence.outcome === 'FAILED') {
          return {
            outcome: 'FAILED',
            scenarioId: scenario.id,
            contextId: context.contextId,
            evidence,
            checkpoint,
            failedStepId: step.id,
            error: stepEvidence.error ?? createBrowserError({ code: 'RHIA_BROWSER_UNEXPECTED_FAILURE', message: 'Fallo sin clasificar.' }),
          };
        }

        checkpoint = { scenarioId: scenario.id, lastCompletedStepIndex: index, lastCompletedStepId: step.id, updatedAt: stepEvidence.finishedAt };
      }

      return { outcome: 'COMPLETED', scenarioId: scenario.id, contextId: context.contextId, evidence, checkpoint };
    } finally {
      // Accion "Perfiles aislados": el contexto SIEMPRE se cierra, exito o
      // fallo -- nunca queda una sesion aislada abierta/huerfana.
      await this.driver.closeContext(context);
    }
  }
}
