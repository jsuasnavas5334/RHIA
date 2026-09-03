import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type { Principal } from '@rhia/policy';
import { CoreApi } from './api.js';
import { CompanyGroupService } from './company-service.js';
import { ApprovalService, JobService } from './control-services.js';
import { createCoreHttpServer, type PrincipalAuthenticator } from './http-server.js';
import {
  MemoryApprovalRepository, MemoryAuditSink, MemoryCompanyGroupRepository, MemoryContactRepository, MemoryIdempotencyStore,
  MemoryJobRepository, MemoryOpportunityRepository, MemorySearchHealthRepository, MemoryUnitOfWork,
} from './memory-adapters.js';
import { ContactService, OpportunityService } from './record-services.js';
import { SearchHealthService } from './search-health-service.js';

const organizationA = '11111111-1111-4111-8111-111111111111';
const organizationB = '22222222-2222-4222-8222-222222222222';
const manager: Principal = {
  kind: 'HUMAN',
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  organizationId: organizationA,
  roles: ['MANAGER'],
};
const viewer: Principal = {
  kind: 'HUMAN',
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  organizationId: organizationA,
  roles: ['VIEWER'],
};
const otherManager: Principal = { ...manager, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', organizationId: organizationB };
const agent: Principal = {
  kind: 'SERVICE', id: 'abababab-abab-4bab-8bab-abababababab', organizationId: organizationA,
  service: 'AGENT_SERVICE', capabilities: ['records.read', 'jobs.execute', 'approvals.request'],
};
const correlationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const fixture = () => {
  const companies = new MemoryCompanyGroupRepository();
  const contacts = new MemoryContactRepository();
  const opportunities = new MemoryOpportunityRepository();
  const jobs = new MemoryJobRepository();
  const approvals = new MemoryApprovalRepository();
  const idempotency = new MemoryIdempotencyStore();
  const audit = new MemoryAuditSink();
  const searchHealth = new MemorySearchHealthRepository();
  const ids = [
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '12345678-1234-4234-8234-123456789abc',
    'abcdefab-cdef-4abc-8def-abcdefabcdef',
  ];
  const dependencies = {
    companies,
    contacts,
    opportunities,
    jobs,
    approvals,
    idempotency,
    audit,
    unitOfWork: new MemoryUnitOfWork(),
    searchHealth,
    newId: () => ids.shift() ?? '99999999-9999-4999-8999-999999999999',
    now: () => new Date('2026-08-21T14:00:00.000Z'),
  };
  return {
    api: new CoreApi(
      new CompanyGroupService(dependencies), new ContactService(dependencies), new OpportunityService(dependencies),
      new JobService(dependencies), new ApprovalService(dependencies), new SearchHealthService(dependencies),
    ),
    companies,
    contacts,
    opportunities,
    jobs,
    approvals,
    audit,
    searchHealth,
  };
};

const withHttpServer = async (
  run: (origin: string) => Promise<void>,
  authenticate: PrincipalAuthenticator = async () => manager,
  maxBodyBytes?: number,
): Promise<void> => {
  const { api } = fixture();
  const server = createCoreHttpServer(api, { authenticate, ...(maxBodyBytes === undefined ? {} : { maxBodyBytes }) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
};

test('POST /api/v1/companies crea y audita una company group', async () => {
  const { api, companies, audit } = fixture();
  const response = await api.handle({
    method: 'POST',
    path: '/api/v1/companies',
    principal: manager,
    correlationId,
    body: { canonicalName: 'Empresa Andina', websiteRoot: 'https://example.com', idempotencyKey: 'company:andina:001' },
  });
  assert.equal(response.status, 201);
  assert.equal(companies.records.length, 1);
  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0]?.action, 'COMPANY_GROUP_CREATED');
  assert.equal(audit.events[0]?.correlationId, correlationId);
});

test('retry idempotente devuelve el mismo recurso y no duplica audit', async () => {
  const { api, companies, audit } = fixture();
  const request = {
    method: 'POST' as const,
    path: '/api/v1/companies',
    principal: manager,
    correlationId,
    body: { canonicalName: 'Empresa Andina', idempotencyKey: 'company:andina:retry' },
  };
  const created = await api.handle(request);
  const replayed = await api.handle(request);
  assert.equal(created.status, 201);
  assert.equal(replayed.status, 200);
  assert.deepEqual((replayed.body as { data: unknown }).data, (created.body as { data: unknown }).data);
  assert.equal(companies.records.length, 1);
  assert.equal(audit.events.length, 1);
});

test('reutilizar idempotency key con otro payload produce conflicto normalizado', async () => {
  const { api } = fixture();
  await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Empresa Uno', idempotencyKey: 'company:shared:key' },
  });
  const conflict = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Empresa Dos', idempotencyKey: 'company:shared:key' },
  });
  assert.equal(conflict.status, 409);
  assert.equal((conflict.body as { error: { code: string } }).error.code, 'RHIA_CONTRACT_INVALID_PAYLOAD');
});

test('viewer y service sin capability no pueden escribir', async () => {
  const { api } = fixture();
  const body = { canonicalName: 'Empresa Andina', idempotencyKey: 'company:denied:001' };
  const viewerResponse = await api.handle({ method: 'POST', path: '/api/v1/companies', principal: viewer, correlationId, body });
  const serviceResponse = await api.handle({
    method: 'POST', path: '/api/v1/companies', correlationId, body,
    principal: { kind: 'SERVICE', id: 'agent-1', organizationId: organizationA, service: 'AGENT_SERVICE', capabilities: ['records.read'] },
  });
  assert.equal(viewerResponse.status, 403);
  assert.equal(serviceResponse.status, 403);
  assert.equal((viewerResponse.body as { error: { code: string } }).error.code, 'RHIA_POLICY_DENIED');
  assert.equal((serviceResponse.body as { error: { code: string } }).error.code, 'RHIA_TOOL_FORBIDDEN');
});

test('listado aplica aislamiento por organizationId', async () => {
  const { api } = fixture();
  await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Tenant A', idempotencyKey: 'company:tenant:a' },
  });
  await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: otherManager, correlationId,
    body: { canonicalName: 'Tenant B', idempotencyKey: 'company:tenant:b' },
  });
  const response = await api.handle({ method: 'GET', path: '/api/v1/companies', principal: manager, correlationId });
  const data = (response.body as { data: readonly { organizationId: string }[] }).data;
  assert.equal(response.status, 200);
  assert.equal(data.length, 1);
  assert.equal(data[0]?.organizationId, organizationA);
});

test('payload inválido y ruta desconocida usan error RHIA normalizado', async () => {
  const { api } = fixture();
  const invalid = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: '', idempotencyKey: 'short' },
  });
  const unknown = await api.handle({ method: 'GET', path: '/api/v2/companies', principal: manager, correlationId });
  assert.equal(invalid.status, 400);
  assert.equal(unknown.status, 404);
  assert.equal((invalid.body as { error: { category: string } }).error.category, 'VALIDATION');
  assert.equal((unknown.body as { error: { code: string } }).error.code, 'RHIA_CONTRACT_INVALID_PAYLOAD');
});

test('session context expone solo roles humanos autenticados', async () => {
  const { api } = fixture();
  const human = await api.handle({ method: 'GET', path: '/api/v1/session', principal: manager, correlationId });
  const service = await api.handle({ method: 'GET', path: '/api/v1/session', principal: agent, correlationId });
  assert.deepEqual((human.body as { data: { roles: string[] } }).data.roles, ['MANAGER']);
  assert.equal(JSON.stringify(human.body).includes(organizationA), false);
  assert.equal(service.status, 403);
});

test('contacts nacen UNVERIFIED, se auditan y son idempotentes', async () => {
  const { api, contacts, audit } = fixture();
  const request = {
    method: 'POST' as const, path: '/api/v1/contacts', principal: manager, correlationId,
    body: {
      companyGroupId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', fullName: 'Ana Torres', countryCode: 'EC',
      linkedinUrl: 'https://www.linkedin.com/in/ana-torres', idempotencyKey: 'contact:ana:001',
    },
  };
  const created = await api.handle(request);
  const replayed = await api.handle(request);
  assert.equal(created.status, 201);
  assert.equal(replayed.status, 200);
  assert.equal(contacts.records[0]?.status, 'UNVERIFIED');
  assert.equal(contacts.records.length, 1);
  assert.equal(audit.events.filter((event) => event.action === 'CONTACT_CREATED').length, 1);
});

test('GET /api/v1/search-health alimenta computeEngineHealthScores con el historial real (PH06-T001)', async () => {
  const { api, searchHealth } = fixture();
  const recent = (hoursAgo: number) => new Date(new Date('2026-08-21T14:00:00.000Z').getTime() - hoursAgo * 60 * 60 * 1000).toISOString();
  for (let index = 0; index < 5; index += 1) {
    searchHealth.events.push({ component: 'search_engine:duckduckgo', status: 'OK', occurredAt: recent(index) });
  }
  for (let index = 0; index < 3; index += 1) {
    searchHealth.events.push({ component: 'search_engine:google cse', status: 'CAPTCHA', occurredAt: recent(index) });
  }
  searchHealth.events.push({ component: 'search_engine:startpage', status: 'OK', occurredAt: recent(0) });

  const response = await api.handle({ method: 'GET', path: '/api/v1/search-health', principal: manager, correlationId });
  assert.equal(response.status, 200);
  const body = response.body as {
    data: readonly { engine: string; score: number | null; classification: string; sampleWeight: number; eventCount: number }[];
    meta: { windowDays: number; halfLifeHours: number; generatedAt: string };
  };
  const byEngine = new Map(body.data.map((entry) => [entry.engine, entry]));
  assert.equal(byEngine.get('duckduckgo')?.classification, 'SALUDABLE');
  assert.equal(byEngine.get('duckduckgo')?.score, 1);
  assert.equal(byEngine.get('google cse')?.classification, 'DEGRADADO');
  assert.equal(byEngine.get('google cse')?.score, 0);
  assert.equal(byEngine.get('startpage')?.classification, 'SIN_DATOS_SUFICIENTES');
  assert.equal(body.meta.windowDays, 14);
  assert.equal(body.meta.generatedAt, '2026-08-21T14:00:00.000Z');
});

test('GET /api/v1/search-health sin eventos devuelve lista vacía, no error', async () => {
  const { api } = fixture();
  const response = await api.handle({ method: 'GET', path: '/api/v1/search-health', principal: manager, correlationId });
  assert.equal(response.status, 200);
  assert.deepEqual((response.body as { data: unknown[] }).data, []);
});

test('GET /api/v1/search-health requiere records.read', async () => {
  const { api } = fixture();
  const response = await api.handle({
    method: 'GET', path: '/api/v1/search-health', correlationId,
    principal: { kind: 'SERVICE', id: 'agent-2', organizationId: organizationA, service: 'AGENT_SERVICE', capabilities: ['jobs.execute'] },
  });
  assert.equal(response.status, 403);
  assert.equal((response.body as { error: { code: string } }).error.code, 'RHIA_TOOL_FORBIDDEN');
});

test('opportunities nacen DISCOVERED/OPEN con score cero', async () => {
  const { api, opportunities, audit } = fixture();
  const created = await api.handle({
    method: 'POST', path: '/api/v1/opportunities', principal: manager, correlationId,
    body: {
      companyGroupId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', marketCountry: 'PE', marketCity: 'Lima',
      idempotencyKey: 'opportunity:lima:001',
    },
  });
  assert.equal(created.status, 201);
  assert.equal(opportunities.records[0]?.stage, 'DISCOVERED');
  assert.equal(opportunities.records[0]?.status, 'OPEN');
  assert.equal(opportunities.records[0]?.score, 0);
  assert.equal(audit.events.some((event) => event.action === 'OPPORTUNITY_CREATED'), true);
});

test('contacts y opportunities rechazan writes de viewer', async () => {
  const { api } = fixture();
  const contact = await api.handle({
    method: 'POST', path: '/api/v1/contacts', principal: viewer, correlationId,
    body: { companyGroupId: organizationA, fullName: 'No Permitido', idempotencyKey: 'contact:denied:001' },
  });
  const opportunity = await api.handle({
    method: 'POST', path: '/api/v1/opportunities', principal: viewer, correlationId,
    body: { companyGroupId: organizationA, marketCountry: 'EC', idempotencyKey: 'opportunity:denied:001' },
  });
  assert.equal(contact.status, 403);
  assert.equal(opportunity.status, 403);
});

test('listados contacts y opportunities aíslan tenants', async () => {
  const { api } = fixture();
  await api.handle({
    method: 'POST', path: '/api/v1/contacts', principal: manager, correlationId,
    body: { companyGroupId: organizationA, fullName: 'Tenant A', idempotencyKey: 'contact:tenant:a' },
  });
  await api.handle({
    method: 'POST', path: '/api/v1/contacts', principal: otherManager, correlationId,
    body: { companyGroupId: organizationB, fullName: 'Tenant B', idempotencyKey: 'contact:tenant:b' },
  });
  await api.handle({
    method: 'POST', path: '/api/v1/opportunities', principal: manager, correlationId,
    body: { companyGroupId: organizationA, marketCountry: 'EC', idempotencyKey: 'opportunity:tenant:a' },
  });
  const contacts = await api.handle({ method: 'GET', path: '/api/v1/contacts', principal: manager, correlationId });
  const opportunities = await api.handle({ method: 'GET', path: '/api/v1/opportunities', principal: manager, correlationId });
  assert.equal((contacts.body as { data: unknown[] }).data.length, 1);
  assert.equal((opportunities.body as { data: unknown[] }).data.length, 1);
});

test('job válido nace PENDING, se audita y respeta START_JOB', async () => {
  const { api, jobs, audit } = fixture();
  const body = {
    jobType: 'RESOLVE_ENTITY',
    input: { companyMentioned: 'Empresa Andina', resolutionQueries: ['Empresa Andina Ecuador'] },
    priority: 70,
    idempotencyKey: 'job:resolve:andina:001',
  };
  const created = await api.handle({ method: 'POST', path: '/api/v1/jobs', principal: agent, correlationId, body });
  const replayed = await api.handle({ method: 'POST', path: '/api/v1/jobs', principal: agent, correlationId, body });
  const denied = await api.handle({ method: 'POST', path: '/api/v1/jobs', principal: viewer, correlationId, body });
  assert.equal(created.status, 201);
  assert.equal(replayed.status, 200);
  assert.equal(denied.status, 403);
  assert.equal(jobs.records[0]?.status, 'PENDING');
  assert.equal(jobs.records.length, 1);
  assert.equal(audit.events.filter((event) => event.action === 'JOB_CREATED').length, 1);
});

test('retry de job fallido es idempotente y agenda un solo intento', async () => {
  const { api, jobs, audit } = fixture();
  const created = await api.handle({
    method: 'POST', path: '/api/v1/jobs', principal: agent, correlationId,
    body: {
      jobType: 'RESOLVE_ENTITY',
      input: { companyMentioned: 'Empresa Retry', resolutionQueries: ['Empresa Retry Ecuador'] },
      idempotencyKey: 'job:retry:create:001',
    },
  });
  const jobId = (created.body as { data: { id: string } }).data.id;
  const current = jobs.records[0];
  assert.ok(current);
  jobs.records[0] = { ...current, status: 'FAILED', completedAt: '2026-08-21T20:00:00.000Z' };
  const request = {
    method: 'POST' as const, path: `/api/v1/jobs/${jobId}/retry`, principal: manager, correlationId,
    body: { idempotencyKey: 'job:retry:command:001' },
  };

  const first = await api.handle(request);
  const replay = await api.handle(request);

  assert.equal(first.status, 200);
  assert.equal(replay.status, 200);
  assert.equal((first.body as { meta: { idempotentReplay: boolean } }).meta.idempotentReplay, false);
  assert.equal((replay.body as { meta: { idempotentReplay: boolean } }).meta.idempotentReplay, true);
  assert.equal(jobs.records[0]?.status, 'RETRY_SCHEDULED');
  assert.equal(jobs.records[0]?.retryCount, 1);
  assert.equal(audit.events.filter((event) => event.action === 'JOB_RETRY_SCHEDULED').length, 1);
});

test('cancel detiene un job no iniciado y bloquea nuevos pasos o usuarios sin permiso', async () => {
  const { api, jobs, audit } = fixture();
  const created = await api.handle({
    method: 'POST', path: '/api/v1/jobs', principal: agent, correlationId,
    body: {
      jobType: 'RESEARCH_COMPANY', input: { companyName: 'Empresa Cancel', countryCode: 'EC', urlsToVerify: [] },
      idempotencyKey: 'job:cancel:create:001',
    },
  });
  const jobId = (created.body as { data: { id: string } }).data.id;
  const body = { reason: 'Ya no es necesario', idempotencyKey: 'job:cancel:command:001' };
  const denied = await api.handle({ method: 'POST', path: `/api/v1/jobs/${jobId}/cancel`, principal: viewer, correlationId, body });
  const cancelled = await api.handle({ method: 'POST', path: `/api/v1/jobs/${jobId}/cancel`, principal: manager, correlationId, body });
  const replayed = await api.handle({ method: 'POST', path: `/api/v1/jobs/${jobId}/cancel`, principal: manager, correlationId, body });
  const retryBlocked = await api.handle({
    method: 'POST', path: `/api/v1/jobs/${jobId}/retry`, principal: manager, correlationId,
    body: { idempotencyKey: 'job:retry:cancelled:001' },
  });
  const approvalBlocked = await api.handle({
    method: 'POST', path: '/api/v1/approvals', principal: agent, correlationId,
    body: {
      jobId, action: 'BINDING_COMMITMENT', reasonCode: 'RHIA_APPROVAL_CANCELLED_JOB',
      summary: 'No debe continuar tras cancelar', targetRef: organizationA,
      idempotencyKey: 'approval:cancelled:001',
    },
  });

  assert.equal(denied.status, 403);
  assert.equal(cancelled.status, 200);
  assert.equal((replayed.body as { meta: { idempotentReplay: boolean } }).meta.idempotentReplay, true);
  assert.equal(retryBlocked.status, 409);
  assert.equal(approvalBlocked.status, 409);
  assert.equal(jobs.records[0]?.status, 'CANCELLED');
  assert.equal(jobs.records[0]?.nextAttemptAt, null);
  assert.equal(audit.events.filter((event) => event.action === 'JOB_CANCELLED').length, 1);
});

test('jobType rechaza input de otro contrato', async () => {
  const { api } = fixture();
  const response = await api.handle({
    method: 'POST', path: '/api/v1/jobs', principal: agent, correlationId,
    body: { jobType: 'VERIFY_PERSON', input: { companyMentioned: 'Campo incorrecto' }, idempotencyKey: 'job:invalid:001' },
  });
  assert.equal(response.status, 400);
  assert.equal((response.body as { error: { code: string } }).error.code, 'RHIA_CONTRACT_INVALID_PAYLOAD');
});

test('agent solicita approval pero no puede listar ni decidir', async () => {
  const { api, approvals, audit } = fixture();
  const job = await api.handle({
    method: 'POST', path: '/api/v1/jobs', principal: agent, correlationId,
    body: {
      jobType: 'RESOLVE_ENTITY', input: { companyMentioned: 'Approval Agent', resolutionQueries: ['Approval Agent Ecuador'] },
      idempotencyKey: 'job:approval:agent:001',
    },
  });
  const created = await api.handle({
    method: 'POST', path: '/api/v1/approvals', principal: agent, correlationId,
    body: {
      jobId: (job.body as { data: { id: string } }).data.id, action: 'CHANGE_PRICE',
      reasonCode: 'RHIA_APPROVAL_PRICE_CHANGE', summary: 'Revisar ajuste propuesto',
      targetRef: '34343434-3434-4434-8434-343434343434', idempotencyKey: 'approval:price:001',
    },
  });
  const approvalId = (created.body as { data: { id: string } }).data.id;
  const listDenied = await api.handle({ method: 'GET', path: '/api/v1/approvals', principal: agent, correlationId });
  const decisionDenied = await api.handle({
    method: 'POST', path: `/api/v1/approvals/${approvalId}/decisions`, principal: agent, correlationId,
    body: { decision: 'APPROVED', idempotencyKey: 'approval:decision:agent' },
  });
  assert.equal(created.status, 201);
  assert.equal(listDenied.status, 403);
  assert.equal(decisionDenied.status, 403);
  assert.equal(approvals.records[0]?.status, 'PENDING');
  assert.equal(audit.events.some((event) => event.action === 'APPROVAL_REQUESTED'), true);
});

test('manager decide approval una sola vez sin ejecutar la acción comercial', async () => {
  const { api, approvals, audit } = fixture();
  const job = await api.handle({
    method: 'POST', path: '/api/v1/jobs', principal: agent, correlationId,
    body: {
      jobType: 'RESOLVE_ENTITY', input: { companyMentioned: 'Approval Manager', resolutionQueries: ['Approval Manager Ecuador'] },
      idempotencyKey: 'job:approval:manager:001',
    },
  });
  const created = await api.handle({
    method: 'POST', path: '/api/v1/approvals', principal: agent, correlationId,
    body: {
      jobId: (job.body as { data: { id: string } }).data.id, action: 'BINDING_COMMITMENT',
      reasonCode: 'RHIA_APPROVAL_COMMITMENT', summary: 'Compromiso sujeto a revisión humana',
      targetRef: '78787878-7878-4878-8878-787878787878', idempotencyKey: 'approval:commitment:001',
    },
  });
  const approvalId = (created.body as { data: { id: string } }).data.id;
  const request = {
    method: 'POST' as const, path: `/api/v1/approvals/${approvalId}/decisions`, principal: manager, correlationId,
    body: { decision: 'APPROVED', reason: 'Revisión humana completada', idempotencyKey: 'approval:decision:manager' },
  };
  const decided = await api.handle(request);
  const replayed = await api.handle(request);
  assert.equal(decided.status, 201);
  assert.equal(replayed.status, 200);
  assert.equal(approvals.records[0]?.status, 'APPROVED');
  assert.equal(audit.events.filter((event) => event.action === 'APPROVAL_DECIDED').length, 1);
  assert.equal(audit.events.some((event) => event.action.includes('EXECUTED')), false);
});

test('transporte HTTP conserva contrato, correlación y no-store', async () => {
  await withHttpServer(async (origin) => {
    const response = await fetch(`${origin}/api/v1/companies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-correlation-id': correlationId },
      body: JSON.stringify({ canonicalName: 'Empresa HTTP', idempotencyKey: 'company:http:001' }),
    });
    const payload = await response.json() as { version: string; data: { canonicalName: string } };
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('x-correlation-id'), correlationId);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(payload.version, '1.0');
    assert.equal(payload.data.canonicalName, 'Empresa HTTP');
  });
});

test('transporte HTTP rechaza autenticación, JSON inválido y payload grande', async () => {
  await withHttpServer(async (origin) => {
    const unauthorized = await fetch(`${origin}/api/v1/companies`);
    assert.equal(unauthorized.status, 401);
    assert.equal(((await unauthorized.json()) as { error: { code: string } }).error.code, 'RHIA_POLICY_DENIED');
  }, async () => { throw new Error('sin sesión'); });

  await withHttpServer(async (origin) => {
    const invalid = await fetch(`${origin}/api/v1/companies`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    });
    const oversized = await fetch(`${origin}/api/v1/companies`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(100) }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(oversized.status, 413);
  }, async () => manager, 32);
});
