import { createHash } from 'node:crypto';
import type { ErrorCode } from '@rhia/domain';
import { authorize, type Principal } from '@rhia/policy';
import { CreateCompanyGroupSchema, type CompanyGroup, type CreateCompanyGroup } from './contracts.js';
import type { CoreDependencies } from './ports.js';

export class CoreServiceError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: 400 | 403 | 409,
    message: string,
  ) {
    super(message);
    this.name = 'CoreServiceError';
  }
}

const fingerprint = (value: object): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const requireAuthorization = (principal: Principal, action: 'READ_OPERATIONS' | 'WRITE_OPERATIONS'): void => {
  const decision = authorize(principal, action);
  if (decision.outcome !== 'ALLOW') {
    throw new CoreServiceError(decision.code ?? 'RHIA_POLICY_DENIED', 403, decision.reason);
  }
};

export class CompanyGroupService {
  constructor(private readonly dependencies: CoreDependencies) {}

  async list(principal: Principal): Promise<readonly CompanyGroup[]> {
    requireAuthorization(principal, 'READ_OPERATIONS');
    return this.dependencies.companies.listByOrganization(principal.organizationId);
  }

  async create(
    principal: Principal,
    rawInput: unknown,
    correlationId: string,
  ): Promise<Readonly<{ company: CompanyGroup; replayed: boolean }>> {
    requireAuthorization(principal, 'WRITE_OPERATIONS');
    const parsed = CreateCompanyGroupSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'El payload de company no cumple el contrato v1.');
    }

    const input: CreateCompanyGroup = parsed.data;
    const normalized = {
      canonicalName: input.canonicalName,
      websiteRoot: input.websiteRoot ?? null,
    };
    const inputFingerprint = fingerprint(normalized);
    return this.dependencies.unitOfWork.execute(async () => {
      const stored = await this.dependencies.idempotency.get(
        principal.organizationId,
        'COMPANY_GROUP_CREATE',
        input.idempotencyKey,
      );
      if (stored) {
        if (stored.fingerprint !== inputFingerprint) {
          throw new CoreServiceError(
            'RHIA_CONTRACT_INVALID_PAYLOAD',
            409,
            'La idempotency key ya fue usada con otro payload.',
          );
        }
        if (stored.resource.resourceType !== 'COMPANY_GROUP') {
          throw new CoreServiceError('RHIA_CORE_UNEXPECTED_FAILURE', 409, 'El ledger idempotente contiene otro tipo de recurso.');
        }
        return { company: stored.resource.value, replayed: true };
      }

      const occurredAt = this.dependencies.now().toISOString();
      const company: CompanyGroup = {
        id: this.dependencies.newId(),
        organizationId: principal.organizationId,
        canonicalName: normalized.canonicalName,
        websiteRoot: normalized.websiteRoot,
        globalIdentityStatus: 'UNRESOLVED',
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      await this.dependencies.companies.create(company);
      await this.dependencies.audit.append({
        id: this.dependencies.newId(),
        organizationId: principal.organizationId,
        actorId: principal.id,
        actorType: principal.kind,
        action: 'COMPANY_GROUP_CREATED',
        resourceType: 'COMPANY_GROUP',
        resourceId: company.id,
        afterHash: fingerprint(company),
        occurredAt,
        correlationId,
      });
      await this.dependencies.idempotency.put(
        principal.organizationId,
        'COMPANY_GROUP_CREATE',
        input.idempotencyKey,
        { fingerprint: inputFingerprint, resource: { resourceType: 'COMPANY_GROUP', value: company } },
      );
      return { company, replayed: false };
    });
  }
}
