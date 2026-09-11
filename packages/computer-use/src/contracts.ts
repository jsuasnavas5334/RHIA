// Computer Use Adapter (PH09-T003) -- contratos neutrales. "Contexto
// necesario" del packet: "Approval/risk model". "Puede ejecutarse en
// paralelo con PH09-T004" (Skill Library) -- este paquete modela
// EXCLUSIVAMENTE control visual NO determinista (coordenadas de pantalla,
// sin selectors DOM reales) para cuando "API/Playwright no bastan" (Objetivo
// del packet) -- el caso DETERMINISTA (DOM estable) ya lo cubre
// `@rhia/playwright-worker` (PH09-T002), reusado aqui para la parte que SI
// es identica en ambos (perfiles/sesion aislada, tipo de screenshot).
//
// Dependencias reales declaradas (PH09-T001, PH09-T002): se reusa
// `toolRiskLevels`/`ToolRiskLevel` LITERAL de `@rhia/tool-registry` (misma
// escala LOW/MEDIUM/HIGH/CRITICAL, nunca una segunda escala paralela) y
// `BrowserProfile`/`BrowserContextHandle`/`ScreenshotRef`/`TypeInput` de
// `@rhia/playwright-worker` (misma nocion de sesion aislada y de
// tipear-sin-loguear-secretos, nunca reimplementada aqui).

import { looksLikeRawSecret } from '@rhia/tool-registry';
import type { ToolRiskLevel } from '@rhia/tool-registry';
import type { TypeInput } from '@rhia/playwright-worker';

export { toolRiskLevels } from '@rhia/tool-registry';
export type { ToolRiskLevel } from '@rhia/tool-registry';

export type ScreenCoordinates = Readonly<{ x: number; y: number }>;

export type ComputerUseAction =
  | Readonly<{ kind: 'MOVE_CLICK'; coordinates: ScreenCoordinates; targetDescription: string }>
  | Readonly<{ kind: 'TYPE'; input: TypeInput; targetDescription: string }>
  | Readonly<{ kind: 'KEY_PRESS'; key: string }>
  | Readonly<{ kind: 'WAIT'; ms: number }>;

export const computerUseActionKinds = ['MOVE_CLICK', 'TYPE', 'KEY_PRESS', 'WAIT'] as const;

/**
 * Accion "Risk checkpoints" + criterio de aceptacion "High-risk action
 * requiere approval": solo `HIGH`/`CRITICAL` exigen una
 * `ComputerUseApprovalProof` valida antes de ejecutarse -- ver worker.ts.
 */
export const highRiskLevels: ReadonlySet<ToolRiskLevel> = new Set(['HIGH', 'CRITICAL']);
export const requiresApproval = (riskLevel: ToolRiskLevel): boolean => highRiskLevels.has(riskLevel);

export type ComputerUseStep = Readonly<{
  id: string;
  riskLevel: ToolRiskLevel;
  action: ComputerUseAction;
  timeoutMs?: number;
}>;

export type ComputerUseTask = Readonly<{
  id: string;
  organizationId: string;
  /** Criterio "No accede dominios no autorizados" -- lista NO vacia, fail-closed (mismo principio que `Scenario.allowedDomains` de `@rhia/playwright-worker`). */
  allowedDomains: readonly string[];
  /** Accion "Step limits": techo REAL y duro -- `steps.length` nunca puede excederlo (validado en `validateTask`, no solo documentado). */
  maxSteps: number;
  steps: readonly ComputerUseStep[];
  defaultTimeoutMs: number;
}>;

/**
 * Prueba requerida "Sensitive action": un proof real, valido SOLO para el
 * `taskId`/`stepId`/`organizationId` exactos que aprueba, con la misma
 * regla de "no auto-aprobado por quien pide" que `@rhia/policy#authorize`
 * aplica a cualquier `ApprovalProof` real -- ver worker.ts `isValidApproval`
 * (replicada localmente porque `@rhia/policy` no exporta esa logica interna,
 * ver "Decision de alcance" en docs/progress/PH09-T003.md).
 */
export type ComputerUseApprovalProof = Readonly<{
  taskId: string;
  stepId: string;
  status: 'APPROVED';
  organizationId: string;
  approvedByHumanId: string;
  expiresAt?: string;
}>;

export type TaskValidationError = Readonly<{ field: string; reason: string }>;
export type TaskValidationResult =
  | Readonly<{ valid: true; task: ComputerUseTask }>
  | Readonly<{ valid: false; errors: readonly TaskValidationError[] }>;

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const toolRiskLevelValues: readonly string[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Validacion REAL en runtime de una `ComputerUseTask` recibida como
 * `unknown` -- mismo principio que `validateToolManifest`/`validateScenario`
 * de los hermanos de PH09: nunca se confia en que ya cumple el tipo TS.
 */
export const validateTask = (raw: unknown): TaskValidationResult => {
  const errors: TaskValidationError[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: [{ field: 'root', reason: 'La tarea debe ser un objeto.' }] };
  }
  const input = raw as Record<string, unknown>;

  if (!nonEmptyString(input['id'])) errors.push({ field: 'id', reason: 'id requerido, string no vacio.' });
  if (!nonEmptyString(input['organizationId'])) errors.push({ field: 'organizationId', reason: 'organizationId requerido, string no vacio.' });

  const allowedDomains = input['allowedDomains'];
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0 || !allowedDomains.every((domain) => nonEmptyString(domain))) {
    errors.push({ field: 'allowedDomains', reason: 'allowedDomains debe tener al menos un dominio -- criterio "No accede dominios no autorizados", fail-closed.' });
  }

  const maxSteps = input['maxSteps'];
  if (typeof maxSteps !== 'number' || !Number.isInteger(maxSteps) || maxSteps < 1) {
    errors.push({ field: 'maxSteps', reason: 'maxSteps debe ser un entero >= 1 -- accion "Step limits".' });
  }

  const defaultTimeoutMs = input['defaultTimeoutMs'];
  if (typeof defaultTimeoutMs !== 'number' || !Number.isFinite(defaultTimeoutMs) || defaultTimeoutMs <= 0) {
    errors.push({ field: 'defaultTimeoutMs', reason: 'defaultTimeoutMs debe ser un numero positivo.' });
  }

  const steps = input['steps'];
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push({ field: 'steps', reason: 'steps debe tener al menos un elemento.' });
  } else if (typeof maxSteps === 'number' && steps.length > maxSteps) {
    errors.push({ field: 'steps', reason: `steps.length (${steps.length}) excede maxSteps (${maxSteps}) -- accion "Step limits", techo real y duro.` });
  } else {
    const seenIds = new Set<string>();
    steps.forEach((rawStep, index) => {
      const prefix = `steps[${index}]`;
      if (typeof rawStep !== 'object' || rawStep === null) {
        errors.push({ field: prefix, reason: 'cada step debe ser un objeto.' });
        return;
      }
      const step = rawStep as Record<string, unknown>;
      if (!nonEmptyString(step['id'])) {
        errors.push({ field: `${prefix}.id`, reason: 'id de step requerido, string no vacio.' });
      } else if (seenIds.has(step['id'])) {
        errors.push({ field: `${prefix}.id`, reason: `id de step duplicado ('${step['id']}') -- el trace/replay necesita ids unicos.` });
      } else {
        seenIds.add(step['id']);
      }

      const riskLevel = step['riskLevel'];
      if (typeof riskLevel !== 'string' || !toolRiskLevelValues.includes(riskLevel)) {
        errors.push({ field: `${prefix}.riskLevel`, reason: `riskLevel debe ser uno de: ${toolRiskLevelValues.join(', ')} -- reusa la escala real de @rhia/tool-registry.` });
      }

      const timeoutMs = step['timeoutMs'];
      if (timeoutMs !== undefined && (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
        errors.push({ field: `${prefix}.timeoutMs`, reason: 'timeoutMs debe ser un numero positivo si se especifica.' });
      }

      const action = step['action'];
      if (typeof action !== 'object' || action === null) {
        errors.push({ field: `${prefix}.action`, reason: 'action requerida.' });
        return;
      }
      const actionInput = action as Record<string, unknown>;
      const kind = actionInput['kind'];
      if (typeof kind !== 'string' || !computerUseActionKinds.includes(kind as ComputerUseAction['kind'])) {
        errors.push({ field: `${prefix}.action.kind`, reason: `kind debe ser uno de: ${computerUseActionKinds.join(', ')}.` });
        return;
      }

      if (kind === 'MOVE_CLICK') {
        const coordinates = actionInput['coordinates'];
        const validCoordinates =
          typeof coordinates === 'object' &&
          coordinates !== null &&
          typeof (coordinates as Record<string, unknown>)['x'] === 'number' &&
          typeof (coordinates as Record<string, unknown>)['y'] === 'number';
        if (!validCoordinates) errors.push({ field: `${prefix}.action.coordinates`, reason: 'coordinates debe ser { x: number, y: number }.' });
        if (!nonEmptyString(actionInput['targetDescription'])) {
          errors.push({ field: `${prefix}.action.targetDescription`, reason: 'targetDescription requerido -- criterio "Session trace auditable" necesita un texto legible para el replay.' });
        }
      } else if (kind === 'TYPE') {
        if (!nonEmptyString(actionInput['targetDescription'])) {
          errors.push({ field: `${prefix}.action.targetDescription`, reason: 'targetDescription requerido -- criterio "Session trace auditable".' });
        }
        const typeInput = actionInput['input'];
        if (typeof typeInput !== 'object' || typeInput === null) {
          errors.push({ field: `${prefix}.action.input`, reason: 'input requerido (LITERAL o SECRET_REF).' });
        } else {
          const typed = typeInput as Record<string, unknown>;
          if (typed['kind'] === 'LITERAL') {
            const value = typed['value'];
            if (!nonEmptyString(value)) {
              errors.push({ field: `${prefix}.action.input.value`, reason: 'value requerido, string no vacio.' });
            } else if (looksLikeRawSecret(value)) {
              errors.push({ field: `${prefix}.action.input.value`, reason: 'value parece una credencial real -- regla fija del proyecto. Usa input.kind = "SECRET_REF".' });
            }
          } else if (typed['kind'] === 'SECRET_REF') {
            if (!nonEmptyString(typed['ref'])) errors.push({ field: `${prefix}.action.input.ref`, reason: 'ref requerido, string no vacio.' });
          } else {
            errors.push({ field: `${prefix}.action.input.kind`, reason: 'input.kind debe ser LITERAL o SECRET_REF.' });
          }
        }
      } else if (kind === 'KEY_PRESS') {
        if (!nonEmptyString(actionInput['key'])) errors.push({ field: `${prefix}.action.key`, reason: 'key requerido, string no vacio.' });
      } else if (kind === 'WAIT') {
        const ms = actionInput['ms'];
        if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) errors.push({ field: `${prefix}.action.ms`, reason: 'ms debe ser un numero positivo.' });
      }
    });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    task: {
      id: input['id'] as string,
      organizationId: input['organizationId'] as string,
      allowedDomains: allowedDomains as readonly string[],
      maxSteps: maxSteps as number,
      defaultTimeoutMs: defaultTimeoutMs as number,
      steps: steps as readonly ComputerUseStep[],
    },
  };
};
