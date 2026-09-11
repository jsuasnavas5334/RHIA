import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TITLE_STALE_AFTER_DAYS, resolvePersonIdentity } from './person-identity.js';
import type { CandidateSearchHit } from './schema.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-09-07T00:00:00.000Z');

const hitFor = (title: string): CandidateSearchHit => ({
  url: 'https://www.linkedin.com/in/jane-doe-example',
  title,
  snippet: 'Perfil profesional en LinkedIn.',
  provider: 'searxng',
});

let counter = 0;
const newId = () => `22222222-2222-4222-8222-${String(counter++).padStart(12, '0')}`;

test('resolvePersonIdentity: extrae nombre y cargo de un hit tipo "Nombre - Cargo"', () => {
  counter = 0;
  const identity = resolvePersonIdentity({
    organizationId: ORG_ID,
    hit: hitFor('Jane Doe - Directora de Recursos Humanos - Acme Corp | LinkedIn'),
    sourceType: 'DIRECTORY',
    fetchedAt: NOW.toISOString(),
    now: NOW,
    newId,
  });
  assert.equal(identity.fullNameGuess, 'Jane Doe');
  assert.equal(identity.titleGuess, 'Directora de Recursos Humanos');
  assert.ok(identity.identityConfidence > 0);
});

// Prueba requerida del packet: "Stale title test".
test('stale title: un cargo observado hace mas de DEFAULT_TITLE_STALE_AFTER_DAYS se marca STALE y penaliza la confianza', () => {
  counter = 0;
  const staleFetchedAt = new Date(NOW.getTime() - (DEFAULT_TITLE_STALE_AFTER_DAYS + 30) * 24 * 60 * 60 * 1000).toISOString();

  const staleIdentity = resolvePersonIdentity({
    organizationId: ORG_ID,
    hit: hitFor('Jane Doe - Directora de Recursos Humanos - Acme Corp | LinkedIn'),
    sourceType: 'DIRECTORY',
    fetchedAt: staleFetchedAt,
    now: NOW,
    newId,
  });
  const freshIdentity = resolvePersonIdentity({
    organizationId: ORG_ID,
    hit: hitFor('Jane Doe - Directora de Recursos Humanos - Acme Corp | LinkedIn'),
    sourceType: 'DIRECTORY',
    fetchedAt: NOW.toISOString(),
    now: NOW,
    newId,
  });

  assert.equal(staleIdentity.titleStatus, 'STALE');
  assert.equal(freshIdentity.titleStatus, 'CURRENT');
  assert.ok(staleIdentity.identityConfidence < freshIdentity.identityConfidence);
  // La evidencia STALE se preserva (nunca se borra), igual que evidence-pipeline.
  assert.ok(staleIdentity.evidence.length > 0);
});

test('stale title: un cargo justo en el umbral (staleAfterDays exacto) NO es STALE (limite exclusivo, mismo criterio que isStaleEvidence)', () => {
  counter = 0;
  const atThreshold = new Date(NOW.getTime() - DEFAULT_TITLE_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const identity = resolvePersonIdentity({
    organizationId: ORG_ID,
    hit: hitFor('Jane Doe - Directora de Recursos Humanos - Acme Corp | LinkedIn'),
    sourceType: 'DIRECTORY',
    fetchedAt: atThreshold,
    now: NOW,
    newId,
  });
  assert.equal(identity.titleStatus, 'CURRENT');
});

test('sin ningun claim extraido (texto sin patron nombre-cargo): identidad UNKNOWN, confianza 0, sin evidencia inventada', () => {
  counter = 0;
  const identity = resolvePersonIdentity({
    organizationId: ORG_ID,
    hit: hitFor('Acerca de la empresa Acme Corp | LinkedIn'),
    sourceType: 'DIRECTORY',
    fetchedAt: NOW.toISOString(),
    now: NOW,
    newId,
  });
  assert.equal(identity.fullNameGuess, null);
  assert.equal(identity.titleGuess, null);
  assert.equal(identity.identityConfidence, 0);
  assert.equal(identity.titleStatus, 'UNKNOWN');
  assert.deepEqual(identity.evidence, []);
});
