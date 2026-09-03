// PH06-T002, acción 2 ("Implementar SearXNG adapter"). Transporte
// inyectable (mismo patrón que los adapters del AI Gateway, PH05-T002):
// este módulo nunca hace `fetch` real ni conoce la URL/host de SearXNG,
// solo sabe interpretar la forma de su respuesta JSON — la llamada HTTP
// real la provee quien instancie el adapter (apps/core-api o
// apps/agent-runtime), fuera de este paquete puro.
//
// La forma de la respuesta cruda de SearXNG está confirmada contra
// `tests/fixtures/searxng/empresa_x_busqueda_degradada.json` y contra el
// nodo n8n `Buscar evidencia entidad` / `Diagnosticar salud búsqueda`
// (`docs/baseline/n8n/workflows/KV6AIXyIPWKSaTAp.json`): raíz
// `{query, results:[...], unresponsive_engines:[...]}`, cada resultado
// `{title, content, url, engine, engines:[...], ...}` — nótese `content`
// (no `snippet`) y `engine` (no `provider`); este adapter hace esa
// traducción hacia el contrato `SearchResponseSchema` de `@rhia/contracts`.

import { classifySearchEngineFailure, normalizeUnresponsiveEngines, type SearchEngineFailureType } from '@rhia/search-health';
import type { ProviderIssue, ProviderRawResult, ProviderSearchOutcome, SearchProviderAdapter } from './adapter.js';

/** Provee el JSON crudo ya parseado (o lanza) — quien lo implemente decide timeout, headers, host, etc. */
export type SearxngTransport = (query: string, limit: number) => Promise<unknown>;

export type SearxngAdapterOptions = Readonly<{ transport: SearxngTransport }>;

const SNIPPET_MAX_LENGTH = 2000; // SearchResponseSchema.results[].snippet
const TITLE_MAX_LENGTH = 500; // SearchResponseSchema.results[].title

const FAILURE_TO_ISSUE: Record<SearchEngineFailureType, ProviderIssue> = {
  CAPTCHA: 'CAPTCHA',
  RATE_LIMIT: 'RATE_LIMIT',
  TIMEOUT: 'TIMEOUT',
  SUSPENDIDO: 'PROVIDER_DOWN',
  CAIDO: 'PROVIDER_DOWN',
  DESCONOCIDO: 'PROVIDER_DOWN',
};

// De más a menos severo, para elegir un único `issue` representativo cuando varios motores fallan a la vez.
const SEVERITY_ORDER: readonly SearchEngineFailureType[] = ['CAPTCHA', 'SUSPENDIDO', 'CAIDO', 'RATE_LIMIT', 'TIMEOUT', 'DESCONOCIDO'];

const mostSevereIssue = (tipos: readonly SearchEngineFailureType[]): ProviderIssue => {
  for (const candidate of SEVERITY_ORDER) {
    if (tipos.includes(candidate)) return FAILURE_TO_ISSUE[candidate];
  }
  return 'PROVIDER_DOWN';
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const truncate = (value: string, maxLength: number): string => (value.length > maxLength ? value.slice(0, maxLength) : value);

const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const mapRawResult = (entry: unknown): ProviderRawResult | null => {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Record<string, unknown>;
  const url = record['url'];
  const title = record['title'];
  if (!isNonEmptyString(url) || !isValidHttpUrl(url) || !isNonEmptyString(title)) return null;

  const content = isNonEmptyString(record['content']) ? record['content'] : '';
  const engine = isNonEmptyString(record['engine']) ? record['engine'] : null;

  return {
    url,
    title: truncate(title, TITLE_MAX_LENGTH),
    snippet: truncate(content, SNIPPET_MAX_LENGTH),
    provider: engine ? `SEARXNG:${engine}` : 'SEARXNG',
  };
};

/** Interpreta el payload crudo de SearXNG ya parseado (JSON.parse del body). Exportado para poder probarse directo contra fixtures reales sin pasar por el transporte. */
export const parseSearxngPayload = (raw: unknown, limit: number): ProviderSearchOutcome => {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>)['results'])) {
    return { results: [], issue: 'PARSE_ERROR' };
  }

  const record = raw as Record<string, unknown>;
  const rawResults = record['results'] as unknown[];
  const results = rawResults
    .map((entry) => mapRawResult(entry))
    .filter((value): value is ProviderRawResult => value !== null)
    .slice(0, limit);

  const unresponsive = normalizeUnresponsiveEngines(record['unresponsive_engines']);

  if (unresponsive.length === 0) {
    return { results }; // sin motores en alerta: saludable, incluso con 0 resultados (PH06-T001).
  }

  return { results, issue: mostSevereIssue(unresponsive.map((entry) => entry.tipo)) };
};

const classifyTransportError = (error: unknown): ProviderIssue => {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (name === 'AbortError' || message.includes('timeout') || message.includes('timed out')) return 'TIMEOUT';
  return 'PROVIDER_DOWN';
};

/**
 * Adapter real de SEARXNG. `options.transport` hace la llamada HTTP real
 * (fuera de este paquete puro) y devuelve el body ya parseado como JSON —
 * este adapter nunca sabe el host/puerto de SearXNG ni cómo se hace la
 * petición, solo interpreta la forma de la respuesta.
 */
export const createSearxngAdapter = (options: SearxngAdapterOptions): SearchProviderAdapter => ({
  source: 'SEARXNG',
  async search(query, { limit }) {
    let raw: unknown;
    try {
      raw = await options.transport(query, limit);
    } catch (error) {
      return { results: [], issue: classifyTransportError(error) };
    }
    try {
      return parseSearxngPayload(raw, limit);
    } catch {
      return { results: [], issue: 'PARSE_ERROR' };
    }
  },
});
