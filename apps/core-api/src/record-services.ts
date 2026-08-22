import { createHash } from 'node:crypto';
import { authorize, type Principal } from '@rhia/policy';
import {
  CreateContactSchema,
  CreateOpportunitySchema,
  type Contact,
  type CreateContact,
  type CreateOpportunity,
  type Opportunity,
} from './contracts.js';
import { CoreServiceError } from './company-service.js';
import type { CoreDependencies, IdempotentResource } from './ports.js';

const hash = (value: object): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const requireRecords = (principal: Principal, mode: 'read' | 'write'): void => {
  const decision = authorize(principal, mode === 'read' ? 'READ_OPERATIONS' : 'WRITE_OPERATIONS');
  if (decision.outcome !== 'ALLOW') {
    throw new CoreServiceError(decision.code ?? 'RHIA_POLICY_DENIED', 403, decision.reason);
  }
};

const replay = <T>(
  stored: Readonly<{ fingerprint: string; resource: IdempotentResource }> | undefined,
  expectedFingerprint: string,
  resourceType: IdempotentResource['resourceType'],
): T | undefined => {
  if (!stored) return undefined;
  if (stored.fingerprint !== expectedFingerprint) {
    throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 409, 'La idempotency key ya fue usada con otro payload.');
  }
  if (stored.resource.resourceType !== resourceType) {
    throw new CoreServiceError('RHIA_CORE_UNEXPECTED_FAILURE', 409, 'El ledger idempotente contiene otro tipo de recurso.');
  }
  return stored.resource.value as T;
};

export class ContactService {
  constructor(private readonly dependencies: CoreDependencies) {}

  async list(principal: Principal): Promise<readonly Contact[]> {
    requireRecords(principal, 'read');
    return this.dependencies.contacts.listByOrganization(principal.organizationId);
  }

  async create(principal: Principal, raw: unknown, correlationId: string): Promise<Readonly<{ contact: Contact; replayed: boolean }>> {
    requireRecords(principal, 'write');
    const parsed = CreateContactSchema.safeParse(raw);
    if (!parsed.success) throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'El payload de contact no cumple el contrato v1.');
    const input: CreateContact = parsed.data;
    const normalized = {
      companyGroupId: input.companyGroupId,
      companyEntityId: input.companyEntityId ?? null,
      fullName: input.fullName,
      title: input.title ?? null,
      department: input.department ?? null,
      seniority: input.seniority ?? null,
      countryCode: input.countryCode ?? null,
      city: input.city ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
    };
    const fingerprint = hash(normalized);
    return this.dependencies.unitOfWork.execute(async () => {
      const stored = await this.dependencies.idempotency.get(principal.organizationId, 'CONTACT_CREATE', input.idempotencyKey);
      const prior = replay<Contact>(stored, fingerprint, 'CONTACT');
      if (prior) return { contact: prior, replayed: true };

      const occurredAt = this.dependencies.now().toISOString();
      const contact: Contact = {
        id: this.dependencies.newId(),
        organizationId: principal.organizationId,
        ...normalized,
        status: 'UNVERIFIED',
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      await this.dependencies.contacts.create(contact);
      await this.dependencies.audit.append({
        id: this.dependencies.newId(), organizationId: principal.organizationId, actorId: principal.id, actorType: principal.kind,
        action: 'CONTACT_CREATED', resourceType: 'CONTACT', resourceId: contact.id, afterHash: hash(contact), occurredAt, correlationId,
      });
      await this.dependencies.idempotency.put(principal.organizationId, 'CONTACT_CREATE', input.idempotencyKey, {
        fingerprint, resource: { resourceType: 'CONTACT', value: contact },
      });
      return { contact, replayed: false };
    });
  }
}

export class OpportunityService {
  constructor(private readonly dependencies: CoreDependencies) {}

  async list(principal: Principal): Promise<readonly Opportunity[]> {
    requireRecords(principal, 'read');
    return this.dependencies.opportunities.listByOrganization(principal.organizationId);
  }

  async create(
    principal: Principal,
    raw: unknown,
    correlationId: string,
  ): Promise<Readonly<{ opportunity: Opportunity; replayed: boolean }>> {
    requireRecords(principal, 'write');
    const parsed = CreateOpportunitySchema.safeParse(raw);
    if (!parsed.success) throw new CoreServiceError('RHIA_CONTRACT_INVALID_PAYLOAD', 400, 'El payload de opportunity no cumple el contrato v1.');
    const input: CreateOpportunity = parsed.data;
    const normalized = {
      companyGroupId: input.companyGroupId,
      primaryEntityId: input.primaryEntityId ?? null,
      marketCountry: input.marketCountry,
      marketCity: input.marketCity ?? null,
      ownerUserId: input.ownerUserId ?? null,
      nextActionAt: input.nextActionAt ?? null,
    };
    const fingerprint = hash(normalized);
    return this.dependencies.unitOfWork.execute(async () => {
      const stored = await this.dependencies.idempotency.get(principal.organizationId, 'OPPORTUNITY_CREATE', input.idempotencyKey);
      const prior = replay<Opportunity>(stored, fingerprint, 'OPPORTUNITY');
      if (prior) return { opportunity: prior, replayed: true };

      const occurredAt = this.dependencies.now().toISOString();
      const opportunity: Opportunity = {
        id: this.dependencies.newId(),
        organizationId: principal.organizationId,
        ...normalized,
        stage: 'DISCOVERED',
        score: 0,
        scoreVersion: 'core-v1',
        status: 'OPEN',
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      await this.dependencies.opportunities.create(opportunity);
      await this.dependencies.audit.append({
        id: this.dependencies.newId(), organizationId: principal.organizationId, actorId: principal.id, actorType: principal.kind,
        action: 'OPPORTUNITY_CREATED', resourceType: 'OPPORTUNITY', resourceId: opportunity.id,
        afterHash: hash(opportunity), occurredAt, correlationId,
      });
      await this.dependencies.idempotency.put(principal.organizationId, 'OPPORTUNITY_CREATE', input.idempotencyKey, {
        fingerprint, resource: { resourceType: 'OPPORTUNITY', value: opportunity },
      });
      return { opportunity, replayed: false };
    });
  }
}
