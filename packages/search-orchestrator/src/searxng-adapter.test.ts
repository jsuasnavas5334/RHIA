import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createSearxngAdapter, parseSearxngPayload } from './searxng-adapter.js';

const fixturePath = fileURLToPath(new URL(
  '../../../tests/fixtures/searxng/empresa_x_busqueda_degradada.json',
  import.meta.url,
));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as readonly Record<string, unknown>[];

test('parseSearxngPayload: 0 resultados sin motores en alerta -> saludable (sin issue)', () => {
  const outcome = parseSearxngPayload({ query: 'q', results: [], unresponsive_engines: [] }, 10);
  assert.deepEqual(outcome, { results: [] });
});

test('parseSearxngPayload: payload malformado (sin results[]) -> PARSE_ERROR', () => {
  assert.deepEqual(parseSearxngPayload({ query: 'q' }, 10), { results: [], issue: 'PARSE_ERROR' });
  assert.deepEqual(parseSearxngPayload(null, 10), { results: [], issue: 'PARSE_ERROR' });
  assert.deepEqual(parseSearxngPayload('no es json', 10), { results: [], issue: 'PARSE_ERROR' });
});

test('parseSearxngPayload: fixture real "Empresa X" con resultados + motores en alerta -> DEGRADADA con provenance por engine', () => {
  const [caso] = fixture; // results=20, unresponsive=[brave RATE_LIMIT, duckduckgo CAPTCHA, startpage CAPTCHA]
  assert.ok(caso);
  const outcome = parseSearxngPayload(caso, 50);

  assert.equal(outcome.results.length, 20);
  assert.equal(outcome.issue, 'CAPTCHA', 'CAPTCHA es más severo que RATE_LIMIT entre los motores en alerta');
  assert.equal(outcome.results[0]?.provider, 'SEARXNG:google cse');
  assert.equal(outcome.results[0]?.snippet, (caso['results'] as Record<string, unknown>[])[0]?.['content']);
  assert.ok(outcome.results.every((result) => result.url.startsWith('http')));
});

test('parseSearxngPayload: fixture real sin resultados y con 4 motores en alerta -> UNAVAILABLE (results vacío + issue)', () => {
  const caso = fixture[1]; // results=0, unresponsive=[brave RATE_LIMIT, duckduckgo CAPTCHA, google cse RATE_LIMIT, startpage CAPTCHA]
  assert.ok(caso);
  const outcome = parseSearxngPayload(caso, 50);
  assert.deepEqual(outcome.results, []);
  assert.equal(outcome.issue, 'CAPTCHA');
});

test('parseSearxngPayload: respeta el límite solicitado', () => {
  const [caso] = fixture;
  const outcome = parseSearxngPayload(caso, 5);
  assert.equal(outcome.results.length, 5);
});

test('parseSearxngPayload: descarta entradas sin url http(s) válida o sin título, sin abortar el resto', () => {
  const outcome = parseSearxngPayload({
    query: 'q',
    unresponsive_engines: [],
    results: [
      { url: 'https://example.com/ok', title: 'Válido', content: 'contenido' },
      { url: 'javascript:alert(1)', title: 'URL peligrosa/no-http' },
      { url: 'https://example.com/sin-titulo', title: '' },
      { title: 'Sin URL' },
    ],
  }, 10);
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0]?.url, 'https://example.com/ok');
});

test('createSearxngAdapter: transporte exitoso delega en parseSearxngPayload', async () => {
  const adapter = createSearxngAdapter({ transport: async () => ({ query: 'q', results: [], unresponsive_engines: [] }) });
  assert.equal(adapter.source, 'SEARXNG');
  const outcome = await adapter.search('q', { limit: 10 });
  assert.deepEqual(outcome, { results: [] });
});

test('createSearxngAdapter: transporte que lanza AbortError -> issue TIMEOUT, no propaga la excepción', async () => {
  const adapter = createSearxngAdapter({
    transport: async () => { const error = new Error('aborted'); error.name = 'AbortError'; throw error; },
  });
  const outcome = await adapter.search('q', { limit: 10 });
  assert.deepEqual(outcome, { results: [], issue: 'TIMEOUT' });
});

test('createSearxngAdapter: transporte que lanza un error genérico -> issue PROVIDER_DOWN, no propaga la excepción', async () => {
  const adapter = createSearxngAdapter({ transport: async () => { throw new Error('ECONNREFUSED'); } });
  const outcome = await adapter.search('q', { limit: 10 });
  assert.deepEqual(outcome, { results: [], issue: 'PROVIDER_DOWN' });
});
