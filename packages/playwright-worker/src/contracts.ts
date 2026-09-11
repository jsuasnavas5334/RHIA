// Playwright Worker (PH09-T002) -- contratos neutrales del "browser worker".
// "Contexto necesario" del packet: "Browser security policy". "Puede
// ejecutarse en paralelo con PH09-T003" (Computer Use) -- este paquete
// modela SOLO automatizacion DETERMINISTA (DOM estable, selectores reales,
// pasos explicitos), nunca control visual/no-determinista (eso es
// exactamente el alcance futuro de PH09-T003, el propio Handoff de este
// packet dice "Handoff Computer Use fallback").
//
// Dependencia real declarada (PH09-T001, Tool Registry): este paquete reusa
// `looksLikeRawSecret` LITERAL de `@rhia/tool-registry` para la misma regla
// fija del proyecto ("nunca escribir contraseñas o credenciales... en
// archivos, memoria o logs") aplicada aqui a un `TYPE` con `input.kind ===
// 'LITERAL'` -- no se reimplementa un heuristico paralelo de deteccion de
// secretos.

import { looksLikeRawSecret } from '@rhia/tool-registry';

// Accion "Selectors robustos": un `RobustSelector` es una CADENA ordenada de
// estrategias (no una sola). Error a evitar del packet "Selectors fragiles
// por texto unicamente" -- `validateScenario` rechaza cualquier selector
// cuya UNICA estrategia sea `text` (visible text es el mas fragil: cambia
// con copy/i18n). `text` SI se permite como fallback adicional dentro de
// una cadena que ya tiene al menos una estrategia estructural.
export type SelectorStrategy =
  | Readonly<{ kind: 'testId'; value: string }>
  | Readonly<{ kind: 'role'; role: string; name: string }>
  | Readonly<{ kind: 'css'; value: string }>
  | Readonly<{ kind: 'text'; value: string }>;

export type RobustSelector = Readonly<{ strategies: readonly SelectorStrategy[] }>;

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isSelectorStrategy = (value: unknown): value is SelectorStrategy => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  switch (input['kind']) {
    case 'testId':
    case 'css':
    case 'text':
      return nonEmptyString(input['value']);
    case 'role':
      return nonEmptyString(input['role']) && nonEmptyString(input['name']);
    default:
      return false;
  }
};

/** Error a evitar "Selectors fragiles por texto unicamente". */
export const isRobustSelector = (value: unknown): value is RobustSelector => {
  if (typeof value !== 'object' || value === null) return false;
  const strategies = (value as Record<string, unknown>)['strategies'];
  if (!Array.isArray(strategies) || strategies.length === 0) return false;
  if (!strategies.every(isSelectorStrategy)) return false;
  return strategies.some((strategy) => (strategy as SelectorStrategy).kind !== 'text');
};

// `TYPE`: nunca un valor literal que "parezca" una credencial real (misma
// regla fija del proyecto, defendida en profundidad con el heuristico real
// de `@rhia/tool-registry`, ver cabecera). Un valor sensible real SIEMPRE
// debe llegar como `SECRET_REF` (resuelto en runtime por un
// `SecretResolver` inyectado, ver driver.ts) -- nunca como texto plano en el
// escenario.
export type TypeInput = Readonly<{ kind: 'LITERAL'; value: string }> | Readonly<{ kind: 'SECRET_REF'; ref: string }>;

export type StepAction =
  | Readonly<{ kind: 'NAVIGATE'; url: string }>
  | Readonly<{ kind: 'CLICK'; selector: RobustSelector }>
  | Readonly<{ kind: 'TYPE'; selector: RobustSelector; input: TypeInput }>
  | Readonly<{ kind: 'WAIT_FOR'; selector: RobustSelector }>
  | Readonly<{ kind: 'ASSERT_TEXT'; selector: RobustSelector; expected: string }>;

export const stepActionKinds = ['NAVIGATE', 'CLICK', 'TYPE', 'WAIT_FOR', 'ASSERT_TEXT'] as const;

/**
 * Accion "Retry seguro": clasificacion FIJA por tipo de accion, no
 * configurable por escenario -- `NAVIGATE`/`WAIT_FOR`/`ASSERT_TEXT` son
 * naturalmente reintentables (no mutan estado del sitio destino);
 * `CLICK`/`TYPE` NUNCA se reintentan automaticamente dentro del mismo
 * intento de step (un click puede enviar un formulario -- reintentarlo a
 * ciegas podria duplicar una accion real). Ver worker.ts.
 */
export const isSafelyRetryableAction = (kind: StepAction['kind']): boolean =>
  kind === 'NAVIGATE' || kind === 'WAIT_FOR' || kind === 'ASSERT_TEXT';

export type ScenarioStep = Readonly<{
  id: string;
  action: StepAction;
  /** Sobreescribe `Scenario.defaultTimeoutMs` solo para este step. */
  timeoutMs?: number;
}>;

export type Scenario = Readonly<{
  id: string;
  /**
   * Accion "Domain allowlist": lista NO vacia y obligatoria (fail-closed,
   * mismo principio que `allowedActions` en `@rhia/tool-registry`) -- un
   * escenario que no declara ningun dominio nunca puede navegar a ninguno.
   */
  allowedDomains: readonly string[];
  steps: readonly ScenarioStep[];
  defaultTimeoutMs: number;
  /** Intentos maximos para steps clasificados como reintentables (ver `isSafelyRetryableAction`). Default 2 si se omite. */
  maxStepAttempts?: number;
}>;

export type ScenarioValidationError = Readonly<{ field: string; reason: string }>;
export type ScenarioValidationResult =
  | Readonly<{ valid: true; scenario: Scenario }>
  | Readonly<{ valid: false; errors: readonly ScenarioValidationError[] }>;

const extractNavigateHost = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const validateSelectorField = (field: string, value: unknown, errors: ScenarioValidationError[]): void => {
  if (!isRobustSelector(value)) {
    errors.push({ field, reason: 'selector invalido: requiere al menos una estrategia y no puede depender UNICAMENTE de `text` -- error a evitar "Selectors fragiles por texto unicamente".' });
  }
};

/**
 * Validacion REAL en runtime de un escenario recibido como `unknown` (puede
 * venir de un agente/LLM como JSON) -- mismo principio que
 * `validateToolManifest` de `@rhia/tool-registry`: nunca se confia en que ya
 * cumple el tipo TS. Rechaza (no corrige en silencio) un escenario invalido
 * ANTES de que `PlaywrightWorker.run` abra ningun contexto de navegador real
 * -- ver "Errores que debe evitar" del packet.
 */
export const validateScenario = (raw: unknown): ScenarioValidationResult => {
  const errors: ScenarioValidationError[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: [{ field: 'root', reason: 'El escenario debe ser un objeto.' }] };
  }
  const input = raw as Record<string, unknown>;

  if (!nonEmptyString(input['id'])) errors.push({ field: 'id', reason: 'id requerido, string no vacio.' });

  const allowedDomains = input['allowedDomains'];
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0 || !allowedDomains.every((domain) => nonEmptyString(domain))) {
    errors.push({ field: 'allowedDomains', reason: 'allowedDomains debe tener al menos un dominio -- error a evitar "Domain allowlist" vacia/implicita.' });
  }
  const defaultTimeoutMs = input['defaultTimeoutMs'];
  if (typeof defaultTimeoutMs !== 'number' || !Number.isFinite(defaultTimeoutMs) || defaultTimeoutMs <= 0) {
    errors.push({ field: 'defaultTimeoutMs', reason: 'defaultTimeoutMs debe ser un numero positivo.' });
  }

  const maxStepAttempts = input['maxStepAttempts'];
  if (maxStepAttempts !== undefined && (typeof maxStepAttempts !== 'number' || !Number.isInteger(maxStepAttempts) || maxStepAttempts < 1)) {
    errors.push({ field: 'maxStepAttempts', reason: 'maxStepAttempts debe ser un entero >= 1 si se especifica.' });
  }

  const steps = input['steps'];
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push({ field: 'steps', reason: 'steps debe tener al menos un elemento.' });
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
        errors.push({ field: `${prefix}.id`, reason: `id de step duplicado ('${step['id']}') -- cada step necesita un id unico para checkpoints reales.` });
      } else {
        seenIds.add(step['id']);
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
      if (typeof kind !== 'string' || !stepActionKinds.includes(kind as StepAction['kind'])) {
        errors.push({ field: `${prefix}.action.kind`, reason: `kind debe ser uno de: ${stepActionKinds.join(', ')}.` });
        return;
      }

      if (kind === 'NAVIGATE') {
        // Solo se valida que la URL sea absoluta y bien formada aqui. El
        // chequeo de "esta URL concreta esta permitida por la allowlist"
        // es DELIBERADAMENTE una unica responsabilidad de runtime
        // (`worker.ts#assertDomainAllowed`, justo antes de llamar al driver
        // real) -- es el punto que de verdad importa para seguridad (justo
        // antes de la accion de red), no un doble chequeo del mismo dato.
        const url = actionInput['url'];
        const host = typeof url === 'string' ? extractNavigateHost(url) : null;
        if (!nonEmptyString(url) || host === null) {
          errors.push({ field: `${prefix}.action.url`, reason: 'url invalida (debe ser una URL absoluta valida).' });
        }
        return;
      }

      if (kind === 'CLICK' || kind === 'WAIT_FOR') {
        validateSelectorField(`${prefix}.action.selector`, actionInput['selector'], errors);
        return;
      }

      if (kind === 'ASSERT_TEXT') {
        validateSelectorField(`${prefix}.action.selector`, actionInput['selector'], errors);
        if (!nonEmptyString(actionInput['expected'])) errors.push({ field: `${prefix}.action.expected`, reason: 'expected requerido, string no vacio.' });
        return;
      }

      if (kind === 'TYPE') {
        validateSelectorField(`${prefix}.action.selector`, actionInput['selector'], errors);
        const typeInput = actionInput['input'];
        if (typeof typeInput !== 'object' || typeInput === null) {
          errors.push({ field: `${prefix}.action.input`, reason: 'input requerido (LITERAL o SECRET_REF).' });
          return;
        }
        const typed = typeInput as Record<string, unknown>;
        if (typed['kind'] === 'LITERAL') {
          const value = typed['value'];
          if (!nonEmptyString(value)) {
            errors.push({ field: `${prefix}.action.input.value`, reason: 'value requerido, string no vacio.' });
          } else if (looksLikeRawSecret(value)) {
            errors.push({ field: `${prefix}.action.input.value`, reason: 'value parece una credencial real, no un literal de formulario -- regla fija del proyecto ("nunca escribir contraseñas o credenciales en formularios"). Usa input.kind = "SECRET_REF".' });
          }
        } else if (typed['kind'] === 'SECRET_REF') {
          if (!nonEmptyString(typed['ref'])) errors.push({ field: `${prefix}.action.input.ref`, reason: 'ref requerido, string no vacio.' });
        } else {
          errors.push({ field: `${prefix}.action.input.kind`, reason: 'input.kind debe ser LITERAL o SECRET_REF.' });
        }
      }
    });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    scenario: {
      id: input['id'] as string,
      allowedDomains: allowedDomains as readonly string[],
      steps: steps as readonly ScenarioStep[],
      defaultTimeoutMs: defaultTimeoutMs as number,
      ...(maxStepAttempts !== undefined ? { maxStepAttempts: maxStepAttempts as number } : {}),
    },
  };
};
