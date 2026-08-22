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

export const CreateCompanyGroupSchema = z
  .object({
    canonicalName: z.string().trim().min(1).max(240),
    websiteRoot: z.string().url().max(500).optional(),
    idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  })
  .strict();

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

export const ContactResponseSchema = resourceResponse(ContactSchema);
export const ContactListResponseSchema = resourceListResponse(ContactSchema);
export const OpportunityResponseSchema = resourceResponse(OpportunitySchema);
export const OpportunityListResponseSchema = resourceListResponse(OpportunitySchema);

const JobTypeSchema = z.enum(['RESOLVE_ENTITY', 'RESEARCH_COMPANY', 'DISCOVER_HR', 'VERIFY_PERSON', 'FIND_CONTACTABILITY']);
export const StartJobSchema = z.object({
  jobType: JobTypeSchema,
  input: z.record(z.string(), z.unknown()),
  priority: z.number().int().min(0).max(100).default(50),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();
export const JobRecordSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  jobType: JobTypeSchema,
  input: z.record(z.string(), z.unknown()),
  status: z.literal('PENDING'),
  priority: z.number().int().min(0).max(100),
  idempotencyKey: z.string(),
  retryCount: z.literal(0),
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
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type CreateOpportunity = z.infer<typeof CreateOpportunitySchema>;
export type JobRecord = z.infer<typeof JobRecordSchema>;
export type StartJob = z.infer<typeof StartJobSchema>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export type CreateApproval = z.infer<typeof CreateApprovalSchema>;
export type DecideApproval = z.infer<typeof DecideApprovalSchema>;
