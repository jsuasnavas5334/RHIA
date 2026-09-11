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
  MemoryApprovalRepository, MemoryAuditSink, MemoryCompanyEntityRepository, MemoryCompanyGroupRepository, MemoryCompanyLocationRepository,
  MemoryContactPointRepository, MemoryContactRepository, MemoryIdempotencyStore, MemoryJobRepository, MemoryOpportunityRepository,
  MemorySearchHealthRepository, MemoryUnitOfWork,
} from './memory-adapters.js';
import { ContactPointService } from './contact-point-service.js';
import { StaticEncryptionKeyProvider, encryptContactPointValue } from './contact-point-crypto.js';
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
  const companyEntities = new MemoryCompanyEntityRepository();
  const companyLocations = new MemoryCompanyLocationRepository();
  const contacts = new MemoryContactRepository();
  const contactPoints = new MemoryContactPointRepository();
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
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000006',
  ];
  const dependencies = {
    companies,
    companyEntities,
    companyLocations,
    contacts,
    contactPoints,
    opportunities,
    jobs,
    approvals,
    idempotency,
    audit,
    unitOfWork: new MemoryUnitOfWork(),
    searchHealth,
    encryptionKeys: new StaticEncryptionKeyProvider(),
    newId: () => ids.shift() ?? '99999999-9999-4999-8999-999999999999',
    now: () => new Date('2026-08-21T14:00:00.000Z'),
  };
  const contactPointService = new ContactPointService(dependencies);
  return {
    api: new CoreApi(
      new CompanyGroupService(dependencies), new ContactService(dependencies), contactPointService, new OpportunityService(dependencies),
      new JobService(dependencies), new ApprovalService(dependencies), new SearchHealthService(dependencies),
    ),
    companies,
    companyEntities,
    companyLocations,
    contacts,
    contactPoints,
    contactPointService,
    opportunities,
    jobs,
    approvals,
    audit,
    searchHealth,
    dependencies,
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

test('no duplica empresas por ciudad cuando comparten dominio: mismo websiteRoot con distinta idempotencyKey reutiliza la company existente (PH07-T001)', async () => {
  // Simula dos discovery jobs independientes que encuentran la MISMA company
  // en distinta ciudad (p. ej. via una búsqueda en Quito y otra vez vía
  // Guayaquil): cada job genera su propia idempotencyKey, así que el ledger
  // de idempotencia por sí solo no evita el duplicado. Se compara por
  // websiteRoot (dominio), no por canonicalName -- ver el comentario de
  // normalizeWebsiteRoot en company-service.ts para por qué nombre-only se
  // descartó deliberadamente (fusionaría empresas distintas con el mismo
  // nombre en ciudades distintas).
  const { api, companies, audit } = fixture();
  const first = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Acme Corp Quito', websiteRoot: 'https://www.acme.example.com/', idempotencyKey: 'job:quito:acme' },
  });
  const second = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Acme Corporation Guayaquil', websiteRoot: 'https://ACME.example.com', idempotencyKey: 'job:guayaquil:acme' },
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(companies.records.length, 1);
  assert.equal(audit.events.length, 1);
  assert.deepEqual((second.body as { data: unknown }).data, (first.body as { data: unknown }).data);

  // Repetir la MISMA idempotencyKey del segundo job debe seguir devolviendo
  // la company existente vía el ledger de idempotencia normal (cubre que el
  // registro de idempotencia del camino de dedup-por-dominio quedó bien
  // guardado, no solo el resultado inmediato).
  const replay = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Acme Corporation Guayaquil', websiteRoot: 'https://ACME.example.com', idempotencyKey: 'job:guayaquil:acme' },
  });
  assert.equal(replay.status, 200);
  assert.equal(companies.records.length, 1);
  assert.equal(audit.events.length, 1);
});

test('no fusiona companies con el mismo nombre pero dominios distintos (o sin dominio) -- protege contra falsos positivos', async () => {
  const { api, companies } = fixture();
  await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Acme Corp', websiteRoot: 'https://acme-quito.example.com', idempotencyKey: 'job:acme:quito' },
  });
  await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Acme Corp', websiteRoot: 'https://acme-bogota.example.com', idempotencyKey: 'job:acme:bogota' },
  });
  await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Acme Corp', idempotencyKey: 'job:acme:sin-dominio' },
  });
  assert.equal(companies.records.length, 3);
});

test('Entity Resolver (PH06-T004) wiring real: mismo nombre+país reutiliza la company aunque la ciudad sea distinta -- criterio "No duplica empresas por ciudad" resuelto con señales de identidad, no solo por dominio', async () => {
  // A diferencia del test de dedupe por dominio (websiteRoot) de arriba, este
  // cubre el caso que ese fix dejaba sin resolver: el mismo discovery job
  // encuentra "Acme Exportadora SA" primero vía una búsqueda en Quito y luego
  // vía una búsqueda en Guayaquil -- SIN ningún websiteRoot -- y el criterio
  // de aceptación del packet es literalmente "no duplica empresas por
  // ciudad". Con `location` en el payload, CompanyGroupService.create ahora
  // invoca a @rhia/entity-resolver (PH06-T004): mismo nombre + mismo país
  // (aunque cambie la ciudad) resuelve al MISMO grupo.
  const { api, companies, companyEntities, companyLocations, audit } = fixture();
  const first = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: {
      canonicalName: 'Acme Exportadora SA',
      location: { countryCode: 'EC', city: 'Quito' },
      idempotencyKey: 'job:resolver:quito',
    },
  });
  assert.equal(first.status, 201);
  assert.equal((first.body as { data: { globalIdentityStatus: string } }).data.globalIdentityStatus, 'RESOLVED');
  assert.equal(companies.records.length, 1);
  assert.equal(companyEntities.records.length, 1);
  assert.equal(companyLocations.records.length, 1);

  const second = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: {
      canonicalName: 'Acme Exportadora SA',
      location: { countryCode: 'EC', city: 'Guayaquil' },
      idempotencyKey: 'job:resolver:guayaquil',
    },
  });
  assert.equal(second.status, 200);
  assert.deepEqual((second.body as { data: unknown }).data, (first.body as { data: unknown }).data);
  // No se creó una company nueva ni una segunda entity/location -- se
  // reutilizó el grupo existente tal cual (soporte multi-entidad por grupo
  // queda fuera de alcance, ver comentario de `create` en company-service.ts).
  assert.equal(companies.records.length, 1);
  assert.equal(companyEntities.records.length, 1);
  assert.equal(companyLocations.records.length, 1);
  assert.equal(audit.events.length, 1);
});

test('Entity Resolver: mismo nombre PERO país distinto NO fusiona -- protege el mismo falso-merge que el dedupe por dominio ya evitaba', async () => {
  // Control negativo directo del test anterior: "Acme Exportadora SA" en
  // Ecuador y una empresa DISTINTA que por coincidencia comparte el mismo
  // nombre en EE. UU. no deben terminar como el mismo company_group --
  // exactamente el error "resolver por string similarity solamente" que
  // @rhia/entity-resolver fue diseñado para evitar (criterio "no mezcla San
  // José CR/US/Belize" de PH06-T004, aplicado aquí a nivel de país).
  const { api, companies } = fixture();
  await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: {
      canonicalName: 'Acme Exportadora SA',
      location: { countryCode: 'EC', city: 'Quito' },
      idempotencyKey: 'job:resolver:ec',
    },
  });
  const other = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: {
      canonicalName: 'Acme Exportadora SA',
      location: { countryCode: 'US', city: 'Denver' },
      idempotencyKey: 'job:resolver:us',
    },
  });
  assert.equal(other.status, 201);
  assert.equal(companies.records.length, 2);
  assert.notEqual(
    (other.body as { data: { id: string } }).data.id,
    companies.records[0]?.id,
  );
});

test('Entity Resolver: legal identifier compartido fusiona aunque nombre y ciudad sean distintos', async () => {
  // El legal identifier es la señal más fuerte (acción 2 del packet
  // PH06-T004): un RUC/EIN compartido liga la misma entidad legal aunque el
  // nombre comercial cambie (alias/rebranding) y la ciudad registrada
  // difiera -- a diferencia del match por nombre+ubicación, este NUNCA se
  // descarta por conflicto de ciudad (solo por conflicto de país).
  const { api, companies } = fixture();
  const first = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: {
      canonicalName: 'Beta Industrial LLC',
      legalIdentifier: 'RUC-0009998887',
      location: { countryCode: 'EC', city: 'Cuenca' },
      idempotencyKey: 'job:resolver:beta-cuenca',
    },
  });
  assert.equal(first.status, 201);
  const second = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: {
      canonicalName: 'Beta Group SAS',
      // Mismo identificador, distinto formato (espacio en vez de guion) --
      // normalizeLegalIdentifier debe igualarlos de todas formas.
      legalIdentifier: 'RUC 0009998887',
      location: { countryCode: 'EC', city: 'Loja' },
      idempotencyKey: 'job:resolver:beta-loja',
    },
  });
  assert.equal(second.status, 200);
  assert.deepEqual((second.body as { data: unknown }).data, (first.body as { data: unknown }).data);
  assert.equal(companies.records.length, 1);
});

test('Entity Resolver: ambigüedad de nombre entre dos grupos ya conocidos no auto-confirma -- crea company nueva marcada AMBIGUOUS para revisión', async () => {
  // Criterio de aceptación de PH06-T004 "Confidence bajo no auto-confirma":
  // cuando el nombre de entrada coincide de forma comparable con MÁS de un
  // grupo conocido (empate real, no una única mejor opción), el resolver
  // reporta NEEDS_REVIEW y no elige ninguno de los dos -- se crea una company
  // nueva (no bloquea al operador) pero con globalIdentityStatus=AMBIGUOUS en
  // vez de RESOLVED, para que quede visible como pendiente de revisión
  // humana en vez de fusionarse silenciosamente con el candidato incorrecto.
  const { api, companies } = fixture();
  await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: {
      canonicalName: 'Comercial Andina Textiles',
      location: { countryCode: 'EC', city: 'Quito' },
      idempotencyKey: 'job:resolver:delta-export',
    },
  });
  await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: {
      canonicalName: 'Comercial Andina Quimicos',
      location: { countryCode: 'EC', city: 'Quito' },
      idempotencyKey: 'job:resolver:delta-group',
    },
  });
  assert.equal(companies.records.length, 2);

  const ambiguous = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: {
      canonicalName: 'Comercial Andina',
      location: { countryCode: 'EC', city: 'Quito' },
      idempotencyKey: 'job:resolver:delta-ambiguo',
    },
  });
  assert.equal(ambiguous.status, 201);
  assert.equal((ambiguous.body as { data: { globalIdentityStatus: string } }).data.globalIdentityStatus, 'AMBIGUOUS');
  assert.equal(companies.records.length, 3);
});

test('Entity Resolver: legalIdentifier sin location es rechazado por el contrato (company_entity.country_code es NOT NULL)', async () => {
  const { api } = fixture();
  const response = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Sin Ubicacion SA', legalIdentifier: 'RUC-123', idempotencyKey: 'job:resolver:sin-location' },
  });
  assert.equal(response.status, 400);
  assert.equal((response.body as { error: { code: string } }).error.code, 'RHIA_CONTRACT_INVALID_PAYLOAD');
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

test('GET /api/v1/companies/:id arma Company 360 con contacts, opportunities y timeline unificado (PH07-T001)', async () => {
  const { api } = fixture();
  const companyResponse = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Empresa 360', idempotencyKey: 'company:360:001' },
  });
  const companyId = (companyResponse.body as { data: { id: string } }).data.id;

  const contactResponse = await api.handle({
    method: 'POST', path: '/api/v1/contacts', principal: manager, correlationId,
    body: { companyGroupId: companyId, fullName: 'Ana Torres', idempotencyKey: 'contact:360:001' },
  });
  const contactId = (contactResponse.body as { data: { id: string } }).data.id;

  const opportunityResponse = await api.handle({
    method: 'POST', path: '/api/v1/opportunities', principal: manager, correlationId,
    body: { companyGroupId: companyId, marketCountry: 'EC', idempotencyKey: 'opportunity:360:001' },
  });
  const opportunityId = (opportunityResponse.body as { data: { id: string } }).data.id;

  // Otra company del mismo tenant, sin relación -- no debe aparecer en el 360 de la primera.
  await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Empresa Ajena', idempotencyKey: 'company:360:ajena' },
  });

  const detail = await api.handle({ method: 'GET', path: `/api/v1/companies/${companyId}`, principal: manager, correlationId });
  assert.equal(detail.status, 200);
  const data = (detail.body as {
    data: {
      company: { id: string };
      contacts: readonly { id: string }[];
      opportunities: readonly { id: string }[];
      timeline: readonly { resourceId: string; action: string }[];
    };
  }).data;
  assert.equal(data.company.id, companyId);
  assert.deepEqual(data.contacts.map((contact) => contact.id), [contactId]);
  assert.deepEqual(data.opportunities.map((opportunity) => opportunity.id), [opportunityId]);
  assert.equal(data.timeline.length, 3);
  assert.deepEqual(new Set(data.timeline.map((event) => event.resourceId)), new Set([companyId, contactId, opportunityId]));
  assert.deepEqual(
    data.timeline.map((event) => event.action).sort(),
    ['COMPANY_GROUP_CREATED', 'CONTACT_CREATED', 'OPPORTUNITY_CREATED'],
  );
});

test('GET /api/v1/companies/:id de otro tenant o inexistente devuelve error de contrato normalizado', async () => {
  const { api } = fixture();
  const created = await api.handle({
    method: 'POST', path: '/api/v1/companies', principal: manager, correlationId,
    body: { canonicalName: 'Empresa Tenant A', idempotencyKey: 'company:360:tenant-a' },
  });
  const companyId = (created.body as { data: { id: string } }).data.id;

  const crossTenant = await api.handle({
    method: 'GET', path: `/api/v1/companies/${companyId}`, principal: otherManager, correlationId,
  });
  const missing = await api.handle({
    method: 'GET', path: '/api/v1/companies/99999999-9999-4999-8999-999999999999', principal: manager, correlationId,
  });

  assert.equal(crossTenant.status, 400);
  assert.equal(missing.status, 400);
  assert.equal((crossTenant.body as { error: { code: string } }).error.code, 'RHIA_CONTRACT_INVALID_PAYLOAD');
  assert.equal((missing.body as { error: { code: string } }).error.code, 'RHIA_CONTRACT_INVALID_PAYLOAD');
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

// PH07-T003 (Contact Validation v1).
test('contact points: email con formato invalido nace INVALID -- criterio "No envia a INVALID"', async () => {
  const { api, contactPoints } = fixture();
  const contactCreate = await api.handle({
    method: 'POST', path: '/api/v1/contacts', principal: manager, correlationId,
    body: { companyGroupId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', fullName: 'Ana Torres', idempotencyKey: 'contact:ana:002' },
  });
  const contactId = (contactCreate.body as { data: { id: string } }).data.id;

  const response = await api.handle({
    method: 'POST', path: `/api/v1/contacts/${contactId}/points`, principal: manager, correlationId,
    body: { pointType: 'EMAIL', rawValue: 'esto-no-es-un-email', idempotencyKey: 'point:ana:email:001' },
  });

  assert.equal(response.status, 201);
  const body = response.body as { data: { validationStatus: string; valueMasked: string } };
  assert.equal(body.data.validationStatus, 'INVALID');
  assert.equal(contactPoints.records[0]?.validationStatus, 'INVALID');
});

test('contact points: telefono duplicado (distinto formato, distinta idempotencyKey) no crea una segunda fila -- "Dedup hash"/"Duplicate phone"', async () => {
  const { api, contactPoints, audit } = fixture();
  const contactCreate = await api.handle({
    method: 'POST', path: '/api/v1/contacts', principal: manager, correlationId,
    body: { companyGroupId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', fullName: 'Carlos Ruiz', idempotencyKey: 'contact:carlos:001' },
  });
  const contactId = (contactCreate.body as { data: { id: string } }).data.id;

  const first = await api.handle({
    method: 'POST', path: `/api/v1/contacts/${contactId}/points`, principal: manager, correlationId,
    body: { pointType: 'PHONE', rawValue: '+593 99 123 4567', idempotencyKey: 'point:carlos:phone:001' },
  });
  // Mismo telefono, formato distinto (guiones en vez de espacios) y una
  // idempotencyKey DISTINTA -- simula dos hits de Contact Discovery
  // encontrando el mismo numero por caminos distintos.
  const second = await api.handle({
    method: 'POST', path: `/api/v1/contacts/${contactId}/points`, principal: manager, correlationId,
    body: { pointType: 'PHONE', rawValue: '+593-99-123-4567', idempotencyKey: 'point:carlos:phone:002' },
  });

  assert.equal(first.status, 201);
  assert.equal(second.status, 200); // dedupeado -- no es un recurso nuevo.
  const firstId = (first.body as { data: { id: string } }).data.id;
  const secondId = (second.body as { data: { id: string } }).data.id;
  assert.equal(firstId, secondId);
  assert.equal(contactPoints.records.filter((point) => point.contactId === contactId).length, 1);
  assert.equal(audit.events.filter((event) => event.action === 'CONTACT_POINT_CREATED').length, 1);
});

test('contact points: PII protegida -- la respuesta y el registro persistido nunca exponen el valor en claro', async () => {
  const { api, contactPoints } = fixture();
  const contactCreate = await api.handle({
    method: 'POST', path: '/api/v1/contacts', principal: manager, correlationId,
    body: { companyGroupId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', fullName: 'Maria Lopez', idempotencyKey: 'contact:maria:001' },
  });
  const contactId = (contactCreate.body as { data: { id: string } }).data.id;
  const rawEmail = 'maria.lopez@empresa-secreta.com';

  const response = await api.handle({
    method: 'POST', path: `/api/v1/contacts/${contactId}/points`, principal: manager, correlationId,
    body: { pointType: 'EMAIL', rawValue: rawEmail, idempotencyKey: 'point:maria:email:001' },
  });

  const responseText = JSON.stringify(response.body);
  assert.ok(!responseText.includes(rawEmail), 'la respuesta HTTP no debe contener el email en claro');
  assert.equal((response.body as { data: { valueMasked: string } }).data.valueMasked, 'm**********@empresa-secreta.com');

  const record = contactPoints.records[0];
  assert.ok(record);
  // El buffer cifrado nunca contiene el valor en claro como substring --
  // AES-256-GCM produce ciphertext indistinguible de datos aleatorios, muy
  // distinto de "ofuscar" el texto.
  const encryptedAsLatin1 = record!.valueEncrypted.toString('latin1');
  assert.ok(!encryptedAsLatin1.includes(rawEmail));
  assert.ok(!encryptedAsLatin1.includes('maria.lopez'));
});

test('contact points: staleness degrada VERIFIED a UNVERIFIED en lectura -- "Unknown no se presenta como verified"/"Stale validation"', async () => {
  const { contactPoints, contactPointService, dependencies } = fixture();
  const now = dependencies.now();
  const staleValidatedAt = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString();

  // Construido directamente en el repositorio (no via create(), que nunca
  // produce VERIFIED sin un provider real conectado -- ver "Fuera de
  // alcance" en docs/progress/PH07-T003.md) para simular un punto que un
  // provider SI confirmo hace tiempo.
  const staleContactId = '10000000-0000-4000-8000-000000000099';
  contactPoints.records.push({
    id: '10000000-0000-4000-8000-000000000098', organizationId: organizationA, contactId: staleContactId, pointType: 'EMAIL',
    valueEncrypted: encryptContactPointValue('ceo@acme.com', dependencies.encryptionKeys.getKey()), valueHash: 'a'.repeat(64),
    validationStatus: 'VERIFIED', sourceId: null, lastValidatedAt: staleValidatedAt, createdAt: staleValidatedAt, updatedAt: staleValidatedAt,
  });

  const points = await contactPointService.listByContact(manager, staleContactId);
  assert.equal(points.length, 1);
  assert.equal(points[0]?.validationStatus, 'UNVERIFIED');
});

test('contact points: viewer no puede crear ni escribir puntos de contacto', async () => {
  const { api } = fixture();
  const response = await api.handle({
    method: 'POST', path: '/api/v1/contacts/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/points', principal: viewer, correlationId,
    body: { pointType: 'EMAIL', rawValue: 'viewer@acme.com', idempotencyKey: 'point:viewer:001' },
  });
  assert.equal(response.status, 403);
});
