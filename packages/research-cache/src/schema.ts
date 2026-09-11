// PH06-T005 — contratos locales del Research Cache. Se definen aquí (no en
// @rhia/contracts) por la misma razón que PH05-T002/PH06-T002/PH06-T003/
// PH06-T004: el Task Packet solo señala "cache/dedupe" como área afectada,
// sin workspace compartido previo; si un futuro packet de scoring/costos
// (PH07+) necesita consumir estos tipos, se promueven a @rhia/contracts
// entonces, no antes.
//
// Este paquete NO persiste nada — es una capa de decisión pura (mismo
// patrón que @rhia/entity-resolver): recibe evidencia ya cargada por el
// llamador (típicamente desde la tabla `evidence`, ver
// packages/evidence-pipeline/src/schema.ts) y una política de TTL, y
// devuelve una decisión auditable de si conviene reutilizar esa evidencia o
// disparar una nueva investigación. El llamador es responsable de
// persistir/loguear el resultado (acción "Record cache hit").

import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '@rhia/contracts';

// Nunca `z.number().positive()` a secas: eso admite `Infinity`, que
// equivaldría a un TTL eterno (error a evitar explícito del Task Packet:
// "Cache eterno"). `.finite()` fuerza un TTL concreto y finito siempre.
const TtlDaysSchema = z.number().positive().finite();

export const CachePolicySchema = z
  .object({
    /** TTL aplicado cuando no hay override más específico para el claim/source. */
    defaultTtlDays: TtlDaysSchema,
    /** Override por tipo de claim (p. ej. "legal_identifier" cambia poco, "employee_count" cambia seguido). */
    claimTypeTtlDays: z.record(z.string(), TtlDaysSchema).optional(),
    /** Override por tipo de fuente (`EvidenceSource.sourceType` de @rhia/evidence-pipeline, p. ej. OFFICIAL_WEBSITE vs SOCIAL). */
    sourceTypeTtlDays: z.record(z.string(), TtlDaysSchema).optional(),
  })
  .strict();
export type CachePolicy = z.infer<typeof CachePolicySchema>;

// Registro de invalidación manual (acción "Invalidation"). El llamador
// mantiene la lista (no se persiste aquí); este paquete solo la interpreta.
export const ManualInvalidationSchema = z
  .object({
    key: z.string().min(1),
    invalidatedAt: TimestampSchema,
    reason: z.string().min(1).max(500),
  })
  .strict();
export type ManualInvalidation = z.infer<typeof ManualInvalidationSchema>;

export const CacheDecisionSchema = z.enum(['CACHE_HIT', 'CACHE_MISS', 'STALE_REVALIDATE']);
export type CacheDecision = z.infer<typeof CacheDecisionSchema>;

export const CacheDecisionReasonSchema = z.enum([
  'NO_EVIDENCE',
  'FRESH_EVIDENCE_FOUND',
  'TTL_EXPIRED',
  'MANUALLY_INVALIDATED',
]);
export type CacheDecisionReason = z.infer<typeof CacheDecisionReasonSchema>;

// Resultado auditable de evaluar el cache para un (subject, claimType) —
// acción "Record cache hit": suficiente para loguear/persistir sin
// necesitar recalcular nada ni volver a mirar la evidencia cruda.
export const CacheEvaluationResultSchema = z
  .object({
    key: z.string().min(1),
    decision: CacheDecisionSchema,
    reason: CacheDecisionReasonSchema,
    evaluatedAt: TimestampSchema,
    // Ausente solo cuando la razón es NO_EVIDENCE (no hay TTL que aplicar sin evidencia previa).
    ttlDaysApplied: TtlDaysSchema.optional(),
    reusableEvidenceIds: z.array(UuidSchema),
    staleEvidenceIds: z.array(UuidSchema),
    mostRecentFreshnessAt: TimestampSchema.optional(),
  })
  .strict();
export type CacheEvaluationResult = z.infer<typeof CacheEvaluationResultSchema>;
