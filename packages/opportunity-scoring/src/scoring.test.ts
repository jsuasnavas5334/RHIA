import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SCORE_VERSION, computeOpportunityScore } from './scoring.js';

const NOW = new Date('2026-09-07T00:00:00.000Z');

const baseInput = {
  matchedCriteria: 3,
  totalCriteria: 4,
  signals: [{ weight: 0.8, hasEvidence: true }],
  sendableContactPoints: 2,
  totalContactPoints: 3,
  nextActionAt: NOW.toISOString(),
  countryCode: 'EC',
  evidenceCount: 3,
};

test('computeOpportunityScore: devuelve un score en [0,1] con breakdown de los 6 componentes', () => {
  const result = computeOpportunityScore(baseInput, { now: NOW });
  assert.ok(result.score >= 0 && result.score <= 1);
  assert.equal(result.breakdown.length, 6);
  const components = new Set(result.breakdown.map((entry) => entry.component));
  assert.equal(components.size, 6);
});

// Criterio de aceptacion: "Score explicable" (accion 6).
test('computeOpportunityScore: cada entrada del breakdown trae rationale no vacio', () => {
  const result = computeOpportunityScore(baseInput, { now: NOW });
  for (const entry of result.breakdown) {
    assert.ok(entry.rationale.length > 0);
    assert.equal(entry.contribution, entry.rawScore * entry.weight);
  }
});

// Pruebas requeridas: "Score versioning".
test('computeOpportunityScore: usa DEFAULT_SCORE_VERSION cuando no se especifica version', () => {
  const result = computeOpportunityScore(baseInput, { now: NOW });
  assert.equal(result.scoreVersion, DEFAULT_SCORE_VERSION);
});

test('computeOpportunityScore: respeta una version explicita distinta -- nunca se pierde ni se reemplaza por el default', () => {
  const result = computeOpportunityScore(baseInput, { now: NOW, scoreVersion: 'scoring-v2-experimental' });
  assert.equal(result.scoreVersion, 'scoring-v2-experimental');
});

test('computeOpportunityScore: cambiar los PESOS no cambia la version -- son configuracion, no una version nueva del algoritmo', () => {
  const customWeights = { FIT: 1, SIGNAL: 0, CONTACTABILITY: 0, TIMING: 0, GEO_PRIORITY: 0, EVIDENCE: 0 };
  const result = computeOpportunityScore(baseInput, { now: NOW, weights: customWeights });
  assert.equal(result.scoreVersion, DEFAULT_SCORE_VERSION);
});

// Pruebas requeridas: "Cross-country test" + criterio "Ecuador y Peru reciben prioridad relativa configurable" + "Otros paises siguen elegibles".
test('cross-country: Ecuador puntua mas alto en GEO_PRIORITY que un pais no listado, con el resto de senales identicas', () => {
  const ecuadorResult = computeOpportunityScore({ ...baseInput, countryCode: 'EC' }, { now: NOW });
  const otherResult = computeOpportunityScore({ ...baseInput, countryCode: 'DE' }, { now: NOW });

  const geoEc = ecuadorResult.breakdown.find((entry) => entry.component === 'GEO_PRIORITY')!;
  const geoOther = otherResult.breakdown.find((entry) => entry.component === 'GEO_PRIORITY')!;
  assert.ok(geoEc.rawScore > geoOther.rawScore);
  // Otros paises siguen elegibles: el score total NUNCA es 0 solo por geografia.
  assert.ok(otherResult.score > 0);
});

test('cross-country: Peru puntua mas alto que un pais no listado, pero por debajo de Ecuador', () => {
  const ecuador = computeOpportunityScore({ ...baseInput, countryCode: 'EC' }, { now: NOW }).breakdown.find((e) => e.component === 'GEO_PRIORITY')!;
  const peru = computeOpportunityScore({ ...baseInput, countryCode: 'PE' }, { now: NOW }).breakdown.find((e) => e.component === 'GEO_PRIORITY')!;
  const other = computeOpportunityScore({ ...baseInput, countryCode: 'MX' }, { now: NOW }).breakdown.find((e) => e.component === 'GEO_PRIORITY')!;
  assert.ok(peru.rawScore > other.rawScore);
  assert.ok(ecuador.rawScore > peru.rawScore);
});

test('cross-country: la prioridad geografica es configurable por llamador sin tocar el motor', () => {
  const result = computeOpportunityScore(
    { ...baseInput, countryCode: 'MX' },
    { now: NOW, countryPriorityTable: { MX: 1, EC: 0.2 } },
  );
  const geo = result.breakdown.find((entry) => entry.component === 'GEO_PRIORITY')!;
  assert.equal(geo.rawScore, 1);
});

// Pruebas requeridas: "No evidence test" (a nivel del motor completo, no solo del componente aislado).
test('no evidence test: sin señales ni evidencia real, el score total nunca se infla -- SIGNAL y EVIDENCE quedan en 0 explicito', () => {
  const result = computeOpportunityScore({ ...baseInput, signals: [], evidenceCount: 0 }, { now: NOW });
  const signal = result.breakdown.find((entry) => entry.component === 'SIGNAL')!;
  const evidence = result.breakdown.find((entry) => entry.component === 'EVIDENCE')!;
  assert.equal(signal.rawScore, 0);
  assert.equal(evidence.rawScore, 0);
  assert.match(signal.rationale, /Sin señales/);
  assert.match(evidence.rationale, /Sin evidencia/);
  // El score total sigue siendo valido (no crashea, no es NaN, no es negativo).
  assert.ok(Number.isFinite(result.score) && result.score >= 0);
});

// Errores a evitar: "No bloquear mercados".
test('no bloquear mercados: incluso con evidencia/señales/contactabilidad en cero, un pais no listado sigue produciendo un score > 0 (nunca excluido)', () => {
  const result = computeOpportunityScore(
    {
      matchedCriteria: 0, totalCriteria: 0, signals: [], sendableContactPoints: 0, totalContactPoints: 0,
      nextActionAt: null, countryCode: 'ZZ', evidenceCount: 0,
    },
    { now: NOW },
  );
  assert.ok(result.score > 0); // FIT neutro (0.5) y GEO_PRIORITY (0.5 por defecto) mantienen el mercado elegible.
});

// Validacion final del packet: "100 oportunidades pueden ordenarse y explicar top 10".
test('validacion final: 100 oportunidades sinteticas se ordenan por score y las top 10 traen breakdown explicable', () => {
  const opportunities = Array.from({ length: 100 }, (_, index) => {
    const countryCode = ['EC', 'PE', 'MX', 'CO', 'CL'][index % 5]!;
    return {
      id: `opp-${index}`,
      ...computeOpportunityScore(
        {
          matchedCriteria: index % 5, totalCriteria: 5,
          signals: index % 3 === 0 ? [{ weight: 0.7, hasEvidence: true }] : [],
          sendableContactPoints: index % 4, totalContactPoints: 4,
          nextActionAt: index % 2 === 0 ? new Date(NOW.getTime() + (index % 10) * 24 * 60 * 60 * 1000).toISOString() : null,
          countryCode, evidenceCount: index % 6,
        },
        { now: NOW },
      ),
    };
  });

  const ranked = [...opportunities].sort((a, b) => b.score - a.score);
  const top10 = ranked.slice(0, 10);

  assert.equal(top10.length, 10);
  for (let i = 1; i < top10.length; i += 1) {
    assert.ok(top10[i - 1]!.score >= top10[i]!.score);
  }
  for (const opportunity of top10) {
    assert.equal(opportunity.breakdown.length, 6);
    for (const entry of opportunity.breakdown) assert.ok(entry.rationale.length > 0);
  }
});
