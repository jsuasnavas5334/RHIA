// PH06-T002 — pieza central: combina los adapters de cada fuente solicitada
// (`request.sources`, ver `SearchRequestSchema` en `@rhia/contracts`) en un
// único `SearchResponse` validado contra el contrato. Errores a evitar
// (Task Packet): "fusionar resultados sin source" (por eso `dedupeResults`
// nunca combina provenance de duplicados) y "retries simultáneos
// agresivos" (por eso aquí solo hay UN intento por fuente por llamada; los
// reintentos entre llamadas separadas los gobierna `SourceQuotaGuard`).

import { SearchRequestSchema, SearchResponseSchema, type SearchRequest, type SearchResponse } from '@rhia/contracts';
import type { ProviderIssue, ProviderSearchOutcome, SearchProviderAdapter, SearchSource } from './adapter.js';
import { dedupeResults } from './dedupe.js';
import { AlwaysAllowQuotaGuard, type SourceQuotaGuard } from './quota.js';

export type OrchestrateSearchOptions = Readonly<{
  /** Circuit breaker por fuente (ver quota.ts). Default: `AlwaysAllowQuotaGuard` (nunca salta ninguna fuente). */
  quotaGuard?: SourceQuotaGuard;
  now?: () => Date;
}>;

type ProviderStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';

const statusFor = (outcome: ProviderSearchOutcome): ProviderStatus => {
  if (outcome.issue === undefined) return 'HEALTHY'; // incluye 0 resultados sin alertas: saludable (PH06-T001).
  return outcome.results.length > 0 ? 'DEGRADED' : 'UNAVAILABLE';
};

const overallStatus = (statuses: readonly ProviderStatus[]): ProviderStatus => {
  if (statuses.every((status) => status === 'UNAVAILABLE')) return 'UNAVAILABLE';
  if (statuses.every((status) => status === 'HEALTHY')) return 'HEALTHY';
  return 'DEGRADED';
};

const UNCONFIGURED_SOURCE_OUTCOME: ProviderSearchOutcome = { results: [], issue: 'PROVIDER_DOWN' };
const SKIPPED_BY_QUOTA_OUTCOME: ProviderSearchOutcome = { results: [], issue: 'PROVIDER_DOWN' };
const ADAPTER_THREW_OUTCOME: ProviderSearchOutcome = { results: [], issue: 'PROVIDER_DOWN' };

/**
 * Ejecuta la búsqueda contra cada fuente de `request.sources`, en el orden
 * dado, sin abortar si alguna falla (fallback implícito: las demás fuentes
 * siguen aportando resultados). Deduplica por URL canónica entre TODAS las
 * fuentes combinadas (no solo dentro de una), asigna `rank` secuencial tras
 * deduplicar y trunca a `request.limit`. Nunca reintenta la misma fuente
 * dentro de esta llamada.
 */
export const orchestrateSearch = async (
  request: SearchRequest,
  adapters: ReadonlyMap<SearchSource, SearchProviderAdapter>,
  options: OrchestrateSearchOptions = {},
): Promise<SearchResponse> => {
  SearchRequestSchema.parse(request);
  const quotaGuard = options.quotaGuard ?? new AlwaysAllowQuotaGuard();
  const now = options.now ?? (() => new Date());

  const providerOutcomes: { source: SearchSource; outcome: ProviderSearchOutcome }[] = [];

  for (const source of request.sources) {
    const adapter = adapters.get(source);

    if (!adapter) {
      providerOutcomes.push({ source, outcome: UNCONFIGURED_SOURCE_OUTCOME });
      continue;
    }

    if (quotaGuard.shouldSkip(source)) {
      providerOutcomes.push({ source, outcome: SKIPPED_BY_QUOTA_OUTCOME });
      continue; // circuito abierto: ni se intenta, no cuenta como un nuevo fallo consecutivo.
    }

    let outcome: ProviderSearchOutcome;
    try {
      outcome = await adapter.search(request.query, { limit: request.limit });
    } catch {
      // Defensa adicional: un adapter conforme al contrato no debería lanzar, pero si lo hace no debe abortar las demás fuentes.
      outcome = ADAPTER_THREW_OUTCOME;
    }

    quotaGuard.recordOutcome(source, statusFor(outcome) === 'UNAVAILABLE' ? 'FAILURE' : 'SUCCESS');
    providerOutcomes.push({ source, outcome });
  }

  const combinedRawResults = providerOutcomes.flatMap(({ outcome }) => outcome.results);
  const deduped = dedupeResults(combinedRawResults).slice(0, request.limit);
  const results = deduped.map((result, index) => ({ ...result, rank: index + 1 }));

  const providers = providerOutcomes.map(({ source, outcome }): SearchResponse['providers'][number] => {
    const status = statusFor(outcome);
    const issue: ProviderIssue | undefined = outcome.issue;
    return issue === undefined ? { provider: source, status } : { provider: source, status, issue };
  });

  const response: SearchResponse = {
    version: '1.0',
    queryId: request.queryId,
    correlationId: request.correlationId,
    status: overallStatus(providers.map((provider) => provider.status)),
    completedAt: now().toISOString(),
    results,
    providers,
  };

  return SearchResponseSchema.parse(response);
};
