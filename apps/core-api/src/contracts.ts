import {
  ApprovalDecisionSchema, ApprovalRequestSchema, ContractVersionSchema, JobRequestSchema, RhiaErrorSchema, TimestampSchema, UuidSchema,
} from '@rhia/contracts';
import { z } from 'zod';

export const CompanyGroupSchema = z
  .object({
    id: UuidSchema,
    organizationId: UuidSchema,
    canonicalName: z.string().min(1).max(240),
    websiteRoot: z.string().url().nullable(),
    globalIdentityStatus: z.enum(['UNRESOLVED', 'RESOLVED', 'AMBIGUOUS']),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict();

/** PH07-T001 (wiring Entity Resolver, PH06-T004): `legalIdentifier`/`location`
 * son señales OPCIONALES de identidad que un caller con evidencia real (p. ej.
 * un futuro job de discovery, o un formulario administrativo que capture país/
 * ciudad) puede aportar para que `CompanyGroupService.create` invoque a
 * `@rhia/entity-resolver` en vez de depender solo de `websiteRoot`. Se
 * persisten en `company_entity`/`company_location` -- tablas YA EXISTENTES de
 * PH03-T001, sin crecer el esquema -- solo cuando se provee `location`
 * (`company_entity.country_code`/`company_location.city` son NOT NULL, así
 * que no hay forma real de persistir un `legalIdentifier` sin un país que lo
 * acompañe; de ahí el refine de abajo). Sin estas señales, `create` sigue
 * comportándose exactamente igual que antes (solo dedupe por `websiteRoot`). */
export const CreateCompanyGroupSchema = z
  .object({
    canonicalName: z.string().trim().min(1).max(240),
    websiteRoot: z.string().url().max(500).optional(),
    legalIdentifier: z.string().trim().min(1).max(80).optional(),
    location: z
      .object({
        countryCode: z.string().regex(/^[A-Z]{2}$/),
        city: z.string().trim().min(1).max(160),
        administrativeArea: z.string().trim().min(1).max(160).optional(),
      })
      .strict()
      .optional(),
    idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  })
  .strict()
  .refine((value) => !value.legalIdentifier || value.location !== undefined, {
    message: 'legalIdentifier requiere location (país/ciudad) -- company_entity.country_code es NOT NULL.',
    path: ['legalIdentifier'],
  });

export const CompanyGroupResponseSchema = z
  .object({
    version: ContractVersionSchema,
    data: CompanyGroupSchema,
    meta: z.object({ idempotentReplay: z.boolean() }).strict(),
  })
  .strict();

export const CompanyGroupListResponseSchema = z
  .object({
    version: ContractVersionSchema,
    data: z.array(CompanyGroupSchema),
  })
  .strict();

export const ContactSchema = z
  .object({
    id: UuidSchema,
    organizationId: UuidSchema,
    companyGroupId: UuidSchema,
    companyEntityId: UuidSchema.nullable(),
    fullName: z.string().min(1).max(240),
    title: z.string().max(240).nullable(),
    department: z.string().max(120).nullable(),
    seniority: z.string().max(80).nullable(),
    countryCode: z.string().regex(/^[A-Z]{2}$/).nullable(),
    city: z.string().max(120).nullable(),
    linkedinUrl: z.string().url().nullable(),
    status: z.enum(['UNVERIFIED', 'VERIFIED', 'CONFLICTING']),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict();

export const CreateContactSchema = z
  .object({
    companyGroupId: UuidSchema,
    companyEntityId: UuidSchema.optional(),
    fullName: z.string().trim().min(1).max(240),
    title: z.string().trim().min(1).max(240).optional(),
    department: z.string().trim().min(1).max(120).optional(),
    seniority: z.string().trim().min(1).max(80).optional(),
    countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    linkedinUrl: z.string().url().max(500).optional(),
    idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  })
  .strict();

export const OpportunitySchema = z
  .object({
    id: UuidSchema,
    organizationId: UuidSchema,
    companyGroupId: UuidSchema,
    primaryEntityId: UuidSchema.nullable(),
    marketCountry: z.string().regex(/^[A-Z]{2}$/),
    marketCity: z.string().max(120).nullable(),
    stage: z.literal('DISCOVERED'),
    score: z.literal(0),
    scoreVersion: z.literal('core-v1'),
    ownerUserId: UuidSchema.nullable(),
    nextActionAt: TimestampSchema.nullable(),
    status: z.literal('OPEN'),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict();

export const CreateOpportunitySchema = z
  .object({
    companyGroupId: UuidSchema,
    primaryEntityId: UuidSchema.optional(),
    marketCountry: z.string().regex(/^[A-Z]{2}$/),
    marketCity: z.string().trim().min(1).max(120).optional(),
    ownerUserId: UuidSchema.optional(),
    nextActionAt: TimestampSchema.optional(),
    idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  })
  .strict();

const resourceResponse = <T extends z.ZodType>(schema: T) =>
  z.object({ version: ContractVersionSchema, data: schema, meta: z.object({ idempotentReplay: z.boolean() }).strict() }).strict();
const resourceListResponse = <T extends z.ZodType>(schema: T) =>
  z.object({ version: ContractVersionSchema, data: z.array(schema) }).strict();

export const SessionContextResponseSchema = z.object({
  version: ContractVersionSchema,
  data: z.object({ roles: z.array(z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'])).min(1) }).strict(),
}).strict();

export const TimelineEventSchema = z
  .object({
    id: UuidSchema,
    action: z.enum([
      'COMPANY_GROUP_CREATED', 'CONTACT_CREATED', 'CONTACT_POINT_CREATED', 'OPPORTUNITY_CREATED', 'JOB_CREATED', 'JOB_RETRY_SCHEDULED',
      'JOB_CANCELLED', 'APPROVAL_REQUESTED', 'APPROVAL_DECIDED',
    ]),
    resourceType: z.enum(['COMPANY_GROUP', 'CONTACT', 'CONTACT_POINT', 'OPPORTUNITY', 'JOB', 'APPROVAL']),
    resourceId: UuidSchema,
    occurredAt: TimestampSchema,
  })
  .strict();

export const CompanyDetailSchema = z
  .object({
    company: CompanyGroupSchema,
    contacts: z.array(ContactSchema),
    opportunities: z.array(OpportunitySchema),
    timeline: z.array(TimelineEventSchema),
  })
  .strict();

export const CompanyDetailResponseSchema = z
  .object({
    version: ContractVersionSchema,
    data: CompanyDetailSchema,
  })
  .strict();

export const ContactResponseSchema = resourceResponse(ContactSchema);
export const ContactListResponseSchema = resourceListResponse(ContactSchema);

/** PH07-T003 (Contact Validation v1). `pointType` es una lista chica y
 * estable (no crece con cada nuevo canal, distinto de una "lista rigida de
 * cargos" -- aqui SI tiene sentido un enum cerrado porque el formato de
 * validacion cambia por tipo de canal, no por dominio de negocio). */
export const ContactPointTypeSchema = z.enum(['EMAIL', 'PHONE', 'WHATSAPP']);

/** `UNVERIFIED`: formato ya normalizado/validado pero sin confirmar contra
 * un provider real (accion 4 del packet, "usar validators/provider cuando
 * se configure" -- ver "Fuera de alcance" en docs/progress/PH07-T003.md).
 * `INVALID`: fallo la validacion de formato (accion 3) -- criterio de
 * aceptacion "No envia a INVALID". `VERIFIED`: confirmado por un provider
 * real -- inalcanzable en este ciclo sin credenciales, pero el estado ya
 * existe en el contrato para cuando se conecte uno. Nunca se expone un
 * status derivado ("STALE") como valor persistido -- ver
 * `effectiveValidationStatus` en contact-point-service.ts: criterio
 * "Unknown no se presenta como verified" se resuelve degradando VERIFIED a
 * UNVERIFIED en LECTURA cuando la validacion quedo vieja, no con un quinto
 * estado guardado. */
export const ContactPointValidationStatusSchema = z.enum(['UNVERIFIED', 'INVALID', 'VERIFIED']);

/** Nunca expone el valor real (email/telefono) ni su forma normalizada --
 * solo `valueMasked` (ej. "j***@acme.com", "***1234") y `valueHash` (sha256,
 * ya no reversible al valor real sin fuerza bruta) -- criterio de aceptacion
 * "PII protegida". El valor real solo vive cifrado (`value_encrypted`,
 * `contact_point` en packages/db/src/schema.ts, PH03-T001) y nunca sale de
 * `apps/core-api/src/contact-point-service.ts` sin enmascarar. */
export const ContactPointSchema = z
  .object({
    id: UuidSchema,
    organizationId: UuidSchema,
    contactId: UuidSchema,
    pointType: ContactPointTypeSchema,
    valueMasked: z.string().min(1).max(240),
    valueHash: z.string().regex(/^[0-9a-f]{64}$/),
    validationStatus: ContactPointValidationStatusSchema,
    sourceId: UuidSchema.nullable(),
    lastValidatedAt: TimestampSchema.nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict();

export const CreateContactPointSchema = z
  .object({
    contactId: UuidSchema,
    pointType: ContactPointTypeSchema,
    // Unico campo que recibe el valor real -- nunca se devuelve en ninguna
    // respuesta (ver ContactPointSchema.valueMasked) ni se persiste sin
    // cifrar. max(320) cubre el limite practico de un email (RFC 5321).
    rawValue: z.string().trim().min(1).max(320),
    sourceId: UuidSchema.optional(),
    idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  })
  .strict();

export const ContactPointResponseSchema = resourceResponse(ContactPointSchema);
export const ContactPointListResponseSchema = resourceListResponse(ContactPointSchema);
export const OpportunityResponseSchema = resourceResponse(OpportunitySchema);
export const OpportunityListResponseSchema = resourceListResponse(OpportunitySchema);

const JobTypeSchema = z.enum(['RESOLVE_ENTITY', 'RESEARCH_COMPANY', 'DISCOVER_HR', 'VERIFY_PERSON', 'FIND_CONTACTABILITY']);
export const StartJobSchema = z.object({
  jobType: JobTypeSchema,
  input: z.record(z.string(), z.unknown()),
  priority: z.number().int().min(0).max(100).default(50),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();
export const RetryJobSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();
export const CancelJobSchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional(),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();
export const JobRecordSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  jobType: JobTypeSchema,
  input: z.record(z.string(), z.unknown()),
  status: z.enum(['PENDING', 'QUEUED', 'RUNNING', 'RETRY_SCHEDULED', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED', 'DEAD_LETTER']),
  priority: z.number().int().min(0).max(100),
  idempotencyKey: z.string(),
  retryCount: z.number().int().nonnegative(),
  nextAttemptAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
}).strict();

const ApprovalActionSchema = z.enum(['CHANGE_PRICE', 'GRANT_DISCOUNT', 'CHANGE_COMMERCIAL_TERMS', 'BINDING_COMMITMENT']);
export const CreateApprovalSchema = z.object({
  jobId: UuidSchema,
  action: ApprovalActionSchema,
  reasonCode: z.string().regex(/^RHIA_APPROVAL_[A-Z0-9_]+$/),
  summary: z.string().trim().min(1).max(1000),
  targetRef: UuidSchema,
  expiresAt: TimestampSchema.optional(),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();
export const DecideApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().min(1).max(1000).optional(),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();
export const ApprovalRecordSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  jobId: UuidSchema,
  action: ApprovalActionSchema,
  reasonCode: z.string(),
  summary: z.string(),
  targetRef: UuidSchema,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']),
  requestedById: UuidSchema,
  correlationId: UuidSchema,
  requestedAt: TimestampSchema,
  approverUserId: UuidSchema.nullable(),
  reason: z.string().nullable(),
  decidedAt: TimestampSchema.nullable(),
  expiresAt: TimestampSchema.nullable(),
  updatedAt: TimestampSchema,
}).strict();

export const JobResponseSchema = resourceResponse(JobRecordSchema);
export const JobListResponseSchema = resourceListResponse(JobRecordSchema);
export const ApprovalResponseSchema = resourceResponse(ApprovalRecordSchema);
export const ApprovalListResponseSchema = resourceListResponse(ApprovalRecordSchema);
export const validateJobRequest = JobRequestSchema;
export const validateApprovalRequest = ApprovalRequestSchema;
export const validateApprovalDecision = ApprovalDecisionSchema;

export const EngineHealthScoreSchema = z
  .object({
    engine: z.string().min(1),
    score: z.number().min(0).max(1).nullable(),
    classification: z.enum(['SALUDABLE', 'INESTABLE', 'DEGRADADO', 'SIN_DATOS', 'SIN_DATOS_SUFICIENTES']),
    sampleWeight: z.number().nonnegative(),
    eventCount: z.number().int().nonnegative(),
  })
  .strict();

export const SearchHealthResponseSchema = z
  .object({
    version: ContractVersionSchema,
    data: z.array(EngineHealthScoreSchema),
    meta: z.object({
      windowDays: z.number().positive(),
      halfLifeHours: z.number().positive(),
      generatedAt: TimestampSchema,
    }).strict(),
  })
  .strict();

export const CoreApiErrorResponseSchema = z
  .object({
    version: ContractVersionSchema,
    error: RhiaErrorSchema,
  })
  .strict();

export type CompanyGroup = z.infer<typeof CompanyGroupSchema>;
export type CreateCompanyGroup = z.infer<typeof CreateCompanyGroupSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type CreateContact = z.infer<typeof CreateContactSchema>;
export type ContactPoint = z.infer<typeof ContactPointSchema>;
export type CreateContactPoint = z.infer<typeof CreateContactPointSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type CreateOpportunity = z.infer<typeof CreateOpportunitySchema>;
export type JobRecord = z.infer<typeof JobRecordSchema>;
export type StartJob = z.infer<typeof StartJobSchema>;
export type RetryJob = z.infer<typeof RetryJobSchema>;
export type CancelJob = z.infer<typeof CancelJobSchema>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export type CreateApproval = z.infer<typeof CreateApprovalSchema>;
export type DecideApproval = z.infer<typeof DecideApprovalSchema>;
export type EngineHealthScoreDto = z.infer<typeof EngineHealthScoreSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type CompanyDetail = z.infer<typeof CompanyDetailSchema>;
