import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvidenceFromSearchResult } from './evidence-builder.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';

let counter = 0;
const sequentialId = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}`;
};

test('buildEvidenceFromSearchResult: canonicaliza la URL de la fuente', () => {
  const { source } = buildEvidenceFromSearchResult({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    result: { url: 'http://www.Empresa-X.com/nosotros/?utm=abc#top', title: 'Empresa X', snippet: 'Sitio oficial.', provider: 'SEARXNG:google' },
    sourceType: 'OFFICIAL_WEBSITE',
    fetchedAt: '2026-09-03T00:00:00.000Z',
    newId: sequentialId,
  });

  assert.equal(source.url, 'https://empresa-x.com/nosotros?utm=abc');
  assert.equal(source.domain, 'empresa-x.com');
});

test('buildEvidenceFromSearchResult: extrae claims y nunca guarda el texto crudo del excerpt', () => {
  const { source, evidence } = buildEvidenceFromSearchResult({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    result: {
      url: 'https://empresa-x.com/nosotros',
      title: 'Empresa X',
      snippet: 'Empresa X fue fundada en 2001 y tiene 300 employees.',
      provider: 'SEARXNG:google',
    },
    sourceType: 'OFFICIAL_WEBSITE',
    fetchedAt: '2026-09-03T00:00:00.000Z',
    newId: sequentialId,
  });

  assert.equal(evidence.length, 2);
  assert.ok(evidence.every((item) => item.sourceId === source.id));
  assert.ok(evidence.every((item) => /^[0-9a-f]{64}$/.test(item.excerptHash)));
  for (const item of evidence) {
    assert.ok(!('title' in item));
    assert.ok(!('snippet' in item));
    assert.ok(!('text' in item));
  }
});

test('buildEvidenceFromSearchResult: sin claims detectables no produce evidencia (no inventa)', () => {
  const { evidence } = buildEvidenceFromSearchResult({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    result: { url: 'https://empresa-x.com', title: 'Empresa X', snippet: 'Bienvenidos a nuestro sitio.', provider: 'SEARXNG:google' },
    sourceType: 'OFFICIAL_WEBSITE',
    fetchedAt: '2026-09-03T00:00:00.000Z',
    newId: sequentialId,
  });

  assert.deepEqual(evidence, []);
});

test('buildEvidenceFromSearchResult: la confianza de la evidencia hereda la reliability de la fuente (v1)', () => {
  const { source, evidence } = buildEvidenceFromSearchResult({
    organizationId: ORG_ID,
    subjectType: 'COMPANY',
    subjectId: SUBJECT_ID,
    result: { url: 'https://empresa-x.gob.cr', title: 'Empresa X', snippet: 'Fundada en 1999.', provider: 'SEARXNG:google' },
    sourceType: 'GOVERNMENT',
    fetchedAt: '2026-09-03T00:00:00.000Z',
    newId: sequentialId,
  });

  assert.equal(source.sourceReliability, 0.95);
  assert.equal(evidence[0]?.confidence, 0.95);
});
