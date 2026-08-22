import { randomUUID } from 'node:crypto';
import { getErrorDefinition, type ErrorCode } from '@rhia/domain';
import type { Principal } from '@rhia/policy';
import { z } from 'zod';
import {
  ApprovalListResponseSchema, ApprovalResponseSchema, CompanyGroupListResponseSchema, CompanyGroupResponseSchema,
  ContactListResponseSchema, ContactResponseSchema, CoreApiErrorResponseSchema, JobListResponseSchema, JobResponseSchema,
  OpportunityListResponseSchema, OpportunityResponseSchema,
} from './contracts.js';
import { CompanyGroupService, CoreServiceError } from './company-service.js';
import { ApprovalService, JobService } from './control-services.js';
import { ContactService, OpportunityService } from './record-services.js';

export type CoreApiRequest = Readonly<{
  method: 'GET' | 'POST';
  path: string;
  principal: Principal;
  correlationId: string;
  body?: unknown;
}>;

export type CoreApiResponse = Readonly<{
  status: number;
  body: unknown;
}>;

export const normalizedError = (code: ErrorCode, message: string, correlationId: string, status: number): CoreApiResponse => {
  const definition = getErrorDefinition(code);
  const body = CoreApiErrorResponseSchema.parse({
    version: '1.0',
    error: {
      code,
      message,
      retryable: definition.retryable,
      correlationId,
      category: definition.category,
    },
  });
  return { status, body };
};

export class CoreApi {
  constructor(
    private readonly companies: CompanyGroupService,
    private readonly contacts: ContactService,
    private readonly opportunities: OpportunityService,
    private readonly jobs: JobService,
    private readonly approvals: ApprovalService,
  ) {}

  async handle(request: CoreApiRequest): Promise<CoreApiResponse> {
    const correlationId = z.string().uuid().safeParse(request.correlationId).success
      ? request.correlationId
      : randomUUID();
    try {
      if (request.path === '/api/v1/companies' && request.method === 'GET') {
        const data = await this.companies.list(request.principal);
        return { status: 200, body: CompanyGroupListResponseSchema.parse({ version: '1.0', data }) };
      }
      if (request.path === '/api/v1/companies' && request.method === 'POST') {
        const result = await this.companies.create(request.principal, request.body, correlationId);
        return {
          status: result.replayed ? 200 : 201,
          body: CompanyGroupResponseSchema.parse({
            version: '1.0',
            data: result.company,
            meta: { idempotentReplay: result.replayed },
          }),
        };
      }
      if (request.path === '/api/v1/contacts' && request.method === 'GET') {
        const data = await this.contacts.list(request.principal);
        return { status: 200, body: ContactListResponseSchema.parse({ version: '1.0', data }) };
      }
      if (request.path === '/api/v1/contacts' && request.method === 'POST') {
        const result = await this.contacts.create(request.principal, request.body, correlationId);
        return {
          status: result.replayed ? 200 : 201,
          body: ContactResponseSchema.parse({ version: '1.0', data: result.contact, meta: { idempotentReplay: result.replayed } }),
        };
      }
      if (request.path === '/api/v1/opportunities' && request.method === 'GET') {
        const data = await this.opportunities.list(request.principal);
        return { status: 200, body: OpportunityListResponseSchema.parse({ version: '1.0', data }) };
      }
      if (request.path === '/api/v1/opportunities' && request.method === 'POST') {
        const result = await this.opportunities.create(request.principal, request.body, correlationId);
        return {
          status: result.replayed ? 200 : 201,
          body: OpportunityResponseSchema.parse({
            version: '1.0', data: result.opportunity, meta: { idempotentReplay: result.replayed },
          }),
        };
      }
      if (request.path === '/api/v1/jobs' && request.method === 'GET') {
        const data = await this.jobs.list(request.principal);
        return { status: 200, body: JobListResponseSchema.parse({ version: '1.0', data }) };
      }
      if (request.path === '/api/v1/jobs' && request.method === 'POST') {
        const result = await this.jobs.create(request.principal, request.body, correlationId);
        return {
          status: result.replayed ? 200 : 201,
          body: JobResponseSchema.parse({ version: '1.0', data: result.job, meta: { idempotentReplay: result.replayed } }),
        };
      }
      if (request.path === '/api/v1/approvals' && request.method === 'GET') {
        const data = await this.approvals.list(request.principal);
        return { status: 200, body: ApprovalListResponseSchema.parse({ version: '1.0', data }) };
      }
      if (request.path === '/api/v1/approvals' && request.method === 'POST') {
        const result = await this.approvals.create(request.principal, request.body, correlationId);
        return {
          status: result.replayed ? 200 : 201,
          body: ApprovalResponseSchema.parse({ version: '1.0', data: result.approval, meta: { idempotentReplay: result.replayed } }),
        };
      }
      const decisionRoute = request.path.match(/^\/api\/v1\/approvals\/([0-9a-f-]{36})\/decisions$/i);
      if (decisionRoute?.[1] && request.method === 'POST') {
        const result = await this.approvals.decide(request.principal, decisionRoute[1], request.body, correlationId);
        return {
          status: result.replayed ? 200 : 201,
          body: ApprovalResponseSchema.parse({ version: '1.0', data: result.approval, meta: { idempotentReplay: result.replayed } }),
        };
      }
      return normalizedError('RHIA_CONTRACT_INVALID_PAYLOAD', 'Ruta o método no soportado por Core API v1.', correlationId, 404);
    } catch (error) {
      if (error instanceof CoreServiceError) {
        return normalizedError(error.code, error.message, correlationId, error.status);
      }
      if (error instanceof z.ZodError) {
        return normalizedError('RHIA_CONTRACT_INVALID_PAYLOAD', 'Core produjo una respuesta que no cumple el contrato v1.', correlationId, 500);
      }
      return normalizedError('RHIA_CORE_UNEXPECTED_FAILURE', 'Core no pudo completar la operación.', correlationId, 500);
    }
  }
}
