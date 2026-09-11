// PH07-T002 — contratos locales de Contact Discovery. Se definen aqui (no en
// @rhia/contracts) por la misma decision de ubicacion que
// PH05-T002/PH06-T002/T003/T004: el Task Packet solo senala "contact
// discovery" como area afectada, sin workspace previo. `ContactCandidate`
// deliberadamente NO reutiliza `ContactSchema` de `apps/core-api/src/
// contracts.ts` (ese contrato exige `id`/`organizationId`/`status` ya
// persistidos) -- este paquete produce candidatos LISTOS para convertirse en
// `CreateContactSchema`, no filas ya guardadas (mismo patron que
// evidence-pipeline con `evidence_source`/`evidence`/`fact`: objetos listos
// para persistir, no acoplados al adapter de escritura).

import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '@rhia/contracts';

// Areas objetivo explicitamente nombradas en el criterio de aceptacion del
// packet ("Puede priorizar RRHH, gerencia, operaciones u otras areas segun
// caso"). `OTRA` cubre cualquier area real (finanzas, TI, legal...) que el
// caso de uso mencione sin necesidad de enumerar cada una por separado --
// evita el error "lista rigida global de cargos" a nivel de intencion: el
// conjunto de AREAS es una taxonomia chica y estable (igual que
// `EvidenceSource.sourceType`), pero los CARGOS concretos que se buscan
// dentro de cada area se derivan dinamicamente en role-derivation.ts, nunca
// desde una lista fija global.
export const RoleAreaSchema = z.enum(['RRHH', 'GERENCIA', 'OPERACIONES', 'FINANZAS', 'TI', 'LEGAL', 'OTRA']);
export type RoleArea = z.infer<typeof RoleAreaSchema>;

// Entrada dinamica: describe la solucion/caso de uso en texto libre (nunca
// un enum fijo de "tipo de producto"). `signals` opcional permite reforzar
// con palabras clave ya conocidas (p. ej. extraidas de un futuro catalogo de
// producto) sin depender de que ese catalogo exista todavia -- ver "Fuera de
// alcance" en docs/progress/PH07-T002.md.
export const UseCaseContextSchema = z
  .object({
    description: z.string().trim().min(3).max(2000),
    signals: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  })
  .strict();
export type UseCaseContext = z.infer<typeof UseCaseContextSchema>;

// Salida de la accion 1 ("Derivar personas objetivo por use case"): una
// prioridad por area, nunca una unica area fija, y las palabras clave de
// cargo que motivaron esa prioridad (trazabilidad -- por que se priorizo
// esta area para este caso, no una afirmacion sin soporte).
export const RoleArchetypeSchema = z
  .object({
    area: RoleAreaSchema,
    priority: z.number().min(0).max(1),
    titleKeywords: z.array(z.string().min(1).max(80)).min(1),
    matchedContextTerms: z.array(z.string().min(1).max(80)),
  })
  .strict();
export type RoleArchetype = z.infer<typeof RoleArchetypeSchema>;

// Resultado crudo de busqueda (mismo shape que
// `SearchResponseSchema.results[number]` de @rhia/contracts, igual que
// `SearchResultLike` en evidence-pipeline) -- este paquete no ejecuta la
// busqueda real, la recibe ya resuelta por el llamador (mismo patron que
// PH06-T003/T004: no hay dispatch de red real dentro de un paquete puro).
export const CandidateSearchHitSchema = z
  .object({
    url: z.string().url(),
    title: z.string().min(1).max(500),
    snippet: z.string().max(2000),
    provider: z.string().min(1).max(80),
  })
  .strict();
export type CandidateSearchHit = z.infer<typeof CandidateSearchHitSchema>;

export const TitleStatusSchema = z.enum(['CURRENT', 'STALE', 'UNKNOWN']);
export type TitleStatus = z.infer<typeof TitleStatusSchema>;

// Salida final (acciones 3+4+5: resolver identidad, vincular company/
// entity, guardar provenance). `companyGroupId` es OBLIGATORIO (no
// `.optional()`/`.nullable()`) -- es la garantia a nivel de schema del
// criterio de aceptacion "No crea contacto sin company linkage": es
// imposible construir un `ContactCandidateSchema` valido sin un
// `companyGroupId` ya resuelto por el llamador (mismo patron que
// `FactSchema.supportingEvidenceIds.min(1)` en evidence-pipeline: la regla
// de negocio vive en el tipo, no solo en un `if` que se puede olvidar).
export const ContactCandidateSchema = z
  .object({
    id: UuidSchema,
    organizationId: UuidSchema,
    companyGroupId: UuidSchema,
    companyEntityId: UuidSchema.nullable(),
    fullNameGuess: z.string().min(1).max(240).nullable(),
    titleGuess: z.string().min(1).max(240).nullable(),
    roleArea: RoleAreaSchema,
    // Prioridad final del candidato (combina la prioridad del area para
    // este caso de uso con la confianza de identidad y el estado del
    // titulo) -- ver contact-discovery.ts. Ordena la lista, nunca decide
    // por si sola crear o no el contacto.
    priority: z.number().min(0).max(1),
    identityConfidence: z.number().min(0).max(1),
    titleStatus: TitleStatusSchema,
    sourceUrl: z.string().url(),
    // Trazabilidad (accion 5, "Guardar provenance"): IDs de `Evidence` reales
    // (mismo tipo que evidence-pipeline) que sostienen este candidato. Puede
    // ir vacio SOLO si no se extrajo ningun claim del hit (igual que
    // `BuildEvidenceOutput.evidence` en evidence-pipeline puede ser []) --
    // pero entonces `identityConfidence` cae a 0 y `titleStatus` es
    // `UNKNOWN` (ver contact-discovery.ts), nunca se inventa evidencia.
    supportingEvidenceIds: z.array(UuidSchema),
  })
  .strict();
export type ContactCandidate = z.infer<typeof ContactCandidateSchema>;

export const ContactDiscoveryResultSchema = z
  .object({
    organizationId: UuidSchema,
    companyGroupId: UuidSchema,
    roles: z.array(RoleArchetypeSchema),
    candidates: z.array(ContactCandidateSchema),
    generatedAt: TimestampSchema,
  })
  .strict();
export type ContactDiscoveryResult = z.infer<typeof ContactDiscoveryResultSchema>;
