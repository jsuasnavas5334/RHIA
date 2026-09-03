import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProviderSearchOutcome, SearchProviderAdapter, SearchSource } from './adapter.js';
import { InMemorySourceQuotaGuard } from './quota.js';
import { orchestrateSearch } from './orchestrator.js';

const baseRequest = (overrides: Partial<Parameters<typeof orchestrateSearch>[0]> = {}) => ({
  version: '1.0' as const,
  queryId: '11111111-1111-4111-8111-111111111111',
  correlationId: '22222222-2222-4222-8222-222222222222',
  query: 'Empresa X Costa Rica',
  market: { countryCode: 'CR' },
  requestedAt: '2026-09-03T00:00:00.000Z',
  limit: 10,
  sources: ['SEARXNG'] as SearchSource[],
  ...overrides,
});

const fakeAdapter = (
  source: SearchSource,
  outcome: ProviderSearchOutcome | (() => ProviderSearchOutcome),
): SearchProviderAdapter & { calls: number } => {
  const state = { calls: 0 };
  return {
    source,
    get calls() { return state.calls; },
    async search() {
      state.calls += 1;
      return typeof outcome === 'function' ? outcome() : outcome;
    },
  };
};

test('una fuente caída no aborta todo: la otra fuente sigue aportando resultados', async () => {
  const searxng = fakeAdapter('SEARXNG', { results: [], issue: 'PROVIDER_DOWN' });
  const webApi = fakeAdapter('WEB_API', {
    results: [{ url: 'https://example.com/a', title: 'A', snippet: 's', provider: 'WEB_API' }],
  });
  const response = await orchestrateSearch(
    baseRequest({ sources: ['SEARXNG', 'WEB_API'] }),
    new Map([['SEARXNG', searxng], ['WEB_API', webApi]]),
  );

  assert.equal(response.status, 'DEGRADED');
  assert.equal(response.results.length, 1);
  assert.equal(response.results[0]?.provider, 'WEB_API');
  assert.deepEqual(
    response.providers.map((provider) => [provider.provider, provider.status]).sort(),
    [['SEARXNG', 'UNAVAILABLE'], ['WEB_API', 'HEALTHY']],
  );
});

test('results mantienen provenance: no se fusiona el provider de un duplicado', async () => {
  const searxng = fakeAdapter('SEARXNG', {
    results: [{ url: 'https://example.com/a', title: 'Primero', snippet: 's1', provider: 'SEARXNG:google cse' }],
  });
  const webApi = fakeAdapter('WEB_API', {
    results: [{ url: 'http://www.example.com/a/', title: 'Duplicado', snippet: 's2', provider: 'WEB_API' }],
  });
  const response = await orchestrateSearch(
    baseRequest({ sources: ['SEARXNG', 'WEB_API'] }),
    new Map([['SEARXNG', searxng], ['WEB_API', webApi]]),
  );

  assert.equal(response.results.length, 1, 'no debe duplicar la URL canonical');
  assert.equal(response.results[0]?.provider, 'SEARXNG:google cse', 'conserva la provenance de la primera ocurrencia, sin fusionar');
  assert.equal(response.results[0]?.rank, 1);
});

test('timeout de una fuente se refleja como issue TIMEOUT sin abortar la búsqueda', async () => {
  const searxng = fakeAdapter('SEARXNG', { results: [], issue: 'TIMEOUT' });
  const response = await orchestrateSearch(baseRequest({ sources: ['SEARXNG'] }), new Map([['SEARXNG', searxng]]));

  assert.equal(response.status, 'UNAVAILABLE');
  assert.equal(response.providers[0]?.issue, 'TIMEOUT');
  assert.deepEqual(response.results, []);
});

test('fuente solicitada sin adapter configurado -> UNAVAILABLE, no lanza', async () => {
  const response = await orchestrateSearch(baseRequest({ sources: ['BROWSER'] }), new Map());
  assert.equal(response.status, 'UNAVAILABLE');
  assert.equal(response.providers[0]?.provider, 'BROWSER');
  assert.equal(response.providers[0]?.issue, 'PROVIDER_DOWN');
});

test('adapter que lanza en vez de devolver un outcome no aborta la búsqueda (defensa adicional)', async () => {
  const searxng: SearchProviderAdapter = { source: 'SEARXNG', search: async () => { throw new Error('boom'); } };
  const response = await orchestrateSearch(baseRequest(), new Map([['SEARXNG', searxng]]));
  assert.equal(response.status, 'UNAVAILABLE');
  assert.equal(response.providers[0]?.issue, 'PROVIDER_DOWN');
});

test('0 resultados en todas las fuentes sin alertas -> HEALTHY (0 resultados saludable)', async () => {
  const searxng = fakeAdapter('SEARXNG', { results: [] });
  const response = await orchestrateSearch(baseRequest(), new Map([['SEARXNG', searxng]]));
  assert.equal(response.status, 'HEALTHY');
  assert.deepEqual(response.results, []);
});

test('trunca a request.limit tras deduplicar y asigna rank secuencial', async () => {
  const many = Array.from({ length: 5 }, (_, index) => ({
    url: `https://example.com/${index}`, title: `T${index}`, snippet: 's', provider: 'SEARXNG',
  }));
  const searxng = fakeAdapter('SEARXNG', { results: many });
  const response = await orchestrateSearch(baseRequest({ limit: 3 }), new Map([['SEARXNG', searxng]]));

  assert.equal(response.results.length, 3);
  assert.deepEqual(response.results.map((result) => result.rank), [1, 2, 3]);
});

test('quota guard con circuito abierto salta la fuente sin invocar el adapter (sin reintentos agresivos)', async () => {
  const guard = new InMemorySourceQuotaGuard({ failureThreshold: 1 });
  const searxng = fakeAdapter('SEARXNG', { results: [], issue: 'PROVIDER_DOWN' });

  await orchestrateSearch(baseRequest(), new Map([['SEARXNG', searxng]]), { quotaGuard: guard });
  assert.equal(searxng.calls, 1);

  const second = await orchestrateSearch(baseRequest(), new Map([['SEARXNG', searxng]]), { quotaGuard: guard });
  assert.equal(searxng.calls, 1, 'el circuito abierto no debe volver a invocar el adapter');
  assert.equal(second.providers[0]?.status, 'UNAVAILABLE');
});

test('respuesta final es válida contra SearchResponseSchema (verificado por orchestrateSearch con .parse)', async () => {
  const searxng = fakeAdapter('SEARXNG', {
    results: [{ url: 'https://example.com/a', title: 'A', snippet: 's', provider: 'SEARXNG:google cse' }],
  });
  const response = await orchestrateSearch(baseRequest(), new Map([['SEARXNG', searxng]]));
  assert.equal(response.version, '1.0');
  assert.equal(response.queryId, '11111111-1111-4111-8111-111111111111');
});
