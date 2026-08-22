import type { Principal } from '@rhia/policy';
import type { ApprovalRecord, CompanyGroup, Contact, JobRecord, Opportunity } from './contracts.js';

export type AuditEvent = Readonly<{
  id: string;
  organizationId: string;
  actorId: string;
  actorType: Principal['kind'];
  action: 'COMPANY_GROUP_CREATED' | 'CONTACT_CREATED' | 'OPPORTUNITY_CREATED' | 'JOB_CREATED' | 'APPROVAL_REQUESTED' | 'APPROVAL_DECIDED';
  resourceType: 'COMPANY_GROUP' | 'CONTACT' | 'OPPORTUNITY' | 'JOB' | 'APPROVAL';
  resourceId: string;
  afterHash: string;
  occurredAt: string;
  correlationId: string;
}>;

export interface CompanyGroupRepository {
  create(company: CompanyGroup): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly CompanyGroup[]>;
}

export interface ContactRepository {
  create(contact: Contact): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly Contact[]>;
}

export interface OpportunityRepository {
  create(opportunity: Opportunity): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly Opportunity[]>;
}

export interface JobRepository {
  create(job: JobRecord): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly JobRecord[]>;
}

export interface ApprovalRepository {
  create(approval: ApprovalRecord): Promise<void>;
  listByOrganization(organizationId: string): Promise<readonly ApprovalRecord[]>;
  findById(organizationId: string, approvalId: string): Promise<ApprovalRecord | undefined>;
  update(approval: ApprovalRecord): Promise<void>;
}

export type IdempotentResource =
  | Readonly<{ resourceType: 'COMPANY_GROUP'; value: CompanyGroup }>
  | Readonly<{ resourceType: 'CONTACT'; value: Contact }>
  | Readonly<{ resourceType: 'OPPORTUNITY'; value: Opportunity }>
  | Readonly<{ resourceType: 'JOB'; value: JobRecord }>
  | Readonly<{ resourceType: 'APPROVAL'; value: ApprovalRecord }>;

export type IdempotencyRecord = Readonly<{
  fingerprint: string;
  resource: IdempotentResource;
}>;

export interface IdempotencyStore {
  get(organizationId: string, operation: string, key: string): Promise<IdempotencyRecord | undefined>;
  put(organizationId: string, operation: string, key: string, record: IdempotencyRecord): Promise<void>;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
}

export interface CoreUnitOfWork {
  execute<T>(work: () => Promise<T>): Promise<T>;
}

export type CoreDependencies = Readonly<{
  companies: CompanyGroupRepository;
  contacts: ContactRepository;
  opportunities: OpportunityRepository;
  jobs: JobRepository;
  approvals: ApprovalRepository;
  idempotency: IdempotencyStore;
  audit: AuditSink;
  unitOfWork: CoreUnitOfWork;
  newId: () => string;
  now: () => Date;
}>;
