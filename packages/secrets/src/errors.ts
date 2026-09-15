// Secrets & Redaction (PH10-T001) -- errores normalizados. Mismo patron
// estructural que `@rhia/skill-library` (createSkillError) y todos los
// hermanos de PH09: un codigo cerrado + mensaje + `safeDetails` (nunca
// incluye el valor sensible real -- ver `redaction.ts`, que es justamente
// la razon de existir de este paquete).

export const secretsErrorCodes = [
  'RHIA_SECRETS_INVALID_REFERENCE',
  'RHIA_SECRETS_INVALID_KEY_LENGTH',
  'RHIA_SECRETS_EMPTY_VALUE',
  'RHIA_SECRETS_DECRYPTION_FAILED',
] as const;
export type SecretsErrorCode = (typeof secretsErrorCodes)[number];

export interface SecretsError {
  readonly code: SecretsErrorCode;
  readonly message: string;
  /** Seguro para logs/UI -- nunca debe contener el secreto, la clave o el valor en claro. */
  readonly safeDetails: string;
}

export function createSecretsError(code: SecretsErrorCode, message: string, safeDetails?: string): SecretsError {
  return { code, message, safeDetails: safeDetails ?? message };
}
