// Observability (PH11-T001) -- errores normalizados. Mismo patron
// estructural que `@rhia/secrets` (createSecretsError) y todos los
// hermanos de PH09/PH10: un codigo cerrado + mensaje + `safeDetails`
// (nunca incluye un valor sensible real -- si un caller intenta construir
// un error con datos crudos, debe pasarlos por `redactValue` primero, este
// paquete no lo hace de forma implicita para no ocultar un olvido real).

export const observabilityErrorCodes = [
  'RHIA_OBS_MISSING_TRACE_ID',
  'RHIA_OBS_INVALID_SPAN',
  'RHIA_OBS_INVALID_HEALTH_EVENT',
  'RHIA_OBS_INVALID_METRIC',
] as const;
export type ObservabilityErrorCode = (typeof observabilityErrorCodes)[number];

export interface ObservabilityError {
  readonly code: ObservabilityErrorCode;
  readonly message: string;
  /** Seguro para logs/UI -- nunca debe contener un secreto o PII en claro. */
  readonly safeDetails: string;
}

export function createObservabilityError(
  code: ObservabilityErrorCode,
  message: string,
  safeDetails?: string,
): ObservabilityError {
  return { code, message, safeDetails: safeDetails ?? message };
}
