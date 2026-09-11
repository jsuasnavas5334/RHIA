import { randomUUID } from 'node:crypto';
import type { HumanRole } from '@rhia/policy';
import type { OperationsApproval, OperationsJob } from './operations-center.tsx';
import type { CompanyDetailData, CoreCompany, CoreContact, CoreOpportunity } from './crm-views.tsx';

type FetchLike = typeof fetch;
type JsonRecord = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jobStatuses = new Set<OperationsJob['status']>([
  'PENDING', 'QUEUED', 'RUNNING', 'RETRY_SCHEDULED', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED', 'DEAD_LETTER',
]);
const approvalStatuses = new Set<OperationsApproval['status']>(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']);
const approvalActions = new Set<OperationsApproval['action']>([
  'CHANGE_PRICE', 'GRANT_DISCOUNT', 'CHANGE_COMMERCIAL_TERMS', 'BINDING_COMMITMENT',
]);
const humanRoles = new Set<HumanRole>(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']);
const companyStatuses = new Set<CoreCompany['globalIdentityStatus']>(['UNRESOLVED', 'RESOLVED', 'AMBIGUOUS']);
const contactStatuses = new Set<CoreContact['status']>(['UNVERIFIED', 'VERIFIED', 'CONFLICTING']);

const isRecord = (value: unknown): value is JsonRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const requiredText = (record: JsonRecord, key: string, max = 1000): string => {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new CoreClientError(502, 'Core devolvió una respuesta inválida.');
  return value;
};
const requiredNumber = (record: JsonRecord, key: string): number => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new CoreClientError(502, 'Core devolvió una respuesta inválida.');
  return value;
};
const optionalText = (record: JsonRecord, key: string, max = 500): string | null => {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > max) throw new CoreClientError(502, 'Core devolvió una respuesta inválida.');
  return value;
};

const safeOrigin = (value: string): string => {
  const url = new URL(value);
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1';
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) {
    throw new TypeError('RHIA_CORE_API_URL debe usar HTTPS o HTTP loopback sin credenciales embebidas.');
  }
  url.pathname = '/';
  return url.toString();
};

const traceFor = (status: OperationsJob['status']): string => ({
  PENDING: 'En espera; todavía no inició ningún paso.',
  QUEUED: 'Asignado a la cola y pendiente de ejecución.',
  RUNNING: 'Ejecución activa; el detalle técnico permanece en la traza Core.',
  RETRY_SCHEDULED: 'Un reintento idempotente quedó programado.',
  SUCCEEDED: 'La ejecución terminó correctamente.',
  PARTIAL: 'Terminó con resultados parciales; revisa evidencia antes de reintentar.',
  FAILED: 'La ejecución falló sin continuar acciones posteriores.',
  CANCELLED: 'Cancelado antes de iniciar nuevos pasos.',
  DEAD_LETTER: 'Agotó los intentos permitidos y requiere revisión humana.',
})[status];

export class CoreClientError extends Error {
  public constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'CoreClientError';
  }
}

export class RhiaCoreClient {
  private readonly origin: string;

  public constructor(origin: string, private readonly fetcher: FetchLike = fetch) {
    this.origin = safeOrigin(origin);
  }

  private async request(path: string, cookieHeader: string, body?: JsonRecord): Promise<JsonRecord> {
    if (!cookieHeader.trim()) throw new CoreClientError(401, 'Inicia sesión para continuar.');
    const response = await this.fetcher(new URL(path, this.origin), {
      method: body ? 'POST' : 'GET',
      headers: {
        cookie: cookieHeader,
        'x-correlation-id': randomUUID(),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      redirect: 'error',
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = isRecord(payload) && isRecord(payload['error']) ? payload['error'] : undefined;
      const message = error && typeof error['message'] === 'string' && error['message'].length <= 500
        ? error['message'] : 'Core no pudo completar la operación.';
      throw new CoreClientError(response.status, message);
    }
    if (!isRecord(payload)) throw new CoreClientError(502, 'Core devolvió una respuesta inválida.');
    return payload;
  }

  public async listJobs(cookieHeader: string): Promise<readonly OperationsJob[]> {
    const payload = await this.request('/api/v1/jobs', cookieHeader);
    if (!Array.isArray(payload['data'])) throw new CoreClientError(502, 'Core devolvió una lista de jobs inválida.');
    return payload['data'].map((value): OperationsJob => {
      if (!isRecord(value)) throw new CoreClientError(502, 'Core devolvió un job inválido.');
      const status = requiredText(value, 'status') as OperationsJob['status'];
      if (!jobStatuses.has(status)) throw new CoreClientError(502, 'Core devolvió un estado de job inválido.');
      return {
        id: requiredText(value, 'id', 36), jobType: requiredText(value, 'jobType', 80), status,
        agentLabel: 'Agente sin asignar', updatedAt: requiredText(value, 'updatedAt', 50),
        retryCount: requiredNumber(value, 'retryCount'), traceSummary: traceFor(status),
      };
    });
  }

  public async getSession(cookieHeader: string): Promise<Readonly<{ roles: readonly HumanRole[] }>> {
    const payload = await this.request('/api/v1/session', cookieHeader);
    const data = payload['data'];
    if (!isRecord(data) || !Array.isArray(data['roles']) || data['roles'].length === 0
      || data['roles'].some((role) => typeof role !== 'string' || !humanRoles.has(role as HumanRole))) {
      throw new CoreClientError(502, 'Core devolvió una sesión inválida.');
    }
    return { roles: data['roles'] as HumanRole[] };
  }

  public async listApprovals(cookieHeader: string): Promise<readonly OperationsApproval[]> {
    const payload = await this.request('/api/v1/approvals', cookieHeader);
    if (!Array.isArray(payload['data'])) throw new CoreClientError(502, 'Core devolvió una lista de approvals inválida.');
    return payload['data'].map((value): OperationsApproval => {
      if (!isRecord(value)) throw new CoreClientError(502, 'Core devolvió una approval inválida.');
      const status = requiredText(value, 'status') as OperationsApproval['status'];
      const action = requiredText(value, 'action') as OperationsApproval['action'];
      if (!approvalStatuses.has(status) || !approvalActions.has(action)) throw new CoreClientError(502, 'Core devolvió una approval inválida.');
      return {
        id: requiredText(value, 'id', 36), action, status, summary: requiredText(value, 'summary'),
        reasonCode: requiredText(value, 'reasonCode', 120), requestedByLabel: 'Identidad autenticada',
        requestedAt: requiredText(value, 'requestedAt', 50), targetLabel: 'Recurso comercial protegido',
      };
    });
  }

  private companyFrom(value: unknown): CoreCompany {
    if (!isRecord(value)) throw new CoreClientError(502, 'Core devolvió una company inválida.');
    const globalIdentityStatus = requiredText(value, 'globalIdentityStatus') as CoreCompany['globalIdentityStatus'];
    if (!companyStatuses.has(globalIdentityStatus)) throw new CoreClientError(502, 'Core devolvió una company inválida.');
    return {
      id: requiredText(value, 'id', 36), canonicalName: requiredText(value, 'canonicalName', 240),
      websiteRoot: optionalText(value, 'websiteRoot', 500), globalIdentityStatus,
    };
  }

  private contactFrom(value: unknown): CoreContact {
    if (!isRecord(value)) throw new CoreClientError(502, 'Core devolvió un contact inválido.');
    const status = requiredText(value, 'status') as CoreContact['status'];
    if (!contactStatuses.has(status)) throw new CoreClientError(502, 'Core devolvió un contact inválido.');
    return {
      id: requiredText(value, 'id', 36), companyGroupId: requiredText(value, 'companyGroupId', 36),
      fullName: requiredText(value, 'fullName', 240), title: optionalText(value, 'title', 240),
      countryCode: optionalText(value, 'countryCode', 2), city: optionalText(value, 'city', 120), status,
    };
  }

  private opportunityFrom(value: unknown): CoreOpportunity {
    if (!isRecord(value)) throw new CoreClientError(502, 'Core devolvió una opportunity inválida.');
    return {
      id: requiredText(value, 'id', 36), companyGroupId: requiredText(value, 'companyGroupId', 36),
      marketCountry: requiredText(value, 'marketCountry', 2), marketCity: optionalText(value, 'marketCity', 120),
      stage: requiredText(value, 'stage') as CoreOpportunity['stage'], score: requiredNumber(value, 'score'),
      status: requiredText(value, 'status') as CoreOpportunity['status'],
    };
  }

  public async listCompanies(cookieHeader: string): Promise<readonly CoreCompany[]> {
    const payload = await this.request('/api/v1/companies', cookieHeader);
    if (!Array.isArray(payload['data'])) throw new CoreClientError(502, 'Core devolvió una lista de companies inválida.');
    return payload['data'].map((value) => this.companyFrom(value));
  }

  public async listContacts(cookieHeader: string): Promise<readonly CoreContact[]> {
    const payload = await this.request('/api/v1/contacts', cookieHeader);
    if (!Array.isArray(payload['data'])) throw new CoreClientError(502, 'Core devolvió una lista de contacts inválida.');
    return payload['data'].map((value) => this.contactFrom(value));
  }

  public async listOpportunities(cookieHeader: string): Promise<readonly CoreOpportunity[]> {
    const payload = await this.request('/api/v1/opportunities', cookieHeader);
    if (!Array.isArray(payload['data'])) throw new CoreClientError(502, 'Core devolvió una lista de opportunities inválida.');
    return payload['data'].map((value) => this.opportunityFrom(value));
  }

  public async getCompany(cookieHeader: string, companyId: string): Promise<CompanyDetailData> {
    if (!UUID.test(companyId)) throw new CoreClientError(400, 'La company seleccionada no es válida.');
    const payload = await this.request(`/api/v1/companies/${companyId}`, cookieHeader);
    const data = payload['data'];
    if (!isRecord(data) || !Array.isArray(data['contacts']) || !Array.isArray(data['opportunities']) || !Array.isArray(data['timeline'])) {
      throw new CoreClientError(502, 'Core devolvió un Company 360 inválido.');
    }
    return {
      company: this.companyFrom(data['company']),
      contacts: data['contacts'].map((value) => this.contactFrom(value)),
      opportunities: data['opportunities'].map((value) => this.opportunityFrom(value)),
      timeline: data['timeline'].map((value): CompanyDetailData['timeline'][number] => {
        if (!isRecord(value)) throw new CoreClientError(502, 'Core devolvió un evento de timeline inválido.');
        return {
          id: requiredText(value, 'id', 36), action: requiredText(value, 'action', 80),
          resourceType: requiredText(value, 'resourceType', 40), resourceId: requiredText(value, 'resourceId', 36),
          occurredAt: requiredText(value, 'occurredAt', 50),
        };
      }),
    };
  }

  public async commandJob(cookieHeader: string, jobId: string, command: 'retry' | 'cancel', reason?: string): Promise<void> {
    if (!UUID.test(jobId)) throw new CoreClientError(400, 'El job seleccionado no es válido.');
    await this.request(`/api/v1/jobs/${jobId}/${command}`, cookieHeader, {
      idempotencyKey: randomUUID(), ...(reason ? { reason } : {}),
    });
  }

  public async decideApproval(cookieHeader: string, approvalId: string, decision: 'APPROVED' | 'REJECTED', reason: string): Promise<void> {
    if (!UUID.test(approvalId) || reason.trim().length === 0 || reason.length > 1000) {
      throw new CoreClientError(400, 'La decisión requiere una approval válida y un motivo.');
    }
    await this.request(`/api/v1/approvals/${approvalId}/decisions`, cookieHeader, {
      decision, reason: reason.trim(), idempotencyKey: randomUUID(),
    });
  }
}
