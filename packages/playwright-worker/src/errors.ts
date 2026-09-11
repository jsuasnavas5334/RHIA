// Playwright Worker (PH09-T002) -- errores normalizados del worker. Mismo
// patron estructural que `ChannelError`/`createChannelError` de
// `@rhia/channel-gateway` (PH08-T001): un adapter/driver NUNCA propaga su
// excepcion cruda hacia el caller final, siempre se normaliza a un objeto
// seguro para logs.
//
// `RHIA_WORKFLOW_TIMEOUT` reusa LITERALMENTE el valor real ya catalogado en
// `@rhia/domain#errorCodes` ("El workflow excedió su tiempo permitido") --
// un step de browser que excede su timeout es, conceptualmente, ese mismo
// caso real, mismo patron ya usado por `tool-registry/authorization.ts` con
// `RHIA_TOOL_FORBIDDEN`. Los demas codigos son especificos de este paquete
// (sin contraparte real hoy en el catalogo compartido).

export const browserErrorCodes = [
  'RHIA_BROWSER_INVALID_SCENARIO',
  'RHIA_BROWSER_DOMAIN_FORBIDDEN',
  'RHIA_BROWSER_SELECTOR_NOT_FOUND',
  'RHIA_WORKFLOW_TIMEOUT',
  'RHIA_BROWSER_SESSION_EXPIRED',
  'RHIA_BROWSER_SECRET_UNAVAILABLE',
  'RHIA_BROWSER_ASSERTION_FAILED',
  'RHIA_BROWSER_UNEXPECTED_FAILURE',
] as const;
export type BrowserErrorCode = (typeof browserErrorCodes)[number];

const RETRYABLE_CODES: ReadonlySet<BrowserErrorCode> = new Set(['RHIA_WORKFLOW_TIMEOUT']);

export const isRetryableBrowserCode = (code: BrowserErrorCode): boolean => RETRYABLE_CODES.has(code);

export interface BrowserErrorCause {
  readonly originalName: string;
}

export interface BrowserError {
  readonly code: BrowserErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  /** Texto seguro para logs/evidencia -- NUNCA incluye valores tipeados/credenciales, ver `redact.ts`/worker.ts. */
  readonly safeDetails: string;
  readonly cause: BrowserErrorCause | null;
}

export interface CreateBrowserErrorInput {
  readonly code: BrowserErrorCode;
  readonly message: string;
  readonly safeDetails?: string;
  readonly originalName?: string;
}

export function createBrowserError(input: CreateBrowserErrorInput): BrowserError {
  return {
    code: input.code,
    message: input.message,
    retryable: isRetryableBrowserCode(input.code),
    safeDetails: input.safeDetails ?? input.message,
    cause: input.originalName !== undefined ? { originalName: input.originalName } : null,
  };
}

/**
 * Envoltorio real de un `BrowserError` ya clasificado, para lanzarlo dentro
 * de `worker.ts` (p.ej. desde `assertDomainAllowed`/`resolveTypeValue`)
 * SIN que `classifyStepError` lo vuelva a re-clasificar como un fallo
 * generico. Usar una CLASE propia (no un objeto plano ni un chequeo
 * heuristico de "tiene un campo `code`") es deliberado: un `DOMException`
 * real (p.ej. el `AbortError` de un timeout) TAMBIEN trae un campo `.code`
 * nativo (el codigo legado DOM4, `20` para `AbortError`) -- un chequeo
 * heuristico por presencia de `.code` clasificaria mal ese caso real (bug
 * encontrado y corregido con evidencia real en este mismo ciclo, ver
 * docs/progress/PH09-T002.md).
 */
export class ClassifiedBrowserError extends Error {
  constructor(readonly browserError: BrowserError) {
    super(browserError.message);
    this.name = 'ClassifiedBrowserError';
  }
}

/** Un step de la libreria del driver que se cae por selector inexistente -- Prueba requerida "UI changed". */
export class BrowserSelectorNotFoundError extends Error {
  constructor(message = 'Ninguna estrategia del selector encontro un elemento real.') {
    super(message);
    this.name = 'BrowserSelectorNotFoundError';
  }
}

/** Prueba requerida "Login expired": la sesion del sitio destino ya no esta autenticada. */
export class BrowserSessionExpiredError extends Error {
  constructor(message = 'La sesion del sitio destino expiro o no esta autenticada.') {
    super(message);
    this.name = 'BrowserSessionExpiredError';
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
  );
}

/**
 * Clasifica cualquier excepcion real del driver (nunca la propaga cruda) --
 * mismo principio que `normalizeUnexpectedError` de `@rhia/channel-gateway`:
 * el mensaje se trunca (200 caracteres) y jamas se interpola un valor
 * tipeado/credencial real (ese valor nunca llega a esta funcion -- ver
 * `worker.ts`, que nunca pasa el input real de un TYPE a un mensaje de
 * error).
 */
export function classifyStepError(error: unknown): BrowserError {
  if (isAbortError(error)) {
    return createBrowserError({ code: 'RHIA_WORKFLOW_TIMEOUT', message: 'El step excedio su tiempo permitido.', originalName: 'AbortError' });
  }
  if (error instanceof BrowserSelectorNotFoundError) {
    return createBrowserError({ code: 'RHIA_BROWSER_SELECTOR_NOT_FOUND', message: error.message, originalName: error.name });
  }
  if (error instanceof BrowserSessionExpiredError) {
    return createBrowserError({ code: 'RHIA_BROWSER_SESSION_EXPIRED', message: error.message, originalName: error.name });
  }
  const message = error instanceof Error ? error.message : 'Fallo no clasificado del driver de browser.';
  return createBrowserError({
    code: 'RHIA_BROWSER_UNEXPECTED_FAILURE',
    message: 'El driver de browser fallo de forma inesperada.',
    safeDetails: message.slice(0, 200),
    originalName: error instanceof Error ? error.name : 'UNKNOWN',
  });
}
