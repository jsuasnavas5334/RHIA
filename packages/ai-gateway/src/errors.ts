import type { GatewayError, GatewayErrorCode, ProviderId } from "./contracts.js";

const RETRYABLE_CODES: ReadonlySet<GatewayErrorCode> = new Set([
  "RHIA_AI_RATE_LIMITED",
  "RHIA_AI_TIMEOUT",
  "RHIA_AI_PROVIDER_UNAVAILABLE",
]);

export function isRetryableCode(code: GatewayErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

export interface CreateGatewayErrorInput {
  readonly code: GatewayErrorCode;
  readonly message: string;
  readonly safeDetails?: string;
  readonly providerId?: ProviderId;
  readonly originalCode?: string;
}

export function createGatewayError(input: CreateGatewayErrorInput): GatewayError {
  const cause =
    input.providerId !== undefined
      ? { providerId: input.providerId, originalCode: input.originalCode ?? "UNKNOWN" }
      : null;
  return {
    code: input.code,
    message: input.message,
    retryable: isRetryableCode(input.code),
    safeDetails: input.safeDetails ?? input.message,
    cause,
  };
}

/**
 * Normaliza cualquier excepcion no controlada (bug de adapter, error de red
 * no clasificado, etc.) a un GatewayError seguro. Nunca vuelve a lanzar y
 * nunca incluye el objeto original crudo (podria contener headers/keys).
 */
export function normalizeUnexpectedError(providerId: ProviderId, error: unknown): GatewayError {
  const message = error instanceof Error ? error.message : "Fallo no clasificado del adapter.";
  return createGatewayError({
    code: "RHIA_AI_UNEXPECTED_FAILURE",
    message: "El adapter fallo de forma inesperada.",
    safeDetails: message.slice(0, 200),
    providerId,
    originalCode: error instanceof Error ? error.name : "UNKNOWN",
  });
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError")
  );
}
