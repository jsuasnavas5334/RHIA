// PH06-T002, acción 1 ("Crear adapter interface"): contrato común que
// cualquier fuente de búsqueda (SEARXNG hoy; WEB_API/BROWSER a futuro, ver
// `SearchRequestSchema.sources` en @rhia/contracts) debe implementar para
// que `orchestrateSearch` (orchestrator.ts) pueda combinarlas sin conocer
// los detalles de transporte de cada una.

/** Mismo vocabulario de `issue` que `SearchResponseSchema` (@rhia/contracts). */
export type ProviderIssue = 'RATE_LIMIT' | 'CAPTCHA' | 'TIMEOUT' | 'PROVIDER_DOWN' | 'PARSE_ERROR';

/** Resultado crudo de un adapter, ya en forma cercana al contrato final (falta `rank`, que asigna el orchestrator tras deduplicar). */
export type ProviderRawResult = Readonly<{
  url: string;
  title: string;
  snippet: string;
  /** Provenance de este resultado en particular. Puede ser más específico que `source` (p. ej. `SEARXNG:google cse`) — ver searxng-adapter.ts. */
  provider: string;
}>;

/**
 * Salida de un adapter para una búsqueda. `issue` presente + `results`
 * vacío -> la fuente no aportó nada (candidata a `UNAVAILABLE`). `issue`
 * presente + `results` no vacío -> aportó parcialmente (candidata a
 * `DEGRADED`: por ejemplo, algunos motores internos de SEARXNG fallaron
 * pero otros sí respondieron). Sin `issue` -> la fuente respondió sin
 * problemas, incluso si `results` está vacío (0 resultados saludable, no es
 * lo mismo que "la fuente está caída" — mismo principio ya establecido en
 * PH06-T001).
 */
export type ProviderSearchOutcome = Readonly<{
  results: readonly ProviderRawResult[];
  issue?: ProviderIssue;
}>;

export type SearchSource = 'SEARXNG' | 'WEB_API' | 'BROWSER';

export interface SearchProviderAdapter {
  readonly source: SearchSource;
  /** Un único intento; nunca reintenta internamente (los reintentos entre búsquedas los gobierna `SourceQuotaGuard`, no el adapter). No debería lanzar — errores de transporte deben resolverse a un `ProviderSearchOutcome` con `issue`; `orchestrateSearch` igual atrapa cualquier excepción como defensa adicional. */
  search(query: string, options: Readonly<{ limit: number }>): Promise<ProviderSearchOutcome>;
}
