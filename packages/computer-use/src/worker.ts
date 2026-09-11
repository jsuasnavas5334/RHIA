// Computer Use Adapter (PH09-T003) -- ejecuta una `ComputerUseTask`
// (contracts.ts) contra un `ComputerUseDriver` inyectado (driver.ts),
// step por step, con las 6 acciones del packet: interfaz provider-neutral
// (ya en driver.ts), sandbox browser (perfil aislado reusado de
// `@rhia/playwright-worker`), capture actions (observacion real antes/
// despues de cada step), step limits (ya impuesto en `validateTask`),
// risk checkpoints (aprobacion real requerida para HIGH/CRITICAL) y
// fallback humano (`ESCALATED_TO_HUMAN`, nunca un intento ciego de seguir
// solo).

import { randomUUID } from 'node:crypto';
import type { BrowserContextHandle } from '@rhia/playwright-worker';
import type { ComputerUseAction, ComputerUseApprovalProof, ComputerUseStep, ComputerUseTask, TaskValidationError, ToolRiskLevel } from './contracts.js';
import { requiresApproval, validateTask } from './contracts.js';
import type { ComputerUseDriver, ComputerUseObservation, SecretResolver } from './driver.js';
import { classifyStepError, createComputerUseError, ClassifiedComputerUseError, type ComputerUseError } from './errors.js';

export type StepTraceEntry = Readonly<{
  stepId: string;
  actionKind: ComputerUseAction['kind'];
  riskLevel: ToolRiskLevel;
  /** Nunca es el valor real tipeado -- solo la etiqueta humana del objetivo (p.ej. "campo de contraseña"), declarada por el propio escenario. Criterio "Session trace auditable". */
  targetDescription: string;
  preObservation: ComputerUseObservation;
  postObservation: ComputerUseObservation | null;
  outcome: 'EXECUTED' | 'BLOCKED' | 'FAILED';
  error: ComputerUseError | null;
}>;

export type ComputerUseRunResult =
  | Readonly<{ outcome: 'REJECTED'; errors: readonly TaskValidationError[] }>
  | Readonly<{ outcome: 'COMPLETED'; taskId: string; contextId: string; trace: readonly StepTraceEntry[] }>
  | Readonly<{ outcome: 'ESCALATED_TO_HUMAN'; taskId: string; contextId: string; trace: readonly StepTraceEntry[]; stepId: string; reason: string }>
  | Readonly<{ outcome: 'FAILED'; taskId: string; contextId: string; trace: readonly StepTraceEntry[]; stepId: string; error: ComputerUseError }>;

export type ComputerUseWorkerDeps = Readonly<{
  now: () => Date;
  secretResolver?: SecretResolver;
  /** Quien pide la corrida -- usado SOLO para la regla real "no auto-aprobado por quien pide" (mismo principio que `@rhia/policy#authorize`). */
  requestingHumanId?: string;
}>;

export type RunTaskOptions = Readonly<{
  /** Aprobaciones YA obtenidas para steps de riesgo HIGH/CRITICAL de esta tarea. Nunca se resuelven/adivinan dentro del worker -- deben llegar ya decididas por un humano real. */
  approvals?: readonly ComputerUseApprovalProof[];
}>;

const targetDescriptionFor = (action: ComputerUseAction): string => {
  switch (action.kind) {
    case 'MOVE_CLICK':
      return action.targetDescription;
    case 'TYPE':
      return action.targetDescription;
    case 'KEY_PRESS':
      return `tecla '${action.key}'`;
    case 'WAIT':
      return `esperar ${action.ms}ms`;
  }
};

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

/**
 * Accion "No accede dominios no autorizados": punto UNICO real de
 * aplicacion, evaluado sobre la URL REAL observada (`observe().currentUrl`),
 * nunca sobre un valor declarado a priori (esta tarea, a diferencia de un
 * `Scenario` de Playwright, no necesariamente declara un `NAVIGATE` -- opera
 * sobre lo que YA este en pantalla). Prueba requerida "Wrong page".
 */
const isDomainAllowed = (task: ComputerUseTask, currentUrl: string): boolean => {
  try {
    return task.allowedDomains.includes(new URL(currentUrl).hostname);
  } catch {
    return false;
  }
};

/**
 * Mismo principio real que la validacion interna (no exportada) de
 * `@rhia/policy#authorize` (`validApproval`): organizacion exacta, vigencia
 * real, y NUNCA auto-aprobado por quien pide la corrida. Se replica
 * localmente porque `@rhia/policy` no exporta esa funcion -- ver
 * docs/progress/PH09-T003.md "Decision de alcance".
 */
const findValidApproval = (
  approvals: readonly ComputerUseApprovalProof[],
  task: ComputerUseTask,
  step: ComputerUseStep,
  requestingHumanId: string | undefined,
  now: Date,
): ComputerUseApprovalProof | undefined =>
  approvals.find((proof) => {
    if (proof.taskId !== task.id || proof.stepId !== step.id || proof.status !== 'APPROVED') return false;
    if (proof.organizationId !== task.organizationId) return false;
    if (requestingHumanId !== undefined && proof.approvedByHumanId === requestingHumanId) return false;
    return !proof.expiresAt || new Date(proof.expiresAt).getTime() > now.getTime();
  });

export class ComputerUseWorker {
  private readonly driver: ComputerUseDriver;
  private readonly deps: ComputerUseWorkerDeps;

  constructor(driver: ComputerUseDriver, deps: ComputerUseWorkerDeps) {
    this.driver = driver;
    this.deps = deps;
  }

  private async resolveTypeValue(action: Extract<ComputerUseAction, { kind: 'TYPE' }>, signal: AbortSignal): Promise<string> {
    if (action.input.kind === 'LITERAL') return action.input.value;
    if (!this.deps.secretResolver) {
      throw new ClassifiedComputerUseError(
        createComputerUseError({ code: 'RHIA_COMPUTER_USE_UNEXPECTED_FAILURE', message: 'El step requiere un SECRET_REF pero no hay SecretResolver inyectado.' }),
      );
    }
    return this.deps.secretResolver.resolve(action.input.ref, signal);
  }

  private async performAction(context: BrowserContextHandle, action: ComputerUseAction, signal: AbortSignal): Promise<void> {
    switch (action.kind) {
      case 'MOVE_CLICK':
        await this.driver.moveAndClick(context, action.coordinates, signal);
        return;
      case 'TYPE': {
        const value = await this.resolveTypeValue(action, signal);
        await this.driver.typeText(context, value, signal);
        return;
      }
      case 'KEY_PRESS':
        await this.driver.pressKey(context, action.key, signal);
        return;
      case 'WAIT':
        await this.driver.wait(action.ms, signal);
        return;
    }
  }

  /**
   * Ejecuta la tarea completa. Nunca abre una sesion sandbox para una tarea
   * invalida. Accion "Sandbox browser": SIEMPRE crea una sesion nueva con
   * `profileId` unico (misma nocion de aislamiento que `@rhia/playwright-
   * worker`), y SIEMPRE la cierra en `finally`.
   */
  async run(taskInput: ComputerUseTask | unknown, options: RunTaskOptions = {}): Promise<ComputerUseRunResult> {
    const validation = validateTask(taskInput);
    if (!validation.valid) return { outcome: 'REJECTED', errors: validation.errors };
    const task = validation.task;
    const approvals = options.approvals ?? [];

    const context = await this.driver.createSandboxSession({ profileId: `${task.id}:${randomUUID()}` }, new AbortController().signal);
    const trace: StepTraceEntry[] = [];

    try {
      for (const step of task.steps) {
        const timeoutMs = step.timeoutMs ?? task.defaultTimeoutMs;
        const controller = new AbortController();

        // Accion "Capture actions": observacion real ANTES de decidir nada.
        const preObservation = await withTimeout(controller.signal, timeoutMs, (signal) => this.driver.observe(context, signal));

        // Prueba requerida "Unexpected modal": un modal real detectado
        // ANTES de actuar es, por definicion, un estado no anticipado por
        // el escenario -- accion "Fallback humano", nunca se intenta
        // adivinar que hacer con el modal.
        if (preObservation.modalDetected) {
          const entry: StepTraceEntry = {
            stepId: step.id,
            actionKind: step.action.kind,
            riskLevel: step.riskLevel,
            targetDescription: targetDescriptionFor(step.action),
            preObservation,
            postObservation: null,
            outcome: 'BLOCKED',
            error: null,
          };
          trace.push(entry);
          return { outcome: 'ESCALATED_TO_HUMAN', taskId: task.id, contextId: context.contextId, trace, stepId: step.id, reason: 'Se detecto un modal/dialogo inesperado antes de ejecutar la accion.' };
        }

        // Prueba requerida "Wrong page": la URL REAL observada debe seguir
        // dentro de la allowlist -- fail-closed, nunca se ejecuta la
        // accion sobre una pagina no autorizada.
        if (!isDomainAllowed(task, preObservation.currentUrl)) {
          const entry: StepTraceEntry = {
            stepId: step.id,
            actionKind: step.action.kind,
            riskLevel: step.riskLevel,
            targetDescription: targetDescriptionFor(step.action),
            preObservation,
            postObservation: null,
            outcome: 'FAILED',
            error: createComputerUseError({ code: 'RHIA_COMPUTER_USE_DOMAIN_FORBIDDEN', message: `La URL actual ('${preObservation.currentUrl}') no esta en la allowlist de la tarea.` }),
          };
          trace.push(entry);
          return { outcome: 'FAILED', taskId: task.id, contextId: context.contextId, trace, stepId: step.id, error: entry.error as ComputerUseError };
        }

        // Accion "Risk checkpoints" + criterio "High-risk action requiere
        // approval". Prueba requerida "Sensitive action".
        if (requiresApproval(step.riskLevel) && !findValidApproval(approvals, task, step, this.deps.requestingHumanId, this.deps.now())) {
          const entry: StepTraceEntry = {
            stepId: step.id,
            actionKind: step.action.kind,
            riskLevel: step.riskLevel,
            targetDescription: targetDescriptionFor(step.action),
            preObservation,
            postObservation: null,
            outcome: 'BLOCKED',
            error: null,
          };
          trace.push(entry);
          return {
            outcome: 'ESCALATED_TO_HUMAN',
            taskId: task.id,
            contextId: context.contextId,
            trace,
            stepId: step.id,
            reason: `El step '${step.id}' es de riesgo ${step.riskLevel} y requiere una aprobacion humana valida (no auto-aprobada) antes de ejecutarse.`,
          };
        }

        try {
          await withTimeout(controller.signal, timeoutMs, (signal) => this.performAction(context, step.action, signal));
        } catch (rawError) {
          const error = rawError instanceof ClassifiedComputerUseError ? rawError.computerUseError : classifyStepError(rawError);
          // Accion "Capture actions": se intenta una observacion post-fallo
          // real (mejor esfuerzo) para dejar evidencia de en que estado
          // quedo la pantalla -- si esa observacion misma falla, no se
          // enmascara el error original.
          let postObservation: ComputerUseObservation | null = null;
          try {
            postObservation = await this.driver.observe(context, new AbortController().signal);
          } catch {
            postObservation = null;
          }
          const entry: StepTraceEntry = {
            stepId: step.id,
            actionKind: step.action.kind,
            riskLevel: step.riskLevel,
            targetDescription: targetDescriptionFor(step.action),
            preObservation,
            postObservation,
            outcome: 'FAILED',
            error,
          };
          trace.push(entry);
          return { outcome: 'FAILED', taskId: task.id, contextId: context.contextId, trace, stepId: step.id, error };
        }

        const postObservation = await withTimeout(controller.signal, timeoutMs, (signal) => this.driver.observe(context, signal));
        trace.push({
          stepId: step.id,
          actionKind: step.action.kind,
          riskLevel: step.riskLevel,
          targetDescription: targetDescriptionFor(step.action),
          preObservation,
          postObservation,
          outcome: 'EXECUTED',
          error: null,
        });
      }

      return { outcome: 'COMPLETED', taskId: task.id, contextId: context.contextId, trace };
    } finally {
      // Accion "Sandbox browser": la sesion SIEMPRE se cierra, en cualquier
      // desenlace -- exito, fallo o escalado a humano.
      await this.driver.closeSession(context);
    }
  }
}

/**
 * Validacion final del packet "Replay/trace permite entender lo realizado":
 * produce una linea legible por humano por cada entrada del trace, en el
 * MISMO orden real de ejecucion (el array `trace` ya esta en ese orden) --
 * nunca incluye un valor tipeado real (`StepTraceEntry` estructuralmente no
 * lo carga, ver arriba).
 */
export const describeTrace = (trace: readonly StepTraceEntry[]): readonly string[] =>
  trace.map((entry) => `${entry.stepId} [${entry.riskLevel}] ${entry.actionKind} sobre '${entry.targetDescription}' -> ${entry.outcome}${entry.error ? ` (${entry.error.code})` : ''}`);
