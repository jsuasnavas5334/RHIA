export type { ProviderIssue, ProviderRawResult, ProviderSearchOutcome, SearchProviderAdapter, SearchSource } from './adapter.js';
export { canonicalizeUrl, dedupeResults, type DedupableResult } from './dedupe.js';
export { orchestrateSearch, type OrchestrateSearchOptions } from './orchestrator.js';
export {
  AlwaysAllowQuotaGuard, InMemorySourceQuotaGuard,
  type QuotaGuardOptions, type SourceOutcome, type SourceQuotaGuard,
} from './quota.js';
export { createSearxngAdapter, parseSearxngPayload, type SearxngAdapterOptions, type SearxngTransport } from './searxng-adapter.js';
