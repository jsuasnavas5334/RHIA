// PH06-T005, acción 2 ("TTL por claim/source").

import type { CachePolicy } from './schema.js';

export type TtlResolutionInput = Readonly<{
  claimType: string;
  /** `EvidenceSource.sourceType` de @rhia/evidence-pipeline. Ausente = sin override de fuente (solo default/claim). */
  sourceType?: string;
}>;

/**
 * Resuelve el TTL aplicable: si hay override por `claimType` y/o por
 * `sourceType`, se usa el MÁS CORTO de los que apliquen (más conservador)
 * — nunca el más largo, y nunca combinado de vuelta con el default general.
 * Dar precedencia silenciosa a un TTL más permisivo sería una forma sutil
 * del error a evitar "cache eterno": preferimos revalidar de más antes que
 * confiar en datos potencialmente caducos por haber combinado mal dos
 * overrides. El default de la política solo se usa cuando NINGÚN override
 * aplica — no participa en el `Math.min` junto a un override activo (un
 * override explícito para el claim/source siempre reemplaza al default,
 * no compite con él).
 */
export const resolveTtlDays = (input: TtlResolutionInput, policy: CachePolicy): number => {
  const candidates: number[] = [];

  const claimOverride = policy.claimTypeTtlDays?.[input.claimType];
  if (claimOverride !== undefined) candidates.push(claimOverride);

  const sourceOverride = input.sourceType !== undefined ? policy.sourceTypeTtlDays?.[input.sourceType] : undefined;
  if (sourceOverride !== undefined) candidates.push(sourceOverride);

  if (candidates.length === 0) return policy.defaultTtlDays;
  return Math.min(...candidates);
};
