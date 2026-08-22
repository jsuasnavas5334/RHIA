import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  ApprovalRecord, CompanyGroup, Contact, JobRecord, Opportunity,
} from './contracts.js';
import type { AuditEvent, AuditSink, CoreDependencies, CoreUnitOfWork, IdempotencyRecord, IdempotencyStore } from './ports.js';

type TimestampValue = Date | string;
type DatabaseRow = QueryResultRow & Record<string, unknown>;

const iso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  throw new TypeError('Timestamp PostgreSQL inválido.');
};
const nullableIso = (value: unknown): string | null => value === null ? null : iso(value);
const text = (value: unknown): string => {
  if (typeof value !== 'string') throw new TypeError('Texto PostgreSQL inválido.');
  return value;
};
const nullableText = (value: unknown): string | null => value === null ? null : text(value);
const number = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError('Número PostgreSQL inválido.');
  return parsed;
};

export class PostgresSession implements CoreUnitOfWork {
  private readonly activeClient = new AsyncLocalStorage<PoolClient>();

  constructor(private readonly pool: Pool) {}

  query<Row extends QueryResultRow = DatabaseRow>(statement: string, values: readonly unknown[] = []) {
    return (this.activeClient.getStore() ?? this.pool).query<Row>(statement, [...values]);
  }

  async execute<T>(work: () => Promise<T>): Promise<T> {
    if (this.activeClient.getStore()) return work();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.activeClient.run(client, work);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'La operación y su rollback PostgreSQL fallaron.');
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

const mapCompany = (row: DatabaseRow): CompanyGroup => ({
  id: text(row['id']), organizationId: text(row['organization_id']), canonicalName: text(row['canonical_name']),
  websiteRoot: nullableText(row['website_root']), globalIdentityStatus: text(row['global_identity_status']) as CompanyGroup['globalIdentityStatus'],
  createdAt: iso(row['created_at'] as TimestampValue), updatedAt: iso(row['updated_at'] as TimestampValue),
});
const mapContact = (row: DatabaseRow): Contact => ({
  id: text(row['id']), organizationId: text(row['organization_id']), companyGroupId: text(row['company_group_id']),
  companyEntityId: nullableText(row['company_entity_id']), fullName: text(row['full_name']), title: nullableText(row['title']),
  department: nullableText(row['department']), seniority: nullableText(row['seniority']), countryCode: nullableText(row['country_code']),
  city: nullableText(row['city']), linkedinUrl: nullableText(row['linkedin_url']), status: text(row['status']) as Contact['status'],
  createdAt: iso(row['created_at']), updatedAt: iso(row['updated_at']),
});
const mapOpportunity = (row: DatabaseRow): Opportunity => ({
  id: text(row['id']), organizationId: text(row['organization_id']), companyGroupId: text(row['company_group_id']),
  primaryEntityId: nullableText(row['primary_entity_id']), marketCountry: text(row['market_country']), marketCity: nullableText(row['market_city']),
  stage: text(row['stage']) as Opportunity['stage'], score: number(row['score']) as Opportunity['score'],
  scoreVersion: text(row['score_version']) as Opportunity['scoreVersion'], ownerUserId: nullableText(row['owner_user_id']),
  nextActionAt: nullableIso(row['next_action_at']), status: text(row['status']) as Opportunity['status'],
  createdAt: iso(row['created_at']), updatedAt: iso(row['updated_at']),
});
const mapJob = (row: DatabaseRow): JobRecord => ({
  id: text(row['id']), organizationId: text(row['organization_id']), jobType: text(row['job_type']) as JobRecord['jobType'],
  input: row['input'] as Record<string, unknown>, status: text(row['status']) as JobRecord['status'], priority: number(row['priority']),
  idempotencyKey: text(row['idempotency_key']), retryCount: number(row['retry_count']) as JobRecord['retryCount'],
  nextAttemptAt: nullableIso(row['next_attempt_at']), createdAt: iso(row['created_at']), updatedAt: iso(row['updated_at']),
  completedAt: nullableIso(row['completed_at']),
});
const mapApproval = (row: DatabaseRow): ApprovalRecord => ({
  id: text(row['id']), organizationId: text(row['organization_id']), jobId: text(row['job_id']),
  action: text(row['approval_type']) as ApprovalRecord['action'], reasonCode: text(row['reason_code']), summary: text(row['summary']),
  targetRef: text(row['target_ref']), status: text(row['status']) as ApprovalRecord['status'], requestedById: text(row['requested_by_ref']),
  correlationId: text(row['correlation_id']), requestedAt: iso(row['requested_at']),
  approverUserId: nullableText(row['approver_user_id']), reason: nullableText(row['reason']),
  decidedAt: nullableIso(row['decided_at']), expiresAt: nullableIso(row['expires_at']), updatedAt: iso(row['updated_at']),
});

const approvalSelection = `
  SELECT approval.*,
    COALESCE(approval.requested_by_user_id, approval.requested_by_agent_instance_id,
      NULLIF(action.request_payload->>'requestedById', '')::uuid) AS requested_by_ref
  FROM rhia.approval approval
  JOIN rhia.action action ON action.id = approval.action_id`;

export class PostgresCorePersistence implements IdempotencyStore, AuditSink {
  constructor(private readonly session: PostgresSession) {}

  async create(company: CompanyGroup | Contact | Opportunity | JobRecord | ApprovalRecord): Promise<void> {
    if ('canonicalName' in company) return this.createCompany(company);
    if ('fullName' in company) return this.createContact(company);
    if ('marketCountry' in company) return this.createOpportunity(company);
    if ('jobType' in company) return this.createJob(company);
    return this.createApproval(company);
  }

  private async createCompany(company: CompanyGroup): Promise<void> {
    await this.session.query(`INSERT INTO rhia.company_group
      (id, organization_id, canonical_name, website_root, global_identity_status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [company.id, company.organizationId, company.canonicalName, company.websiteRoot,
      company.globalIdentityStatus, company.createdAt, company.updatedAt]);
  }
  private async createContact(contact: Contact): Promise<void> {
    await this.session.query(`INSERT INTO rhia.contact
      (id, organization_id, company_group_id, company_entity_id, full_name, title, department, seniority, country_code, city,
       linkedin_url, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [contact.id, contact.organizationId, contact.companyGroupId, contact.companyEntityId, contact.fullName, contact.title,
      contact.department, contact.seniority, contact.countryCode, contact.city, contact.linkedinUrl, contact.status,
      contact.createdAt, contact.updatedAt]);
  }
  private async createOpportunity(opportunity: Opportunity): Promise<void> {
    await this.session.query(`INSERT INTO rhia.opportunity
      (id, organization_id, company_group_id, primary_entity_id, market_country, market_city, stage, score, score_version,
       owner_user_id, next_action_at, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [opportunity.id, opportunity.organizationId, opportunity.companyGroupId, opportunity.primaryEntityId, opportunity.marketCountry,
      opportunity.marketCity, opportunity.stage, opportunity.score, opportunity.scoreVersion, opportunity.ownerUserId,
      opportunity.nextActionAt, opportunity.status, opportunity.createdAt, opportunity.updatedAt]);
  }
  private async createJob(job: JobRecord): Promise<void> {
    await this.session.query(`INSERT INTO rhia.job
      (id, organization_id, job_type, input, status, priority, idempotency_key, retry_count, next_attempt_at, created_at, updated_at,
       completed_at) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [job.id, job.organizationId, job.jobType, JSON.stringify(job.input), job.status, job.priority, job.idempotencyKey,
      job.retryCount, job.nextAttemptAt, job.createdAt, job.updatedAt, job.completedAt]);
  }
  private async createApproval(approval: ApprovalRecord): Promise<void> {
    await this.session.query('SELECT 1 FROM rhia.job WHERE id=$1 AND organization_id=$2 FOR UPDATE',
      [approval.jobId, approval.organizationId]);
    await this.session.query(`WITH next_attempt AS (
        SELECT COALESCE(MAX(attempt), 0) + 1 AS attempt FROM rhia.execution WHERE job_id=$2
      ), inserted_execution AS (
        INSERT INTO rhia.execution (job_id, attempt, executor_type, trace_id, started_at)
        SELECT $2, attempt, 'CORE_API', $13, $10 FROM next_attempt RETURNING id
      ), inserted_action AS (
        INSERT INTO rhia.action (execution_id, capability_key, resource_type, resource_id, request_payload, risk_level, status, created_at, updated_at)
        SELECT id, 'approved-actions.request', 'APPROVAL_TARGET', $7, $14::jsonb, 'CRITICAL', 'PENDING', $10, $10
        FROM inserted_execution RETURNING id
      ) INSERT INTO rhia.approval
        (id, action_id, organization_id, job_id, requested_by_user_id, requested_by_agent_instance_id, approval_type, status,
         reason_code, summary, target_ref, correlation_id, requested_at, expires_at, updated_at)
      SELECT $1, action.id, $3, $2,
        (SELECT id FROM rhia.app_user WHERE id=$8 AND organization_id=$3),
        (SELECT instance.id FROM rhia.agent_instance instance JOIN rhia.agent_definition definition ON definition.id=instance.agent_definition_id
          WHERE instance.id=$8 AND definition.organization_id=$3),
        $4, $5, $6, $9, $7, $13, $10, $11, $12 FROM inserted_action action`,
    [approval.id, approval.jobId, approval.organizationId, approval.action, approval.status, approval.reasonCode, approval.targetRef,
      approval.requestedById, approval.summary, approval.requestedAt, approval.expiresAt, approval.updatedAt,
      approval.correlationId, JSON.stringify(approval)]);
  }

  async listByOrganization(organizationId: string): Promise<readonly CompanyGroup[]> {
    const result = await this.session.query<DatabaseRow>(
      'SELECT * FROM rhia.company_group WHERE organization_id=$1 ORDER BY created_at, id', [organizationId]);
    return result.rows.map(mapCompany);
  }
  async listContactsByOrganization(organizationId: string): Promise<readonly Contact[]> {
    const result = await this.session.query<DatabaseRow>('SELECT * FROM rhia.contact WHERE organization_id=$1 ORDER BY created_at, id', [organizationId]);
    return result.rows.map(mapContact);
  }
  async listOpportunitiesByOrganization(organizationId: string): Promise<readonly Opportunity[]> {
    const result = await this.session.query<DatabaseRow>('SELECT * FROM rhia.opportunity WHERE organization_id=$1 ORDER BY created_at, id', [organizationId]);
    return result.rows.map(mapOpportunity);
  }
  async listJobsByOrganization(organizationId: string): Promise<readonly JobRecord[]> {
    const result = await this.session.query<DatabaseRow>('SELECT * FROM rhia.job WHERE organization_id=$1 ORDER BY created_at, id', [organizationId]);
    return result.rows.map(mapJob);
  }
  async listApprovalsByOrganization(organizationId: string): Promise<readonly ApprovalRecord[]> {
    const result = await this.session.query<DatabaseRow>(`${approvalSelection} WHERE approval.organization_id=$1 ORDER BY approval.requested_at, approval.id`, [organizationId]);
    return result.rows.map(mapApproval);
  }

  async findById(organizationId: string, approvalId: string): Promise<ApprovalRecord | undefined> {
    const result = await this.session.query<DatabaseRow>(`${approvalSelection} WHERE approval.organization_id=$1 AND approval.id=$2 FOR UPDATE`,
      [organizationId, approvalId]);
    const row = result.rows[0];
    return row ? mapApproval(row) : undefined;
  }
  async update(approval: ApprovalRecord): Promise<void> {
    await this.session.query(`UPDATE rhia.approval SET status=$3, approver_user_id=$4, reason=$5, decided_at=$6, updated_at=$7
      WHERE organization_id=$1 AND id=$2`, [approval.organizationId, approval.id, approval.status, approval.approverUserId,
      approval.reason, approval.decidedAt, approval.updatedAt]);
  }

  async get(organizationId: string, operation: string, key: string): Promise<IdempotencyRecord | undefined> {
    const result = await this.session.query<DatabaseRow>(`SELECT fingerprint, resource_type, resource_snapshot
      FROM rhia.core_idempotency WHERE organization_id=$1 AND operation=$2 AND idempotency_key=$3`, [organizationId, operation, key]);
    const row = result.rows[0];
    if (!row) return undefined;
    return { fingerprint: text(row['fingerprint']), resource: {
      resourceType: text(row['resource_type']) as IdempotencyRecord['resource']['resourceType'],
      value: row['resource_snapshot'],
    } as IdempotencyRecord['resource'] };
  }
  async put(organizationId: string, operation: string, key: string, record: IdempotencyRecord): Promise<void> {
    await this.session.query(`INSERT INTO rhia.core_idempotency
      (organization_id, operation, idempotency_key, fingerprint, resource_type, resource_id, resource_snapshot)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`, [organizationId, operation, key, record.fingerprint,
      record.resource.resourceType, record.resource.value.id, JSON.stringify(record.resource.value)]);
  }
  async append(event: AuditEvent): Promise<void> {
    await this.session.query(`INSERT INTO rhia.audit_event
      (id, organization_id, actor_ref, actor_type, action, resource_type, resource_id, after_hash, occurred_at, trace_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [event.id, event.organizationId, event.actorId, event.actorType, event.action,
      event.resourceType, event.resourceId, event.afterHash, event.occurredAt, event.correlationId]);
  }
}

export const createPostgresCoreDependencies = (
  pool: Pool,
  utilities: Readonly<{ newId: () => string; now: () => Date }>,
): CoreDependencies => {
  const session = new PostgresSession(pool);
  const persistence = new PostgresCorePersistence(session);
  return {
    companies: { create: (value) => persistence.create(value), listByOrganization: (id) => persistence.listByOrganization(id) },
    contacts: { create: (value) => persistence.create(value), listByOrganization: (id) => persistence.listContactsByOrganization(id) },
    opportunities: { create: (value) => persistence.create(value), listByOrganization: (id) => persistence.listOpportunitiesByOrganization(id) },
    jobs: { create: (value) => persistence.create(value), listByOrganization: (id) => persistence.listJobsByOrganization(id) },
    approvals: {
      create: (value) => persistence.create(value), listByOrganization: (id) => persistence.listApprovalsByOrganization(id),
      findById: (organizationId, approvalId) => persistence.findById(organizationId, approvalId),
      update: (value) => persistence.update(value),
    },
    idempotency: persistence, audit: persistence, unitOfWork: session, ...utilities,
  };
};
