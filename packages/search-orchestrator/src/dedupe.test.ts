import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeUrl, dedupeResults } from './dedupe.js';

test('canonicalizeUrl: ignora protocolo, www., slash final, orden de query y fragmento', () => {
  const a = canonicalizeUrl('http://www.Example.com/pagina/?b=2&a=1#seccion');
  const b = canonicalizeUrl('https://example.com/pagina?a=1&b=2');
  assert.equal(a, b);
});

test('canonicalizeUrl: rutas distintas no colapsan', () => {
  assert.notEqual(canonicalizeUrl('https://example.com/a'), canonicalizeUrl('https://example.com/b'));
});

test('canonicalizeUrl: URL no parseable devuelve el texto recortado sin lanzar', () => {
  assert.equal(canonicalizeUrl('  no-es-una-url  '), 'no-es-una-url');
});

test('dedupeResults: conserva la primera ocurrencia y su provenance, sin fusionar', () => {
  const deduped = dedupeResults([
    { url: 'https://example.com/a', title: 'Primero', snippet: 's1', provider: 'SEARXNG:google cse' },
    { url: 'http://www.example.com/a/', title: 'Duplicado', snippet: 's2', provider: 'SEARXNG:duckduckgo' },
    { url: 'https://example.com/b', title: 'Otro', snippet: 's3', provider: 'SEARXNG:google cse' },
  ]);

  assert.equal(deduped.length, 2);
  assert.equal(deduped[0]?.title, 'Primero');
  assert.equal(deduped[0]?.provider, 'SEARXNG:google cse');
  assert.equal(deduped[1]?.url, 'https://example.com/b');
});

test('dedupeResults: lista vacía devuelve lista vacía', () => {
  assert.deepEqual(dedupeResults([]), []);
});
