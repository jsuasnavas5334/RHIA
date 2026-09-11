// Computer Use Adapter (PH09-T003) -- errores normalizados. Mismo patron
// estructural que `@rhia/playwright-worker/errors.ts` (a su vez modelado en
// `@rhia/channel-gateway`): nunca se propaga una excepcion cruda del driver.

export const computerUseErrorCodes = [
  'RHIA_COMPUTER_USE_INVALID_TASK',
  'RHIA_COMPUTER_USE_DOMAIN_FORBIDDEN',
  'RHIA_WORKFLOW_TIMEOUT',
  'RHIA_COMPUTER_USE_APPROVAL_REQUIRED',
  'RHIA_COMPUTER_USE_UNEXPECTED_FAILURE',
] as const;
export type ComputerUseErrorCode = (typeof computerUseErrorCodes)[number];

const RETRYABLE_CODES: ReadonlySet<ComputerUseErrorCode> = new Set(['RHIA_WORKFLOW_TIMEOUT']);
export const isRetryableComputerUseCode = (code: ComputerUseErrorCode): boolean => RETRYABLE_CODES.has(code);

export interface ComputerUseError {
  readonly code: ComputerUseErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly safeDetails: string;
}

export interface CreateComputerUseErrorInput {
  readonly code: ComputerUseErrorCode;
  readonly message: string;
  readonly safeDetails?: string;
}

export function createComputerUseError(input: CreateComputerUseErrorInput): ComputerUseError {
  return {
    code: input.code,
    message: input.message,
    retryable: isRetryableComputerUseCode(input.code),
    safeDetails: input.safeDetails ?? input.message,
  };
}

/** Envoltorio real de un `ComputerUseError` ya clasificado -- mismo diseño y misma razon de ser que `ClassifiedBrowserError` de `@rhia/playwright-worker` (un `DOMException` de timeout trae un `.code` nativo que un chequeo heuristico confundiria). */
export class ClassifiedComputerUseError extends Error {
  constructor(readonly computerUseError: ComputerUseError) {
    super(computerUseError.message);
    this.name = 'ClassifiedComputerUseError';
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
  );
}

export function classifyStepError(error: unknown): ComputerUseError {
  if (isAbortError(error)) {
    return createComputerUseError({ code: 'RHIA_WORKFLOW_TIMEOUT', message: 'El step excedio su tiempo permitido.' });
  }
  const message = error instanceof Error ? error.message : 'Fallo no clasificado del driver de computer use.';
  return createComputerUseError({
    code: 'RHIA_COMPUTER_USE_UNEXPECTED_FAILURE',
    message: 'El driver de computer use fallo de forma inesperada.',
    safeDetails: message.slice(0, 200),
  });
}
