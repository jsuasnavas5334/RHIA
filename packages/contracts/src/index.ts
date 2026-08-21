import { z } from 'zod';
import { errorCatalog, errorCategories, errorCodes } from '@rhia/domain';

export const ContractVersionSchema = z.literal('1.0');
export const UuidSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime({ offset: true });
export const ComponentSchema = z.enum(['CORE', 'N8N', 'WORKER']);
export const JobTypeSchema = z.enum([
  'RESOLVE_ENTITY',
  'RESEARCH_COMPANY',
  'DISCOVER_HR',
  'VERIFY_PERSON',
  'FIND_CONTACTABILITY',
]);

export const MarketSchema = z
  .object({
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    regionCode: z.string().min(1).max(20).optional(),
    city: z.string().min(1).max(120).optional(),
  })
  .strict();

export const RhiaErrorSchema = z
  .object({
    code: z.enum(errorCodes),
    message: z.string().min(1).max(500),
    retryable: z.boolean(),
    correlationId: UuidSchema,
    category: z.enum(errorCategories),
    safeDetails: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const definition = errorCatalog[value.code];
    if (value.category !== definition.category) {
      context.addIssue({ code: 'custom', path: ['category'], message: 'La categoría no coincide con el catálogo.' });
    }
    if (value.retryable !== definition.retryable) {
      context.addIssue({ code: 'custom', path: ['retryable'], message: 'retryable no coincide con el catálogo.' });
    }
  });

const JobRequestBaseSchema = z
  .object({
    version: ContractVersionSchema,
    jobId: UuidSchema,
    correlationId: UuidSchema,
    requestedAt: TimestampSchema,
    requestedBy: ComponentSchema,
    attempt: z.number().int().min(1).max(10).default(1),
  })
  .strict();

const ResolveEntityJobSchema = JobRequestBaseSchema.extend({
  jobType: z.literal('RESOLVE_ENTITY'),
  input: z
    .object({
      companyMentioned: z.string().min(1).max(240),
      countryQuery: z.string().min(1).max(120).optional(),
      cityQuery: z.string().min(1).max(120).optional(),
      resolutionQueries: z.array(z.string().min(1).max(500)).min(1).max(30),
    })
    .strict(),
});

const ResearchCompanyJobSchema = JobRequestBaseSchema.extend({
  jobType: z.literal('RESEARCH_COMPANY'),
  input: z
    .object({
      companyName: z.string().min(1).max(240),
      countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
      urlsToVerify: z.array(z.string().url()).max(30).default([]),
    })
    .strict(),
});

const DiscoverHrJobSchema = JobRequestBaseSchema.extend({
  jobType: z.literal('DISCOVER_HR'),
  input: z
    .object({
      companyName: z.string().min(1).max(240),
      contactQuery: z.string().min(1).max(500),
      candidatesToVerify: z.array(z.string().min(1).max(240)).max(50).default([]),
    })
    .strict(),
});

const VerifyPersonJobSchema = JobRequestBaseSchema.extend({
  jobType: z.literal('VERIFY_PERSON'),
  input: z
    .object({
      companyName: z.string().min(1).max(240),
      personName: z.string().min(1).max(240),
      declaredRole: z.string().min(1).max(240).optional(),
      verificationQuery: z.string().min(1).max(500),
    })
    .strict(),
});

const FindContactabilityJobSchema = JobRequestBaseSchema.extend({
  jobType: z.literal('FIND_CONTACTABILITY'),
  input: z
    .object({
      companyName: z.string().min(1).max(240),
      personName: z.string().min(1).max(240).optional(),
      directContactQuery: z.string().min(1).max(500),
    })
    .strict(),
});

export const JobRequestSchema = z.discriminatedUnion('jobType', [
  ResolveEntityJobSchema,
  ResearchCompanyJobSchema,
  DiscoverHrJobSchema,
  VerifyPersonJobSchema,
  FindContactabilityJobSchema,
]);

const EvidenceRefSchema = z
  .object({
    evidenceId: UuidSchema,
    classification: z.enum(['EVIDENCE', 'FACT', 'INFERENCE', 'DECISION']),
  })
  .strict();

const JobOutputSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('RESOLVE_ENTITY'),
      resolution: z.enum(['RESOLVED', 'AMBIGUOUS', 'INSUFFICIENT_EVIDENCE']),
      selectedMarket: MarketSchema.optional(),
      candidateCount: z.number().int().nonnegative(),
      evidence: z.array(EvidenceRefSchema),
    })
    .strict(),
  z
    .object({
      kind: z.literal('RESEARCH_COMPANY'),
      companyRef: UuidSchema,
      evidence: z.array(EvidenceRefSchema),
    })
    .strict(),
  z
    .object({
      kind: z.literal('DISCOVER_HR'),
      candidateRefs: z.array(UuidSchema),
      evidence: z.array(EvidenceRefSchema),
    })
    .strict(),
  z
    .object({
      kind: z.literal('VERIFY_PERSON'),
      personRef: UuidSchema,
      verificationStatus: z.enum(['VERIFIED', 'CONFLICTING', 'UNVERIFIED']),
      evidence: z.array(EvidenceRefSchema),
    })
    .strict(),
  z
    .object({
      kind: z.literal('FIND_CONTACTABILITY'),
      contactRefs: z.array(UuidSchema),
      evidence: z.array(EvidenceRefSchema),
    })
    .strict(),
]);

export const JobResultSchema = z
  .object({
    version: ContractVersionSchema,
    jobId: UuidSchema,
    correlationId: UuidSchema,
    jobType: JobTypeSchema,
    status: z.enum(['SUCCEEDED', 'PARTIAL', 'FAILED']),
    completedAt: TimestampSchema,
    output: JobOutputSchema.optional(),
    error: RhiaErrorSchema.optional(),
    metrics: z
      .object({
        durationMs: z.number().int().nonnegative(),
        attempt: z.number().int().min(1).max(10),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'SUCCEEDED' && (!value.output || value.error)) {
      context.addIssue({ code: 'custom', message: 'SUCCEEDED requiere output y prohíbe error.' });
    }
    if (value.status === 'FAILED' && (!value.error || value.output)) {
      context.addIssue({ code: 'custom', message: 'FAILED requiere error y prohíbe output.' });
    }
    if (value.output && value.output.kind !== value.jobType) {
      context.addIssue({ code: 'custom', path: ['output', 'kind'], message: 'output.kind debe coincidir con jobType.' });
    }
    if (value.error && value.error.correlationId !== value.correlationId) {
      context.addIssue({ code: 'custom', path: ['error', 'correlationId'], message: 'La correlación del error no coincide.' });
    }
  });

export const ExecutionEventSchema = z
  .object({
    version: ContractVersionSchema,
    eventId: UuidSchema,
    executionId: UuidSchema,
    jobId: UuidSchema,
    correlationId: UuidSchema,
    source: ComponentSchema,
    eventType: z.enum(['ACCEPTED', 'STARTED', 'PROGRESS', 'RETRY_SCHEDULED', 'COMPLETED', 'FAILED']),
    occurredAt: TimestampSchema,
    sequence: z.number().int().nonnegative(),
    data: z
      .object({
        progressPercent: z.number().min(0).max(100).optional(),
        messageCode: z.string().regex(/^RHIA_[A-Z0-9]+(?:_[A-Z0-9]+)+$/).optional(),
        attempt: z.number().int().min(1).max(10).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const SearchRequestSchema = z
  .object({
    version: ContractVersionSchema,
    queryId: UuidSchema,
    correlationId: UuidSchema,
    query: z.string().min(1).max(500),
    market: MarketSchema,
    requestedAt: TimestampSchema,
    limit: z.number().int().min(1).max(50).default(10),
    sources: z.array(z.enum(['SEARXNG', 'WEB_API', 'BROWSER'])).min(1),
  })
  .strict();

const SearchProviderHealthSchema = z
  .object({
    provider: z.string().min(1).max(80),
    status: z.enum(['HEALTHY', 'DEGRADED', 'UNAVAILABLE']),
    issue: z.enum(['RATE_LIMIT', 'CAPTCHA', 'TIMEOUT', 'PROVIDER_DOWN', 'PARSE_ERROR']).optional(),
  })
  .strict();

export const SearchResponseSchema = z
  .object({
    version: ContractVersionSchema,
    queryId: UuidSchema,
    correlationId: UuidSchema,
    status: z.enum(['HEALTHY', 'DEGRADED', 'UNAVAILABLE']),
    completedAt: TimestampSchema,
    results: z.array(
      z
        .object({
          rank: z.number().int().positive(),
          url: z.string().url(),
          title: z.string().min(1).max(500),
          snippet: z.string().max(2000),
          provider: z.string().min(1).max(80),
        })
        .strict(),
    ),
    providers: z.array(SearchProviderHealthSchema).min(1),
  })
  .strict();

const ToolCallBaseSchema = z
  .object({
    version: ContractVersionSchema,
    toolCallId: UuidSchema,
    jobId: UuidSchema,
    correlationId: UuidSchema,
    requestedAt: TimestampSchema,
  })
  .strict();

export const ToolCallSchema = z
  .discriminatedUnion('toolKind', [
    ToolCallBaseSchema.extend({ toolKind: z.literal('SEARCH'), request: SearchRequestSchema }),
    ToolCallBaseSchema.extend({
      toolKind: z.literal('WORKFLOW'),
      request: z
        .object({
          workflowId: z.string().min(1).max(100),
          job: JobRequestSchema,
        })
        .strict(),
    }),
  ])
  .superRefine((value, context) => {
    const nestedCorrelationId = value.toolKind === 'SEARCH' ? value.request.correlationId : value.request.job.correlationId;
    if (nestedCorrelationId !== value.correlationId) {
      context.addIssue({ code: 'custom', path: ['request', 'correlationId'], message: 'La correlación anidada no coincide.' });
    }
    if (value.toolKind === 'WORKFLOW' && value.request.job.jobId !== value.jobId) {
      context.addIssue({ code: 'custom', path: ['request', 'job', 'jobId'], message: 'El job anidado no coincide.' });
    }
  });

export const ToolResultSchema = z
  .discriminatedUnion('success', [
    z
      .object({
        version: ContractVersionSchema,
        toolCallId: UuidSchema,
        jobId: UuidSchema,
        correlationId: UuidSchema,
        completedAt: TimestampSchema,
        success: z.literal(true),
        output: z.union([SearchResponseSchema, JobResultSchema]),
      })
      .strict(),
    z
      .object({
        version: ContractVersionSchema,
        toolCallId: UuidSchema,
        jobId: UuidSchema,
        correlationId: UuidSchema,
        completedAt: TimestampSchema,
        success: z.literal(false),
        error: RhiaErrorSchema,
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    const nestedCorrelationId = value.success ? value.output.correlationId : value.error.correlationId;
    if (nestedCorrelationId !== value.correlationId) {
      context.addIssue({ code: 'custom', path: [value.success ? 'output' : 'error', 'correlationId'], message: 'La correlación anidada no coincide.' });
    }
    if (value.success && 'jobId' in value.output && value.output.jobId !== value.jobId) {
      context.addIssue({ code: 'custom', path: ['output', 'jobId'], message: 'El job del resultado no coincide.' });
    }
  });

export const ApprovalRequestSchema = z
  .object({
    version: ContractVersionSchema,
    approvalId: UuidSchema,
    jobId: UuidSchema,
    correlationId: UuidSchema,
    requestedAt: TimestampSchema,
    requestedBy: ComponentSchema,
    status: z.literal('PENDING'),
    action: z.enum(['CHANGE_PRICE', 'GRANT_DISCOUNT', 'CHANGE_COMMERCIAL_TERMS', 'BINDING_COMMITMENT']),
    reasonCode: z.string().regex(/^RHIA_APPROVAL_[A-Z0-9_]+$/),
    summary: z.string().min(1).max(1000),
    targetRef: UuidSchema,
    expiresAt: TimestampSchema.optional(),
  })
  .strict();

export const ApprovalDecisionSchema = z
  .object({
    version: ContractVersionSchema,
    approvalId: UuidSchema,
    correlationId: UuidSchema,
    decision: z.enum(['APPROVED', 'REJECTED', 'EXPIRED']),
    decidedAt: TimestampSchema,
    decidedByRef: UuidSchema,
    reason: z.string().max(1000).optional(),
  })
  .strict();

const CallbackBaseSchema = z
  .object({
    version: ContractVersionSchema,
    callbackId: UuidSchema,
    correlationId: UuidSchema,
    emittedAt: TimestampSchema,
  })
  .strict();

export const CallbackEnvelopeSchema = z
  .discriminatedUnion('callbackType', [
    CallbackBaseSchema.extend({ callbackType: z.literal('JOB_RESULT'), payload: JobResultSchema }),
    CallbackBaseSchema.extend({ callbackType: z.literal('EXECUTION_EVENT'), payload: ExecutionEventSchema }),
    CallbackBaseSchema.extend({ callbackType: z.literal('APPROVAL_DECISION'), payload: ApprovalDecisionSchema }),
  ])
  .superRefine((value, context) => {
    if (value.payload.correlationId !== value.correlationId) {
      context.addIssue({ code: 'custom', path: ['payload', 'correlationId'], message: 'La correlación del callback no coincide.' });
    }
  });

export const ContractSchemas = {
  RhiaError: RhiaErrorSchema,
  JobRequest: JobRequestSchema,
  JobResult: JobResultSchema,
  ExecutionEvent: ExecutionEventSchema,
  SearchRequest: SearchRequestSchema,
  SearchResponse: SearchResponseSchema,
  ToolCall: ToolCallSchema,
  ToolResult: ToolResultSchema,
  ApprovalRequest: ApprovalRequestSchema,
  ApprovalDecision: ApprovalDecisionSchema,
  CallbackEnvelope: CallbackEnvelopeSchema,
} as const;

export type JobRequest = z.infer<typeof JobRequestSchema>;
export type JobResult = z.infer<typeof JobResultSchema>;
export type ExecutionEvent = z.infer<typeof ExecutionEventSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type CallbackEnvelope = z.infer<typeof CallbackEnvelopeSchema>;
