import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateResearchCache } from './research-cache.js';
import type { CachePolicy, ManualInvalidation } from './schema.js';
import type { Evidence, EvidenceSource } from '@rhia/evidence-pipeline';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';
const HASH_A = 'a'.repeat(64);

let counter = 0;
const nextId = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}`;
};

const baseEvidence = (overrides: Partial<Evidence> = {}): Evidence => ({
  id: nextId(),
  organizationId: ORG_ID,
  subjectType: 'COMPANY',
  subjectId: SUBJECT_ID,
  sourceId: nextId(),
  claimType: 'EMPLOYEE_COUNT',
  excerptHash: HASH_A,
  observedValue: { count: 150, unit: 'employees' },
  confidence: 0.7,
  freshnessAt: '2026-09-01T00:00:00.000Z',
  status: 'ACTIVE',
  ...overrides,
});

const baseSource = (id: string, overrides: Partial<EvidenceSource> = {}): EvidenceSource => ({
  id,
  organizationId: ORG_ID,
  sourceType: 'OFFICIAL_WEBSITE',
  url: 'https://example.com/about',
  fetchedAt: '2026-09-01T00:00:00.000Z',
  provider: 'SEARXNG',
  sourceReliability: 0.8,
  ...overrides,
});

const DEFAULT_POLICY: CachePolicy = { defaultTtlDays: 30 };

// --- Pruebas requeridas por el Task Packet -------------------------------

test('Repeated job: la misma empresa/claim ejecutada dos veces seguidas (evidencia fresca) da CACHE_HIT en la segunda -- no repite la busqueda', () => {
  const evidence = baseEvidence({ freshnessAt: '2026-09-01T00:00:00.000Z' });
  const sources = new Map([[evidence.sourceId, baseSource(evidence.sourceId)]]);
  const now = () => new Date('2026-09-05T00:00:00.000Z'); // 4 dias despues, dentro del TTL de 30.

  const result = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [evidence],
    sources,
    policy: DEFAULT_POLICY,
    now,
  });

  assert.equal(result.decision, 'CACHE_HIT');
  assert.equal(result.reason, 'FRESH_EVIDENCE_FOUND');
  assert.deepEqual(result.reusableEvidenceIds, [evidence.id]);
});

test('TTL expiry: evidencia mas vieja que el TTL aplicable da STALE_REVALIDATE, no CACHE_HIT', () => {
  const evidence = baseEvidence({ freshnessAt: '2026-01-01T00:00:00.000Z' });
  const sources = new Map([[evidence.sourceId, baseSource(evidence.sourceId)]]);
  const now = () => new Date('2026-09-05T00:00:00.000Z'); // ~247 dias despues, TTL default es 30.

  const result = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [evidence],
    sources,
    policy: DEFAULT_POLICY,
    now,
  });

  assert.equal(result.decision, 'STALE_REVALIDATE');
  assert.equal(result.reason, 'TTL_EXPIRED');
  assert.deepEqual(result.reusableEvidenceIds, []);
  assert.deepEqual(result.staleEvidenceIds, [evidence.id]);
});

test('Manual invalidate: evidencia dentro del TTL pero invalidada manualmente despues de recolectarse fuerza revalidacion', () => {
  const evidence = baseEvidence({ freshnessAt: '2026-09-01T00:00:00.000Z' });
  const sources = new Map([[evidence.sourceId, baseSource(evidence.sourceId)]]);
  const now = () => new Date('2026-09-05T00:00:00.000Z'); // dentro del TTL de 30 dias.
  const key = `${ORG_ID}::COMPANY::${SUBJECT_ID}::EMPLOYEE_COUNT`;
  const invalidations: ManualInvalidation[] = [
    { key, invalidatedAt: '2026-09-02T00:00:00.000Z', reason: 'dato corregido por el equipo comercial' },
  ];

  const result = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [evidence],
    sources,
    policy: DEFAULT_POLICY,
    invalidations,
    now,
  });

  assert.equal(result.decision, 'STALE_REVALIDATE');
  assert.equal(result.reason, 'MANUALLY_INVALIDATED');
});

test('Manual invalidate: evidencia recolectada DESPUES de la invalidacion vuelve a ser reutilizable sin una segunda accion manual', () => {
  const evidence = baseEvidence({ freshnessAt: '2026-09-03T00:00:00.000Z' }); // posterior a la invalidacion.
  const sources = new Map([[evidence.sourceId, baseSource(evidence.sourceId)]]);
  const now = () => new Date('2026-09-05T00:00:00.000Z');
  const key = `${ORG_ID}::COMPANY::${SUBJECT_ID}::EMPLOYEE_COUNT`;
  const invalidations: ManualInvalidation[] = [
    { key, invalidatedAt: '2026-09-02T00:00:00.000Z', reason: 'dato corregido por el equipo comercial' },
  ];

  const result = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [evidence],
    sources,
    policy: DEFAULT_POLICY,
    invalidations,
    now,
  });

  assert.equal(result.decision, 'CACHE_HIT');
  assert.equal(result.reason, 'FRESH_EVIDENCE_FOUND');
});

// --- Criterios de aceptacion del packet ----------------------------------

test('Misma empresa no repite busquedas frescas (criterio de aceptacion)', () => {
  const evidence = baseEvidence();
  const sources = new Map([[evidence.sourceId, baseSource(evidence.sourceId)]]);
  const now = () => new Date('2026-09-02T00:00:00.000Z');

  const first = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [evidence],
    sources,
    policy: DEFAULT_POLICY,
    now,
  });
  const second = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [evidence],
    sources,
    policy: DEFAULT_POLICY,
    now,
  });

  assert.equal(first.decision, 'CACHE_HIT');
  assert.equal(second.decision, 'CACHE_HIT');
});

test('Datos stale se revalidan (criterio de aceptacion): sin evidencia utilizable, la decision nunca es CACHE_HIT', () => {
  const result = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [],
    sources: new Map(),
    policy: DEFAULT_POLICY,
  });

  assert.equal(result.decision, 'CACHE_MISS');
  assert.equal(result.reason, 'NO_EVIDENCE');
});

test('Cache hit auditable (criterio de aceptacion): el resultado trae key, razon, ttl aplicado y evidencia trazable', () => {
  const evidence = baseEvidence();
  const sources = new Map([[evidence.sourceId, baseSource(evidence.sourceId)]]);
  const now = () => new Date('2026-09-02T00:00:00.000Z');

  const result = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [evidence],
    sources,
    policy: DEFAULT_POLICY,
    now,
  });

  assert.equal(result.key, `${ORG_ID}::COMPANY::${SUBJECT_ID}::EMPLOYEE_COUNT`);
  assert.equal(result.ttlDaysApplied, 30);
  assert.equal(result.evaluatedAt, '2026-09-02T00:00:00.000Z');
  assert.deepEqual(result.reusableEvidenceIds, [evidence.id]);
});

// --- Errores a evitar del Task Packet -------------------------------------

test('Errores a evitar -- Cache eterno: nunca se acepta un TTL infinito en la politica', () => {
  assert.throws(() => {
    evaluateResearchCache({
      organizationId: ORG_ID,
      subjectType: 'COMPANY',
      subjectId: SUBJECT_ID,
      claimType: 'EMPLOYEE_COUNT',
      evidence: [baseEvidence()],
      sources: new Map(),
      policy: { defaultTtlDays: Number.POSITIVE_INFINITY },
    });
  });
});

test('Errores a evitar -- Cache por nombre sin pais/entidad: subjectId debe ser un UUID valido, nunca texto libre', () => {
  assert.throws(() => {
    evaluateResearchCache({
      organizationId: ORG_ID,
      subjectType: 'COMPANY',
      subjectId: 'Acme Corp', // nombre de empresa en texto libre -- debe rechazarse.
      claimType: 'EMPLOYEE_COUNT',
      evidence: [],
      sources: new Map(),
      policy: DEFAULT_POLICY,
    });
  });
});

test('Evidencia de otro subject (misma organizacion/claim) no cuenta para el cache de este subject', () => {
  const otherSubjectEvidence = baseEvidence({ subjectId: '33333333-3333-4333-8333-333333333333' });

  const result = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [otherSubjectEvidence],
    sources: new Map(),
    policy: DEFAULT_POLICY,
  });

  assert.equal(result.decision, 'CACHE_MISS');
});

test('TTL por source: la misma evidencia con una fuente SOCIAL de TTL corto expira antes que con una fuente OFFICIAL_WEBSITE', () => {
  const policy: CachePolicy = { defaultTtlDays: 30, sourceTypeTtlDays: { SOCIAL: 3 } };
  const now = () => new Date('2026-09-05T00:00:00.000Z'); // 4 dias despues de la evidencia.

  const officialEvidence = baseEvidence({ freshnessAt: '2026-09-01T00:00:00.000Z' });
  const officialSources = new Map([[officialEvidence.sourceId, baseSource(officialEvidence.sourceId, { sourceType: 'OFFICIAL_WEBSITE' })]]);
  const officialResult = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [officialEvidence],
    sources: officialSources,
    policy,
    now,
  });

  const socialEvidence = baseEvidence({ freshnessAt: '2026-09-01T00:00:00.000Z' });
  const socialSources = new Map([[socialEvidence.sourceId, baseSource(socialEvidence.sourceId, { sourceType: 'SOCIAL' })]]);
  const socialResult = evaluateResearchCache({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    claimType: 'EMPLOYEE_COUNT',
    evidence: [socialEvidence],
    sources: socialSources,
    policy,
    now,
  });

  assert.equal(officialResult.decision, 'CACHE_HIT', '4 dias de antiguedad esta dentro del TTL default de 30');
  assert.equal(socialResult.decision, 'STALE_REVALIDATE', '4 dias de antiguedad supera el TTL de 3 para fuentes SOCIAL');
});
