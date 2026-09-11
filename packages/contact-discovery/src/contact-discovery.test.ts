import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MissingCompanyLinkageError } from './company-linking.js';
import { discoverContacts, type DiscoveredHit } from './contact-discovery.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const COMPANY_GROUP_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-09-07T00:00:00.000Z');

let counter = 0;
const newId = () => `44444444-4444-4444-8444-${String(counter++).padStart(12, '0')}`;

const hrHit: DiscoveredHit = {
  hit: {
    url: 'https://www.linkedin.com/in/jane-doe-hr',
    title: 'Jane Doe - Directora de Recursos Humanos - Acme Corp | LinkedIn',
    snippet: 'Perfil profesional.',
    provider: 'searxng',
  },
  sourceType: 'DIRECTORY',
  fetchedAt: NOW.toISOString(),
};

const opsHit: DiscoveredHit = {
  hit: {
    url: 'https://www.linkedin.com/in/john-smith-ops',
    title: 'John Smith - Gerente de Operaciones - Acme Corp | LinkedIn',
    snippet: 'Perfil profesional.',
    provider: 'searxng',
  },
  sourceType: 'DIRECTORY',
  fetchedAt: NOW.toISOString(),
};

const staleCeoHit: DiscoveredHit = {
  hit: {
    url: 'https://www.linkedin.com/in/carlos-perez-ceo',
    title: 'Carlos Perez - Gerente General - Acme Corp | LinkedIn',
    snippet: 'Perfil profesional.',
    provider: 'searxng',
  },
  sourceType: 'DIRECTORY',
  fetchedAt: new Date(NOW.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString(),
};

// Criterio de aceptacion: "No crea contacto sin company linkage".
test('discoverContacts: sin companyGroupId, no se crea ningun candidato -- lanza antes de procesar hits', () => {
  assert.throws(
    () =>
      discoverContacts({
        organizationId: ORG_ID,
        company: { companyGroupId: undefined, canonicalName: 'Acme Corp' },
        useCase: { description: 'nomina y recursos humanos' },
        hits: [hrHit],
        now: NOW,
        newId,
      }),
    MissingCompanyLinkageError,
  );
});

test('discoverContacts: con companyGroupId, cada candidato queda vinculado a la compania', () => {
  counter = 0;
  const { result } = discoverContacts({
    organizationId: ORG_ID,
    company: { companyGroupId: COMPANY_GROUP_ID, canonicalName: 'Acme Corp' },
    useCase: { description: 'nomina y recursos humanos' },
    hits: [hrHit],
    now: NOW,
    newId,
  });
  assert.equal(result.companyGroupId, COMPANY_GROUP_ID);
  assert.ok(result.candidates.length > 0);
  for (const candidate of result.candidates) {
    assert.equal(candidate.companyGroupId, COMPANY_GROUP_ID);
  }
});

// Criterio de aceptacion: "Puede priorizar RRHH, gerencia, operaciones u
// otras areas segun caso" -- mismo set de hits (RRHH + operaciones), pero un
// caso de uso de nomina prioriza al candidato de RRHH primero.
test('discoverContacts: prioriza segun el caso de uso -- nomina prioriza al candidato de RRHH sobre el de operaciones', () => {
  counter = 0;
  const { result } = discoverContacts({
    organizationId: ORG_ID,
    company: { companyGroupId: COMPANY_GROUP_ID, canonicalName: 'Acme Corp' },
    useCase: { description: 'Software de nomina y gestion de talento humano.' },
    hits: [opsHit, hrHit],
    now: NOW,
    newId,
  });
  assert.equal(result.candidates[0]?.roleArea, 'RRHH');
});

test('discoverContacts: el mismo set de hits, con un caso de uso de manufactura, prioriza al candidato de operaciones', () => {
  counter = 0;
  const { result } = discoverContacts({
    organizationId: ORG_ID,
    company: { companyGroupId: COMPANY_GROUP_ID, canonicalName: 'Acme Corp' },
    useCase: { description: 'Sistema de gestion de planta, produccion y manufactura.' },
    hits: [hrHit, opsHit],
    now: NOW,
    newId,
  });
  assert.equal(result.candidates[0]?.roleArea, 'OPERACIONES');
});

test('discoverContacts: un candidato con titulo STALE queda marcado y con prioridad reducida frente a uno CURRENT del mismo area', () => {
  counter = 0;
  const currentCeoHit: DiscoveredHit = {
    hit: { ...staleCeoHit.hit, url: 'https://www.linkedin.com/in/maria-lopez-ceo', title: 'Maria Lopez - Gerente General - Acme Corp | LinkedIn' },
    sourceType: 'DIRECTORY',
    fetchedAt: NOW.toISOString(),
  };
  const { result } = discoverContacts({
    organizationId: ORG_ID,
    company: { companyGroupId: COMPANY_GROUP_ID, canonicalName: 'Acme Corp' },
    useCase: { description: 'Panel de estrategia y direccion general para la junta directiva.' },
    hits: [staleCeoHit, currentCeoHit],
    now: NOW,
    newId,
  });
  const stale = result.candidates.find((candidate) => candidate.fullNameGuess === 'Carlos Perez');
  const current = result.candidates.find((candidate) => candidate.fullNameGuess === 'Maria Lopez');
  assert.equal(stale?.titleStatus, 'STALE');
  assert.equal(current?.titleStatus, 'CURRENT');
  assert.ok((stale?.priority ?? 1) < (current?.priority ?? 0));
});

test('discoverContacts: guarda provenance real -- supportingEvidenceIds de cada candidato existen en el arreglo de evidence devuelto', () => {
  counter = 0;
  const { result, evidence } = discoverContacts({
    organizationId: ORG_ID,
    company: { companyGroupId: COMPANY_GROUP_ID, canonicalName: 'Acme Corp' },
    useCase: { description: 'nomina y recursos humanos' },
    hits: [hrHit],
    now: NOW,
    newId,
  });
  const evidenceIds = new Set(evidence.map((item) => item.id));
  assert.ok(result.candidates[0]!.supportingEvidenceIds.length > 0);
  for (const evidenceId of result.candidates[0]!.supportingEvidenceIds) {
    assert.ok(evidenceIds.has(evidenceId));
  }
});

test('discoverContacts: roles devueltos reflejan deriveTargetRoles para el mismo caso de uso', () => {
  counter = 0;
  const { result } = discoverContacts({
    organizationId: ORG_ID,
    company: { companyGroupId: COMPANY_GROUP_ID, canonicalName: 'Acme Corp' },
    useCase: { description: 'nomina y recursos humanos' },
    hits: [],
    now: NOW,
    newId,
  });
  assert.equal(result.roles.length, 7);
  assert.equal(result.roles[0]?.area, 'RRHH');
  assert.equal(result.candidates.length, 0);
});
