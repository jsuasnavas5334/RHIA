import { createHash } from 'node:crypto';
import { authorize, type ActionKey, type Principal } from '@rhia/policy';
import {
  CreateApprovalSchema, DecideApprovalSchema, StartJobSchema, validateApprovalDecision, validateApprovalRequest, validateJobRequest,
  type ApprovalRecord, type CreateApproval, type DecideApproval, type JobRecord, type StartJob,
} from './contracts.js';
import { CoreServiceError } from './company-service.js';
import type { CoreDependencies, IdempotentResource } from './ports.js';

const hash = (value: object): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const requireAction = (principal: Principal, action: ActionKey): void => {
  const decision = authorize(principal, action);
  if (decision.outcome !== 'ALLOW') throw new CoreServiceError(decision.code ?? 'RHIA_POLICY_DENIED', 403, decision.reason);
};
const replay = <T>(
  stored: Readonly<{ fingerprint: string; resource: IdempotentResource }> | undefined,
  expected: string,
  type: IdempotentResource['resourceType'],
): T | undefined => {
  if (!stored) return undefined;
  if (stored.fingerprint !== expected) {
    throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 409, 'La idempotency key ya fue usada con otro payload.');
  }
  if (stored.resource.resourceType !== type) {
    throw new CoreServiceError('RHIA_CORE_UNEXPECTED_FAILURE', 409, 'El ledger idempotente contiene otro tipo de recurso.');
  }
  return stored.resource.value as T;
};

export class JobService {
  constructor(private readonly dependencies: CoreDependencies) {}

  async list(principal: Principal): Promise<readonly JobRecord[]> {
    requireAction(principal, 'READ_OPERATIONS');
    return this.dependencies.jobs.listByOrganization(principal.organizationId);
  }

  async create(principal: Principal, raw: unknown, correlationId: string): Promise<Readonly<{ job: JobRecord; replayed: boolean }>> {
    requireAction(principal, 'START_JOB');
    const parsed = StartJobSchema.safeParse(raw);
    if (!parsed.success) throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'El payload de job no cumple el contrato v1.');
    const input: StartJob = parsed.data;
    const fingerprint = hash({ jobType: input.jobType, input: input.input, priority: input.priority });
    return this.dependencies.unitOfWork.execute(async () => {
      const stored = await this.dependencies.idempotency.get(principal.organizationId, 'JOB_CREATE', input.idempotencyKey);
      const prior = replay<JobRecord>(stored, fingerprint, 'JOB');
      if (prior) return { job: prior, replayed: true };

      const id = this.dependencies.newId();
      const occurredAt = this.dependencies.now().toISOString();
      const contract = validateJobRequest.safeParse({
        version: '1.0', jobId: id, correlationId, requestedAt: occurredAt, requestedBy: 'CORE', attempt: 1,
        jobType: input.jobType, input: input.input,
      });
      if (!contract.success) throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'El input no corresponde al jobType solicitado.');
      const job: JobRecord = {
        id, organizationId: principal.organizationId, jobType: input.jobType, input: input.input, status: 'PENDING',
        priority: input.priority, idempotencyKey: input.idempotencyKey, retryCount: 0, nextAttemptAt: null,
        createdAt: occurredAt, updatedAt: occurredAt, completedAt: null,
      };
      await this.dependencies.jobs.create(job);
      await this.dependencies.audit.append({
        id: this.dependencies.newId(), organizationId: principal.organizationId, actorId: principal.id, actorType: principal.kind,
        action: 'JOB_CREATED', resourceType: 'JOB', resourceId: job.id, afterHash: hash(job), occurredAt, correlationId,
      });
      await this.dependencies.idempotency.put(principal.organizationId, 'JOB_CREATE', input.idempotencyKey, {
        fingerprint, resource: { resourceType: 'JOB', value: job },
      });
      return { job, replayed: false };
    });
  }
}

export class ApprovalService {
  constructor(private readonly dependencies: CoreDependencies) {}

  async list(principal: Principal): Promise<readonly ApprovalRecord[]> {
    requireAction(principal, 'READ_APPROVALS');
    return this.dependencies.approvals.listByOrganization(principal.organizationId);
  }

  async create(principal: Principal, raw: unknown, correlationId: string): Promise<Readonly<{ approval: ApprovalRecord; replayed: boolean }>> {
    requireAction(principal, 'REQUEST_APPROVAL');
    const parsed = CreateApprovalSchema.safeParse(raw);
    if (!parsed.success) throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'El payload de approval no cumple el contrato v1.');
    const input: CreateApproval = parsed.data;
    const fingerprint = hash({ ...input, idempotencyKey: undefined });
    return this.dependencies.unitOfWork.execute(async () => {
      const stored = await this.dependencies.idempotency.get(principal.organizationId, 'APPROVAL_CREATE', input.idempotencyKey);
      const prior = replay<ApprovalRecord>(stored, fingerprint, 'APPROVAL');
      if (prior) return { approval: prior, replayed: true };

      const id = this.dependencies.newId();
      const occurredAt = this.dependencies.now().toISOString();
      const contract = validateApprovalRequest.safeParse({
        version: '1.0', approvalId: id, jobId: input.jobId, correlationId, requestedAt: occurredAt, requestedBy: 'CORE',
        status: 'PENDING', action: input.action, reasonCode: input.reasonCode, summary: input.summary, targetRef: input.targetRef,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      });
      if (!contract.success) throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'La solicitud no cumple ApprovalRequest v1.');
      const approval: ApprovalRecord = {
        id, organizationId: principal.organizationId, jobId: input.jobId, action: input.action, reasonCode: input.reasonCode,
        summary: input.summary, targetRef: input.targetRef, status: 'PENDING', requestedById: principal.id,
        correlationId, requestedAt: occurredAt, approverUserId: null, reason: null, decidedAt: null, expiresAt: input.expiresAt ?? null,
        updatedAt: occurredAt,
      };
      await this.dependencies.approvals.create(approval);
      await this.dependencies.audit.append({
        id: this.dependencies.newId(), organizationId: principal.organizationId, actorId: principal.id, actorType: principal.kind,
        action: 'APPROVAL_REQUESTED', resourceType: 'APPROVAL', resourceId: approval.id, afterHash: hash(approval), occurredAt, correlationId,
      });
      await this.dependencies.idempotency.put(principal.organizationId, 'APPROVAL_CREATE', input.idempotencyKey, {
        fingerprint, resource: { resourceType: 'APPROVAL', value: approval },
      });
      return { approval, replayed: false };
    });
  }

  async decide(
    principal: Principal,
    approvalId: string,
    raw: unknown,
    correlationId: string,
  ): Promise<Readonly<{ approval: ApprovalRecord; replayed: boolean }>> {
    requireAction(principal, 'DECIDE_APPROVAL');
    const parsed = DecideApprovalSchema.safeParse(raw);
    if (!parsed.success) throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'La decisión no cumple el contrato v1.');
    const input: DecideApproval = parsed.data;
    const fingerprint = hash({ approvalId, decision: input.decision, reason: input.reason ?? null });
    return this.dependencies.unitOfWork.execute(async () => {
      const stored = await this.dependencies.idempotency.get(principal.organizationId, 'APPROVAL_DECIDE', input.idempotencyKey);
      const prior = replay<ApprovalRecord>(stored, fingerprint, 'APPROVAL');
      if (prior) return { approval: prior, replayed: true };

      const current = await this.dependencies.approvals.findById(principal.organizationId, approvalId);
      if (!current) throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'Approval no existe en el tenant activo.');
      if (current.requestedById === principal.id) {
        throw new CoreServiceError('RHIA_POLICY_DENIED', 403, 'La persona solicitante no puede aprobar su propia acción.');
      }
      if (current.status !== 'PENDING' || (current.expiresAt && new Date(current.expiresAt) <= this.dependencies.now())) {
        throw new CoreServiceError('RHIA_STATE_INVALID_TRANSITION', 409, 'Approval ya no admite una decisión.');
      }
      const decidedAt = this.dependencies.now().toISOString();
      const contract = validateApprovalDecision.safeParse({
        version: '1.0', approvalId, correlationId, decision: input.decision, decidedAt, decidedByRef: principal.id,
        ...(input.reason ? { reason: input.reason } : {}),
      });
      if (!contract.success) throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'La decisión no cumple ApprovalDecision v1.');
      const approval: ApprovalRecord = {
        ...current, status: input.decision, approverUserId: principal.id, reason: input.reason ?? null, decidedAt, updatedAt: decidedAt,
      };
      await this.dependencies.approvals.update(approval);
      await this.dependencies.audit.append({
        id: this.dependencies.newId(), organizationId: principal.organizationId, actorId: principal.id, actorType: principal.kind,
        action: 'APPROVAL_DECIDED', resourceType: 'APPROVAL', resourceId: approval.id, afterHash: hash(approval),
        occurredAt: decidedAt, correlationId,
      });
      await this.dependencies.idempotency.put(principal.organizationId, 'APPROVAL_DECIDE', input.idempotencyKey, {
        fingerprint, resource: { resourceType: 'APPROVAL', value: approval },
      });
      return { approval, replayed: false };
    });
  }
}
