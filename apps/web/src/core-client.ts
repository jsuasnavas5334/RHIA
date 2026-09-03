import { randomUUID } from 'node:crypto';
import type { HumanRole } from '@rhia/policy';
import type { OperationsApproval, OperationsJob } from './operations-center.tsx';

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
