// Secrets & Redaction (PH10-T001) -- "Centralizar secret refs" (accion 1) y
// "Rotation runbook" (accion 4, ver docs/security/secrets-rotation-runbook.md
// para el procedimiento humano; este archivo solo modela CUANDO una
// rotacion esta vencida, nunca ejecuta la rotacion real).
//
// Decision de diseno explicita: `SecretReference` reusa el MISMO heuristico
// `looksLikeRawSecret` de `@rhia/tool-registry` (PH09-T001) en vez de
// reimplementarlo -- ya es el heuristico real y probado del proyecto para
// distinguir una referencia/nombre corto de un secreto real pegado por
// accidente (criterio "No secret en repo/log" del packet). Este paquete
// NUNCA guarda ni transporta el valor real de un secreto: `ref` es siempre
// un nombre/id de vault (ej. `"vault:crm:api-key"`), igual que
// `credentialRef` en `ToolManifest`.

import { looksLikeRawSecret } from '@rhia/tool-registry';

export type SecretReference = Readonly<{
  /** Nombre humano/logico del secreto (ej. "outreach-provider-api-key"). */
  name: string;
  /** Referencia a donde vive el valor real (vault/env/etc.) -- NUNCA el valor. */
  ref: string;
  rotationIntervalDays: number;
  /** ISO date de la ultima rotacion real, o `null` si nunca se ha rotado. */
  lastRotatedAt: string | null;
}>;

export type SecretReferenceValidationError = Readonly<{ field: string; reason: string }>;
export type SecretReferenceValidationResult =
  | Readonly<{ valid: true; reference: SecretReference }>
  | Readonly<{ valid: false; errors: readonly SecretReferenceValidationError[] }>;

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isValidIsoDate = (value: string): boolean => !Number.isNaN(new Date(value).getTime());

export const validateSecretReference = (raw: unknown): SecretReferenceValidationResult => {
  const errors: SecretReferenceValidationError[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: [{ field: 'root', reason: 'La referencia debe ser un objeto.' }] };
  }
  const input = raw as Record<string, unknown>;

  if (!nonEmptyString(input['name'])) errors.push({ field: 'name', reason: 'name requerido, string no vacio.' });

  const ref = input['ref'];
  if (!nonEmptyString(ref)) {
    errors.push({ field: 'ref', reason: 'ref requerido, string no vacio.' });
  } else if (looksLikeRawSecret(ref)) {
    errors.push({
      field: 'ref',
      reason:
        'ref parece un secreto real, no una referencia -- error a evitar "No secret en repo/log". Usa un nombre/id de vault, nunca el valor real (mismo heuristico de @rhia/tool-registry#looksLikeRawSecret).',
    });
  }

  const rotationIntervalDays = input['rotationIntervalDays'];
  if (typeof rotationIntervalDays !== 'number' || !Number.isFinite(rotationIntervalDays) || rotationIntervalDays <= 0) {
    errors.push({ field: 'rotationIntervalDays', reason: 'rotationIntervalDays debe ser un numero mayor a 0.' });
  }

  const lastRotatedAt = input['lastRotatedAt'];
  if (lastRotatedAt !== null && lastRotatedAt !== undefined) {
    if (typeof lastRotatedAt !== 'string' || !isValidIsoDate(lastRotatedAt)) {
      errors.push({ field: 'lastRotatedAt', reason: 'lastRotatedAt debe ser null o una fecha ISO valida.' });
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    reference: {
      name: input['name'] as string,
      ref: ref as string,
      rotationIntervalDays: rotationIntervalDays as number,
      lastRotatedAt: (lastRotatedAt as string | null | undefined) ?? null,
    },
  };
};

/**
 * Criterio de aceptacion "Rotation posible": una referencia sin rotacion
 * previa (`lastRotatedAt: null`) SIEMPRE se considera vencida -- nunca hay
 * un secreto que "nunca" necesite rotar. El runbook humano
 * (`docs/security/secrets-rotation-runbook.md`) usa esta funcion para
 * decidir que filas de `secrets.rotate` (permission real de `@rhia/policy`)
 * requieren accion, nunca ejecuta la rotacion por si sola.
 */
export const isRotationDue = (reference: SecretReference, now: Date = new Date()): boolean => {
  if (reference.lastRotatedAt === null) return true;
  const last = new Date(reference.lastRotatedAt).getTime();
  const dueAtMs = last + reference.rotationIntervalDays * 24 * 60 * 60 * 1000;
  return now.getTime() >= dueAtMs;
};
