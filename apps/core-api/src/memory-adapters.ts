import type {
  ApprovalRepository, AuditEvent, AuditSink, CompanyGroupRepository, ContactRepository, CoreUnitOfWork, IdempotencyRecord, IdempotencyStore,
  JobRepository, OpportunityRepository,
} from './ports.js';
import type { ApprovalRecord, CompanyGroup, Contact, JobRecord, Opportunity } from './contracts.js';

export class MemoryCompanyGroupRepository implements CompanyGroupRepository {
  readonly records: CompanyGroup[] = [];

  async create(company: CompanyGroup): Promise<void> {
    this.records.push(company);
  }

  async listByOrganization(organizationId: string): Promise<readonly CompanyGroup[]> {
    return this.records.filter((company) => company.organizationId === organizationId);
  }
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  readonly records = new Map<string, IdempotencyRecord>();

  async get(organizationId: string, operation: string, key: string): Promise<IdempotencyRecord | undefined> {
    return this.records.get(`${organizationId}:${operation}:${key}`);
  }

  async put(organizationId: string, operation: string, key: string, record: IdempotencyRecord): Promise<void> {
    this.records.set(`${organizationId}:${operation}:${key}`, record);
  }
}

export class MemoryContactRepository implements ContactRepository {
  readonly records: Contact[] = [];

  async create(contact: Contact): Promise<void> {
    this.records.push(contact);
  }

  async listByOrganization(organizationId: string): Promise<readonly Contact[]> {
    return this.records.filter((contact) => contact.organizationId === organizationId);
  }
}

export class MemoryOpportunityRepository implements OpportunityRepository {
  readonly records: Opportunity[] = [];

  async create(opportunity: Opportunity): Promise<void> {
    this.records.push(opportunity);
  }

  async listByOrganization(organizationId: string): Promise<readonly Opportunity[]> {
    return this.records.filter((opportunity) => opportunity.organizationId === organizationId);
  }
}

export class MemoryJobRepository implements JobRepository {
  readonly records: JobRecord[] = [];
  async create(job: JobRecord): Promise<void> { this.records.push(job); }
  async listByOrganization(organizationId: string): Promise<readonly JobRecord[]> {
    return this.records.filter((job) => job.organizationId === organizationId);
  }
}

export class MemoryApprovalRepository implements ApprovalRepository {
  readonly records: ApprovalRecord[] = [];
  async create(approval: ApprovalRecord): Promise<void> { this.records.push(approval); }
  async listByOrganization(organizationId: string): Promise<readonly ApprovalRecord[]> {
    return this.records.filter((approval) => approval.organizationId === organizationId);
  }
  async findById(organizationId: string, approvalId: string): Promise<ApprovalRecord | undefined> {
    return this.records.find((approval) => approval.organizationId === organizationId && approval.id === approvalId);
  }
  async update(approval: ApprovalRecord): Promise<void> {
    const index = this.records.findIndex((candidate) => candidate.organizationId === approval.organizationId && candidate.id === approval.id);
    if (index >= 0) this.records[index] = approval;
  }
}

export class MemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

export class MemoryUnitOfWork implements CoreUnitOfWork {
  async execute<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
