export { CoreApi, normalizedError, type CoreApiRequest, type CoreApiResponse } from './api.js';
export { createCoreHttpServer, type CoreHttpOptions, type PrincipalAuthenticator } from './http-server.js';
export { createPostgresCoreDependencies, PostgresCorePersistence, PostgresSession } from './postgres-adapters.js';
export { CompanyGroupService, CoreServiceError } from './company-service.js';
export { ContactService, OpportunityService } from './record-services.js';
export { ApprovalService, JobService } from './control-services.js';
export {
  CompanyGroupListResponseSchema,
  CompanyGroupResponseSchema,
  CompanyGroupSchema,
  CoreApiErrorResponseSchema,
  CreateCompanyGroupSchema,
  ContactListResponseSchema,
  ContactResponseSchema,
  ContactSchema,
  CreateContactSchema,
  CreateOpportunitySchema,
  OpportunityListResponseSchema,
  OpportunityResponseSchema,
  OpportunitySchema,
  ApprovalListResponseSchema,
  ApprovalRecordSchema,
  ApprovalResponseSchema,
  CreateApprovalSchema,
  DecideApprovalSchema,
  JobListResponseSchema,
  JobRecordSchema,
  JobResponseSchema,
  StartJobSchema,
  type CompanyGroup,
  type Contact,
  type CreateCompanyGroup,
  type CreateContact,
  type CreateOpportunity,
  type Opportunity,
  type ApprovalRecord,
  type CreateApproval,
  type DecideApproval,
  type JobRecord,
  type StartJob,
} from './contracts.js';
export {
  MemoryApprovalRepository, MemoryAuditSink, MemoryCompanyGroupRepository, MemoryContactRepository, MemoryIdempotencyStore,
  MemoryJobRepository, MemoryOpportunityRepository, MemoryUnitOfWork,
} from './memory-adapters.js';
export type {
  ApprovalRepository, AuditEvent, AuditSink, CompanyGroupRepository, ContactRepository, CoreDependencies, CoreUnitOfWork, IdempotencyStore,
  JobRepository, OpportunityRepository,
} from './ports.js';
