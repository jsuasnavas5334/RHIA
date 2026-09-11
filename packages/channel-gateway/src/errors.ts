import type { ChannelError, ChannelErrorCode } from "./contracts.js";

const RETRYABLE_CODES: ReadonlySet<ChannelErrorCode> = new Set([
  "RHIA_CHANNEL_RATE_LIMITED",
  "RHIA_CHANNEL_TIMEOUT",
  "RHIA_CHANNEL_PROVIDER_UNAVAILABLE",
]);

export function isRetryableCode(code: ChannelErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

export interface CreateChannelErrorInput {
  readonly code: ChannelErrorCode;
  readonly message: string;
  readonly safeDetails?: string;
  readonly provider?: string;
  readonly originalCode?: string;
}

export function createChannelError(input: CreateChannelErrorInput): ChannelError {
  const cause =
    input.provider !== undefined
      ? { provider: input.provider, originalCode: input.originalCode ?? "UNKNOWN" }
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
 * Normaliza cualquier excepcion no controlada de un adapter a un
 * ChannelError seguro. Nunca vuelve a lanzar y nunca incluye el objeto
 * original crudo (podria contener tokens/headers del proveedor) -- mismo
 * principio que normalizeUnexpectedError en @rhia/ai-gateway.
 */
export function normalizeUnexpectedError(provider: string, error: unknown): ChannelError {
  const message = error instanceof Error ? error.message : "Fallo no clasificado del adapter de canal.";
  return createChannelError({
    code: "RHIA_CHANNEL_UNEXPECTED_FAILURE",
    message: "El adapter de canal fallo de forma inesperada.",
    safeDetails: message.slice(0, 200),
    provider,
    originalCode: error instanceof Error ? error.name : "UNKNOWN",
  });
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError")
  );
}
