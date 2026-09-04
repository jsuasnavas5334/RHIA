// PH06-T004 — contratos locales del Entity Resolver. Igual que la decisión
// de ubicación de PH05-T002/PH06-T002/PH06-T003, se definen aquí (no en
// @rhia/contracts) porque el Task Packet solo señala "entity resolution"
// como área afectada, sin workspace compartido previo; si CRM (PH07)
// necesita consumir estos tipos, se promueven entonces, no antes.
//
// Este paquete NO decide persistencia — no lee ni escribe
// `company_group`/`company_entity`/`company_location`/`company_alias`
// (packages/db/src/schema.ts, PH03-T001 ya cerrada). Recibe señales ya
// extraídas (típicamente derivadas de `Fact`/`Evidence` de
// @rhia/evidence-pipeline, aunque este paquete no depende de ese formato
// exacto para no acoplarse a sus claim types todavía) y candidatos
// existentes ya cargados por el llamador (p. ej. desde una consulta a
// `company_group` filtrada por organización), y devuelve una DECISIÓN de
// resolución con confidence y conflictos explícitos, lista para que un
// adapter de integración (fuera de este packet) la persista o la escale a
// revisión humana.

import { z } from 'zod';
import { UuidSchema } from '@rhia/contracts';

const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
const Confidence01Schema = z.number().min(0).max(1);

// ---------------------------------------------------------------------------
// Señales de entrada (acción 1-4 del packet). Cada señal es trazable a su
// propio confidence, para que "calcular confidence" (acción 5) no dependa
// de una única fuente y "escalar ambigüedad" (acción 6) tenga con qué
// razonar cuando las señales no coinciden entre sí.
// ---------------------------------------------------------------------------

export const NameSignalSchema = z
  .object({
    name: z.string().min(1).max(255),
    kind: z.enum(['LEGAL', 'TRADE', 'ALIAS']),
    confidence: Confidence01Schema,
  })
  .strict();
export type NameSignal = z.infer<typeof NameSignalSchema>;

export const LegalIdentifierSignalSchema = z
  .object({
    identifier: z.string().min(1).max(80),
    countryCode: CountryCodeSchema,
    confidence: Confidence01Schema,
  })
  .strict();
export type LegalIdentifierSignal = z.infer<typeof LegalIdentifierSignalSchema>;

export const LocationSignalSchema = z
  .object({
    city: z.string().min(1).max(160),
    // Puede faltar (p. ej. un snippet solo menciona la ciudad) — resolveLocation
    // debe tratar la ausencia como señal débil, nunca inventar un país.
    countryCode: CountryCodeSchema.optional(),
    administrativeArea: z.string().min(1).max(160).optional(),
    confidence: Confidence01Schema,
  })
  .strict();
export type LocationSignal = z.infer<typeof LocationSignalSchema>;

export const OwnershipSignalSchema = z
  .object({
    // Nombre del grupo/matriz mencionado por la señal (p. ej. "a subsidiary of Acme Holding").
    counterpartName: z.string().min(1).max(255),
    relation: z.enum(['SUBSIDIARY_OF', 'OPERATOR_OF', 'PARENT_OF']),
    confidence: Confidence01Schema,
  })
  .strict();
export type OwnershipSignal = z.infer<typeof OwnershipSignalSchema>;

// ---------------------------------------------------------------------------
// Candidatos existentes (ya resueltos, cargados por el llamador desde
// `company_group`/`company_entity`/`company_alias` filtrados por
// `organizationId`). El resolver compara contra estos para decidir si el
// candidato de entrada es el MISMO grupo/entidad o uno nuevo — nunca decide
// eso solo con similitud de string (error a evitar del packet).
// ---------------------------------------------------------------------------

export const KnownEntitySchema = z
  .object({
    companyGroupId: UuidSchema,
    companyEntityId: UuidSchema.optional(),
    canonicalName: z.string().min(1).max(255),
    legalIdentifiers: z.array(z.string().min(1).max(80)).default([]),
    aliases: z.array(z.string().min(1).max(255)).default([]),
    countryCode: CountryCodeSchema.optional(),
    city: z.string().min(1).max(160).optional(),
  })
  .strict();
export type KnownEntity = z.infer<typeof KnownEntitySchema>;

// ---------------------------------------------------------------------------
// Entrada / salida del resolver.
// ---------------------------------------------------------------------------

export const EntityResolutionInputSchema = z
  .object({
    organizationId: UuidSchema,
    names: z.array(NameSignalSchema).min(1),
    legalIdentifiers: z.array(LegalIdentifierSignalSchema).default([]),
    locations: z.array(LocationSignalSchema).default([]),
    ownership: z.array(OwnershipSignalSchema).default([]),
    knownEntities: z.array(KnownEntitySchema).default([]),
  })
  .strict();
export type EntityResolutionInput = z.infer<typeof EntityResolutionInputSchema>;

export const LocationResolutionStatusSchema = z.enum(['RESOLVED', 'AMBIGUOUS', 'NONE']);

export const LocationResolutionSchema = z
  .object({
    status: LocationResolutionStatusSchema,
    city: z.string().min(1).max(160).optional(),
    countryCode: CountryCodeSchema.optional(),
    administrativeArea: z.string().min(1).max(160).optional(),
    confidence: Confidence01Schema,
    // Motivo explícito cuando status !== RESOLVED (p. ej. "ciudad ambigua sin señal de país").
    reason: z.string().max(400).optional(),
  })
  .strict();
export type LocationResolution = z.infer<typeof LocationResolutionSchema>;

export const RelationshipResolutionSchema = z
  .object({
    relation: z.enum(['SUBSIDIARY_OF', 'OPERATOR_OF', 'PARENT_OF']),
    counterpartName: z.string().min(1).max(255),
    matchedGroupId: UuidSchema.optional(),
    confidence: Confidence01Schema,
  })
  .strict();
export type RelationshipResolution = z.infer<typeof RelationshipResolutionSchema>;

export const EntityResolutionStatusSchema = z.enum(['RESOLVED', 'NEEDS_REVIEW']);

export const EntityResolutionResultSchema = z
  .object({
    status: EntityResolutionStatusSchema,
    resolvedName: z.string().min(1).max(255),
    // Grupo existente al que se ligó el candidato, si alguno. Ausente cuando
    // isNewGroup = true (candidato no matchea ningún KnownEntity dado).
    matchedGroupId: UuidSchema.optional(),
    isNewGroup: z.boolean(),
    location: LocationResolutionSchema,
    relationship: RelationshipResolutionSchema.optional(),
    confidence: Confidence01Schema,
    // Conflictos explícitos (nunca silenciados) que motivaron NEEDS_REVIEW
    // o que simplemente quedaron registrados aunque el status sea RESOLVED
    // (p. ej. una alias secundaria que no matcheó pero no bajó la confianza
    // lo suficiente como para escalar).
    conflicts: z.array(z.string().min(1).max(400)),
  })
  .strict();
export type EntityResolutionResult = z.infer<typeof EntityResolutionResultSchema>;
