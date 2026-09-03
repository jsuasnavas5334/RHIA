// PH06-T003 — contratos locales del Evidence Pipeline. Se definen aquí (no
// en @rhia/contracts) porque, como en la decisión de ubicación de
// PH05-T002/PH06-T002, el Task Packet solo señala "evidence service" como
// área afectada, sin workspace compartido previo; si un futuro packet de
// scoring/CRM (PH07) necesita consumir estos tipos, se promueven a
// @rhia/contracts entonces, no antes.
//
// Los campos reflejan 1:1 las tablas reales `evidence_source`, `evidence` y
// `fact` de packages/db/src/schema.ts (misma tarea PH03-T001 ya cerrada) —
// este paquete no crea un modelo de datos nuevo, produce objetos listos
// para persistir en esas tablas. `sourceReliability`/`confidence` son
// `numeric(5,4)` en la BD (0..1 con 4 decimales); aquí se validan como
// `number` en [0,1] y es responsabilidad del adapter de persistencia (fuera
// de este packet) convertir a string decimal si el driver lo requiere.

import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '@rhia/contracts';

export const EvidenceSourceSchema = z
  .object({
    id: UuidSchema,
    organizationId: UuidSchema,
    sourceType: z.enum(['OFFICIAL_WEBSITE', 'NEWS', 'DIRECTORY', 'SOCIAL', 'GOVERNMENT', 'UNKNOWN']),
    domain: z.string().min(1).max(255).optional(),
    url: z.string().url(),
    fetchedAt: TimestampSchema,
    provider: z.string().min(1).max(80),
    sourceReliability: z.number().min(0).max(1),
  })
  .strict();
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

// Estado del registro de evidencia. ACTIVE: participa en el collapse a
// fact. STALE: excedió `staleAfterDays` (ver fact-collapse.ts) — se
// conserva (nunca se borra evidencia), pero fact-collapse la excluye de
// convertirse en soporte de un fact nuevo salvo que sea la única disponible
// (ver acción "no promover inferencia a fact sin support").
export const EvidenceStatusSchema = z.enum(['ACTIVE', 'STALE']);

export const EvidenceSchema = z
  .object({
    id: UuidSchema,
    organizationId: UuidSchema,
    subjectType: z.string().min(1).max(80),
    subjectId: UuidSchema,
    sourceId: UuidSchema,
    claimType: z.string().min(1).max(80),
    // Nunca el texto crudo del excerpt (acción "evitar guardar texto entero
    // sin necesidad") — solo su huella para poder detectar duplicados
    // exactos y auditar sin retener el contenido.
    excerptHash: z.string().regex(/^[0-9a-f]{64}$/),
    observedValue: z.unknown(),
    confidence: z.number().min(0).max(1),
    freshnessAt: TimestampSchema,
    status: EvidenceStatusSchema,
  })
  .strict();
export type Evidence = z.infer<typeof EvidenceSchema>;

export const FactSchema = z
  .object({
    id: UuidSchema,
    organizationId: UuidSchema,
    subjectType: z.string().min(1).max(80),
    subjectId: UuidSchema,
    predicate: z.string().min(1).max(80),
    value: z.unknown(),
    confidence: z.number().min(0).max(1),
    validFrom: TimestampSchema.optional(),
    validTo: TimestampSchema.optional(),
    supportingEvidenceIds: z.array(UuidSchema).min(1),
  })
  .strict();
export type Fact = z.infer<typeof FactSchema>;
